# Desktop to iPhone feature parity

This inventory follows the desktop route tree in `src/components/index/index.tsx`,
`main-nav.tsx`, `sidebar/index.tsx`, the six Settings tabs, data fetchers, and
assistant skill registry. **Done** means the same operation is reachable on
iPhone. **Adapted** means the operation uses phone navigation, sheets, Files,
or native iOS services. Tests listed here cover the named behavior or its
shared data path; a browser test with mocked Tauri IPC does not prove a
physical device integration. Native checks are recorded in
[PROGRESS.md](PROGRESS.md).
The Xcode target is iPhone only. iPad layouts are outside this parity claim.
The iPhone route tree is in `src/mobile/components/index/index.tsx`.

## Navigation and portfolio pages

| Desktop feature or route | iPhone location | Implementation | Test | Status |
| --- | --- | --- | --- | --- |
| Main navigation, sidebar, `/` redirect | Bottom tabs: Overview, History, Analytics, More; `/` opens Overview | `src/mobile/components/index/index.tsx`, `src/mobile/components/mobile/navigation.tsx` | `tests/e2e/mobile.spec.ts`, `tests/e2e/ios-parity.spec.ts` | Adapted |
| External URL scheme / incoming deep links | No external URL entry point; direct in-app hash routes remain available | `src/mobile/components/index/index.tsx`, `src-tauri/gen/apple/project.yml` | `tests/e2e/ios-settings.spec.ts` covers direct hash routes | N/A for desktop parity: the desktop app registers no URL scheme, and this port adds none |
| `/overview`: total, change, P&L, allocation, rankings | Overview tab; Show More reveals rankings | `src/mobile/components/overview.tsx`, `total-value-and-change.tsx`, `pnl.tsx`, `latest-assets-percentage.tsx`, `top-coins-rank.tsx` | `tests/e2e/mobile.spec.ts`, `src/mobile/components/overview-mobile-density.test.tsx` | Adapted |
| `/summary`: all-time analytics | Analytics tab | `src/mobile/components/summary.tsx`, `ath-value.tsx`, `profit-metrics.tsx`, `profit-summary.tsx`, `profit.tsx` | `tests/e2e/ios-parity.spec.ts`, `src/mobile/components/profit-metrics.test.tsx` | Adapted |
| `/wallets`: balances, allocation, changes, per-source view | Analytics → Wallets; tap source or change row | `src/mobile/components/wallet-analytics.tsx`, `wallet-assets-percentage.tsx`, `wallet-assets-change.tsx` | `tests/e2e/mobile.spec.ts`, `src/mobile/components/wallet-assets-percentage.test.tsx` | Adapted |
| `/comparison`: snapshot dates, absolute and relative change | Analytics → Comparison; date sheet and range swipes | `src/mobile/components/comparison.tsx` | `tests/e2e/mobile.spec.ts`, `src/mobile/components/comparison-page.test.tsx` | Adapted |
| `/cost-basis`: FIFO/LIFO/HIFO/Average, realized/unrealized, tax year, dates, holding period, CSV/JSON export | Analytics → Cost basis; method, filter and export controls | `src/mobile/components/cost-basis.tsx`, `src/middlelayers/cost-basis-report.ts` | `tests/e2e/mobile.spec.ts`, `src/mobile/components/cost-basis.test.tsx`, `src/middlelayers/cost-basis-data.test.ts` | Adapted |
| `/coins/:symbol`: crypto/stock detail, holdings, transactions, price/type edits | Tap an asset in Overview or Analytics; transaction detail sheet | `src/mobile/components/coin-analytics.tsx`, `coins-amount-and-value-change.tsx` | `tests/e2e/mobile.spec.ts`, `src/mobile/components/coin-analytics.test.tsx` | Adapted |
| `/history`: snapshot list/detail, pagination, delete and undo | History tab; swipe a row or open detail | `src/mobile/components/historical-data.tsx`, `src/middlelayers/charts-history.ts` | `tests/e2e/mobile.spec.ts`, `src/components/historical-data-performance.test.tsx` | Adapted |
| `/rebalance`: targets, tolerance, equal/current presets, normalize, cash, minimum trade, ignore small holdings, suggestions, CSV export | More → Rebalance; target sliders, trade options and result cards | `src/mobile/components/rebalance.tsx`, `src/middlelayers/rebalance.ts` | `tests/e2e/ios-parity.spec.ts`, `src/mobile/components/rebalance.test.tsx` | Adapted |
| `/goals`: seven goal/alert rule kinds, progress, history, acknowledge, delete | More → Goals & Alerts; full-screen rule editor | `src/mobile/components/goals-alerts.tsx`, `src/middlelayers/alerts.ts` | `tests/e2e/ios-parity.spec.ts`, `src/mobile/components/goals-alerts.test.tsx` | Adapted |
| `/assistant`, `/assistant/:sessionId`: chat, sessions, tools, approval cards | More → Assistant; session list, keyboard-aware composer | `src/mobile/components/assistant/chat-page.tsx`, `action-card.tsx`, `use-chat-sessions.ts` | `tests/e2e/ios-parity.spec.ts`, `src/mobile/components/assistant/chat-page.test.tsx`, `tests/e2e/ai-setup.spec.ts` | Adapted |
| `/settings` and nested routes | More → Settings → focused page; Back returns through Settings | `src/mobile/components/settings/index.tsx`, `src/mobile/components/index/index.tsx` | `tests/e2e/ios-settings.spec.ts` | Adapted |
| Date range and refresh, source status and retry | Overview header date sheet; Refresh button or pull down | `src/mobile/components/date-picker.tsx`, `refresh-data.tsx`, `src/mobile/components/mobile/index.tsx` | `tests/e2e/mobile.spec.ts`, `tests/e2e/ios-settings.spec.ts`, `src/mobile/components/refresh-data.test.tsx` | Adapted |
| Unread alert navigation badge | More tab badge, Goals & Alerts history | `src/mobile/components/use-alert-badge.ts`, `src/mobile/components/mobile/navigation.tsx` | `src/mobile/components/use-alert-badge.test.ts`, `src/mobile/components/mobile/navigation.test.tsx` | Adapted |

## Settings and local data

| Desktop feature or setting | iPhone location | Implementation | Test | Status |
| --- | --- | --- | --- | --- |
| Exchange add/edit, credentials, active toggle, remove, quick view | More → Settings → Data sources → Exchanges | `src/mobile/components/configuration/mobile-sources.tsx`, `configuration/index.tsx` | `src/mobile/components/configuration/mobile-sources.test.tsx`, `tests/e2e/ios-parity.spec.ts`, `tests/e2e/ios-settings.spec.ts` | Adapted |
| Wallet add/edit, address validation, active toggle, remove, quick view | More → Settings → Data sources → Wallets | `src/mobile/components/configuration/mobile-sources.tsx`, `configuration/index.tsx` | `src/mobile/components/configuration/mobile-sources.test.tsx`, `tests/e2e/ios-parity.spec.ts` | Adapted |
| IBKR Flex Query ID and Token, active toggle, remove | More → Settings → Data sources → Brokers | `src/mobile/components/configuration/mobile-sources.tsx`, `configuration/stock-broker-section.tsx` | `src/mobile/components/configuration/mobile-sources.test.tsx`, `configuration/stock-broker-section.test.tsx` | Adapted |
| Custom asset/stock holdings and source attachment | More → Settings → Data sources → Custom assets | `src/mobile/components/configuration/mobile-others.tsx`, `configuration/attach-modal.tsx` | `tests/e2e/ios-parity.spec.ts`, `src/mobile/components/configuration/mobile-others.test.tsx` | Adapted |
| Preferred/base currency, currency rate update | More → Settings → Currency | `src/mobile/components/configuration/general-settings.tsx`, `src/middlelayers/configuration.ts` | `tests/e2e/ios-settings.spec.ts`, `src/mobile/components/configuration-base-currency.test.tsx` | Adapted |
| Group USD stablecoins | More → Settings → Currency → Group USD stablecoins | `src/mobile/components/configuration/general-settings.tsx` | `src/mobile/components/configuration/general-settings.test.tsx` | Done |
| Hide inactive sources | More → Settings → Currency → Hide inactive sources | `src/mobile/components/configuration/general-settings.tsx` | `src/mobile/components/configuration/general-settings.test.tsx` | Done |
| History query size | More → Settings → Currency → Count of results | `src/mobile/components/configuration/general-settings.tsx` | `src/mobile/components/configuration/general-settings.test.tsx` | Done |
| Theme: light, dark, follow system | More → Settings → Appearance | `src/mobile/components/appearance.tsx`, `common/theme/index.tsx` | `tests/e2e/ios-parity.spec.ts`, `src/mobile/components/appearance-mobile.test.tsx` | Adapted |
| Gain/loss quote colors | More → Settings → Appearance | `src/mobile/components/appearance.tsx` | `src/mobile/components/appearance-mobile.test.tsx` | Done |
| English and Simplified Chinese | More → Settings → Language | `src/i18n/index.tsx`, `locales/en.json`, `locales/zh.json` | `tests/e2e/ios-parity.spec.ts`, `src/i18n/locales/catalog-parity.test.ts` | Done |
| Token blacklist and undo removal | More → Settings → Blacklist | `src/mobile/components/data-management.tsx`, `src/middlelayers/configuration.ts` | `src/mobile/components/data-management-blacklist.test.tsx` | Adapted |
| Pro status, subscription period, license entry/verification and device deactivation | More → Settings → Pro and license | `src/mobile/components/system-info.tsx`, `src/middlelayers/license.ts` | `src/mobile/components/system-info-subscription.test.tsx`, `tests/e2e/ios-settings.spec.ts` | Adapted |
| Desktop external subscription checkout links | Pro and license keeps license entry; checkout links are hidden | `src/mobile/components/system-info.tsx` | `src/mobile/components/system-info-subscription.test.tsx` | N/A on iOS: desktop external checkout is not an iOS purchase flow; a future in-app purchase needs App Store integration |
| Assistant endpoint, API key, model and connection test | More → Settings → AI assistant → Connection and Model | `src/mobile/components/settings/assistant.tsx`, `src/middlelayers/configuration.ts` | `src/components/settings/assistant.test.tsx`, `tests/e2e/ios-settings.spec.ts` | Done |
| Assistant context size, input/output token prices and usage | More → Settings → AI assistant → Context and Pricing; usage in chat | `src/mobile/components/settings/assistant.tsx`, `src/mobile/components/assistant/chat-page.tsx` | `src/components/settings/assistant.test.tsx`, `src/mobile/components/assistant/chat-page.test.tsx` | Done |
| Assistant advanced JSON (`temperature`, `top_p`, headers, extra body, provider) | More → Settings → AI assistant → Advanced JSON | `src/mobile/components/settings/assistant.tsx` | `src/components/settings/assistant.test.tsx` | Done |
| Assistant actions and proactive insight summary switches | More → Settings → AI assistant → Action and insight controls | `src/mobile/components/settings/assistant.tsx`, `src/mobile/components/insights-card.tsx` | `src/components/settings/assistant.test.tsx`, `src/components/insights-card.test.tsx` | Done |
| JSON export/import, optional configuration, conflict resolution | More → Settings → Backup → Export, Share JSON or Import | `src/mobile/components/data-management.tsx`, `src/middlelayers/datamanager.ts`, `src/utils/export-file.ts` | `tests/e2e/ios-parity.spec.ts`, `src/middlelayers/datamanager.test.ts` | Adapted |
| Automatic monthly backup and restore, status, folder clearing | More → Settings → Backup → automatic backup in Documents; last backup and import dates appear inline | `src/mobile/components/data-management.tsx`, `src/middlelayers/data.ts` | `src/mobile/components/data-management-blacklist.test.tsx`, `src/mobile/components/auto-backup-indicator.test.tsx`, `src/middlelayers/data-auto-backup.test.ts` | Adapted |
| Encryption key rotation and recovery notice | More → Settings → Security → Update Encryption Key; startup notice | `src/mobile/components/data-management.tsx`, `ios-key-recovery-notice.tsx`, `src-tauri/src/ent.rs` | `src/mobile/components/ios-key-recovery-notice.test.tsx`, `src-tauri/pure-tests` | Adapted |
| Face ID/Touch ID/passcode lock, app switcher cover | More → Settings → Security → App lock | `src/mobile/components/data-management.tsx`, `src-tauri/gen/apple/Sources/track3/Track3Native.swift` | `src/mobile/components/data-management-blacklist.test.tsx`; device check pending | Adapted |
| Encrypted S3 endpoint, region, bucket, prefix, access key ID and secret, path style, connection test | More → Settings → Backup and sync → Connection | `src/mobile/components/settings/sync.tsx`, `src/middlelayers/sync/settings.ts` | `src/components/settings/sync.test.tsx`, `src/middlelayers/sync/s3-client.test.ts` | Done |
| Sync passphrase setup, confirmation and per-session unlock | More → Settings → Backup and sync → Passphrase | `src/mobile/components/settings/sync.tsx`, `src/middlelayers/sync/runtime.ts` | `src/components/settings/sync.test.tsx`, `src/middlelayers/sync/runtime.test.ts` | Done |
| Sync category switches: history, settings, secrets, rebalance and chat | More → Settings → Backup and sync → Categories | `src/mobile/components/settings/sync.tsx`, `src/middlelayers/sync/runtime.ts` | `src/components/settings/sync.test.tsx` | Done |
| Sync settings conflict resolution, local or remote | More → Settings → Backup and sync → Configuration conflicts | `src/mobile/components/settings/sync.tsx`, `src/middlelayers/sync/runtime.ts` | `src/components/settings/sync.test.tsx` | Done |
| Sync device list, rename, last upload, Sync now, disable and forget remote | More → Settings → Backup and sync → Devices | `src/mobile/components/settings/sync.tsx`, `src/middlelayers/sync/runtime.ts` | `src/components/settings/sync.test.tsx`, `src/middlelayers/sync/runtime.test.ts` | Done |
| App version, system details, About | More → Settings → About | `src/mobile/components/system-info.tsx` | `tests/e2e/ios-settings.spec.ts` | Adapted |
| Desktop updater and app relaunch controls | No iPhone control; releases install through App Store or TestFlight | `src/mobile/components/auto-updater.tsx` is gated by `isIOS()` | `src/mobile/components/auto-updater.test.tsx` | N/A on iOS: iOS owns app installation and updates |
| Sidebar collapse, window chrome, tray, right-click menus, drag regions and keyboard shortcuts | Bottom tabs, sheets and touch actions supply the relevant navigation/actions | `src/mobile/components/index/index.tsx`, `src/mobile/components/mobile/` | `tests/e2e/mobile.spec.ts` | N/A on iOS: these are desktop window and pointer controls |

## Goal and alert rules

Every rule is created in More → Goals & Alerts → Add alert and can be
edited, enabled or disabled, and removed there. Triggered records appear
in the History section of that page with acknowledge and clear controls.
The iPhone editor uses `src/mobile/components/goals-alerts.tsx`; evaluation and
persistence remain in `src/middlelayers/alerts.ts`.

| Desktop rule | iPhone control | Implementation | Test | Status |
| --- | --- | --- | --- | --- |
| Portfolio total value target | Add alert → Portfolio value target | `src/mobile/components/goals-alerts.tsx`, `src/middlelayers/alerts.ts` | `src/middlelayers/alerts.test.ts`, `tests/e2e/ios-parity.spec.ts` | Adapted |
| Asset holding value target | Add alert → Asset value target | `src/mobile/components/goals-alerts.tsx`, `src/middlelayers/alerts.ts` | `src/middlelayers/alerts.test.ts` | Adapted |
| Asset price target | Add alert → Asset price target | `src/mobile/components/goals-alerts.tsx`, `src/middlelayers/alerts.ts` | `src/middlelayers/alerts.test.ts` | Adapted |
| Asset price move over 24h, 7d or 30d | Add alert → Asset price move | `src/mobile/components/goals-alerts.tsx`, `src/middlelayers/alerts.ts` | `src/middlelayers/alerts.test.ts` | Adapted |
| Allocation deviation from rebalance target | Add alert → Allocation deviation | `src/mobile/components/goals-alerts.tsx`, `src/middlelayers/alerts.ts` | `src/middlelayers/alerts.test.ts` | Adapted |
| Period portfolio P&L | Add alert → Period P&L | `src/mobile/components/goals-alerts.tsx`, `src/middlelayers/alerts.ts` | `src/middlelayers/alerts.test.ts` | Adapted |
| Portfolio value change over a period | Add alert → Portfolio value change | `src/mobile/components/goals-alerts.tsx`, `src/middlelayers/alerts.ts` | `src/middlelayers/alerts.test.ts` | Adapted |
| Threshold direction, 24h/7d/30d window and cooldown | Add alert → Comparator, Window and Cooldown | `src/mobile/components/goals-alerts.tsx`, `src/middlelayers/alerts.ts` | `src/mobile/components/goals-alerts.test.tsx`, `src/middlelayers/alerts.test.ts` | Adapted |

## Data sources and prices

Each row uses the existing refresh and price pipeline; the iPhone source form
only changes how credentials or addresses are entered. A missing live provider
response cannot be proved by mocked browser IPC.

| Desktop integration | iPhone location | Implementation | Test | Status |
| --- | --- | --- | --- | --- |
| Binance | Settings → Data sources → Add exchange → Binance | `src/middlelayers/datafetch/coins/cex/binance.ts`, `src-tauri/src/binance.rs` | `src/middlelayers/datafetch/coins/cex/binance.test.ts` | Done |
| OKX | Settings → Data sources → Add exchange → OKX | `src/middlelayers/datafetch/coins/cex/okx.ts` | `src/middlelayers/datafetch/coins/cex/okx.test.ts` | Done |
| Bitget | Settings → Data sources → Add exchange → Bitget | `src/middlelayers/datafetch/coins/cex/bitget.ts` | `src/middlelayers/datafetch/coins/cex/bitget.test.ts` | Done |
| Gate.io | Settings → Data sources → Add exchange → Gate.io | `src/middlelayers/datafetch/coins/cex/gate.ts` | `src/middlelayers/datafetch/coins/cex/gate.test.ts` | Done |
| Kraken | Settings → Data sources → Add exchange → Kraken | `src/middlelayers/datafetch/coins/cex/kraken.ts` | `src/middlelayers/datafetch/coins/cex/kraken.test.ts` | Done |
| Coinbase | Settings → Data sources → Add exchange → Coinbase | `src/middlelayers/datafetch/coins/cex/coinbase.ts` | `src/middlelayers/datafetch/coins/cex/coinbase.test.ts` | Done |
| Bybit | Settings → Data sources → Add exchange → Bybit | `src/middlelayers/datafetch/coins/cex/bybit.ts` | `src/middlelayers/datafetch/coins/cex/bybit.test.ts` | Done |
| HTX | Settings → Data sources → Add exchange → HTX | `src/middlelayers/datafetch/coins/cex/htx.ts` | `src/middlelayers/datafetch/coins/cex/htx.test.ts` | Done |
| MEXC | Settings → Data sources → Add exchange → MEXC | `src/middlelayers/datafetch/coins/cex/mexc.ts` | `src/middlelayers/datafetch/coins/cex/mexc.test.ts` | Done |
| Backpack | Settings → Data sources → Add exchange → Backpack | `src/middlelayers/datafetch/coins/cex/backpack.ts` | `src/middlelayers/datafetch/coins/cex/backpack.test.ts` | Done |
| Catch-all exchange and unknown ticker mapping | Refresh → source status; same adapter is retained | `src/middlelayers/datafetch/coins/cex/others.ts`, `coins/others.ts` | `src/middlelayers/datafetch/coins/cex/others.test.ts`, `coins/others.test.ts` | Done |
| BTC | Settings → Data sources → Add wallet → BTC | `src/middlelayers/datafetch/coins/btc.ts` | `src/middlelayers/datafetch/coins/btc.test.ts` | Done |
| Ethereum/ERC20 and supported EVM chains (Pro) | Settings → Data sources → Add wallet → ERC20 | `src/middlelayers/datafetch/coins/erc20.ts` | `src/middlelayers/datafetch/coins/erc20.test.ts` | Done |
| SOL | Settings → Data sources → Add wallet → SOL | `src/middlelayers/datafetch/coins/sol.ts` | `src/middlelayers/datafetch/coins/sol.test.ts` | Done |
| DOGE | Settings → Data sources → Add wallet → DOGE | `src/middlelayers/datafetch/coins/doge.ts` | `src/middlelayers/datafetch/coins/doge.test.ts` | Done |
| TRON/TRC20 (Pro) | Settings → Data sources → Add wallet → TRC20 | `src/middlelayers/datafetch/coins/trc20.ts` | `src/middlelayers/datafetch/coins/trc20.test.ts` | Done |
| TON | Settings → Data sources → Add wallet → TON | `src/middlelayers/datafetch/coins/ton.ts` | `src/middlelayers/datafetch/coins/ton.test.ts` | Done |
| SUI | Settings → Data sources → Add wallet → SUI | `src/middlelayers/datafetch/coins/sui.ts` | `src/middlelayers/datafetch/coins/sui.test.ts` | Done |
| IBKR Flex stocks | Settings → Data sources → Add broker → Interactive Brokers | `src/middlelayers/datafetch/coins/stock/ibkr.ts` | `src/middlelayers/datafetch/coins/stock/ibkr.test.ts` | Done |
| CoinGecko, exchange and stock prices; stablecoin list | Refresh and every value/chart screen | `src/middlelayers/datafetch/coins/price.ts`, `stable.ts`, `stock/stock-analyzer.ts`, `src-tauri/src/info.rs` | `src/middlelayers/datafetch/coins/price.test.ts`, `stable.test.ts`, `stock/stock-analyzer.test.ts` | Done |

## Charts and calculations

Line and bar charts keep touch inspection through `src/mobile/components/pnl-chart.tsx`
and `src/mobile/components/finance-charts.tsx`; chart gestures allow vertical page
scrolling. The allocation doughnut accepts nearby taps.

| Desktop chart or calculation | iPhone location | Implementation | Test | Status |
| --- | --- | --- | --- | --- |
| Portfolio total and P&L time series | Overview → total/P&L; Analytics → profit summary | `src/mobile/components/pnl-chart.tsx`, `pnl.tsx`, `profit-summary.tsx` | `src/mobile/components/finance-charts.test.tsx`, `src/middlelayers/charts-timeseries-large.test.ts` | Adapted |
| Latest asset allocation doughnut | Overview → allocation | `src/mobile/components/latest-assets-percentage.tsx` | `src/mobile/components/latest-assets-percentage.test.tsx`, `tests/e2e/mobile.spec.ts` | Adapted |
| Asset percentage change and top-coin change/ranking | Overview → Show More | `src/mobile/components/assets-percentage-change.tsx`, `top-coins-percentage-change.tsx`, `top-coins-rank.tsx` | `src/mobile/components/assets-percentage-change.test.tsx`, `top-coins-percentage-change.test.tsx` | Adapted |
| ATH, profit metrics, profit by asset, attribution | Analytics → cards and profit | `src/mobile/components/ath-value.tsx`, `profit-metrics.tsx`, `profit.tsx`, `profit-attribution.tsx` | `src/mobile/components/profit-metrics.test.tsx`, `profit-attribution.test.tsx` | Adapted |
| Wallet proportion and wallet change | Analytics → Wallets | `src/mobile/components/wallet-assets-percentage.tsx`, `wallet-assets-change.tsx` | `src/mobile/components/wallet-assets-percentage.test.tsx`, `tests/e2e/mobile.spec.ts` | Adapted |
| Coin amount/value history and transactions | Tap an asset → detail and transaction sheet | `src/mobile/components/coins-amount-and-value-change.tsx`, `coin-analytics.tsx` | `src/mobile/components/coins-amount-and-value-change.test.tsx`, `tests/e2e/mobile.spec.ts` | Adapted |
| FIFO/LIFO/HIFO/Average cost basis, realized by asset and cumulative gains | Analytics → Cost basis → method/date | `src/mobile/components/cost-basis.tsx`, `finance-charts.tsx` | `src/mobile/components/cost-basis.test.tsx`, `finance-charts.test.tsx` | Adapted |
| Goal progress and portfolio value history chart | More → Goals & Alerts | `src/mobile/components/goals-alerts.tsx`, `finance-charts.tsx` | `src/mobile/components/goals-alerts.test.tsx`, `finance-charts.test.tsx` | Adapted |
| Rebalance current versus target and deviation charts | More → Rebalance → Details | `src/mobile/components/rebalance.tsx`, `finance-charts.tsx` | `src/mobile/components/rebalance.test.tsx`, `finance-charts.test.tsx` | Adapted |
| Comparison snapshots and attribution metrics | Analytics → Comparison | `src/mobile/components/comparison.tsx` | `src/mobile/components/comparison-page.test.tsx`, `tests/e2e/mobile.spec.ts` | Adapted |
| Large-history aggregation and chart downsampling | History, Overview, Analytics and detail charts | `src/middlelayers/charts-history.ts`, `charts-timeseries.ts`, `chart-downsample.ts` | `src/middlelayers/charts-history-page.test.ts`, `charts-timeseries-large.test.ts`, `chart-downsample.test.ts` | Done |

## Assistant tools

All tools remain registered through `src/middlelayers/ai/skills/index.ts`.
They are reached from More → Assistant, and write actions still require the
chat confirmation card. Model access requires the user's configured provider.

| Desktop skill | iPhone location | Implementation | Test | Status |
| --- | --- | --- | --- | --- |
| `asset_snapshot`, `asset_detail`, `asset_history` | Assistant chat | `src/middlelayers/ai/skills/asset-{snapshot,detail,history}.ts` | `src/middlelayers/ai/skills/asset-{snapshot,detail,history}.test.ts` | Done |
| `portfolio_value`, `portfolio_comparison` | Assistant chat | `src/middlelayers/ai/skills/portfolio-{value,comparison}.ts` | `src/middlelayers/ai/skills/portfolio-comparison.test.ts`, `src/test/eval/golden.test.ts` | Done |
| `transaction_list`, `transaction_stats` | Assistant chat | `src/middlelayers/ai/skills/transaction-{list,stats}.ts` | `src/middlelayers/ai/skills/transaction-stats.test.ts`, `src/test/eval/golden.test.ts` | Done |
| `cost-basis`, `market_price`, `current_context` | Assistant chat | `src/middlelayers/ai/skills/{cost-basis,market-price,current-context}.ts` | Corresponding skill tests | Done |
| `rebalance-status`, `rebalance-suggest`, `goals-status` | Assistant chat; approval can open Rebalance | `src/middlelayers/ai/skills/{rebalance-status,rebalance-suggest,goals-status}.ts` | `src/middlelayers/ai/skills/rebalance-skills.test.ts`, `goals-status.test.ts`, `tests/e2e/ai-setup.spec.ts` | Adapted |
| Insights and approved assistant actions | Assistant chat and Insights cards | `src/mobile/components/insights-card.tsx`, `assistant/action-card.tsx`, `src/middlelayers/ai/actions/` | `src/components/insights-card.test.tsx`, `assistant/action-card.test.tsx` | Done |

## Platform limits

- Refresh and automatic backup run while the app is active. iOS may suspend
  WKWebView in the background; scheduled execution after suspension is not
  guaranteed. See [RELEASE.md](RELEASE.md).
- iPhone Files import/export and the share sheet are available. Keychain,
  Face ID, app switcher cover, notification badge, and Files/iCloud Drive
  behavior still need checks on a signed physical device.
- The desktop does not offer camera wallet scanning. The iPhone form accepts
  typed or pasted addresses; camera scanning is an unimplemented iOS
  enhancement, not a removed desktop feature.
