use std::{collections::HashMap, vec};

use coingecko::CoinGeckoClient;

pub fn get_price_querier() -> CoinGecko {
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
}
