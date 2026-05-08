ALTER TABLE assets_v2 ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'crypto';
DROP INDEX IF EXISTS unique_uuid_symbol_amount_wallet;
CREATE UNIQUE INDEX IF NOT EXISTS unique_uuid_asset_type_symbol_wallet ON assets_v2 (uuid, asset_type, symbol, wallet);
