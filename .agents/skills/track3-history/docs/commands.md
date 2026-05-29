# Track3 History CLI Commands

Run commands from the repository root:

```bash
node .claude/skills/track3-history/bin/track3-history.mjs <command> [options]
```

## Commands

### `doctor`

Checks database path, required tables, required columns, row counts, snapshot count, and earliest/latest snapshot timestamps.

```bash
node .claude/skills/track3-history/bin/track3-history.mjs doctor
```

### `dates`

Lists snapshot UUIDs, createdAt values, asset counts, and snapshot totals.

```bash
node .claude/skills/track3-history/bin/track3-history.mjs dates --limit 20
```

### `snapshots`

Returns historical snapshots grouped by `uuid`. Assets are grouped by `asset_type + symbol` by default.

```bash
node .claude/skills/track3-history/bin/track3-history.mjs snapshots --from 2026-01-01 --to 2026-01-31 --limit 10
```

Use `--raw` to keep wallet-level asset rows and `--include-transactions` to include transaction rows.

### `timeline`

Returns portfolio total value points sorted ascending by time.

```bash
node .claude/skills/track3-history/bin/track3-history.mjs timeline --from 2026-01-01 --to 2026-12-31 --max-points 100
```

### `latest`

Returns the latest snapshot allocation.

```bash
node .claude/skills/track3-history/bin/track3-history.mjs latest --asset-type crypto
```

Use `--include-zero` to include sold-out positions and `--group-by-wallet` to keep wallet-level rows.

### `asset`

Returns a symbol drilldown with latest position, max position, time series, and recent transactions.

```bash
node .claude/skills/track3-history/bin/track3-history.mjs asset --symbol BTC --asset-type crypto --from 2026-01-01 --to 2026-01-31
```

Pass `--asset-type` when a stock and crypto asset can share the same symbol.

### `transactions`

Queries transaction history.

```bash
node .claude/skills/track3-history/bin/track3-history.mjs transactions --symbol AAPL --asset-type stock --txn-type buy --limit 50
```

Supported transaction types: `buy`, `sell`, `deposit`, `withdraw`.

### `pnl`

Calculates range profit using Track3-style earliest/latest position plus buy/sell transactions.

```bash
node .claude/skills/track3-history/bin/track3-history.mjs pnl --symbol BTC --asset-type crypto --from 2026-01-01 --to 2026-01-31
```

### `compare`

Compares two snapshots. Pass UUIDs when available, or dates to use the latest snapshot at or before each date.

```bash
node .claude/skills/track3-history/bin/track3-history.mjs compare --left-date 2026-01-01 --right-date 2026-01-31
```

Without explicit arguments, it compares the previous snapshot against the latest snapshot.

### `top`

Ranks assets by cumulative value over a range by default.

```bash
node .claude/skills/track3-history/bin/track3-history.mjs top --from 2026-01-01 --to 2026-12-31 --limit 10
```

Use `--by latest` for latest-value ranking.

### `export`

Runs another query and emits the selected output format.

```bash
node .claude/skills/track3-history/bin/track3-history.mjs export --query timeline --from 2026-01-01 --to 2026-12-31 --format csv
```

## Output

JSON output has this shape:

```json
{
  "command": "timeline",
  "parameters": {
    "from": "2026-01-01",
    "to": "2026-12-31"
  },
  "metadata": {
    "generatedAt": "2026-05-28T00:00:00.000Z",
    "rowCount": 10,
    "truncated": false,
    "warnings": []
  },
  "data": {}
}
```

Use JSON for AI analysis. Use CSV only when the next step needs tabular export.
