use std::{collections::HashMap, vec};

use coingecko::{
    CoinGeckoClient,
};

pub fn get_coin_info_provider() -> CoinGecko {
    CoinGecko::new()
}

pub struct CoinGecko {
    client: CoinGeckoClient,
}

#[derive(Debug, Clone)]
struct CoinGeckoCoin {
    id: String,
    symbol: String,
}

// to return infos of currencies
impl CoinGecko {
    pub fn new() -> CoinGecko {
        let client = CoinGeckoClient::default();

        CoinGecko { client }
    }

    async fn list_all_coin_ids(
        &self,
        symbols: Vec<String>,
    ) -> Result<Vec<CoinGeckoCoin>, Box<dyn std::error::Error>> {
        let coins = self.client.coins_list(false).await?;
        let coins_map = coins
            .iter()
            .filter(|c| symbols.contains(&c.symbol.to_uppercase()))
            .map(|c| CoinGeckoCoin {
                id: c.id.clone(),
                symbol: c.symbol.to_uppercase(),
            })
            .fold(HashMap::new(), |mut acc, coin| {
                acc.entry(coin.symbol.clone()).or_insert(vec![]).push(coin);
                acc
            });

        let mut res = vec![];
        for (_, coins) in coins_map {
            if coins.len() > 1 {
                if let Some(coin) = coins.iter().find(|c| c.id.to_uppercase() == c.symbol) {
                    res.push(coin.clone());
                } else {
                    res.push(coins[0].clone());
                }
            } else {
                res.push(coins[0].clone());
            }
        }
        return Ok(res);
    }

    pub async fn query_coins_prices(
        &self,
        symbols: Vec<String>,
    ) -> Result<HashMap<String, f64>, Box<dyn std::error::Error>> {
        let all_coins = self.list_all_coin_ids(symbols).await?;
        // todo: if there are multi coins with same symbol, we should find by tokenAddress
        let all_ids = all_coins.iter().map(|c| &c.id).collect::<Vec<_>>();
        let all_prices = self
            .client
            .price(&all_ids, &["usd"], false, false, false, false)
            .await?;

        let mut res = HashMap::new();

        for coin in all_coins {
            if let Some(price) = all_prices.get(&coin.id) {
                if let Some(price) = price.usd {
                    res.insert(coin.symbol, price);
                }
            }
        }

        return Ok(res);
    }

    pub async fn download_coins_logos(
        &self,
        symbols: Vec<String>,
        base_dir: String,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut paths = vec![base_dir.clone()];
        paths.push("assets".to_string());
        paths.push("coins".to_string());
        let path_str = paths.join("/");
        let download_dir = std::path::Path::new(path_str.as_str());
        // mkdir download_dr if not exists
        if !download_dir.exists() {
            std::fs::create_dir_all(download_dir)?;
        }

        let non_exists_symbols = symbols.into_iter().filter(|s| {
            let path = download_dir.clone();
            let asset_path = path.join(format!("{}.png", s.to_lowercase()));
            !asset_path.exists()
        }).collect::<Vec<String>>();

        println!("non_exists_symbols: {:?}", non_exists_symbols);

        if non_exists_symbols.len() == 0 {
            return Ok(());
        }

        let all_coins = self.list_all_coin_ids(non_exists_symbols.clone()).await?;
        // key: symbol, value: id
        let non_exists_ids = all_coins
            .iter()
            .map(|c| c.id.clone())
            .collect::<Vec<String>>();

        let page_size = std::cmp::min(non_exists_ids.len(), 250) as i64;

        let markets = self
            .client
            .coins_markets(
                "usd",
                &non_exists_ids,
                None,
                coingecko::params::MarketsOrder::MarketCapDesc,
                page_size,
                1,
                false,
                &[],
            )
            .await?;

        let markets_size = markets.len() as i64;

        for m in markets {
            println!("downloading coin logo: {:?}", m.image);
            let logo = reqwest::get(m.image).await?.bytes().await?;

            std::fs::write(download_dir.join(format!("{}.png", m.symbol.to_lowercase())), logo)?;
        }

        if markets_size >= page_size {
            // full load

            // check if file is not exists for each symbol
            // if not exists, make an empty file

            for symbol in non_exists_symbols {
                let path = download_dir.clone();
                let asset_path = path.join(format!("{}.png", symbol.to_lowercase()));
                if !asset_path.exists() {
                    std::fs::write(asset_path, "")?;
                }
            }
        }
        Ok(())
    }
}
