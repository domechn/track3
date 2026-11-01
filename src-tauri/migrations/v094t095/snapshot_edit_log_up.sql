CREATE TABLE IF NOT EXISTS snapshot_edit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_uuid TEXT NOT NULL,
  edited_at TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('local', 'sync', 'import')),
  target TEXT NOT NULL CHECK (target IN ('transaction', 'asset', 'snapshot')),
  action TEXT NOT NULL CHECK (action IN ('price', 'txnType', 'delete', 'restore', 'replace')),
  asset_type TEXT,
  symbol TEXT,
  wallet TEXT,
  old_value TEXT,
  new_value TEXT
);
CREATE INDEX IF NOT EXISTS snapshot_edit_log_uuid_idx ON snapshot_edit_log (snapshot_uuid, edited_at DESC);
