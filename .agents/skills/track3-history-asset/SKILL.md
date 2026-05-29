---
name: track3-history-asset
description: Use when the user asks to analyze one Track3 asset, coin, stock, symbol history, transaction history, amount/value time series, or asset PnL.
---

# Track3 Asset History

Use the shared Track3 history CLI:

```bash
node .claude/skills/track3-history/bin/track3-history.mjs <command> [options]
```

Prefer these commands:

- `asset --symbol <symbol> --asset-type crypto|stock` for position and time series
- `transactions --symbol <symbol>` for transaction rows
- `pnl --symbol <symbol> --asset-type crypto|stock` for profit/loss

Always include `--asset-type` when the symbol could exist as both crypto and stock. Summaries should separate amount, value, price, realized profit, unrealized profit, and transaction count when those fields are present.
