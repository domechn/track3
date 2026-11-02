use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fs::OpenOptions,
    io::{Error, ErrorKind, Write},
    path::Path,
    sync::{Mutex, OnceLock},
    time::Duration,
    vec,
};

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

const MAX_PRICE_CANDIDATES_PER_SYMBOL: usize = 25;
const MAX_PRICE_IDS_LENGTH: usize = 1800;
static LOGO_ATTEMPTS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
const VERIFIED_BLACKLIST_HEADER: &str = "# verified-logo-blacklist-v2";

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

// Verified against CoinGecko /coins/list on 2026-10-30.
fn major_logo_id(symbol: &str) -> Option<&'static str> {
    match symbol {
        "BTC" => Some("bitcoin"),
        "USDT" => Some("tether"),
        "ETH" => Some("ethereum"),
        "USDC" => Some("usd-coin"),
        "SOL" => Some("solana"),
        "BNB" => Some("binancecoin"),
        "TRX" => Some("tron"),
        "SUI" => Some("sui"),
        "DOGE" => Some("dogecoin"),
        "XRP" => Some("ripple"),
        "ADA" => Some("cardano"),
        "DOT" => Some("polkadot"),
        "AVAX" => Some("avalanche-2"),
        "LINK" => Some("chainlink"),
        "MATIC" => Some("matic-network"),
        "POL" => Some("polygon-ecosystem-token"),
        "LTC" => Some("litecoin"),
        "SHIB" => Some("shiba-inu"),
        "PEPE" => Some("pepe"),
        "WBTC" => Some("wrapped-bitcoin"),
        "DAI" => Some("dai"),
        "TON" => Some("the-open-network"),
        _ => None,
    }
}

fn select_logo_coin<'a>(
    candidates: &'a [CoinGeckoCoin],
    caps: &HashMap<String, f64>,
) -> Option<&'a CoinGeckoCoin> {
    let first = candidates.first()?;
    major_logo_id(&first.symbol)
        .and_then(|id| candidates.iter().find(|coin| coin.id == id))
        .or_else(|| {
            candidates
                .iter()
                .find(|coin| coin.id.eq_ignore_ascii_case(&coin.symbol))
        })
        .or_else(|| Some(select_price_coin(candidates, caps)))
}

fn take_unattempted_symbols(symbols: Vec<String>, attempted: &mut HashSet<String>) -> Vec<String> {
    symbols
        .into_iter()
        .filter(|symbol| attempted.insert(symbol.clone()))
        .collect()
}

#[derive(Clone, Copy)]
enum LogoOutcome {
    Saved,
    NoImage,
    Failed(&'static str),
}

fn should_blacklist_logo(outcome: LogoOutcome) -> bool {
    matches!(outcome, LogoOutcome::NoImage)
}

fn load_verified_blacklist(path: &Path) -> Result<HashSet<String>, Error> {
    if path.exists() {
        let content = std::fs::read_to_string(path)?;
        if content.lines().next() == Some(VERIFIED_BLACKLIST_HEADER) {
            return Ok(content.lines().skip(1).map(str::to_uppercase).collect());
        }
    }
    // Old entries included transient download failures; their validity cannot be trusted.
    std::fs::write(path, format!("{VERIFIED_BLACKLIST_HEADER}\n"))?;
    Ok(HashSet::new())
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

    pub async fn download_coins_logos(
        &self,
        coins: Vec<CoinWithPrice>,
        base_dir: String,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let path_str = format!("{base_dir}/assets/coins");
        let download_dir = Path::new(&path_str);
        std::fs::create_dir_all(download_dir)?;

        let invalid_record = download_dir.join("invalid_asset_icon_record.txt");
        let blacklisted = load_verified_blacklist(&invalid_record)?;
        let symbols = coins
            .iter()
            .map(|coin| coin.symbol.to_uppercase())
            .filter(|symbol| {
                !blacklisted.contains(symbol)
                    && !download_dir
                        .join(format!("{}.png", symbol.to_lowercase()))
                        .exists()
            })
            .collect();
        let symbols = {
            let mut attempted = LOGO_ATTEMPTS
                .get_or_init(|| Mutex::new(HashSet::new()))
                .lock()
                .map_err(|_| Error::other("coin logo attempt state unavailable"))?;
            take_unattempted_symbols(symbols, &mut attempted)
        };
        if symbols.is_empty() {
            return Ok(());
        }

        let mut groups = BTreeMap::<String, Vec<CoinGeckoCoin>>::new();
        for coin in self
            .list_all_coin_ids(symbols.clone(), None)
            .await
            .map_err(|_| Error::other("CoinGecko coin list request failed"))?
        {
            groups.entry(coin.symbol.clone()).or_default().push(coin);
        }

        let cap_ids = groups
            .values()
            .filter(|group| {
                group.len() > 1
                    && !major_logo_id(&group[0].symbol)
                        .is_some_and(|id| group.iter().any(|coin| coin.id == id))
                    && !group
                        .iter()
                        .any(|coin| coin.id.eq_ignore_ascii_case(&coin.symbol))
            })
            .flat_map(|group| group.iter().map(|coin| coin.id.clone()))
            .collect::<Vec<_>>();
        let mut caps = HashMap::new();
        let mut failed_cap_ids = HashSet::new();
        for batch in price_id_batches(&cap_ids)? {
            match self
                .client
                .price(&batch, &["usd"], true, false, false, false)
                .await
            {
                Ok(prices) => caps.extend(
                    prices
                        .into_iter()
                        .filter_map(|(id, price)| price.usd_market_cap.map(|cap| (id, cap))),
                ),
                Err(_) => failed_cap_ids.extend(batch.into_iter().map(str::to_string)),
            }
        }

        let failed_cap_groups = groups
            .values()
            .filter(|group| group.iter().any(|coin| failed_cap_ids.contains(&coin.id)))
            .map(|group| group[0].symbol.clone())
            .collect::<HashSet<_>>();
        let selected = groups
            .values()
            .filter(|group| !failed_cap_groups.contains(&group[0].symbol))
            .filter_map(|group| select_logo_coin(group, &caps).cloned())
            .collect::<Vec<_>>();
        let mut newly_invalid = symbols
            .iter()
            .filter(|symbol| !groups.contains_key(*symbol))
            .cloned()
            .collect::<Vec<_>>();
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()?;
        let mut failed_downloads = failed_cap_groups.len();
        for chunk in selected.chunks(250) {
            let ids = chunk.iter().map(|coin| coin.id.clone()).collect::<Vec<_>>();
            let mut markets = HashMap::new();
            let mut failed_market_ids = HashSet::new();
            for batch in price_id_batches(&ids)? {
                match self
                    .client
                    .coins_markets(
                        "usd",
                        &batch,
                        None,
                        coingecko::params::MarketsOrder::MarketCapDesc,
                        batch.len() as i64,
                        1,
                        false,
                        &[],
                    )
                    .await
                {
                    Ok(items) => {
                        markets.extend(items.into_iter().map(|item| (item.id.clone(), item)))
                    }
                    Err(_) => failed_market_ids.extend(batch.into_iter().map(str::to_string)),
                }
            }
            for coin in chunk {
                let outcome = if failed_market_ids.contains(&coin.id) {
                    LogoOutcome::Failed("CoinGecko logo metadata request failed")
                } else {
                    match markets.get(&coin.id) {
                        Some(item) => {
                            self.download_coin_logo(&http, download_dir, &coin.symbol, item)
                                .await
                        }
                        None => LogoOutcome::Failed("CoinGecko omitted logo metadata"),
                    }
                };
                if should_blacklist_logo(outcome) {
                    newly_invalid.push(coin.symbol.clone());
                } else if let LogoOutcome::Failed(reason) = outcome {
                    failed_downloads += 1;
                    eprintln!("coin logo download failed: {reason}");
                }
            }
        }
        if !newly_invalid.is_empty() {
            let mut file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(invalid_record)?;
            for symbol in newly_invalid {
                writeln!(file, "{symbol}")?;
            }
        }
        if failed_downloads > 0 {
            return Err(
                Error::other(format!("{failed_downloads} coin logo downloads failed")).into(),
            );
        }
        Ok(())
    }

    async fn download_coin_logo(
        &self,
        http: &reqwest::Client,
        download_dir: &Path,
        symbol: &str,
        item: &CoinsMarketItem,
    ) -> LogoOutcome {
        if item.image.trim().is_empty() {
            return LogoOutcome::NoImage;
        }
        let response = match http.get(&item.image).send().await {
            Ok(response) => response,
            Err(_) => return LogoOutcome::Failed("image request failed"),
        };
        let response = match response.error_for_status() {
            Ok(response) => response,
            Err(_) => return LogoOutcome::Failed("image server returned an error"),
        };
        let logo = match response.bytes().await {
            Ok(logo) if !logo.is_empty() => logo,
            Ok(_) => return LogoOutcome::Failed("image response was empty"),
            Err(_) => return LogoOutcome::Failed("image response failed"),
        };
        let path = download_dir.join(format!("{}.png", symbol.to_lowercase()));
        let partial_path = path.with_extension("png.part");
        if std::fs::write(&partial_path, logo).is_err() {
            return LogoOutcome::Failed("image file write failed");
        }
        if std::fs::rename(partial_path, path).is_err() {
            return LogoOutcome::Failed("image file rename failed");
        }
        LogoOutcome::Saved
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
    fn logo_exact_id_wins_for_unpinned_symbol() {
        let coins = vec![
            CoinGeckoCoin {
                id: "other".into(),
                symbol: "DUP".into(),
            },
            CoinGeckoCoin {
                id: "dup".into(),
                symbol: "DUP".into(),
            },
        ];
        let caps = HashMap::from([("other".into(), 100.0)]);

        assert_eq!(select_logo_coin(&coins, &caps).unwrap().id, "dup");
    }

    #[test]
    fn dot_logo_uses_polkadot_even_when_dot_is_listed() {
        let coins = vec![
            CoinGeckoCoin {
                id: "dot".into(),
                symbol: "DOT".into(),
            },
            CoinGeckoCoin {
                id: "polkadot".into(),
                symbol: "DOT".into(),
            },
        ];

        assert_eq!(
            select_logo_coin(&coins, &HashMap::new()).unwrap().id,
            "polkadot"
        );
    }

    #[test]
    fn logo_major_pin_wins_over_larger_market_cap() {
        let coins = vec![
            CoinGeckoCoin {
                id: "bridged-ether".into(),
                symbol: "ETH".into(),
            },
            CoinGeckoCoin {
                id: "ethereum".into(),
                symbol: "ETH".into(),
            },
        ];
        let caps = HashMap::from([
            ("bridged-ether".into(), 1_000_000.0),
            ("ethereum".into(), 1.0),
        ]);

        assert_eq!(select_logo_coin(&coins, &caps).unwrap().id, "ethereum");
    }

    #[test]
    fn logo_largest_cap_then_lowest_id_and_no_candidates() {
        let coins = vec![candidate("z"), candidate("a"), candidate("large")];
        let caps = HashMap::from([("z".into(), 5.0), ("a".into(), 5.0), ("large".into(), 6.0)]);

        assert_eq!(select_logo_coin(&coins, &caps).unwrap().id, "large");
        assert_eq!(select_logo_coin(&coins[..2], &caps).unwrap().id, "a");
        assert!(select_logo_coin(&[], &caps).is_none());
    }

    #[test]
    fn ton_logo_uses_canonical_id() {
        let coins = vec![
            CoinGeckoCoin {
                id: "atnt-ondo-tokenized-stock".into(),
                symbol: "TON".into(),
            },
            CoinGeckoCoin {
                id: "the-open-network".into(),
                symbol: "TON".into(),
            },
        ];
        let caps = HashMap::from([("atnt-ondo-tokenized-stock".into(), 1_000_000.0)]);

        assert_eq!(
            select_logo_coin(&coins, &caps).unwrap().id,
            "the-open-network"
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
    fn major_logo_ids_are_plausible_coingecko_ids() {
        let ids = [
            ("BTC", "bitcoin"),
            ("USDT", "tether"),
            ("ETH", "ethereum"),
            ("USDC", "usd-coin"),
            ("SOL", "solana"),
            ("BNB", "binancecoin"),
            ("TRX", "tron"),
            ("SUI", "sui"),
            ("DOGE", "dogecoin"),
            ("XRP", "ripple"),
            ("ADA", "cardano"),
            ("DOT", "polkadot"),
            ("AVAX", "avalanche-2"),
            ("LINK", "chainlink"),
            ("MATIC", "matic-network"),
            ("POL", "polygon-ecosystem-token"),
            ("LTC", "litecoin"),
            ("SHIB", "shiba-inu"),
            ("PEPE", "pepe"),
            ("WBTC", "wrapped-bitcoin"),
            ("DAI", "dai"),
            ("TON", "the-open-network"),
        ];
        for (symbol, expected_id) in ids {
            assert_eq!(major_logo_id(symbol), Some(expected_id));
            assert!(expected_id
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-'));
        }
    }

    #[test]
    fn failed_logo_download_is_not_blacklisted_but_missing_image_is() {
        assert!(!should_blacklist_logo(LogoOutcome::Failed("HTTP error")));
        assert!(should_blacklist_logo(LogoOutcome::NoImage));
        assert!(!should_blacklist_logo(LogoOutcome::Saved));
    }

    #[test]
    fn failed_market_cap_request_still_processes_pinned_logo() {
        use std::io::{Read, Write};
        use std::sync::{
            atomic::{AtomicBool, Ordering},
            Arc,
        };

        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let address = listener.local_addr().unwrap();
        let stop = Arc::new(AtomicBool::new(false));
        let server_stop = Arc::clone(&stop);
        let server = std::thread::spawn(move || {
            while !server_stop.load(Ordering::Relaxed) {
                let Ok((mut stream, _)) = listener.accept() else {
                    std::thread::sleep(Duration::from_millis(10));
                    continue;
                };
                let mut request = [0; 2048];
                let size = stream.read(&mut request).unwrap();
                let path = String::from_utf8_lossy(&request[..size]);
                let (status, body) = if path.contains("/coins/list?") {
                    (
                        "200 OK",
                        r#"[{"id":"dot","symbol":"dot","name":"Dot"},
                            {"id":"polkadot","symbol":"dot","name":"Polkadot"},
                            {"id":"alpha","symbol":"zzqa","name":"Alpha"},
                            {"id":"beta","symbol":"zzqa","name":"Beta"}]"#,
                    )
                } else if path.contains("/simple/price?") {
                    ("503 Service Unavailable", "temporary failure")
                } else if path.contains("/coins/markets?") {
                    (
                        "200 OK",
                        r#"[{"id":"polkadot","symbol":"dot","name":"Polkadot","image":"",
                            "market_cap_rank":null,"fully_diluted_valuation":null,"roi":null}]"#,
                    )
                } else {
                    ("404 Not Found", "{}")
                };
                write!(
                    stream,
                    "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
                    body.len()
                )
                .unwrap();
            }
        });
        let host = Box::leak(format!("http://{address}").into_boxed_str());
        let provider = CoinGecko {
            client: CoinGeckoClient::new(host),
        };
        let dir = std::env::temp_dir().join(format!("track3-logo-{}", uuid::Uuid::new_v4()));
        let result =
            tokio::runtime::Runtime::new()
                .unwrap()
                .block_on(provider.download_coins_logos(
                    vec![
                        CoinWithPrice {
                            symbol: "DOT".into(),
                            price: 1.0,
                        },
                        CoinWithPrice {
                            symbol: "ZZQA".into(),
                            price: 1.0,
                        },
                    ],
                    dir.to_str().unwrap().to_string(),
                ));
        stop.store(true, Ordering::Relaxed);
        server.join().unwrap();

        let record =
            std::fs::read_to_string(dir.join("assets/coins/invalid_asset_icon_record.txt"))
                .unwrap();
        assert_eq!(
            result.unwrap_err().to_string(),
            "1 coin logo downloads failed"
        );
        assert!(record.lines().any(|line| line == "DOT"));
        assert!(!record.lines().any(|line| line == "ZZQA"));
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn failed_image_responses_do_not_create_cached_logos() {
        use std::io::{Read, Write};

        for (response, expected_error) in [
            (
                b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n".as_slice(),
                "image response was empty",
            ),
            (
                b"HTTP/1.1 429 Too Many Requests\r\nContent-Length: 0\r\n\r\n".as_slice(),
                "image server returned an error",
            ),
            (
                b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\n\r\n".as_slice(),
                "image server returned an error",
            ),
        ] {
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let address = listener.local_addr().unwrap();
            let server = std::thread::spawn(move || {
                let (mut stream, _) = listener.accept().unwrap();
                let mut request = [0; 512];
                assert!(stream.read(&mut request).unwrap() > 0);
                stream.write_all(response).unwrap();
            });
            let market: CoinsMarketItem = serde_json::from_value(serde_json::json!({
                "id": "ethereum", "symbol": "eth", "name": "Ethereum",
                "image": format!("http://{address}/image.png"),
                "market_cap_rank": null, "fully_diluted_valuation": null, "roi": null
            }))
            .unwrap();
            let dir = std::env::temp_dir().join(format!("track3-logo-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir_all(&dir).unwrap();

            let outcome = tokio::runtime::Runtime::new().unwrap().block_on(async {
                CoinGecko::new()
                    .download_coin_logo(&reqwest::Client::new(), &dir, "ETH", &market)
                    .await
            });

            server.join().unwrap();
            assert!(matches!(outcome, LogoOutcome::Failed(reason) if reason == expected_error));
            assert!(!should_blacklist_logo(outcome));
            assert!(!dir.join("eth.png").exists());
            std::fs::remove_dir_all(dir).unwrap();
        }
    }

    #[test]
    fn successful_metadata_without_image_is_blacklisted() {
        let market: CoinsMarketItem = serde_json::from_value(serde_json::json!({
            "id": "ethereum", "symbol": "eth", "name": "Ethereum",
            "image": "", "market_cap_rank": null,
            "fully_diluted_valuation": null, "roi": null
        }))
        .unwrap();
        let outcome = tokio::runtime::Runtime::new().unwrap().block_on(async {
            CoinGecko::new()
                .download_coin_logo(&reqwest::Client::new(), Path::new("unused"), "ETH", &market)
                .await
        });

        assert!(should_blacklist_logo(outcome));
    }

    #[test]
    fn logo_attempts_are_bounded_once_per_process_for_each_symbol() {
        let mut attempted = std::collections::HashSet::new();
        let symbols = vec!["ETH".to_string(), "ETH".to_string(), "USDC".to_string()];

        assert_eq!(
            take_unattempted_symbols(symbols.clone(), &mut attempted),
            vec!["ETH", "USDC"]
        );
        assert!(take_unattempted_symbols(symbols, &mut attempted).is_empty());
    }

    #[test]
    fn legacy_blacklist_entries_are_retried_then_new_invalid_entries_persist() {
        let path = std::env::temp_dir().join(format!("track3-invalid-{}", uuid::Uuid::new_v4()));
        std::fs::write(&path, "ETH\nBOGUS\n").unwrap();

        assert!(load_verified_blacklist(&path).unwrap().is_empty());
        assert!(!std::fs::read_to_string(&path).unwrap().contains("ETH"));
        writeln!(
            OpenOptions::new().append(true).open(&path).unwrap(),
            "BOGUS"
        )
        .unwrap();
        assert_eq!(
            load_verified_blacklist(&path).unwrap(),
            HashSet::from(["BOGUS".to_string()])
        );
        std::fs::remove_file(path).unwrap();
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
