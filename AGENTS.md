# Project Guidelines

## Code Style
- TypeScript is strict (`tsconfig.json`); fix types instead of suppressing.
- Use path alias `@/*` for local imports (`tsconfig.json`, `vite.config.ts`).
- Keep existing file naming: kebab-case component files in `src/components/`.
- Follow local style per file: TSX often uses semicolons, middlelayers frequently omit them—match nearby code.
- Rust code in `src-tauri/src/` follows `rustfmt` defaults.

## Architecture
- Frontend UI lives in `src/components/`; domain/data orchestration lives in `src/middlelayers/`.
- App shell uses `ThemeProvider` and `ChartResizeContext` in `src/App.tsx`.
- Navigation is `react-router-dom` with `HashRouter`/`Routes` in `src/components/index/index.tsx`.
- Tauri backend commands/plugins are wired in `src-tauri/src/main.rs`; frontend calls via `invoke()` and Tauri plugins.
- CEX fetchers follow the `Exchanger` pattern in `src/middlelayers/datafetch/coins/cex/cex.ts`.

## Build and Test
- Install deps: `yarn install`.
- Frontend dev: `yarn dev` (Vite).
- Desktop dev: `yarn tauri dev`.
- Frontend build/typecheck: `yarn build`.
- Desktop build: `yarn tauri build`.
- Release metadata: `yarn update-release`.
- No unit-test suite yet; validation is build/smoke-run based.

## Project Conventions
- Config is YAML split across fixed IDs in `configuration` table (`10`,`11`,`12`; legacy `1`) in `src/middlelayers/configuration.ts`.
- Encrypted config values are prefixed `!ent:` and use Rust `encrypt`/`decrypt` commands.
- `saveLicense()` uses encrypted storage (ID `997`); do not treat license as plain text config.
- Wallet/exchange identities are md5-hashed (`src/middlelayers/wallet.ts`).
- Keep HTTP calls in data fetchers on `@tauri-apps/plugin-http` wrapper (`src/middlelayers/datafetch/utils/http.ts`), not browser fetch.
- Cache fetch-heavy paths via `CacheCenter` (`src/middlelayers/datafetch/utils/cache.ts`) with explicit TTL seconds.

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
