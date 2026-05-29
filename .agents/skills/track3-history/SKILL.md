---
name: track3-history
description: Use when querying Track3 local historical data, portfolio timeline, latest holdings, asset PnL, transaction history, snapshot comparison, top assets, or exporting Track3 history through the bundled CLI.
---

# Track3 Historical Data

## When to Use

Use this skill when the user asks to inspect or analyze local Track3 history, including:

- portfolio value timeline or latest holdings
- historical snapshot dates or snapshot contents
- single asset drilldown by symbol and optional `asset_type`
- transaction history for a symbol, wallet, or date range
- realized/unrealized PnL over a date range
- comparison between two snapshots or two dates
- top assets by latest or cumulative value
- JSON or CSV export of historical data queries

## Scope and Privacy

This skill is read-only. It queries the local SQLite database and does not modify Track3 data.

- Do not call network APIs or refresh external prices from this skill.
- Do not decrypt configuration values.
- Do not print API keys, encrypted config payloads, license data, or secrets.
- Treat wallet values as stored identities; aliases may be unavailable because they can live in encrypted config.
- Keep all implementation files for this workflow inside `.claude/skills/`.

## Bundled CLI

Use the local CLI for all data access:

```bash
node .claude/skills/track3-history/bin/track3-history.mjs <command> [options]
```

The CLI defaults to JSON output and resolves the normal Track3 Tauri database path. Use `--db <path>` for backups, fixtures, or explicit databases.

Common options:

- `--from <iso>` and `--to <iso>` for date ranges
- `--format json|csv|table`, default `json`
- `--limit <n>` for row limits
- `--max-points <n>` for downsampling time series
- `--symbol <symbol>` for asset, transaction, and PnL queries
- `--asset-type crypto|stock` to disambiguate same-symbol assets

## Default Workflow

1. Start with `doctor` when database location or schema health is uncertain.
2. Choose the smallest command that answers the question.
3. Use `--format json` for agent analysis and summaries.
4. Add date ranges and limits before broad queries to avoid flooding the chat context.
5. Preserve `asset_type` in the answer when symbols may overlap across crypto and stock.
6. Summarize the result in plain language and mention any warnings or truncation.

## Command Selection

| User intent                             | Command                    |
| --------------------------------------- | -------------------------- |
| Check whether data is available         | `doctor`                   |
| List historical snapshot dates          | `dates`                    |
| Inspect snapshot contents               | `snapshots`                |
| Show portfolio value over time          | `timeline`                 |
| Show current allocation                 | `latest`                   |
| Analyze one coin or stock               | `asset`                    |
| List buys, sells, deposits, withdrawals | `transactions`             |
| Calculate profit/loss                   | `pnl`                      |
| Compare two dates or snapshots          | `compare`                  |
| Rank assets by value                    | `top`                      |
| Produce CSV/JSON for another tool       | `export` or `--format csv` |

## Examples

Portfolio timeline for 2026:

```bash
node .claude/skills/track3-history/bin/track3-history.mjs timeline --from 2026-01-01 --to 2026-12-31 --max-points 80
```

Latest holdings including zero positions:

```bash
node .claude/skills/track3-history/bin/track3-history.mjs latest --include-zero
```

BTC crypto PnL for a date range:

```bash
node .claude/skills/track3-history/bin/track3-history.mjs pnl --symbol BTC --asset-type crypto --from 2026-01-01 --to 2026-01-31
```

Compare two snapshot UUIDs:

```bash
node .claude/skills/track3-history/bin/track3-history.mjs compare --left-uuid <older-uuid> --right-uuid <newer-uuid>
```

Export transactions to CSV:

```bash
node .claude/skills/track3-history/bin/track3-history.mjs transactions --symbol AAPL --asset-type stock --format csv
```

## Expected Response Shape

When using this skill, respond with:

- the query scope, including date range, symbol, and asset type when relevant
- the main result in one short paragraph or a compact table
- notable movers, top holdings, or PnL drivers when useful
- warnings from `metadata.warnings` and whether output was truncated
- the command run only when the user needs reproducibility

Avoid dumping raw JSON unless the user asks for it.

## Implementation Notes

- The CLI uses Node's built-in SQLite API and opens the database read-only.
- Historical assets live in `assets_v2`; transactions live in `transactions`.
- Snapshot identity is `uuid`; snapshot grouping follows Track3's `asset_type + symbol` behavior.
- SQL inputs are bound as parameters, with enums and dates validated before execution.
- The command reference is in `.claude/skills/track3-history/docs/commands.md`.
