use binance::{
    account::Account, api::Binance as BinanceApi, futures::account::FuturesAccount, margin::Margin,
    util::build_signed_request, wallet::Wallet,
};
use std::collections::HashMap;

pub struct Binance {
    api_key: String,
    secret_key: String,
}

#[derive(Debug, serde::Deserialize)]
struct LockedSavingResponse {
    rows: Vec<LockedSavingRowItem>,
}

#[derive(Debug, serde::Deserialize)]
struct LockedSavingRowItem {
    asset: String,
    amount: String,
}

#[derive(Debug, serde::Deserialize)]
struct FlexibleSavingResponse {
    rows: Vec<FlexibleSavingRowItem>,
}

#[derive(Debug, serde::Deserialize)]
struct FlexibleSavingRowItem {
    asset: String,
    #[serde(rename = "totalAmount")]
    total_amount: String,
}

fn add_balance(balances: &mut HashMap<String, f64>, asset: &str, amount: f64) {
    let asset = asset.trim().to_uppercase();
    if asset.is_empty() || !amount.is_finite() || amount == 0.0 {
        return;
    }
    *balances.entry(asset).or_insert(0.0) += amount;
}

fn merge_locked_savings(
    balances: &mut HashMap<String, f64>,
    response: &LockedSavingResponse,
) -> Result<(), Box<dyn std::error::Error>> {
    for row in &response.rows {
        let amount = row.amount.parse::<f64>().map_err(|_| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("invalid locked savings amount for {}", row.asset),
            )
        })?;
        add_balance(balances, &row.asset, amount);
    }
    Ok(())
}

fn merge_flexible_savings(
    balances: &mut HashMap<String, f64>,
    response: &FlexibleSavingResponse,
) -> Result<(), Box<dyn std::error::Error>> {
    for row in &response.rows {
        let amount = row.total_amount.parse::<f64>().map_err(|_| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("invalid flexible savings amount for {}", row.asset),
            )
        })?;
        add_balance(balances, &row.asset, amount);
    }
    Ok(())
}

fn build_earn_request(recv_window: u64) -> Result<String, Box<dyn std::error::Error>> {
    Ok(build_signed_request([("size", "100")], recv_window)?)
}

impl Binance {
    pub fn new(api_key: String, secret_key: String) -> Self {
        Self {
            api_key,
            secret_key,
        }
    }

    pub async fn query_balance(&self) -> Result<HashMap<String, f64>, Box<dyn std::error::Error>> {
        let api_key = Some(self.api_key.clone());
        let secret_key = Some(self.secret_key.clone());
        let account: Account = BinanceApi::new(api_key.clone(), secret_key.clone());
        let funding: Wallet = BinanceApi::new(api_key.clone(), secret_key.clone());
        let futures: FuturesAccount = BinanceApi::new(api_key.clone(), secret_key.clone());
        let margin: Margin = BinanceApi::new(api_key, secret_key);
        let acc = account.get_account().await?;
        // spot
        let mut res = acc
            .balances
            .into_iter()
            .map(|b| (b.asset.clone(), b.free + b.locked))
            .fold(HashMap::new(), |mut acc, (k, v)| {
                acc.insert(k.to_owned(), v.to_owned());
                acc
            });

        // funding: it includes flexible savings
        let wallet_funding = funding.funding_wallet(None, None).await?;
        wallet_funding
            .iter()
            .map(|wf| (wf.asset.clone(), wf.free + wf.locked))
            .for_each(|(k, v)| {
                if res.contains_key(&k) {
                    let val = res.get(&k).unwrap();
                    res.insert(k.to_owned(), val + v);
                } else {
                    res.insert(k.to_owned(), v);
                }
            });

        // locked savings in simple earn
        let locked_savings_req = build_earn_request(funding.recv_window)?;
        let locked_savings: LockedSavingResponse = funding
            .client
            .get_signed(
                "/sapi/v1/simple-earn/locked/position",
                locked_savings_req.as_str(),
            )
            .await?;

        merge_locked_savings(&mut res, &locked_savings)?;

        let flexible_savings_req = build_earn_request(funding.recv_window)?;
        let flexible_savings: FlexibleSavingResponse = funding
            .client
            .get_signed(
                "/sapi/v1/simple-earn/flexible/position",
                flexible_savings_req.as_str(),
            )
            .await?;

        merge_flexible_savings(&mut res, &flexible_savings)?;

        // cross margin
        // some accounts may not have margin enabled, so we handle the error gracefully
        let margin_details = margin.details().await;
        if let Ok(margin_details) = margin_details {
            margin_details.user_assets.into_iter().for_each(|asset| {
                let amount = asset.net_asset;
                if res.contains_key(&asset.asset) {
                    let val = res.get(&asset.asset).unwrap();
                    res.insert(asset.asset.to_owned(), val + amount);
                } else {
                    res.insert(asset.asset.to_owned(), amount);
                }
            });
        } else {
            eprintln!("Failed to fetch cross margin account balances");
        }

        // futures
        // some accounts may not have futures enabled, so we handle the error gracefully
        let futures_balances = futures.account_balance().await;
        if let Ok(futures_balances) = futures_balances {
            futures_balances
                .into_iter()
                .map(|b| (b.asset.clone(), b.balance))
                .for_each(|(k, v)| {
                    if res.contains_key(&k) {
                        let val = res.get(&k).unwrap();
                        res.insert(k.to_owned(), val + v);
                    } else {
                        res.insert(k.to_owned(), v);
                    }
                });
        } else {
            eprintln!("Failed to fetch futures account balances");
        }

        Ok(res)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::info::sanitize_upstream_error;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    #[test]
    fn parses_and_merges_locked_and_flexible_savings_fixtures() {
        let locked: LockedSavingResponse =
            serde_json::from_str(include_str!("../tests/fixtures/binance-locked.json")).unwrap();
        let flexible: FlexibleSavingResponse =
            serde_json::from_str(include_str!("../tests/fixtures/binance-flexible.json")).unwrap();
        let mut balances = HashMap::new();

        merge_locked_savings(&mut balances, &locked).unwrap();
        merge_flexible_savings(&mut balances, &flexible).unwrap();

        assert_eq!(balances.get("BTC"), Some(&4.0));
        assert_eq!(balances.get("ETH"), Some(&3.5));
        assert!(!balances.contains_key("ZERO"));
    }

    #[test]
    fn malformed_savings_amount_returns_an_error() {
        let locked: LockedSavingResponse =
            serde_json::from_str(r#"{"rows": [{"asset": "BTC", "amount": "not-a-number"}]}"#)
                .unwrap();

        let error = merge_locked_savings(&mut HashMap::new(), &locked).unwrap_err();

        assert!(error.to_string().contains("BTC"));
        assert!(error.to_string().contains("invalid locked savings amount"));
    }

    #[test]
    fn binance_error_redaction_removes_credentials_and_signatures() {
        let error = sanitize_upstream_error(
            "GET /api?apiKey=key-value&signature=signature-value&secret=secret-value",
        );

        assert!(!error.contains("key-value"));
        assert!(!error.contains("signature-value"));
        assert!(!error.contains("secret-value"));
        assert_eq!(
            error,
            "GET /api?apiKey=<REDACTED>&signature=<REDACTED>&secret=<REDACTED>"
        );
    }

    #[test]
    fn earn_request_contains_window_timestamp_and_page_size() {
        let query = build_earn_request(5_000).unwrap();
        let parts = query.split('&').collect::<Vec<_>>();
        assert_eq!(parts.len(), 3);
        assert_eq!(parts[0], "recvWindow=5000");
        assert!(parts[1]
            .strip_prefix("timestamp=")
            .unwrap()
            .parse::<u64>()
            .is_ok());
        assert_eq!(parts[2], "size=100");
    }

    #[test]
    fn earn_query_is_signed_on_the_request_sent_to_binance() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let host = format!("http://{}", listener.local_addr().unwrap());
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buffer = [0u8; 4096];
            let mut bytes = Vec::new();
            loop {
                let count = stream.read(&mut buffer).unwrap();
                bytes.extend_from_slice(&buffer[..count]);
                if count == 0 || bytes.windows(4).any(|window| window == b"\r\n\r\n") {
                    break;
                }
            }
            let request = String::from_utf8_lossy(&bytes).to_string();
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 11\r\nConnection: close\r\n\r\n{\"rows\":[]}")
                .unwrap();
            request
        });
        let query = build_earn_request(5_000).unwrap();
        let wallet: Wallet = BinanceApi::new_with_config(
            Some("test-api-key".to_string()),
            Some("test-secret".to_string()),
            &binance::config::Config::default().set_rest_api_endpoint(host),
        );
        let response: serde_json::Value = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(
                wallet
                    .client
                    .get_signed("/sapi/v1/simple-earn/locked/position", &query),
            )
            .unwrap();
        assert_eq!(response["rows"], serde_json::json!([]));

        let request = server.join().unwrap();
        let request_line = request.lines().next().unwrap();
        let signed_key = ring::hmac::Key::new(ring::hmac::HMAC_SHA256, b"test-secret");
        let expected_signature = ring::hmac::sign(&signed_key, query.as_bytes())
            .as_ref()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        assert_eq!(
            request_line,
            format!(
                "GET /sapi/v1/simple-earn/locked/position?{query}&signature={expected_signature} HTTP/1.1"
            )
        );
        assert!(request
            .to_lowercase()
            .contains("x-mbx-apikey: test-api-key"));
    }
}
