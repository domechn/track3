CREATE TABLE IF NOT EXISTS rebalance_profiles (
  id INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
  targets TEXT NOT NULL CHECK (json_valid(targets) AND json_type(targets) = 'array'),
  tolerance_percent REAL NOT NULL DEFAULT 0 CHECK (tolerance_percent >= 0 AND tolerance_percent <= 100)
);
