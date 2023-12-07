CREATE TABLE IF NOT EXISTS asset_prices (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	-- uuid in assets_v2
	uuid TEXT NOT NULL,
	assetID INTEGER NOT NULL,
	symbol TEXT NOT NULL,
	-- if amount > 0, price is cost price, else price is sell price
	price REAL NOT NULL,
	-- assetCreatedAt in assets_v2
	assetCreatedAt DATETIME NOT NULL,
	updatedAt DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_uuid_asset_id ON asset_prices (uuid, assetID);
