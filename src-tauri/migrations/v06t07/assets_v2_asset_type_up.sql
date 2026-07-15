DROP INDEX IF EXISTS unique_uuid_symbol_amount_wallet;
DROP INDEX IF EXISTS unique_uuid_asset_type_symbol_wallet;
CREATE UNIQUE INDEX unique_uuid_asset_type_symbol_wallet ON assets_v2 (uuid, asset_type, symbol, wallet);
