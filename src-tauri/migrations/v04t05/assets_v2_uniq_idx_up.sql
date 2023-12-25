CREATE UNIQUE INDEX IF NOT EXISTS unique_uuid_symbol_amount_wallet ON assets_v2 (uuid, symbol, wallet);
UPDATE assets_v2 SET wallet = '' WHERE wallet IS NULL; -- update legacy data's wallet
