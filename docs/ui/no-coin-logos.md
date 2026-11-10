# Coin and stock logo inventory

Inventory of TS/TSX renderers and CSS image or initials tiles. Coin and stock symbols, amounts, chart colors, and `STOCK` text tags remain. Source marks identify a wallet, exchange, or broker rather than a held asset.

| File | What it rendered | Action |
| --- | --- | --- |
| `src/components/latest-assets-percentage.tsx`, `src/mobile/components/latest-assets-percentage.tsx` | Allocation and holding row token images | Removed |
| `src/components/top-coins-rank.tsx`, `src/mobile/components/top-coins-rank.tsx` | Ranked coin and stock images | Removed |
| `src/components/top-coins-percentage-change.tsx`, `src/mobile/components/top-coins-percentage-change.tsx` | Mover row token images | Removed |
| `src/components/profit.tsx`, `src/mobile/components/profit.tsx` | Summary gainer and loser images | Removed |
| `src/mobile/components/profit-attribution.tsx` | Coin attribution images and stock initials tiles | Removed; source and wallet marks kept |
| `src/components/comparison.tsx`, `src/mobile/components/comparison.tsx` | Comparison coin images and mobile asset card images | Removed |
| `src/components/historical-data.tsx`, `src/mobile/components/historical-data.tsx` | Snapshot row image stacks and historical asset images | Removed |
| `src/components/common/image-stack/` | Historical asset image stack component and CSS | Removed |
| `src/assets/icons/stock-default-logo.svg` | Stock fallback icon | Removed after all references were removed |
| `src/components/coin-analytics.tsx`, `src/mobile/components/coin-analytics.tsx` | Asset detail header and selector images | Removed |
| `src/components/realtime-total-value.tsx` | Live value popover coin images | Removed |
| `src/components/blacklist-design.tsx` | Blacklisted symbol initials tile | Removed |
| `src/mobile/components/fidelity-blacklist.tsx` | Mobile blacklist symbol initials tile | Removed |
| `src/components/configuration/quick-look-dialog.tsx`, `src/mobile/components/configuration/quick-look-dialog.tsx` | Asset balance preview coin images | Removed |
| `src/components/configuration/index.tsx`, `src/mobile/components/configuration/index.tsx` | Coin image lookup for the quick look preview | Removed |
| `src/mobile/components/mobile/mobile.css`, `src/style.css` | Empty asset image tracks, offsets, and tiles | Removed |
| `src/middlelayers/data.ts`, `src/utils/app.ts`, `src/utils/assets.ts` | Frontend coin logo download, cached file lookup, and fallback helpers | Removed |
| `src/components/configuration/exchange-section.tsx`, `src/components/configuration/wallet-section.tsx`, `src/components/configuration/stock-broker-section.tsx`, `src/components/configuration/attach-modal.tsx` | Settings source card and picker brand images | Kept because configuration |
| `src/components/configuration/source-design.tsx`, `src/components/configuration/source-editor-design.tsx` | Settings source and editor identity marks, including Others source marks | Kept because configuration |
| `src/mobile/components/configuration/mobile-sources.tsx`, `src/mobile/components/configuration/mobile-others.tsx`, `src/mobile/components/configuration/attach-modal.tsx` | Mobile Settings source and editor brand images | Kept because configuration |
| `src/mobile/components/configuration/fidelity-source-editor.tsx`, `src/mobile/components/configuration/quick-look-dialog.tsx` | Mobile source editor and quick look source mark | Kept because configuration |
| `src/components/onboarding/onboarding-guide.tsx`, `src/mobile/components/first-run-fidelity.tsx` | App mark and first run source identity | Kept because configuration or app brand |
| `src/components/wallet-assets-change.tsx`, `src/mobile/components/wallet-assets-change.tsx` | Wallet type image in Wallets | Kept because wallet outside configuration |
| `src/components/overview-panels.tsx`, `src/mobile/components/overview-fidelity.tsx`, `src/mobile/components/partial-overview-fidelity.tsx`, `src/mobile/components/refresh-data.tsx`, `src/mobile/components/source-mark.tsx` | Source identity and status marks | Kept because exchange or wallet outside configuration |

The frontend coin image lookup, download call, fallback stock asset, and unused image stack were deleted. Exchange and wallet images under `src/assets/icons/` remain referenced by the configuration. The unused Rust coin logo command and downloader were also removed. On startup, the app makes a best-effort attempt to remove old cached coin icons from `app_cache_dir/assets/coins`, including the obsolete blacklist file, without touching other cache entries. Stored database and sync formats remain unchanged.

Release note for the next release: Removed unused coin icon downloads and cleaned up previously cached coin icons at startup.
