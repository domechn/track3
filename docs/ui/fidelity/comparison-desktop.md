# Comparison desktop fidelity specification

Approved images: `analyze/comparison-desktop.jpg` and `comparison-picker-desktop.jpg` (1600 px wide). Authoritative source: `source/ds/pages/analyze-comparison*.html`, `analyze-comparison.js`, `analyze-data.js`, `ds.css`, `ds.js`, and `ds/BRIEF.md`. Geometry and computed type below were measured in headless Chromium at 1600 px in dark mode.

## Shell and grid

The 56 px collapsed rail has Comparison active. Main area begins at x=56 with 28 px horizontal, 20 px top, and 40 px bottom padding. Heading `Comparison` is `(84,20)`, Public Sans 26 px/32 px weight 600; subtitle is `(84,54)`, 13 px/18 px regular, muted, and reads `What changed between two snapshots? +$34,641.48 (+4.75%) from 1 Oct to 31 Oct; BTC and ETH made 68% of it.` Right actions are green-dot `Synced 09:41` and a 34 px `Copy as text` pill. Grid starts at `(84,88)`, width 1488 px, with 16 px gaps and a 12-column split. Cards are `--surface #131217` with `--border #222224` 1 px, 6 px radius, 20 px padding. Titles are 15 px/20 px weight 600; body 13 px/18 px, labels 12 px, all values tabular. Blue `--accent #4a8ad6` marks selected snapshots and top movers; green `--positive #5fc39c` and red `--negative #ee6a82` mark signed changes.

1. **Snapshots**, `(84,88)`, 1488 × 249 px. Header says `31 snapshots in October · compare any two`. The selector row has Snapshot A input `1 Oct 2026`, right detail `09:41 · $729,168`; a 36 px circular Swap button; Snapshot B `31 Oct 2026`, `09:41 · $763,809`; Quick range ending at B with `Yesterday`, `7 days`, selected `30 days`, `Start of month` pills. Below a divider, four KPI cells: Value at A · 1 Oct `$729,167.79`, `Snapshot 09:41`; Value at B · 31 Oct `$763,809.27`, `30 days later`; Change `+$34,641.48`, `absolute`; Change % `+4.75%`, `vs 1 Oct`.
2. **Per asset**, `(84,353)` in the original reference. The full-width grouped table has Asset, Amount A/B, Price A/B, Value A/B, Change Absolute/Relative. It lists the available assets in absolute-change order, then totals and the price-movement banner when saved amounts are equal and there were no transactions. The table grows with its assets.
3. **Biggest movers by value**, left card below Per asset. It ranks assets by absolute value change, with signs shown in the value column and diverging bars. The 11-asset review fixture begins BTC `−$318,305`, BNB `−$35,571`, USDT `−$4,000`; the first ten rows appear initially and `and 1 more` reveals USD. Each row is 36 px, the columns and zero axis are shared across the card, and the card grows to fit the rows. The computed note says BTC and BNB made 99% of the total change for this fixture.
4. **Biggest movers by percentage**, right card. It ranks by absolute percentage change, shows the signed percentage and absolute change, and uses its own shared bar scale and columns. The same fixture starts BNB `−6.92%`, PLUME `−6.92%`, ETH `−5.19%`; `and 1 more` reveals USD. The note uses actual asset changes and the asset flagged as stable: `SCHD rose most in relative terms; USDT moved −2.23%.`

The source capture above used eight assets and fixed card bounds. Current cards show up to ten rows each, expand when more assets exist, and have no fixed mover height. The expansion button uses `Show More` without a count while values are hidden. Unchanged assets rank last in every panel and draw no bar; the compact desktop and iPad panel does not render when every asset is unchanged.

## Snapshot A picker open

The first selector has a blue focus ring. A 340 px wide popover is anchored 6 px below it at approximately `(105,220)` and overlays the KPI/table without moving them. It has a dark raised surface, border, 10 px radius, shadow, October 2026 header with previous/next circular icons, a seven-column Monday-first calendar, muted Sep 28–30 and Nov 1, blue dots on days with snapshots, selected day 1 in blue, comparison day 31 outlined. A key reads `Has a snapshot` and `Grey: none yet`. The bottom selected-snapshot row reads `1 Oct 2026, 09:41` and `$729,167.79`. Clicking a dated snapshot updates A; Swap exchanges A and B; quick-range pills compute A from B. The picker closes with Escape/outside click and is keyboard reachable.

## Other states and constraints

With fewer than two stored snapshots, the page shows an empty explanation and no invented comparison. Loading preserves the selector/card regions. Query failure uses the existing error and retry treatment. A missing asset on one date shows unknown or absent fields rather than inventing amount/price. Unknown profit and sparse-month snapshots retain the established #760/#788 display. The blue price-movement banner appears only if stored amounts really are equal; saved transactions are not inferred from equal balances. Copy as text uses the current selection. Hide-values masks every monetary cell, and quote-colour settings control signed values. All selection changes use UI state and existing snapshot records.

## Remaining differences

- UI42's approved neutral logo tiles replace the bare marks in the older design page. On the iPad mover rows, the STOCK tag sits below its ticker so the ticker, movement bar and signed value remain visible within the available columns.

After merging the active-navigation change, the dark 1440 × 900 source
and app viewports differ by **5.51%** at RGB-sum threshold 60. The
callout still shares x=105, y=853.5, and height 62px; the source is
15px wider because the app reserves a scroll rail. The source's fixed
mover ranking and attribution, the app's actual sync state, and the
owner-required active navigation tile account for the visible
differences. Captures and computed bounds are in
`.local/tag-theme/desktop-comparison-*`.

Before the navigation merge, the 8 Nov 2026 tag review rendered the dark
source page at 1440 × 900 beside the app viewport: **5.419%** of pixels differ at RGB-sum
threshold 60. The price-only callout starts at (105, 853.5) in both,
measures 62 px high, and its backgrounds are RGB (20, 36, 58) and
(20, 36, 57). The 15 px width difference is the app's scroll rail. Captures
and computed bounds are in `.local/tag-theme/desktop-comparison-*`. The
absolute-movement ranking, computed attribution and product sync state
remain visible differences below.

An 8 Nov source-page render and current dark 1440 × 900 app capture differ
by **6.385%** at an RGB-channel threshold of 20. The required
absolute-change ranking, expanding mover cards, and computed attribution
account for the large regions below the Per asset table. Top mover uses
the shared 20 px theme tag; its 11 px label, border, and padding differ
from the source's 12 px dark pill. In light theme its tint follows the
accent token, and the subtitle amount and price-movement callout use
readable light surfaces. The source supplies no light-theme page.

Fresh renders of the source HTML and app with the source's eight assets both measure 1600 × 1452 px. The default state differs at **5.27%** of pixels with any RGB channel above 20, or **4.21%** above 60. With picker A open the ratios are **5.36%** and **4.23%**, respectively. The captures and `getBoundingClientRect`/`getComputedStyle` measurements are in `/tmp/ui14-current/`. The required mover layout accounts for the largest region of changed pixels. The source cannot display the required 11-asset state, so these ratios measure the same eight-asset data on both sides.

- The source ranks mover rows by signed change, uses 42 px rows and fixed 459 px cards, and puts its zero axis and value columns at different positions. The product ranks by absolute size, uses 36 px rows, one diverging scale and shared columns per card, and grows the cards for up to ten rows plus expansion. Matching the source here would restore the overflow or break the required behavior.
- The source's fixed attribution and stablecoin note cannot describe the 11-asset fixture. The product computes both notes from stored assets.
- The source divides the two largest signed changes by the net change. The product divides their magnitudes by total absolute movement so a mixture of gains and losses gives a share from 0% to 100%. This changes the source's eight-asset `68%` note to `67%`.
- The source shows a sync stamp even with its static fixture. The app shows a stamp when sync status exists; this fake comparison data has no sync status.
- The rail glyphs, picker focus ring, day-dot and text baselines, Per asset column positions, small shadows, and text rasterization remain visibly different. They use the app's shared components and could be matched but are not worth another round.
- The Per asset caption reserves space for the hide-values eye button so the control does not cover `sorted by absolute change`.
