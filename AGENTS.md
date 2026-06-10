# Project Guidelines

## Project Overview

Track3 is a privacy-focused desktop cryptocurrency portfolio tracker built with **Tauri v2** (Rust backend + React frontend). It aggregates balances from centralized exchanges (CEX) and web3 wallets, storing all data locally in encrypted SQLite.

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

Additional wiring:

- Frontend UI lives in `src/components/`; domain/data orchestration lives in `src/middlelayers/`.
- App shell uses `ThemeProvider` and `ChartResizeContext` in `src/App.tsx`.
- Navigation is `react-router-dom` with `HashRouter`/`Routes` in `src/components/index/index.tsx`.
- Tauri backend commands/plugins are wired in `src-tauri/src/main.rs`; frontend calls via `invoke()` and Tauri plugins.
- CEX fetchers follow the `Exchanger` pattern in `src/middlelayers/datafetch/coins/cex/cex.ts`.

### Rust Backend (`src-tauri/`)

Exposes Tauri commands to frontend via `invoke()`:

- `query_coins_prices` — CoinGecko price queries
- `query_binance_balance` — Binance API integration
- `encrypt` / `decrypt` — Config encryption via magic-crypt
- `download_coins_logos` — Coin logo caching

Key files: `main.rs` (entry + commands), `binance.rs`, `info.rs` (CoinGecko), `migration.rs` (DB versioning), `ent.rs` (encryption)

### Database

SQLite with versioned migrations in `src-tauri/migrations/` (v1→v5). Key tables: `assets_v2`, `asset_prices`, `configuration`, `currency_rates`.

## Code Style

- TypeScript is strict (`tsconfig.json`); fix types instead of suppressing.
- Use path alias `@/*` for local imports (`tsconfig.json`, `vite.config.ts`).
- Keep existing file naming: kebab-case component files in `src/components/`.
- Follow local style per file: TSX often uses semicolons, middlelayers frequently omit them—match nearby code.
- Rust code in `src-tauri/src/` follows `rustfmt` defaults.

## Key Patterns

- **Path alias:** `@/*` maps to `./src/*` (configured in tsconfig + vite)
- **Hash-based routing:** Required for Tauri's `file://` protocol
- **State management:** React Context API (no Redux)
- **CEX Analyzer pattern:** Each exchange implements an `Analyzer` interface in `datafetch/coins/cex/`
- **Caching:** Memory + localStorage with TTL in `datafetch/utils/`
- **Async:** Bluebird promises for parallel data fetching with progress callbacks
- **Pro license:** JWT-based, unlocks additional EVM chain support
- **Repo-local skill:** `.claude/skills/version-upgrade/SKILL.md` documents the standard Track3 version bump workflow

## Build and Test

```bash
corepack yarn install          # Install frontend dependencies
corepack yarn dev              # Frontend dev (Vite)
corepack yarn tauri dev        # Desktop dev (starts Vite on port 1420 + Tauri)
corepack yarn build            # TypeScript compile + Vite production build (frontend only)
corepack yarn tauri build      # Build distributable desktop app
corepack yarn update-release   # Release metadata
```

No unit-test suite yet; validation is build/smoke-run based.

## Build Requirements

- Node.js 24+, Yarn 4.x (via Corepack), Rust 1.94.1+
- macOS: Xcode CLI tools
- Linux: `libwebkit2gtk-4.0-dev`, `libappindicator3-dev`, and related system libs
- Windows: MSVC toolchain

## Project Conventions

- Config is YAML split across fixed IDs in `configuration` table (`10`,`11`,`12`; legacy `1`) in `src/middlelayers/configuration.ts`.
- Encrypted config values are prefixed `!ent:` and use Rust `encrypt`/`decrypt` commands.
- `saveLicense()` uses encrypted storage (ID `997`); do not treat license as plain text config.
- Wallet/exchange identities are md5-hashed (`src/middlelayers/wallet.ts`).
- Keep HTTP calls in data fetchers on `@tauri-apps/plugin-http` wrapper (`src/middlelayers/datafetch/utils/http.ts`), not browser fetch.
- Cache fetch-heavy paths via `CacheCenter` (`src/middlelayers/datafetch/utils/cache.ts`) with explicit TTL seconds.
- Skill-related Vitest files live under `src/test/skills/`.

## Integration Points

- External price and exchange integrations are split across Rust (`query_coins_prices`, Binance) and TS exchange adapters.
- Data persistence uses SQLite through `@tauri-apps/plugin-sql` in `src/middlelayers/database.ts`.
- File import/export uses `@tauri-apps/plugin-fs` in `src/middlelayers/datamanager.ts`.
- CI and release behavior are defined in `.github/workflows/`.

## Security

- Never log API keys, secrets, passphrases, or decrypted config payloads.
- Preserve encryption flow when touching `configuration.ts`, `src-tauri/src/ent.rs`, or `license.ts`.
- Capability scope is broad (`src-tauri/capabilities/migrated.json`); avoid adding new permissions unless required.
- Keep `PRO_API_ENDPOINT` and license verification behavior intact unless task explicitly changes licensing.
