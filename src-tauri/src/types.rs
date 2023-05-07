pub struct Addresses {
    pub addresses: Vec<String>,
}

pub struct TokenConfig {
    pub erc20: Addresses,
    pub btc: Addresses,
    pub sol: Addresses,
    pub doge: Addresses,
    pub others: Vec<Coin>,
}

pub struct Coin {
    pub symbol: String,
    pub amount: f64,
}
