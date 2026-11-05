# Overview desktop fidelity specification

Approved images: `core/overview-desktop.jpg`, `overview-ai-off-desktop.jpg`, `overview-expanded-1024-desktop.jpg`, `overview-expanded-1440-desktop.jpg`, `overview-hover-desktop.jpg`, `overview-range-desktop.jpg`, `overview-stale-desktop.jpg`, `overview-sync-desktop.jpg`. The permanent JPEGs are **1440 px** wide, except the expanded 1024 image; the task description's 1600 px claim differs from the files. Capture at 1600 px as requested and also at each JPEG's native width for pixel comparison.

## Structure and geometry

Measured in headless Chromium from `source/ds/pages/core-overview.html` with `ds.css` and `ds.js`, at 1440 px. The shell has a 56 px icon rail or a 216 px expanded rail. The main area has 28 px horizontal padding, 20 px top padding, 40 px bottom padding, and a 1560 px maximum width. The rail has a logo, Overview, divider, Analyze (Summary, Wallets, Comparison, Cost basis), divider, Manage (History, Rebalance, Goals & alerts, Assistant), and Settings at the bottom. Active item is a 36 px high rounded rectangle with a 2 px blue edge. Collapsed items show tooltips; the alert badge becomes a red dot.

The top bar is at `(84,14)` and is 1328 × 36 px. Left: `Live total`, `$763,809.27`, `+$1,533.16`, green dot. Right: a 30 px pill `Synced 09:41` with green dot and cloud icon, then a bell with badge `2`. The page heading at `(84,64)` is 26 px/32 px, weight 600; the subtitle is 13 px/18 px. It reads `7-day gain of $26,010.84 comes mostly from BTC and SOL; AAPL is the one position down.` Controls on its right: a 260 × 32 px six choice pill segment (`1D`, `7D`, `30D`, `90D`, `1Y`, `All`, with `30D` selected), the 198 × 34 px `1 Oct – 31 Oct 2026` range pill, and the 34 px high `Refresh` pill. Controls have 10 px gaps.

The 12 column grid begins at `(84,132)`, width 1328 px, gap 16 px; each column is 96 px. Every card has a 1 px border, 6 px radius, 20 px padding, background `--surface`, and the design system card shadow.

| Row | Left to right at 1440 px | Height |
| --- | --- | --- |
| 1 | Total value/chart, 8 columns = 880 px; Holdings, 4 columns = 432 px | 449 px |
| 2 | AI insights, Daily change, What moved, each 4 columns = 432 px | 413 px |
| 3 | Top coins, 8 columns = 880 px; Sources, 4 columns = 432 px | 423 px |

The hero has a four column type based KPI strip: `Total value` `$763,809.27` and `Last snapshot 31 Oct, 09:41`; `Latest` `+0.20%` `+$1,533.16 vs 30 Oct`; `7 days` `+3.53%` `+$26,010.84 vs 24 Oct`; `30 days` `+4.75%` `+$34,641.48 vs 1 Oct`. KPI labels are 12 px, regular; the total is 34 px/38 px, weight 600, with the source HTML money element beginning at y=173 px at 1440 px width; other KPI values are 22 px/28 px, weight 500. Hairline dividers separate them. Beneath is a blue, 2 px, 31 point October line chart with four faint gridlines, `700K` to `780K` ticks, and a `29 Oct: +$9,571, best day (ETH +$3,743)` annotation. The footer is separated by a hairline: `All-time high $763,809.27`, `reached 31 Oct, the latest snapshot`, `Latest is 0.00% below the high`.

Holdings is a right aligned value table with 8 rows, in order BTC, USDT, ETH, SOL, BNB, USDC, AAPL, NVDA. Header `Asset`, `Amount`, `Value`, `7D`; the first row is `BTC 26.9%`, `3.2226`, `$205,737.58`, `+6.4%`; USDT is `182,446.74`, `$182,446.74` and `0.0%`; the last row is `NVDA 4.1%`, `220`, `$31,075.00`, `+1.7%`. Each row is 42 px with subtle top rule. Zero is grey; gain is green; loss is red.

AI insights has a `Pro` blue chip, written time, dismiss icon, three separated insights, and an `Ask the assistant` text link. The three headings are `BTC drove the week`, `Stablecoins are 29.1% of the portfolio`, `AAPL is the one position down`. Its numerical details are from stored snapshots; the assistant copy itself must reflect actual data. Daily change has signed blue/red bars over a zero line, a `USD, last 30 days` label, and `Up`/`Down` axis hints. What moved is an eight row diverging bar list: BTC, SOL, ETH, BNB, NVDA, USDT, USDC, AAPL. Top coins is a six row table with `By value`/`By price change` segment, headers `Coin`, `Rank`, `Price`, `24h`, `7D`, `Value`, and a rank footnote. Sources lists Binance, OKX, Ledger cold wallet, 0x4f…a91c, Interactive Brokers; each row has a round monogram, name, kind, updated time, value, and share. Footer: `Local database · synced to Cloudflare R2, end-to-end encrypted · 2 devices · 0 conflicts`.

The type face is Public Sans with tabular numbers. Tokens: `--ground #0d0d0e`, `--surface #131217`, `--raised #1b1a20`, `--sunken #0a0a0b`, `--border #222224`, `--rule #1b1a1f`, `--control #3a3a3e`, `--text #ffffff`, `--muted #b4b6bc`, `--faint #9b9da3`, `--accent #4a8ad6`, `--positive #5fc39c`, `--negative #ee6a82`, `--warning #d9a441`. Body 13 px/18 px; card headings 15 px/20 px weight 600; small text 12 px/16 px. Pills are full radius. Inputs and cards have 6 px radius; overlay popovers have 10 px radius.

## State variants and interaction

- **AI off:** same grid, with `Off` neutral pill, dashed empty frame, `Insights are turned off` explanatory text and `Open AI settings` pill; settings breadcrumb below. Other cards retain their height.
- **Expanded at 1440:** rail becomes 216 px. Grid starts at x=244; 8/4 and 4/4/4 splits remain, with widths 773/379 px. At 1024, the header wraps to 102 px high. Grid starts at `(244,182)`, hero spans 752 px, Holdings/AI and Daily/What moved are 368 px pairs, then Top coins and Sources each span 752 px.
- **Hover:** hovering chart date 13 Oct draws a vertical crosshair, blue outlined marker, and a small raised tooltip `13 Oct` / `$728,863`.
- **Range open:** 560 × 427 px popover anchored to range button. Left presets `Today`, `7 days`, `30 days`, `90 days`, `1 year`, `All time`, `Custom range`. Right: From/To inputs, month calendar with selected 8–24 Oct, footer `8 Oct – 24 Oct 2026 · 17 snapshots · +$8,929.61 (+1.23%)`, Cancel/Apply. Dates before first snapshot cannot be picked.
- **Stale source:** Sources card has amber warning banner `Interactive Brokers did not refresh` with its last good value and time. Source row says `Failed · last good 08:12` and offers Retry; header says 4 of 5 up to date. Current product data determines whether the total includes this source.
- **Sync open:** 360 px wide `Backup & sync` popover anchored under the sync pill. Rows: Last upload, Destination, Devices, Waiting to upload, Errors. Footer has last run and next check, Details, Copy diagnostics, Sync now.
- **Loading, empty, error:** preserve the rail and card grid. Skeletons have the size of the replaced blocks with no shimmer. Empty cards have one reason and an action. A failing block states the failure, last good time and Retry while other blocks remain usable. Toasts stack at the bottom right with success, warning, error and action variants.
- **Controls:** range and sort choices update stored snapshot selection without changing its format; Refresh retains source progress and retry behavior; Sync opens the existing sync status; the bell links to Goals & alerts; the rail links use existing routes. Hide values masks monetary data. Gain/loss colours follow the quote colour setting. Keyboard focus, names and roles remain available.

## Remaining differences

Fresh 5 Nov 2026 browser captures against the source HTML renders differ by **7.38%** for Overview, **6.63%** for AI off, **9.07%** for Expanded 1024, **8.14%** for Expanded 1440, **6.65%** for Hover, **9.48%** for Range open, **7.38%** for Stale source, and **7.78%** for Sync open at the RGB-sum threshold of 60. The app's fixed-height content scroller clips most captures at 900 px while the source page is 1510–2411 px tall. The current two-peak product mark also differs from the source tile. The stored AI summary, live total, charts, source status, and sync details below remain product-data differences; source labels now use the same alias and short-name rules as Wallets.

The native-width captures are in `/tmp/fidelity-desktop/overview/`; each state also has a `-1600.png` capture. The authoritative source renders are in `/tmp/fidelity-desktop/design/`. The review gate counts a pixel as changed when its three absolute RGB-channel differences sum to more than 60, over the overlapping top-left rectangle. Capture dimensions are reported separately. The permanent JPEGs were also checked visually; the source render takes precedence where its page height differs.

The pixel figures below predate the Track3 mark change.

| State | Measured difference | Source render / capture size |
| --- | ---: | --- |
| Overview | 5.17% | 1440 × 1523 / 1440 × 1523 |
| AI off | 4.62% | 1440 × 1510 / 1440 × 1510 |
| Expanded 1024 | 5.49% | 1024 × 2411 / 1024 × 2411 |
| Expanded 1440 | 5.77% | 1440 × 1567 / 1440 × 1567 |
| Hover | 5.26% | 1440 × 1523 / 1440 × 1523 |
| Range open | 5.28% | 1440 × 1523 / 1440 × 1523 |
| Stale source | 6.00% | 1440 × 1551 / 1440 × 1551 |
| Sync open | 5.25% | 1440 × 1523 / 1440 × 1523 |

The unchanged product-data regions account for most changed pixels. Excluding the live-total trigger, persisted AI summary, Chart.js plot and its annotations, daily-change plot, portfolio-rank column and footnote, and real sync footer/status gives **2.79%** for Overview, **2.89%** for AI off, **2.80%** for Hover, **2.89%** for Range open, and **2.85%** for Sync open, as contributions to each full page. Stale source is **2.90%** after also excluding the failed-source banner and row whose wording is limited by the stored reason. The regions used for the common states are `(84,0)-(380,60)`, `(84,597)-(516,1019)`, `(536,625)-(965,1019)`, `(105,255)-(945,585)`, `(213,1087)-(303,1415)`, `(105,1410)-(945,1450)`, `(84,1450)-(965,1523)`, and `(1200,0)-(1390,60)`. The stale state also excludes `(980,1085)-(1412,1190)` and `(980,1350)-(1412,1490)` for its stored failure content. These are documented product differences, not spacing allowances.

- The top left contains the product's `Live total` trigger without a number. The product fetches live prices only when that trigger opens, and the result may differ from the last saved snapshot. Displaying `$763,809.27` there as live data would misstate the saved fixture.
- The AI-on fixture seeds a saved three-paragraph summary. The card separates each paragraph's heading and detail, but the persisted summary has no structured metric columns, so the design's three metric rows and written-at/dismiss controls are absent. The AI-off state uses the empty frame when no AI configuration exists.
- The chart uses the application's Chart.js renderer. The plotted 31 snapshot values are the design fixture. It shows the right-end value label and the best day's largest positive asset contribution from saved snapshots. Hover opens the real tooltip. Its stroke, tick raster and annotation differ slightly from the source SVG.
- The `Rank` column contains portfolio-value positions because the persisted asset and price records lack market-cap rank. The reference explicitly uses sample market-cap ranks (#1, #3, #2, #6, #4, #7). Its market-cap footnote therefore becomes a portfolio-rank explanation.
- The sync fixture performs a real pass through the local fake S3 service. It has one device with an ID and a dynamic last-run time; the reference has two named devices and Cloudflare R2. The `Waiting to upload` value is unknown until the actual sync manifest reports it, and the real scheduler says the next check is on activity. The other seven states show the same genuine fake-service status, not invented R2/device metadata.
- A failed source retains a last-good timestamp and value, but the stored source-status normalizer only retains the generic timeout reason. The stale banner therefore says `Source timed out` rather than `Flex Query timed out`. The failed row's status copy is tighter and the retry chip has less space than the reference.
- The rail uses the current text-free Track3 two-peak mark, while the reference shows a blue chart tile. Settings uses a cog rather than the reference's sun so it reads as navigation. Top controls use the app's existing icon set. Several pictograms, the active-rail edge and some pill/icon offsets differ from the reference. Small type raster, table text baselines and narrow chart strokes also differ; they are below the acceptance threshold.
- The Sources card now says `Refresh all` and the primary `Refresh` control keeps its own accessible name.
- The footer includes `Show More`, which exposes the product's existing detailed Overview panels. The reference footer has only the sync stamp. The stamp reflects the real fake-service destination and device count.
- The source's daily bars use a presentation-only series, while the app derives bars from persisted daily snapshot changes. The largest bars and some positions therefore differ. The app derives What moved from persisted asset changes too; bar lengths and the final dollar rounding differ. These panels keep the source's order and scales.
- The page heights now match all eight source states. The 1024 and expanded states use the same responsive grid sequence as the source, with some extra text wrapping. The range calendar still uses the product's date-picker controls, while its position and selection band match the source. The hover tooltip and crosshair use the product's Chart.js interaction.
- During refresh and after a partial snapshot, the full Overview grid stays mounted. A partial warning appears above it, the total defaults to excluding the unavailable source, and the `Total value view` selector can include or exclude last-known values. The refresh dialog's `Use last known values` action selects the included view.

- The desktop zero-line bars now stay visible for all-loss weeks; the shared iOS card keeps its full-width scale and 2% minimum. Daily ticks use the selected currency, and the real-data chart omits a regular date label when it crowds the final date. The partial hero label clears the amount at desktop widths.
