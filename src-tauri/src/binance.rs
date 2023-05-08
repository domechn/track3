use binance::{account::Account, api::Binance as BinanceApi, wallet::Wallet, futures::{general::FuturesGeneral, account::FuturesAccount}};
use std::collections::HashMap;

pub struct Binance {
    api_key: String,
    secret_key: String,
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
        let futures : FuturesAccount = BinanceApi::new(Some(self.api_key.clone()), Some(self.secret_key.clone()));
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

        // funding
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

        // futures
        let futures_balances = futures.account_balance().await?;
        futures_balances.into_iter()
        .map(|b| (b.asset.clone(), b.balance))
        .for_each(|(k, v)| {
            if res.contains_key(&k) {
                let val = res.get(&k).unwrap();
                res.insert(k.to_owned(), val + v);
            } else {
                res.insert(k.to_owned(), v);
            }
        });

        Ok(res)
    }
}
