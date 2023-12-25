CREATE TABLE IF NOT EXISTS assets_v2 (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	uuid TEXT NOT NULL,
	createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
	wallet TEXT NOT NULL,
	symbol TEXT NOT NULL,
	amount REAL NOT NULL,
	value REAL NOT NULL,
	price REAL  NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_uuid_symbol_amount_wallet ON assets_v2 (uuid, symbol, wallet);
