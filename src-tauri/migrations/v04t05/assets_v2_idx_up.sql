CREATE UNIQUE INDEX IF NOT EXISTS unique_uuid_symbol_amount_wallet ON assets_v2 (uuid, symbol, wallet);
UPDATE assets_v2 SET wallet = '' WHERE wallet IS NULL; -- update legacy data's wallet

CREATE INDEX IF NOT EXISTS symbol_idx ON assets_v2 (symbol);
CREATE INDEX IF NOT EXISTS createdAt_idx ON assets_v2 (createdAt);
