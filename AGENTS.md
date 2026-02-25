# Repository Guidelines

## Project Structure & Module Organization

- `src/`: React + TypeScript frontend (UI components, data middle layers, utilities).
- `src/components/`: screen and shared UI components (`ui/`, `common/`, feature modules).
- `src/middlelayers/`: app domain logic (wallet/config/data fetch/chart/data manager).
  - `datafetch/coins/cex/`: one file per CEX exchange implementing the `Exchanger` interface.
  - `datafetch/coins/`: blockchain fetchers: `btc.ts`, `erc20.ts`, `sol.ts`, `doge.ts`, `trc20.ts`, `ton.ts`, `sui.ts`, `stable.ts`.
  - `datafetch/utils/`: `cache.ts`, `http.ts`, `async.ts`, `address.ts`, `coins.ts`.
  - `entities/`: domain-handler singletons — `ASSET_HANDLER`, `TRANSACTION_HANDLER`, `CURRENCY_RATE_HANDLER`.
- `src-tauri/`: Rust/Tauri desktop backend, migrations, and platform packaging config.
- `public/` and `src/assets/`: static assets used by the frontend.
- `.github/workflows/`: CI/release pipelines used to validate and publish builds.

## Build, Test, and Development Commands

- `yarn install`: install JS dependencies (CI uses Yarn).
- `yarn dev`: run frontend locally with Vite on port `1420`.
- `yarn tauri dev`: run full desktop app (frontend + Rust backend).
- `yarn build`: type-check (`tsc`) and create production frontend bundle.
- `yarn tauri build`: build desktop binaries (same path used in CI release jobs).
- `yarn update-release`: generate update metadata used by release automation.

## Coding Style & Naming Conventions

- TypeScript is `strict`; fix type errors instead of suppressing them. No linter is configured.
- Use 2-space indentation and semicolons in TS/TSX; keep imports grouped and alias local imports with `@/` (`@/*` maps to `./src/*` in both `tsconfig.json` and `vite.config.ts`).
- React components/files use kebab-case filenames (for example `auto-updater.tsx`), with PascalCase component exports.
- Rust code in `src-tauri/` follows `rustfmt` defaults (4 spaces, snake_case functions).
- Keep Tailwind utility usage readable; extract repeated UI patterns into `src/components/ui/`.

## Testing Guidelines

- There is no dedicated unit-test suite yet; validation is build-based.
- Before opening a PR, run:
  - `yarn build`
  - `yarn tauri build` (or at minimum `yarn tauri dev` smoke test)
- CI (`.github/workflows/test-on-pr.yaml`) verifies cross-platform Tauri builds on Ubuntu, macOS, and Windows.

## Commit & Pull Request Guidelines

- Follow existing commit style: short, imperative summaries (for example `support htx`, `refactor configuration storage`).
- Prefer including issue/PR references when relevant (for example `(#602)`).
- Keep commits focused by concern (UI, data layer, Rust backend, migrations).
- PRs should include: what changed, why, local verification steps, and screenshots/GIFs for UI changes.
- If backend schema or migration behavior changes, explicitly call out compatibility and upgrade impact.

---

## Architecture Deep-Dive

### Routing & App Shell

`App.tsx` uses **no router library**. The entire app renders a single `<IndexApp />` with internal state-based navigation. Hash-based routing exists at the Tauri `file://` protocol level only. Two top-level React Contexts are provided:

- `ThemeProvider` (wraps everything, persists theme to `localStorage` under key `"track3-ui-theme"`).
- `ChartResizeContext` (`{ needResize: number, setNeedResize }`) — increment `needResize` to trigger chart redraws on layout changes.
- Global right-click menu: `onContextMenu={renderRightClickMenu}` from `src/utils/hook.ts`.

### Core Type Definitions

**`src/middlelayers/types.d.ts`** — DB-mapped models and UI data shapes:

- `AssetModel` — `assets_v2` row: `{ id, uuid, createdAt, symbol, amount, value, price, wallet? }`
- `AssetPriceModel` — `asset_prices` row: price > 0 = cost price, < 0 = sell price
- `TransactionModel` — transactions row: `txnType: 'buy' | 'sell' | 'deposit' | 'withdraw'`
- `ConfigurationModel` — `{ id: number, data: string }` (data may be YAML or plain value depending on config ID)
- `UniqueIndexConflictResolver` — `'IGNORE' | 'REPLACE'`
- Chart data types: `TopCoinsRankData`, `PNLChartData` (alias `TotalValuesData`), `AssetChangeData`, `LatestAssetsPercentageData`, `WalletAssetsPercentageData`

**`src/middlelayers/datafetch/types.d.ts`** — fetch-layer types:

- `Coin` — `{ symbol, price?: { value, base: 'usd'|'usdt' }, amount }`
- `WalletCoin = Coin & { wallet: string }`
- `Analyzer` interface — implemented by every data-source class:
  ```ts
  interface Analyzer {
    getAnalyzeName(): string;
    preLoad(): Promise<void>;
    loadPortfolio(): Promise<WalletCoin[]>;
    verifyConfigs(): Promise<boolean>;
    postLoad(): Promise<void>;
  }
  ```
- `GlobalConfig = CexConfig & TokenConfig & { configs: { groupUSD: boolean, hideInactive?: boolean } }`
- `CexConfig.exchanges[].initParams`: `{ apiKey, secret, password? /* OKX */, passphrase? /* Bitget */ }`
- `TokenConfig` — keys: `erc20`, `trc20`, `btc`, `sol`, `doge`, `ton`, `sui` (each `Addresses`), plus `others[]`
- `Addresses.addresses` — each entry is either a plain `string` or `{ address, alias?, active? }`

### CEX Exchange Pattern

Each exchange in `datafetch/coins/cex/` implements the `Exchanger` interface defined in `cex.ts`:

```ts
interface Exchanger {
  getExchangeName(): string;
  getIdentity(): string; // e.g. "okex-<apiKey>"; md5'd when stored in DB
  getAlias(): string | undefined;
  fetchTotalBalance(): Promise<{ [symbol: string]: number }>;
  fetchCoinsPrice(): Promise<{ [symbol: string]: number }>;
  verifyConfig(): Promise<boolean>;
}
```

`CexAnalyzer` (implements `Analyzer`) dispatches to the correct `Exchanger` by switching on `exCfg.name`. Entries with `active === false` are skipped at construction. `OtherCexExchanges` handles any unrecognized exchange name. Balance fetches are wrapped in the `"data-fetch"` memory cache (TTL 600 s, key `${identity}_total_balance`).

### Configuration Storage

Stored in the `configuration` SQLite table with **fixed numeric string IDs**:

| ID          | Content                                                | Encrypted |
| ----------- | ------------------------------------------------------ | --------- |
| `"10"`      | exchanges YAML                                         | Yes       |
| `"11"`      | wallets YAML                                           | Yes       |
| `"12"`      | general (`configs`, `others`) YAML                     | No        |
| `"1"`       | legacy monolithic config (migrated away on first read) | Yes       |
| `"3"`–`"8"` | misc settings (autoBackup, querySize, etc.)            | No        |
| `"996"`     | stableCoins                                            | No        |
| `"997"`     | license (JWT)                                          | No        |
| `"998"`     | clientInfo                                             | No        |

- Encrypted values are prefixed with `"!ent:"` and produced/consumed by Rust commands `encrypt`/`decrypt` (magic-crypt via `invoke()`).
- Config is YAML-serialized (not JSON). Use `yaml.parse` / `yaml.stringify` from the `yaml` package.
- `getConfiguration()` merges IDs 10/11/12; falls back to legacy ID 1 with inline migration.
- `PRO_API_ENDPOINT = 'https://track3-pro-api.domc.me'` — Pro license verification.

### Database Abstraction (`database.ts`)

SQLite via `@tauri-apps/plugin-sql`. DB file: `track3.db`. Singleton loaded once via `getDatabase()`.

Key helpers (all generic over `T extends object`):

- `saveModelsToDatabase<T>(table, models, conflictResolver='REPLACE')` — bulk `INSERT OR REPLACE/IGNORE … RETURNING *`; strips `undefined` fields automatically.
- `selectFromDatabase<T>(table, where, limit?, orderBy?, plainWhere?, plainWhereValues?)` — builds `SELECT * FROM t WHERE 1=1 AND …` dynamically; use `plainWhere` for raw SQL fragments.
- `selectFromDatabaseWithSql<T>(sql, values)` — raw parameterized select.
- `deleteFromDatabase<T>(table, where, allowFullDelete=false)` — guards against full-table deletes.
- **No ORM** — all SQL is hand-built with lodash helpers.

### Caching System (`datafetch/utils/cache.ts`)

Two-tier cache, both accessed via singleton factory functions:

- `getMemoryCacheInstance(groupKey?)` → in-process `Map`, reset on app restart.
- `getLocalStorageCacheInstance(groupKey?)` → prefixed `localStorage`, survives restarts.
- CEX balance/price data uses group key `"data-fetch"`.
- `CacheCenter.setCache<T>(key, value, ttl=0)` — TTL in **seconds**; `0` = no expiry.
- `asyncMap<K,V>(items, fn, concurrency=1, delay=0, ttl=600)` in `async.ts` wraps `bluebird.map` with automatic memory-cache using item JSON as key.

### HTTP Client (`datafetch/utils/http.ts`)

**Critical:** uses `fetch` from `@tauri-apps/plugin-http`, **not** the browser's native `fetch`. Required by Tauri's sandboxed HTTP permission model.

```ts
sendHttpRequest<T>(method, url, timeout=5000, headers={}, json={}, formData={}): Promise<T>
```

- Auto-sets `content-type: application/json` when `json` is non-empty.
- Throws on `status > 299`.
- Sets `user-agent` to the browser UA string.

### Tauri Commands (`src-tauri/src/main.rs`)

Five commands registered in `invoke_handler`:

| Command                 | Rust signature                                         | Notes                                                                      |
| ----------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `query_coins_prices`    | `(symbols: Vec<String>) → HashMap<String, f64>`        | Always appends `"USDT"` if absent; errors if all prices are 0 (issue #257) |
| `query_binance_balance` | `(api_key, api_secret: String) → HashMap<String, f64>` | Direct Rust Binance impl, bypasses JS HTTP layer                           |
| `download_coins_logos`  | `(handle: AppHandle, coins: Vec<CoinWithPrice>) → ()`  | Saves to `app_cache_dir()`                                                 |
| `encrypt`               | `(data: String) → String`                              | Uses lazy_static `ENT: Ent` singleton (magic-crypt)                        |
| `decrypt`               | `(data: String) → String`                              | Same `ENT` singleton                                                       |

Plugins: `process`, `http`, `updater`, `sql` (×2 — duplicate registration, harmless), `fs`, `shell`, `dialog`, `opener`.

### DB Migrations (`src-tauri/migrations/`)

Directories: `init/`, `v01t02/`, `v02t03/`, `v03t04/`, `v04t05/`.

`init/` holds the initial schema as separate `.sql` files per table (`assets_v2_up.sql`, `asset_prices_up.sql`, `configuration_up.sql`, `currency_rates_up.sql`, `cloud_sync_up.sql`).

Migration is **version-string based** (not sequential integer). Each migration struct (`V1TV2`…`V4TV5`) implements `need_to_run(&previous_version_string)` and `migrate()`. All four are checked in order on every app startup in the Tauri `setup()` closure; `prepare_required_data()` is called afterward to seed required rows.

### Wallet Identity & Aliases (`wallet.ts`)

- All wallet/exchange identities stored in DB are **md5-hashed** (using the `md5` package).
- CEX identity hash: `md5(exchanger.getIdentity())` where `getIdentity()` returns e.g. `"okex-<apiKey>"`.
- Web3 address hash: `md5(address_string)`.
- `WalletAnalyzer` takes `queryAssets` as a constructor argument (injected dependency, not imported directly).
- The pseudo-wallet `"others"` (literal string) is md5'd and represents `others[]` config entries.

### Data Export/Import (`datamanager.ts`)

`ExportData` format: `{ clientVersion?, client?, exportAt, configuration?, historicalData, md5V2 }`.
`md5V2` is computed as `md5(JSON.stringify({ data: JSON.stringify(exportData) }))` — **double-serialized** payload. File I/O via `@tauri-apps/plugin-fs` (`writeTextFile` / `readTextFile`). Domain operations delegate to `ASSET_HANDLER` and `TRANSACTION_HANDLER` singletons in `src/middlelayers/entities/`.
