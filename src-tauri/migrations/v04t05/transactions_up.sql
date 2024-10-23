CREATE TABLE IF NOT EXISTS transactions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	uuid TEXT NOT NULL, -- batch data id
	assetID INTEGER NOT NULL,
	wallet TEXT NOT NULL,
	symbol TEXT NOT NULL,
	amount REAL NOT NULL,
	price REAL NOT NULL,
	-- txnType: BUY, SELL, DEPOSIT, WITHDRAW
	txnType TEXT NOT NULL,
	txnCreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
	createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
	updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS txn_symbol_idx ON transactions (symbol);
CREATE INDEX IF NOT EXISTS txn_txnCreatedAt_idx ON transactions (txnCreatedAt);
CREATE INDEX IF NOT EXISTS txn_wallet_symbol_idx ON transactions (wallet, symbol);
