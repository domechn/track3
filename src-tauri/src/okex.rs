use std::collections::HashMap;

use okex::rest::{BalanceRequest, FundingBalanceRequest, OkExRest, SavingsBalanceRequest};
pub struct Okex {
    api_key: String,
    secret_key: String,
    password: String,
}

impl Okex {
    pub fn new(api_key: String, secret_key: String, password: String) -> Self {
        Okex {
            api_key,
            secret_key,
            password,
        }
    }

    pub async fn query_balance(&self) -> Result<HashMap<String, f64>, Box<dyn std::error::Error>> {
        let client = OkExRest::with_credential(&self.api_key, &self.secret_key, &self.password);

        let req = BalanceRequest { ccy: None };

        let [resp] = client.request(req).await?;

        // spot
        let mut res = resp.details.into_iter().map(|b| (b.ccy, b.eq)).fold(
            HashMap::new(),
            |mut acc, (k, v)| {
                acc.insert(k.to_owned(), v.parse::<f64>().unwrap());
                acc
            },
        );

        // savings
        let req = SavingsBalanceRequest { ccy: None };
        let resp = client.request(req).await?;

        resp.into_iter()
            .map(|b| (b.ccy, b.amt.parse::<f64>().unwrap()))
            .for_each(|(k, v)| {
                if res.contains_key(&k) {
                    let val = res.get(&k).unwrap();
                    res.insert(k.to_owned(), val + v);
                } else {
                    res.insert(k.to_owned(), v);
                }
            });

        // funding
        let req = FundingBalanceRequest { ccy: None };
        let resp = client.request(req).await?;

        resp.into_iter()
            .map(|b| (b.ccy, b.bal.parse::<f64>().unwrap()))
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
