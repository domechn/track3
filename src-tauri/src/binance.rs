use binance::{account::Account, api::Binance as BinanceApi, wallet::Wallet};
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

        println!("{:?}", res);

        Ok(res)

        // let account: Account =
        //     BinanceApi::new(Some(self.api_key.clone()), Some(self.secret_key.clone()));
        // let acc = account.get_account()?;

        // // let abc = Savings::new(Some(self.api_key.clone()), Some(self.secret_key.clone()))
        // //     .get_all_coins()
        // //     .unwrap()
        // //     .into_iter()
        // //     .filter(|s| s.free != 0.0 || s.locked != 0.0)
        // //     .map(|s| (s.coin, s.free + s.locked))
        // //     .collect::<HashMap<String, f64>>();

        // // println!("{:?}", abc);

        // let res = acc
        //     .balances
        //     .into_iter()
        //     .map(|b| {
        //         (
        //             b.asset.clone(),
        //             b.free.parse::<f64>().unwrap() + b.locked.parse::<f64>().unwrap(),
        //         )
        //     })
        //     .fold(HashMap::new(), |mut acc, (k, v)| {
        //         acc.insert(k.to_owned(), v.to_owned());
        //         acc
        //     });

        //     println!("{:?}", res);

        // Ok(res)
    }
}
