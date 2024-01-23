use std::{collections::HashMap, fs::OpenOptions, io::Write, path::Path, vec};

use coingecko::{response::coins::CoinsMarketItem, CoinGeckoClient};

use crate::types::CoinWithPrice;

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

    fn get_usdt_id() -> String {
        "tether".to_string()
    }

    // if multi coins with same symbol, will return all of them in result
    async fn list_all_coin_ids(
        &self,
        symbols: Vec<String>,
        filter_duplicate: Option<fn(Vec<CoinGeckoCoin>) -> CoinGeckoCoin>,
    ) -> Result<Vec<CoinGeckoCoin>, Box<dyn std::error::Error>> {
        let coins = self.client.coins_list(false).await?;
        // key: symbol
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
        let mut usdt_in = false;
        for (s, coins) in coins_map {
            if s == "USDT" {
                usdt_in = true;
                continue;
            }
            if coins.len() > 1 {
                if filter_duplicate != None {
                    let filter_duplicate = filter_duplicate.unwrap();
                    res.push(filter_duplicate(coins));
                } else {
                    res.append(&mut coins.clone());
                }
            } else {
                res.push(coins[0].clone());
            }
        }

        // hard fix usdt id
        if usdt_in {
            res.push(CoinGeckoCoin {
                id: CoinGecko::get_usdt_id(),
                symbol: "USDT".to_string(),
            });
        }
        return Ok(res);
    }

    pub async fn query_coins_prices(
        &self,
        symbols: Vec<String>,
    ) -> Result<HashMap<String, f64>, Box<dyn std::error::Error>> {
        let filter_duplicate = |coins: Vec<CoinGeckoCoin>| -> CoinGeckoCoin {
            if let Some(coin) = coins.iter().find(|c| c.id.to_uppercase() == c.symbol) {
                coin.clone()
            } else {
                coins[0].clone()
            }
        };
        let all_coins = self
            .list_all_coin_ids(symbols, Some(filter_duplicate))
            .await?;

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
        coins: Vec<CoinWithPrice>,
        base_dir: String,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut paths = vec![base_dir.clone()];
        paths.push("assets".to_string());
        paths.push("coins".to_string());
        let path_str = paths.join("/");
        let download_dir = Path::new(path_str.as_str());
        // mkdir download_dr if not exists
        if !download_dir.exists() {
            std::fs::create_dir_all(download_dir)?;
        }

        let non_exists_symbols = coins
            .iter()
            .map(|c| c.symbol.clone())
            .filter(|s| {
                let path = download_dir.clone();
                let asset_path = path.join(format!("{}.png", s.to_lowercase()));
                !asset_path.exists()
            })
            .collect::<Vec<String>>();

        let invalid_asset_icon_record_file_path =
            download_dir.join("invalid_asset_icon_record.txt");

        // if non_exists_symbols in invalid_asset_icon_record_file_path, filter it
        let non_exists_symbols = if invalid_asset_icon_record_file_path.exists() {
            let invalid_asset_icon_record_file_content =
                std::fs::read_to_string(invalid_asset_icon_record_file_path.clone())?;
            let invalid_asset_icon_record_file_content = invalid_asset_icon_record_file_content
                .split("\n")
                .map(|s| s.to_string())
                .collect::<Vec<String>>();
            non_exists_symbols
                .into_iter()
                .filter(|s| !invalid_asset_icon_record_file_content.contains(s))
                .collect::<Vec<String>>()
        } else {
            non_exists_symbols
        };

        if non_exists_symbols.len() == 0 {
            return Ok(());
        }
        println!("non_exists_symbols: {:?}", non_exists_symbols);
        // need to filter coins with same symbol
        let mut all_coins = self
            .list_all_coin_ids(non_exists_symbols.clone(), None)
            .await?;

        // check if there are coins with same symbol
        let dup_symbol_coins = all_coins
            .iter()
            .fold(HashMap::new(), |mut acc, coin| {
                acc.entry(coin.symbol.clone())
                    .or_insert(vec![])
                    .push(coin.clone());
                acc
            })
            .iter()
            .filter(|(_, coins)| coins.len() > 1)
            .map(|(_, coins)| coins.clone())
            .flatten()
            .collect::<Vec<_>>();

        if dup_symbol_coins.len() > 0 {
            let dup_coin_symbols = dup_symbol_coins
                .iter()
                .map(|c| c.symbol.clone())
                .collect::<Vec<String>>();
            // remove dup_symbol_coins from all_coins
            all_coins = all_coins
                .into_iter()
                .filter(|c| !dup_coin_symbols.contains(&c.symbol))
                .collect::<Vec<_>>();

            let dup_coin_ids = dup_symbol_coins
                .iter()
                .map(|c| c.id.clone())
                .collect::<Vec<_>>();
            let dup_coin_prices = self
                .client
                .price(&dup_coin_ids, &["usd"], false, false, false, false)
                .await?;
            // find the coin with closest price
            for s in dup_coin_symbols {
                let coin_with_same_symbol = dup_symbol_coins
                    .iter()
                    .filter(|c| c.symbol == s)
                    .collect::<Vec<_>>();
                let coin = coins.iter().find(|c| c.symbol == s);
                if let None = coin {
                    continue;
                }
                let want_price = coin.unwrap().price;
                let mut closest = coin_with_same_symbol[0].clone();
                for coin in coin_with_same_symbol {
                    if let Some(price) = dup_coin_prices.get(&coin.id) {
                        let closest_price = dup_coin_prices.get(&closest.id);
                        if let Some(closest_price) = closest_price {
                            if let Some(closest_price) = closest_price.usd {
                                if let Some(price) = price.usd {
                                    if (want_price - price).abs()
                                        < (want_price - closest_price).abs()
                                    {
                                        closest = coin.clone();
                                    }
                                }
                            }
                        }
                    }
                }

                all_coins.push(closest);
            }
        }

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
            let _ = self
                .download_coin_logo(download_dir.clone(), m.clone())
                .await;
        }

        if markets_size >= page_size {
            // full load

            // check if file is not exists for each symbol
            // if not exists, make an empty file

            for symbol in non_exists_symbols {
                let path = download_dir.clone();
                let asset_path = path.join(format!("{}.png", symbol.to_lowercase()));
                if !asset_path.exists() {
                    let mut file = OpenOptions::new()
                        .create(true)
                        .write(true)
                        .append(true)
                        .open(invalid_asset_icon_record_file_path.clone())?;
                    // append to invalid asset icon record file
                    file.write_all(format!("{}\n", symbol).as_bytes())?;
                }
            }
        }
        Ok(())
    }

    async fn download_coin_logo(
        &self,
        download_dir: &Path,
        m: CoinsMarketItem,
    ) -> Result<(), Box<dyn std::error::Error>> {
        println!("downloading coin logo: {:?}", m.image);
        let mut res = reqwest::get(m.image).await;
        if let Err(_) = res {
            println!("fallback to download coin logo from github: {:?}", m.symbol);
            let url = format!(
                "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/{}.png",
                m.symbol.to_lowercase()
            );
            res = reqwest::get(url).await;
        }
        let logo = res?.bytes().await?;

        std::fs::write(
            download_dir.join(format!("{}.png", m.symbol.to_lowercase())),
            logo,
        )?;
        Ok(())
    }
}
