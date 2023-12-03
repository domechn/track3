use serde::{Deserialize, Serialize};
use sqlx::FromRow;

pub struct Addresses {
    pub addresses: Vec<String>,
}

pub struct TokenConfig {
    pub erc2_0: Addresses,
    pub btc: Addresses,
    pub sol: Addresses,
    pub doge: Addresses,
    pub others: Vec<Coin>,
}

pub struct Coin {
    pub symbol: String,
    pub amount: f64,
}

#[derive(Serialize, Deserialize)]
pub struct CoinWithPrice {
    pub symbol: String,
    pub price: f64,
}

#[derive(FromRow)]
pub struct AssetsV1 {
    pub id: i32,
    pub createdAt: String,
    pub top01: Option<String>,
    pub amount01: Option<f64>,
    pub value01: Option<f64>,
    pub top02: Option<String>,
    pub amount02: Option<f64>,
    pub value02: Option<f64>,
    pub top03: Option<String>,
    pub amount03: Option<f64>,
    pub value03: Option<f64>,
    pub top04: Option<String>,
    pub amount04: Option<f64>,
    pub value04: Option<f64>,
    pub top05: Option<String>,
    pub amount05: Option<f64>,
    pub value05: Option<f64>,
    pub top06: Option<String>,
    pub amount06: Option<f64>,
    pub value06: Option<f64>,
    pub top07: Option<String>,
    pub amount07: Option<f64>,
    pub value07: Option<f64>,
    pub top08: Option<String>,
    pub amount08: Option<f64>,
    pub value08: Option<f64>,
    pub top09: Option<String>,
    pub amount09: Option<f64>,
    pub value09: Option<f64>,
    pub top10: Option<String>,
    pub amount10: Option<f64>,
    pub value10: Option<f64>,
    pub topOthers: Option<String>,
    pub amountOthers: Option<String>,
    pub valueOthers: Option<f64>,
    pub total: Option<f64>,
}

#[derive(FromRow, Debug)]
pub struct AssetsV2 {
    pub id: i32,
    pub uuid: String,
    pub created_at: String,

    pub symbol: String,
    pub amount: f64,
    pub value: f64,
    pub price: f64,

    pub wallet: Option<String>,
}

#[derive(FromRow, Debug)]
pub struct Configuration {
    pub id: i32,
    pub data: String,
}
