# AI Skills Debug Trace

## Overview

The AI skills system includes a dev-only debug trace that logs operation names
to the browser DevTools console. It shows:

- Skill registration
- When each skill's `run()` method is called
- When atomic functions (`getLatestSnapshot`, `getSnapshotSummaries`, etc.) are called
- Database query operation names
- Orchestrator scheduler operation names

Arguments, portfolio values, and raw errors are omitted because they may contain private data.

**Active only in dev mode** (`import.meta.env.DEV === true`, i.e. `yarn dev` or `yarn tauri dev`).
In production builds these traces are no-ops.

## How to use

1. Run `yarn tauri dev` (or `yarn dev`)
2. Open the browser DevTools console (F12)
3. Filter by `[skill-trace]` to see only skill trace messages
4. Trigger the AI chat query that's failing
5. Look for the trace log sequence

## Trace log format

```
[skill-trace] SKILL: asset_snapshot called
[skill-trace] getLatestSnapshot
[skill-trace] getSnapshotSummaries
[skill-trace] getAssetsBySnapshot
[skill-trace] runSkill
```

## Key trace prefixes

| Prefix | Source | What it shows |
|---|---|---|
| `SKILL:` | skill `.ts` files | Skill `run()` called |
| `registerSkill` | `tools.ts` | Skills being registered at startup |
| `runSkill` | `tools.ts` | Skill dispatch |
| `getSnapshotSummaries` | `functions/assets.ts` | DB query: total value records |
| `getLatestSnapshot` | `functions/assets.ts` | Latest snapshot lookup |
| `getAssetsBySnapshot` | `functions/assets.ts` | DB query: assets by UUID |
| `getPortfolioValueSeries` | `functions/assets.ts` | Value timeline query |
| `getAssetHistory` | `functions/assets.ts` | Single asset history query |
| `getTransactions` | `functions/transactions.ts` | Transaction query |
| `getPrices` / `getCryptoPrices` / `getStockPrices` | `functions/prices.ts` | Price lookups |
| `SCHEDULER:` | `orchestrator/scheduler.ts` | Task dispatch |

## Common failure patterns

### "Unknown skill: portfolio_summary"
The LLM is calling old skill names from conversation history. Start a new chat session.

### Data access fails
Check that `yarn tauri dev` is running so the Tauri SQL plugin is available.

## Trace files

The trace utility itself: `src/middlelayers/ai/skills/functions/trace.ts`

Enabled files:
- `src/middlelayers/ai/tools.ts` — `registerSkill`, `runSkill`
- `src/middlelayers/ai/skills/functions/assets.ts` — All asset functions
- `src/middlelayers/ai/skills/functions/transactions.ts` — Transaction functions
- `src/middlelayers/ai/skills/functions/prices.ts` — Price functions
- `src/middlelayers/ai/orchestrator/scheduler.ts` — Task dispatch
- All 9 skill `.ts` files — Skill entry points
