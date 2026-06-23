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
- **Repo-local skill:** `.agents/skills/version-upgrade/SKILL.md` documents the standard Track3 version bump workflow

## Development Methodology

This project follows **Test-Driven Development (TDD)**. All new features and bug fixes must be written in this order:

1. **Write a failing test** first that defines the expected behavior.
2. **Write the minimal implementation** to make the test pass.
3. **Refactor** the code while keeping tests green.

Tests live alongside the code they test (co-located `*.test.tsx` / `*.test.ts` files under `src/`). Use Vitest as the test runner.

## Build and Test

```bash
corepack yarn install          # Install frontend dependencies
corepack yarn dev              # Frontend dev (Vite)
corepack yarn tauri dev        # Desktop dev (starts Vite on port 1420 + Tauri)
corepack yarn build            # TypeScript compile + Vite production build (frontend only)
corepack yarn tauri build      # Build distributable desktop app
corepack yarn update-release   # Release metadata
```

Tests run via Vitest (`corepack yarn vitest`). All new code must include co-located tests.

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

## Internationalization (i18n)

Track3 supports **English** and **Simplified Chinese** through a lightweight in-house i18n system. There is no external i18n library — the implementation lives in `src/i18n/`.

### Module layout

- `src/i18n/index.tsx` — `I18nProvider`, `useTranslation()` hook, `Locale` type, `SUPPORTED_LOCALES`, `LOCALE_LABELS`, `localeLocalStorageKey` constant.
- `src/i18n/locales/en.json` — English strings.
- `src/i18n/locales/zh.json` — Chinese strings.

Both locale files MUST have identical key sets. The provider falls back to English when a key is missing in the active locale, and to the key string itself when neither locale has it.

### Provider

`I18nProvider` is mounted at the very top of `App` in `src/App.tsx`, wrapping `ThemeProvider`. `useTranslation()` returns a fallback `{ locale: "en", setLocale: noop, t: passthroughT }` when no provider is mounted (used in unit tests that do not wrap with the provider — the passthrough returns the English string for known keys).

### Hook API

```tsx
const { t, locale, setLocale } = useTranslation();
t("nav.overview"); // plain key
t("key.with.{placeholder}", ""); // key + optional fallback
// Template values are applied with String.prototype.replace, e.g.:
t("history.showing")
  .replace("{start}", String(loadedRangeStart))
  .replace("{end}", String(loadedRangeEnd));
```

`setLocale(next)` validates against `SUPPORTED_LOCALES`, updates React state, and persists to `localStorage` under `localeLocalStorageKey` (`"track3-ui-locale"`).

### Locale detection

`detectInitialLocale()` (in `src/i18n/index.tsx`) runs at provider mount:

1. Read `localStorage[localeLocalStorageKey]`; if present and supported, use it.
2. Otherwise inspect `navigator.language`; return `"zh"` when it starts with `"zh"`, else `"en"`.
3. Final fallback: `"en"`.

`document.documentElement.lang` is synced to the active locale on change.

### Settings integration

The user-facing language switcher lives in the **Appearance** tab of Settings (`src/components/appearance.tsx`):

- A new `Card` block (third in the top row) shows the currently selected language.
- A new `Card` section at the bottom of the page renders a `RadioGroup` over `SUPPORTED_LOCALES` with `LOCALE_LABELS` as labels.
- Selecting an option calls `setLocale(locale)` immediately — no `Update Preferences` button is required because language is not persisted through `middlelayers/configuration.ts`.
- Layout and existing theme/quote-color controls are unchanged.

### i18n rules (apply to any new or modified copy)

1. **Copy only.** Translate only user-facing text. Do not change layout, spacing, colors, or behavior when adding translations.
2. **Skip numbers, amounts, dates, ticker symbols, file paths, and config IDs.** These are formatted by utilities (`prettyNumberToLocaleString`, `date-fns`, etc.) and never go through `t()`.
3. **Use the existing key catalog.** Add new keys in a hierarchical, feature-prefixed form (e.g. `feature.section.label`) rather than generic names. Use lowercase dot-separated paths, never nested objects.
4. **Keep `en.json` and `zh.json` in lock-step.** Every key in one must exist in the other. CI/visual QA catches parity breaks because the provider falls back to English silently.
5. **String interpolation goes through `.replace("{name}", value)`.** Do not split a phrase across multiple `t()` calls or concatenate translated fragments.
6. **Render-time keys are OK, but key sets are static.** Keys are looked up at call time, so `t("section.title")` with a dynamic suffix is fine; do not change the JSON shape to support pluralization — keep keys flat.
7. **For dialog/destructive actions, the button label still translates.** The component primitives (`AlertDialogCancel`, `AlertDialogAction`, `Button`) accept a `children` prop, so pass `t("common.cancel")`, `t("common.delete")`, etc. There is no special handling for destructive vs. confirmatory buttons.
8. **Toast descriptions and alert dialog descriptions are translatable.** `useToast({ description: t("...") })` and `<AlertDialogDescription>{t("...")}</AlertDialogDescription>` are the standard patterns.
9. **Developer-only error strings (e.g. `throw new Error("...")`) are not translated.** They are surfaced to logs/devtools, not the UI.
10. **Asset type labels (e.g. `"stock"`, `"crypto"`) are protocol values, not i18n strings.** They come from `AssetType` and must remain stable across locales.

### Testing

- Unit tests render components without wrapping in `I18nProvider`. The `passthroughT` fallback keeps the existing assertions (which check for English strings) green. Do not change those assertions to translated values; instead, add new keys when adding new copy.
- For new tests that need a specific locale, wrap with `<I18nProvider>` and either rely on the initial-locale detection or mock `localStorage`.

### Adding a new language

1. Append the locale code to `SUPPORTED_LOCALES` and `LOCALE_LABELS` in `src/i18n/index.tsx`.
2. Update `detectInitialLocale()` with a detection rule for the new language.
3. Add `src/i18n/locales/<code>.json` containing every key from `en.json` translated.
4. Update the Appearance tab if you want to surface a custom label.

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
