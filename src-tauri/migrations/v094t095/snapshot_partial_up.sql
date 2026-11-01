CREATE TABLE IF NOT EXISTS snapshot_partial (
  uuid TEXT PRIMARY KEY NOT NULL,
  sources_total INTEGER NOT NULL CHECK (sources_total >= 1),
  missing TEXT NOT NULL CHECK (json_valid(missing) AND json_type(missing) = 'array'),
  fill TEXT NOT NULL CHECK (fill IN ('last_known')),
  created_at TEXT NOT NULL
);
