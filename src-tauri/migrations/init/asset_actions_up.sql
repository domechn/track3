CREATE TABLE IF NOT EXISTS asset_actions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	-- uuid in assets_v2
	uuid TEXT NOT NULL,
	changedAt DATETIME NOT NULL,
	wallet TEXT,
	symbol TEXT NOT NULL,
	amount REAL NOT NULL,
	costPrice REAL NOT NULL
);
