# Asset and source icons

Track3 uses the website's logo tile as the common shape for coin, exchange, wallet chain, broker, stock and custom assets. `AssetIcon` owns logo resolution and fallback, using the existing brand catalogue in `WALLET_LOGS`. `AssetLabel` owns icon and text alignment. Brand files stay unchanged.

## Tile

| Context | Tile size | Padding | Radius |
| --- | ---: | ---: | ---: |
| Chips | 16 px | 2 px | 4 px |
| Tables and lists | 20 px | 3 px | 4 px |
| Settings cards and source status | 24 px | 3 px | 6 px |
| Detail headers | 32 px | 4 px | 6 px |

Every tile has a 1 px border, a neutral background and no shadow, ring, gradient or coloured badge. Light uses a white background and `hsl(var(--border))`. Dark uses `#f4f4f5` and a 10% white border. The near white dark tile is intentional: logos with black strokes stay readable and the same brand file works in both themes. Images retain their original colours and fit inside the tile. When a coin row supplies no image, `AssetIcon` looks up its cached coin logo before using a bundled chain mark. If the cached logo fails, it tries the bundled chain mark. When no image works, the tile shows one ticker or source initial at 16/20 px and two at 24/32 px; a stock uses its ticker initial(s), and a custom asset uses the generic coin glyph. Images are lazy loaded and have explicit dimensions.

`AssetLabel` aligns the tile with the first text line. The gap is 8 px for tiles sized 16 or 20 px, and 10 px for tiles sized 24 or 32 px. Names are 13 px / 500 with ellipsis, secondary lines are 12 px and muted, and the shared `Tag` sits 6 px after the name.
On the 390 px Summary table and iPad Comparison movers, the stock tag sits below its ticker within the first column so the ticker, amount and movement bar remain fully visible. Attribution retains its localized stock label and omits a duplicate stock tag.
At 1280 px, History keeps its snapshot list beside the detail. The detail keeps room for the 20 px asset tile, the delete target and separate quantity, price, value and share columns.

The coin only `data-quiet` treatment is used in dense data tables and lists. It sets image opacity to .92 and saturation to .85. Exchange, wallet and broker brand marks never receive the filter. In the 11 asset mover fixture, the tile's mean RGB chroma drops by more than 4% in both light and dark (`tests/e2e/icon-quiet.spec.ts`). The before and after contact sheets at `~/.hermes/projects/track3-design/icons/` record the visual review. The restrained coin treatment keeps the colourful round logos from dominating values; the neutral tile supplies the primary calming effect.

## Legacy page pixel comparison

On 8 Nov, the source HTML pages were rendered again at the same dark viewport sizes as the UI42 app contact captures. A pixel counts when any RGB channel differs by more than 20. The raw viewport ratios are:

| Page | Before UI42 | UI42 tiles |
| --- | ---: | ---: |
| Desktop Overview | 11.18% | 11.67% |
| Desktop Summary | 15.27% | 15.56% |
| Desktop Comparison | 10.79% | 11.04% |
| Desktop Wallets | 11.42% | 11.81% |
| Desktop Sources | 11.78% | 11.80% |
| Desktop coin detail | 10.46% | 10.53% |
| Desktop History | 13.95% | 14.62% |
| Desktop Rebalance | 14.45% | 14.52% |
| Phone Overview | 17.27% | 16.70% |
| Phone Summary | 16.40% | 17.56% |

Source screenshots are `/tmp/ui42-source-<page>.png`; app screenshots are in the contact sheet's `before/` and `after/` directories. These older page sources predate the owner's website-tile direction and use different static data from the 11-asset and 16-source app fixtures, so their full-screen ratios do not measure the icon treatment in isolation. The phone Summary before and after captures also use different fixtures and must not be compared with each other. The page-specific product and capture differences are listed under “Remaining differences” in `docs/ui/fidelity/<page>.md`. Chromium `getComputedStyle()` and `getBoundingClientRect()` remeasurement found that the source site's `.source-grid img` and the UI42 light tile both use a 32 px square, 4 px padding, 6 px radius, white background and `object-fit: contain`. The source border is `#e5e5e5`; the app uses its required border token, computed as `#d4d4d8`. The app's 16/20/24/32 px tiles measured at their declared widths and heights with 2/3/3/4 px padding and 4/4/6/6 px radii. The supplied source pages have no light-theme equivalent, so there is no light source-page pixel ratio.

## Replaced locations

| Surface | Shared rows and cells | Size |
| --- | --- | ---: |
| Overview | holdings, top coins, what moved, source status, partial overview source list, live total | 20; source status 24 |
| Summary | top profit, top loss, unknown, profit table, attribution by coin, source, wallet and asset type | 20 |
| Comparison | per asset table and mover rows, including fidelity view | 20 |
| Wallets | source picker chips, source allocation, source balances, changes, status, matrix headers and cells, mover rows | 16 chips; 20 rows |
| Coin detail | coin identity, asset selector, holdings by source | 32 header; 20 rows |
| History | asset detail rows, desktop Assets at that time, and snapshot logo previews | 20; 24 large previews |
| Cost basis | chart legend, averages and open lots | 20 |
| Rebalance | target allocations, suggested trades and legacy trade lists | 20 |
| Goals | asset rule rows | 20 |
| Settings data sources | exchange, wallet, broker and custom cards; provider selectors; source editor; quick look; attachment picker | 24 cards and editor; 20 pickers and details |
| Source and refresh dialogs | source status, partial overview and refresh progress | 20 |
| Other asset lists | top coins rank, price change table, wallet change table | 20 |
| Phone and iPad | matching Overview, Summary, Comparison, Wallets, coin detail, History, Cost basis, Rebalance, Goals, settings and refresh surfaces | same sizes |

### File inventory

| Location | Size |
| --- | --- |
| `src/components/latest-assets-percentage.tsx` holdings | 20 |
| `src/components/overview-panels.tsx` top coins, what moved, source status | 20, 24 |
| `src/components/partial-overview.tsx` included sources | 20 |
| `src/components/realtime-total-value.tsx` live asset rows | 20 |
| `src/components/summary-top-list.tsx` top profit, loss and unknown | 20 |
| `src/components/summary-market-card.tsx` attribution by coin, source, wallet and asset type | 20 |
| `src/components/profit.tsx`, `profit-attribution.tsx` profit and attribution | 20 |
| `src/components/comparison.tsx`, `comparison-movers-panel.tsx`, `comparison-fidelity.tsx` per asset and movers | 20 |
| `src/components/wallet-assets-percentage.tsx`, `source-allocation-list.tsx` picker and allocation | 16, 20 |
| `src/components/wallet-assets-change.tsx`, `wallets-fidelity.tsx` changes, balances, matrix and status | 16, 20 |
| `src/components/wallet-source-changes.tsx` source matrix and changes | 20 |
| `src/components/coin-analytics.tsx`, `coin-fidelity-view.tsx`, `coin-detail-sections.tsx` header, picker and sources | 32, 20 |
| `src/components/historical-data.tsx`, `historical-data-desktop.tsx`, `common/image-stack/index.tsx` snapshot rows and previews | 20, 24 |
| `src/components/cost-basis-desktop-view.tsx` averages and lots | 20 |
| `src/components/rebalance.tsx`, `rebalance-desktop.tsx`, `goals-desktop.tsx` targets, trades and rules | 20 |
| `src/components/configuration/exchange-section.tsx`, `wallet-section.tsx`, `stock-broker-section.tsx` source cards and pickers | 24, 20 |
| `src/components/configuration/source-design.tsx`, `source-editor-design.tsx` data source rows, provider picker and quick look | 24, 20 |
| `src/components/configuration/attach-modal.tsx`, `quick-look-dialog.tsx` source and holding dialogs | 20 |
| `src/components/refresh-data.tsx` source progress and status | 20 |
| `src/components/top-coins-rank.tsx`, `top-coins-percentage-change.tsx` ranked assets | 20 |
| `src/mobile/components/latest-assets-percentage.tsx`, `overview-fidelity.tsx`, `partial-overview-fidelity.tsx`, `first-run-fidelity.tsx` holdings and sources | 20 |
| `src/mobile/components/summary-fidelity.tsx` through shared `SummaryTopList`, `profit.tsx`, `profit-attribution.tsx` | 20 |
| `src/mobile/components/comparison.tsx`, `comparison-fidelity.tsx`, `wallet-fidelity.tsx` comparison, source and matrix rows | 16, 20 |
| `src/mobile/components/wallet-assets-percentage.tsx`, `wallet-assets-change.tsx` pickers and source rows | 16, 20 |
| `src/mobile/components/coin-analytics.tsx`, `coin-fidelity.tsx` header, picker and holdings by source | 32, 20 |
| `src/mobile/components/historical-data.tsx` asset rows and previews | 20, 24 |
| `src/mobile/components/cost-basis.tsx`, `cost-basis-phone.tsx`, `rebalance.tsx`, `rebalance-fidelity.tsx`, `goals-fidelity.tsx` lot, trade and rule rows | 20 |
| `src/mobile/components/configuration/mobile-sources.tsx`, `mobile-others.tsx` source cards, picker and editor | 24, 32 header |
| `src/mobile/components/configuration/attach-modal.tsx`, `quick-look-dialog.tsx` dialog rows | 20 |
| `src/mobile/components/refresh-data.tsx` source progress and status | 20 |
| `src/mobile/components/top-coins-rank.tsx`, `top-coins-percentage-change.tsx` ranked assets | 20 |

Assistant context, chat attachment chips, update dialogs and export previews contain text or user attached image previews rather than coin or source logo rows. They therefore have no brand mark to migrate. UI action icons such as delete, reveal and external link remain outside `AssetIcon`.

No persisted data, formats, i18n catalogues, goldens, guard files or Rust code changed. Existing image snapshot inventories were not edited.
