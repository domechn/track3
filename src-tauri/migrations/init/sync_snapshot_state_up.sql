CREATE TABLE IF NOT EXISTS sync_snapshot_state (
  snapshot_id TEXT PRIMARY KEY,
  snapshot_hash TEXT,
  snapshot_edit TEXT CHECK (snapshot_edit IS NULL OR json_valid(snapshot_edit)),
  pending_snapshot_edit TEXT CHECK (pending_snapshot_edit IS NULL OR json_valid(pending_snapshot_edit)),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  known TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(known)),
  asset_rows TEXT CHECK (asset_rows IS NULL OR json_valid(asset_rows)),
  transaction_rows TEXT CHECK (transaction_rows IS NULL OR json_valid(transaction_rows)),
  row_events TEXT CHECK (row_events IS NULL OR json_valid(row_events)),
  transaction_events TEXT CHECK (transaction_events IS NULL OR json_valid(transaction_events))
);
