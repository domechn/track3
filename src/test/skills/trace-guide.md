# AI Skills Debug Trace

## Overview

The AI skills system includes a dev-only debug trace that logs the full skill execution
pipeline to the browser DevTools console. It shows:

- Skill registration
- When each skill's `run()` method is called (with args)
- When atomic functions (`getLatestSnapshot`, `getSnapshotSummaries`, etc.) are called
- Database query results (count of records, errors)
- Orchestrator scheduler dispatching (task IDs, skill names, results)
- Full error stack traces for any failures

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
[skill-trace] SKILL: asset_snapshot called args: {...}
[skill-trace] getLatestSnapshot date: undefined
[skill-trace] getSnapshotSummaries from: undefined to: undefined
[skill-trace] getLatestSnapshot -> latest: 2026-06-29T10:00:00.000Z 12345.67
[skill-trace] getAssetsBySnapshot uuid: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[skill-trace] getAssetsBySnapshot -> 15 assets
[skill-trace] runSkill asset_snapshot -> ok, text: Snapshot at ...
```

## Key trace prefixes

| Prefix | Source | What it shows |
|---|---|---|
| `SKILL:` | skill `.ts` files | Skill `run()` called, args received |
| `registerSkill` | `tools.ts` | Skills being registered at startup |
| `runSkill` | `tools.ts` | Skill dispatch, result |
| `getSnapshotSummaries` | `functions/assets.ts` | DB query: total value records |
| `getLatestSnapshot` | `functions/assets.ts` | Latest snapshot lookup |
| `getAssetsBySnapshot` | `functions/assets.ts` | DB query: assets by UUID |
| `getPortfolioValueSeries` | `functions/assets.ts` | Value timeline query |
| `getAssetHistory` | `functions/assets.ts` | Single asset history query |
| `getTransactions` | `functions/transactions.ts` | Transaction query |
| `getPrices` / `getCryptoPrices` / `getStockPrices` | `functions/prices.ts` | Price lookups |
| `SCHEDULER:` | `orchestrator/scheduler.ts` | Task dispatch, result, error |
| `[skill-trace:error]` | All files | Unhandled exceptions with stack |

## Common failure patterns

### "Unknown skill: portfolio_summary"
The LLM is calling old skill names from conversation history. Start a new chat session.

### "listTotalValueRecords failed" in traceError
The Tauri SQL plugin is not available. Check that `yarn tauri dev` (not just `yarn dev`) is running.

### "runSkill threw" with TypeError about `const downsampled`
Duplicate declaration bug in `functions/assets.ts` — check for duplicate variable declarations.

## Trace files

The trace utility itself: `src/middlelayers/ai/skills/functions/trace.ts`

Enabled files:
- `src/middlelayers/ai/tools.ts` — `registerSkill`, `runSkill`
- `src/middlelayers/ai/skills/functions/assets.ts` — All asset functions
- `src/middlelayers/ai/skills/functions/transactions.ts` — Transaction functions
- `src/middlelayers/ai/skills/functions/prices.ts` — Price functions
- `src/middlelayers/ai/orchestrator/scheduler.ts` — Task dispatch
- All 9 skill `.ts` files — Skill entry points
