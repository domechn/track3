use binance::{
    account::Account, api::Binance as BinanceApi, futures::account::FuturesAccount,
    margin::Margin,
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

impl Binance {
    pub fn new(api_key: String, secret_key: String) -> Self {
        Self {
            api_key,
            secret_key,
        }
    }

    pub async fn query_balance(&self) -> Result<HashMap<String, f64>, Box<dyn std::error::Error>> {
        let account: Account =
            BinanceApi::new(Some(self.api_key.clone()), Some(self.secret_key.clone()));
        let funding: Wallet =
            BinanceApi::new(Some(self.api_key.clone()), Some(self.secret_key.clone()));
        let futures: FuturesAccount =
            BinanceApi::new(Some(self.api_key.clone()), Some(self.secret_key.clone()));
        let margin: Margin =
            BinanceApi::new(Some(self.api_key.clone()), Some(self.secret_key.clone()));
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
        let locked_savings_req = build_signed_request([("size", "100")], funding.recv_window)?;
        let locked_savings: LockedSavingResponse = funding
            .client
            .get_signed(
                "/sapi/v1/simple-earn/locked/position",
                locked_savings_req.as_str(),
            )
            .await?;

        locked_savings.rows.iter().for_each(|row| {
            let asset = row.asset.clone();
            let amount = row.amount.parse::<f64>().unwrap_or(0.0);
            if res.contains_key(&asset) {
                let val = res.get(&asset).unwrap();
                res.insert(asset.to_owned(), val + amount);
            } else {
                res.insert(asset.to_owned(), amount);
            }
        });

        let flexible_savings_req = build_signed_request([("size", "100")], funding.recv_window)?;
        let flexible_savings: FlexibleSavingResponse = funding
            .client
            .get_signed(
                "/sapi/v1/simple-earn/flexible/position",
                flexible_savings_req.as_str(),
            )
            .await?;

        flexible_savings.rows.iter().for_each(|row| {
            let asset = row.asset.clone();
            let amount = row.total_amount.parse::<f64>().unwrap_or(0.0);
            if res.contains_key(&asset) {
                let val = res.get(&asset).unwrap();
                res.insert(asset.to_owned(), val + amount);
            } else {
                res.insert(asset.to_owned(), amount);
            }
        });

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
            println!(
                "Failed to fetch cross margin account balances, error: {:?}",
                margin_details.err()
            );
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
            println!("Failed to fetch futures account balances, error: {:?}", futures_balances.err());
        }

        Ok(res)
    }
}
