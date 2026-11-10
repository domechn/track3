use std::{
    collections::{BTreeMap, HashMap},
    io::{Error, ErrorKind},
    vec,
};

use coingecko::CoinGeckoClient;

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

const MAX_PRICE_CANDIDATES_PER_SYMBOL: usize = 25;
const MAX_PRICE_IDS_LENGTH: usize = 1800;

fn select_price_coin<'a>(
    candidates: &'a [CoinGeckoCoin],
    caps: &HashMap<String, f64>,
) -> &'a CoinGeckoCoin {
    candidates
        .iter()
        .max_by(|left, right| {
            let cap = |coin: &CoinGeckoCoin| {
                caps.get(&coin.id)
                    .copied()
                    .filter(|cap| cap.is_finite() && *cap > 0.0)
                    .unwrap_or(0.0)
            };
            let exact = |coin: &CoinGeckoCoin| coin.id.eq_ignore_ascii_case(&coin.symbol);
            exact(left)
                .cmp(&exact(right))
                .then_with(|| cap(left).total_cmp(&cap(right)))
                .then_with(|| right.id.cmp(&left.id))
        })
        .expect("coin group is nonempty")
}

fn limit_price_candidates(mut coins: Vec<CoinGeckoCoin>) -> Vec<CoinGeckoCoin> {
    coins.sort_by(|left, right| left.id.cmp(&right.id));
    if let Some(exact) = coins
        .iter()
        .position(|coin| coin.id.eq_ignore_ascii_case(&coin.symbol))
    {
        return vec![coins.remove(exact)];
    }
    coins.truncate(MAX_PRICE_CANDIDATES_PER_SYMBOL);
    coins
}

fn price_id_batches(ids: &[String]) -> Result<Vec<Vec<&str>>, Error> {
    let mut batches = vec![];
    let mut batch = vec![];
    let mut length = 0;
    for id in ids {
        if id.len() > MAX_PRICE_IDS_LENGTH {
            return Err(Error::new(
                ErrorKind::InvalidData,
                "CoinGecko coin ID exceeds price URL budget",
            ));
        }
        let added = id.len() + if batch.is_empty() { 0 } else { 3 }; // "%2C"
        if length + added > MAX_PRICE_IDS_LENGTH {
            batches.push(batch);
            batch = vec![];
            length = 0;
        }
        length += id.len() + if batch.is_empty() { 0 } else { 3 };
        batch.push(id.as_str());
    }
    if !batch.is_empty() {
        batches.push(batch);
    }
    Ok(batches)
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
        let mut ton_in = false;
        for (s, coins) in coins_map {
            if s == "USDT" {
                usdt_in = true;
                continue;
            }
            if s == "BTC" {
                btc_in = true;
                continue;
            }
            if s == "TON" {
                ton_in = true;
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

        // Use canonical IDs for symbols with ambiguous or outdated CoinGecko listings.
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
        if ton_in {
            res.push(CoinGeckoCoin {
                id: "the-open-network".to_string(),
                symbol: "TON".to_string(),
            });
        }
        return Ok(res);
    }

    pub async fn query_coins_prices(
        &self,
        symbols: Vec<String>,
    ) -> Result<HashMap<String, f64>, Box<dyn std::error::Error>> {
        let all_coins = self.list_all_coin_ids(symbols, None).await?;
        let mut groups = BTreeMap::<String, Vec<CoinGeckoCoin>>::new();
        for coin in all_coins {
            groups.entry(coin.symbol.clone()).or_default().push(coin);
        }
        let groups = groups
            .into_values()
            .map(limit_price_candidates)
            .collect::<Vec<_>>();

        // todo: if there are multi coins with same symbol, we should find by tokenAddress
        let all_ids = groups
            .iter()
            .flat_map(|coins| coins.iter().map(|coin| coin.id.clone()))
            .collect::<Vec<_>>();
        let mut all_prices = HashMap::new();
        for batch in price_id_batches(&all_ids)? {
            all_prices.extend(
                self.client
                    .price(&batch, &["usd"], true, false, false, false)
                    .await?,
            );
        }
        let caps = all_prices
            .iter()
            .filter_map(|(id, price)| price.usd_market_cap.map(|cap| (id.clone(), cap)))
            .collect();
        let selected = groups
            .iter()
            .map(|coins| select_price_coin(coins, &caps).clone())
            .collect::<Vec<_>>();
        let res = map_coin_prices(&selected, |id| {
            all_prices.get(id).and_then(|price| price.usd)
        });

        return Ok(res);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use coingecko::response::simple::Price;

    fn candidate(id: &str) -> CoinGeckoCoin {
        CoinGeckoCoin {
            id: id.to_string(),
            symbol: "DUP".to_string(),
        }
    }

    #[test]
    fn exact_symbol_id_wins_even_with_a_smaller_market_cap() {
        let coins = vec![candidate("large"), candidate("dup")];
        let caps = HashMap::from([("large".to_string(), 100.0), ("dup".to_string(), 1.0)]);

        assert_eq!(select_price_coin(&coins, &caps).id, "dup");
        assert_eq!(
            select_price_coin(&[coins[1].clone(), coins[0].clone()], &caps).id,
            "dup"
        );
    }

    #[test]
    fn largest_valid_market_cap_wins_regardless_of_candidate_order() {
        let coins = vec![candidate("small"), candidate("large")];
        let caps = HashMap::from([("small".to_string(), 1.0), ("large".to_string(), 100.0)]);

        assert_eq!(select_price_coin(&coins, &caps).id, "large");
        assert_eq!(
            select_price_coin(&[coins[1].clone(), coins[0].clone()], &caps).id,
            "large"
        );
    }

    #[test]
    fn tied_or_missing_market_caps_choose_the_lowest_id() {
        let coins = vec![candidate("z"), candidate("a")];
        let caps = HashMap::from([("z".to_string(), 10.0), ("a".to_string(), 10.0)]);

        assert_eq!(select_price_coin(&coins, &caps).id, "a");
        assert_eq!(select_price_coin(&coins, &HashMap::new()).id, "a");
        assert_eq!(
            select_price_coin(&[coins[1].clone(), coins[0].clone()], &caps).id,
            "a"
        );
    }

    #[test]
    fn non_finite_and_non_positive_market_caps_are_ignored() {
        let coins = vec![
            candidate("infinite"),
            candidate("nan"),
            candidate("zero"),
            candidate("negative"),
            candidate("valid"),
        ];
        let caps = HashMap::from([
            ("infinite".to_string(), f64::INFINITY),
            ("nan".to_string(), f64::NAN),
            ("zero".to_string(), 0.0),
            ("negative".to_string(), -1.0),
            ("valid".to_string(), 2.0),
        ]);

        assert_eq!(select_price_coin(&coins, &caps).id, "valid");
        assert_eq!(
            select_price_coin(&[coins[4].clone(), coins[0].clone()], &caps).id,
            "valid"
        );
    }

    #[test]
    fn ton_coin_list_replaces_unrelated_ids_with_canonical_id() {
        use std::io::{Read, Write};

        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0; 512];
            assert!(stream.read(&mut request).unwrap() > 0);
            let body = r#"[{"id":"atnt-ondo-tokenized-stock","symbol":"ton","name":"AT&T Ondo Stock"},
                {"id":"tac-bridged-ton-tac","symbol":"ton","name":"TAC Bridged TON"},
                {"id":"the-open-network","symbol":"gram","name":"Gram (prev. Toncoin)"}]"#;
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
                body.len()
            )
            .unwrap();
        });
        let host = Box::leak(format!("http://{address}").into_boxed_str());
        let provider = CoinGecko {
            client: CoinGeckoClient::new(host),
        };
        let coins = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(provider.list_all_coin_ids(vec!["TON".into()], None))
            .unwrap();

        server.join().unwrap();
        assert_eq!(coins.len(), 1);
        assert_eq!(coins[0].id, "the-open-network");
        assert_eq!(coins[0].symbol, "TON");
    }

    #[test]
    fn limits_ambiguous_candidates_to_the_lowest_twenty_five_ids() {
        let coins = (0..26)
            .rev()
            .map(|index| candidate(&format!("coin-{index:02}")))
            .collect::<Vec<_>>();

        let limited = limit_price_candidates(coins.clone());
        assert_eq!(limited.len(), 25);
        assert_eq!(limited.first().unwrap().id, "coin-00");
        assert_eq!(limited.last().unwrap().id, "coin-24");

        let mut with_exact = coins;
        with_exact.push(candidate("dup"));
        assert_eq!(limit_price_candidates(with_exact)[0].id, "dup");
    }

    #[test]
    fn price_batches_keep_encoded_id_lists_within_the_url_budget() {
        let ids = vec!["a".repeat(890), "b".repeat(890), "c".repeat(890)];
        let batches = price_id_batches(&ids).unwrap();

        assert_eq!(batches.len(), 2);
        assert_eq!(batches[0], vec![ids[0].as_str(), ids[1].as_str()]);
        assert_eq!(batches[1], vec![ids[2].as_str()]);
        assert!(batches
            .iter()
            .all(|batch| batch.iter().map(|id| id.len()).sum::<usize>()
                + batch.len().saturating_sub(1) * 3
                <= MAX_PRICE_IDS_LENGTH));
        assert!(price_id_batches(&["x".repeat(MAX_PRICE_IDS_LENGTH + 1)]).is_err());
    }

    #[test]
    fn maps_price_fixture_by_coin_id_and_omits_missing_prices() {
        let fixture: HashMap<String, Price> =
            serde_json::from_str(include_str!("../tests/fixtures/coingecko-prices.json")).unwrap();
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
