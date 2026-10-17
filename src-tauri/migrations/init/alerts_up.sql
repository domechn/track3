CREATE TABLE IF NOT EXISTS alert_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('total_value_target', 'asset_value_target', 'asset_price_target', 'asset_price_move', 'allocation_deviation', 'period_pnl', 'portfolio_value_change')),
  asset_type TEXT CHECK (asset_type IS NULL OR asset_type IN ('crypto', 'stock')),
  symbol TEXT,
  comparator TEXT NOT NULL CHECK (comparator IN ('gte', 'lte')),
  threshold REAL NOT NULL CHECK (kind IN ('asset_price_move', 'period_pnl', 'portfolio_value_change') OR threshold >= 0),
  window TEXT CHECK (window IS NULL OR window IN ('24h', '7d', '30d')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  cooldown_seconds INTEGER NOT NULL DEFAULT 3600 CHECK (cooldown_seconds >= 0),
  last_triggered_at TEXT,
  last_value REAL,
  armed INTEGER NOT NULL DEFAULT 1 CHECK (armed IN (0, 1)),
  CHECK (
    (kind IN ('asset_value_target', 'asset_price_target', 'asset_price_move', 'allocation_deviation')) =
    (asset_type IS NOT NULL AND symbol IS NOT NULL AND length(trim(symbol)) > 0)
  ),
  CHECK (
    (kind IN ('asset_price_move', 'period_pnl', 'portfolio_value_change')) =
    (window IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS alert_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  symbol TEXT,
  value REAL NOT NULL,
  triggered_at TEXT NOT NULL,
  acknowledged_at TEXT
);

CREATE INDEX IF NOT EXISTS alert_history_time_idx ON alert_history(triggered_at DESC);
CREATE INDEX IF NOT EXISTS alert_history_unread_idx ON alert_history(acknowledged_at);
