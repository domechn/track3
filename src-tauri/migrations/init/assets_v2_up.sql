CREATE TABLE IF NOT EXISTS assets_v2 (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	uuid TEXT NOT NULL,
	createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
	wallet TEXT NOT NULL,
	asset_type TEXT NOT NULL DEFAULT 'crypto',
	symbol TEXT NOT NULL,
	amount REAL NOT NULL,
	value REAL NOT NULL,
	price REAL  NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_uuid_asset_type_symbol_wallet ON assets_v2 (uuid, asset_type, symbol, wallet);
CREATE INDEX IF NOT EXISTS symbol_idx ON assets_v2 (symbol);
CREATE INDEX IF NOT EXISTS createdAt_idx ON assets_v2 (createdAt);
