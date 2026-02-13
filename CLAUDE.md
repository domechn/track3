# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Track3 is a privacy-focused desktop cryptocurrency portfolio tracker built with **Tauri v2** (Rust backend + React frontend). It aggregates balances from centralized exchanges (CEX) and web3 wallets, storing all data locally in encrypted SQLite.

## Development Commands

```bash
yarn install          # Install frontend dependencies
yarn tauri dev        # Launch app in development mode (starts Vite on port 1420 + Tauri)
yarn build            # TypeScript compile + Vite production build (frontend only)
yarn tauri build      # Build distributable desktop app
```

No test framework or linter is currently configured.

## Architecture

### Two-Layer Structure

- **`src/`** — React/TypeScript frontend (Vite, Tailwind CSS, shadcn/ui)
- **`src-tauri/`** — Rust backend (Tauri v2, SQLite via sqlx)

### Frontend Layers (`src/`)

1. **Components** (`src/components/`) — React UI. Uses shadcn/ui primitives in `ui/`, feature components at top level (overview, analytics, configuration, etc.)
2. **Middlelayers** (`src/middlelayers/`) — Core business logic:
   - `datafetch/coins/cex/` — CEX exchange integrations (Binance, OKX, Gate, Kraken, Bybit, Bitget, Coinbase)
   - `datafetch/coins/` — Blockchain fetchers (BTC, ETH/ERC20, SOL, DOGE, TRC20, TON, SUI)
   - `datafetch/utils/` — HTTP client, caching, async helpers
   - `database.ts` — SQLite abstraction layer
   - `configuration.ts` — Encrypted config management
   - `types.d.ts` — Core TypeScript type definitions
3. **Utils** (`src/utils/`) — Pure utility functions

### Rust Backend (`src-tauri/`)

Exposes Tauri commands to frontend via `invoke()`:
- `query_coins_prices` — CoinGecko price queries
- `query_binance_balance` — Binance API integration
- `encrypt` / `decrypt` — Config encryption via magic-crypt
- `download_coins_logos` — Coin logo caching

Key files: `main.rs` (entry + commands), `binance.rs`, `info.rs` (CoinGecko), `migration.rs` (DB versioning), `ent.rs` (encryption)

### Database

SQLite with versioned migrations in `src-tauri/migrations/` (v1→v5). Key tables: `assets_v2`, `asset_prices`, `configuration`, `currency_rates`.

## Key Patterns

- **Path alias:** `@/*` maps to `./src/*` (configured in tsconfig + vite)
- **Hash-based routing:** Required for Tauri's `file://` protocol
- **State management:** React Context API (no Redux)
- **CEX Analyzer pattern:** Each exchange implements an `Analyzer` interface in `datafetch/coins/cex/`
- **Caching:** Memory + localStorage with TTL in `datafetch/utils/`
- **Async:** Bluebird promises for parallel data fetching with progress callbacks
- **Pro license:** JWT-based, unlocks additional EVM chain support

## Build Requirements

- Node.js 20+, Yarn, Rust 1.81.0+
- macOS: Xcode CLI tools
- Linux: `libwebkit2gtk-4.0-dev`, `libappindicator3-dev`, and related system libs
- Windows: MSVC toolchain
