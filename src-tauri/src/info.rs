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

fn map_coin_prices(
    coins: &[CoinGeckoCoin],
    mut get_price: impl FnMut(&str) -> Option<f64>,
) -> HashMap<String, f64> {
    coins
        .iter()
        .filter_map(|coin| get_price(&coin.id).map(|price| (coin.symbol.clone(), price)))
        .collect()
}

pub fn validate_coin_prices(prices: HashMap<String, f64>) -> Result<HashMap<String, f64>, String> {
    if prices.is_empty() || prices.values().all(|price| *price == 0.0) {
        return Err("get coin prices failed: all prices are 0".to_string());
    }
    Ok(prices)
}

fn redact_value_after_marker(input: &str, marker: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut remaining = input;

    while let Some(index) = remaining.find(marker) {
        output.push_str(&remaining[..index]);
        output.push_str(marker);
        output.push_str("<REDACTED>");

        let value = &remaining[index + marker.len()..];
        let value_end = value
            .find(|character: char| {
                character.is_whitespace() || matches!(character, '&' | ',' | ';' | '"' | '\'' | '}')
            })
            .unwrap_or(value.len());
        remaining = &value[value_end..];
    }

    output.push_str(remaining);
    output
}

pub fn sanitize_upstream_error(message: &str) -> String {
    [
        "signature=",
        "Signature=",
        "apiKey=",
        "api_key=",
        "apiSecret=",
        "api_secret=",
        "secret=",
        "timestamp=",
        "recvWindow=",
        "token=",
        "authorization=",
    ]
    .iter()
    .fold(message.to_string(), |sanitized, marker| {
        redact_value_after_marker(&sanitized, marker)
    })
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
    fn get_btc_id() -> String {
        "bitcoin".to_string()
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
        let mut btc_in = false;
        for (s, coins) in coins_map {
            if s == "USDT" {
                usdt_in = true;
                continue;
            }
            if s == "BTC" {
                btc_in = true;
                continue;
            }
            if coins.len() > 1 {
                if let Some(filter_duplicate) = filter_duplicate {
                    res.push(filter_duplicate(coins));
                } else {
                    res.append(&mut coins.clone());
                }
            } else {
                res.push(coins[0].clone());
            }
        }

        // hard fix usdt and btc id
        if usdt_in {
            res.push(CoinGeckoCoin {
                id: CoinGecko::get_usdt_id(),
                symbol: "USDT".to_string(),
            });
        }
        if btc_in {
            res.push(CoinGeckoCoin {
                id: CoinGecko::get_btc_id(),
                symbol: "BTC".to_string(),
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

        let res = map_coin_prices(&all_coins, |id| {
            all_prices.get(id).and_then(|price| price.usd)
        });

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
                let asset_path = download_dir.join(format!("{}.png", s.to_lowercase()));
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
            let _ = self.download_coin_logo(download_dir, m.clone()).await;
        }

        if markets_size >= page_size {
            // full load

            // check if file is not exists for each symbol
            // if not exists, make an empty file

            for symbol in non_exists_symbols {
                let asset_path = download_dir.join(format!("{}.png", symbol.to_lowercase()));
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct FixturePrice {
        usd: Option<f64>,
    }

    #[test]
    fn maps_price_fixture_by_coin_id_and_omits_missing_prices() {
        let fixture: HashMap<String, FixturePrice> = serde_json::from_str(
            r#"{
                "bitcoin": {"usd": 65000.0},
                "ethereum": {"usd": 3500.0},
                "missing": {}
            }"#,
        )
        .unwrap();
        let coins = vec![
            CoinGeckoCoin {
                id: "bitcoin".to_string(),
                symbol: "BTC".to_string(),
            },
            CoinGeckoCoin {
                id: "ethereum".to_string(),
                symbol: "ETH".to_string(),
            },
            CoinGeckoCoin {
                id: "missing".to_string(),
                symbol: "MISS".to_string(),
            },
        ];

        let prices = map_coin_prices(&coins, |id| fixture.get(id).and_then(|price| price.usd));

        assert_eq!(prices.get("BTC"), Some(&65000.0));
        assert_eq!(prices.get("ETH"), Some(&3500.0));
        assert!(!prices.contains_key("MISS"));
    }

    #[test]
    fn rejects_empty_and_all_zero_price_maps() {
        let empty_error = validate_coin_prices(HashMap::new()).unwrap_err();
        assert_eq!(empty_error, "get coin prices failed: all prices are 0");

        let zero_error =
            validate_coin_prices(HashMap::from([("BTC".to_string(), 0.0)])).unwrap_err();
        assert_eq!(zero_error, "get coin prices failed: all prices are 0");

        let prices = HashMap::from([("BTC".to_string(), 65000.0), ("USDT".to_string(), 0.0)]);
        assert_eq!(validate_coin_prices(prices.clone()).unwrap(), prices);
    }

    #[test]
    fn redacts_sensitive_upstream_error_values_without_leaving_suffixes() {
        let message = sanitize_upstream_error(
            "request failed?api_key=public-key&signature=signed-value \
             secret=private-secret apiSecret=another-secret timestamp=1700000000",
        );

        assert!(message.contains("api_key=<REDACTED>"));
        assert!(message.contains("signature=<REDACTED>"));
        assert!(message.contains("secret=<REDACTED>"));
        assert!(message.contains("apiSecret=<REDACTED>"));
        assert!(!message.contains("public-key"));
        assert!(!message.contains("signed-value"));
        assert!(!message.contains("private-secret"));
        assert!(!message.contains("another-secret"));
        assert!(!message.contains("1700000000"));
    }
}
