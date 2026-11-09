# History desktop fidelity specification

Source: `desktop/records/history{,-delete,-empty,-loading,-undo}-desktop.jpg` and `source/ds/pages/records-history*.html`, `records-history.js`, `records.css`, `ds.css`. All five images were viewed. Measurements below come from Chromium at a 1600 × 1024 viewport with the source HTML loaded through `file://`; full page screenshots extend below the viewport.

## Shared frame and tokens

- The fixed left icon rail is 56 px wide, ground `#0d0d0e`, with a 1 px `#222224` right rule. The main column starts at x=56 with 28 px side padding and 20 px top padding, giving content x=84 and width=1488.
- When Goals has unread alerts, its collapsed-rail dot is 7 × 7 px at (31,373), with a 2 px `#0d0d0e` border around `#ee6a82`. Fidelity captures seed actual unread alert rows to make that state visible.
- Body uses Public Sans, 13/18 px, tabular numbers. Heading `History` is 26/32 px, weight 600 at (84,20); the 13/18 muted subtitle begins y=54. The synced status is right aligned, 12 px faint `#9b9da3` with a 6 px green dot.
- Cards have `#131217` surface, `#222224` border, 6 px radius and 20 px content padding. Card grids have 16 px gaps. Main text is `#fff`; muted is `#b4b6bc`; faint is `#9b9da3`; accent is `#4a8ad6`; positive is `#5fc39c`; negative is `#ee6a82`; warning is `#d9a441`.
- The filter card begins (84,88), spans 1488 × 64 px, has 14/20 px padding and 28 px horizontal control group gaps. The source Range group begins at x=105 and spans 321 px; its segmented control begins at x=151 and spans 275 px. The first date input begins at x=454. The Show group begins at x=1296, uses an 8 px inner gap, and spans 255 px. Controls are pill segmented controls: 32 px high outer `#1a1a1e`, 28 px high items at 12 px weight 500, selected fill `#2a2a30`. Date inputs are 34 px high, sunken `#0a0a0b`, 1 px `#3a3a3e` border, 6 px radius. Clock, info, compare, edit, trash and undo icons are thin 1.5 px stroke icons.
- From left to right the filter reads `Range`, `7 days`, `30 days`, `90 days`, `All time`; clock `From any date`, `to`, clock `To any date`; right aligned `Show`, `All`, `With issues 2`, `Edited 1`. These are working filters.

## Populated history

- Beneath a 12 px gap, a 12 column grid places the snapshot card in 7 columns, x=84, width=861.33; detail in 5 columns, x=961.33, width=610.67. Both start y=164 and align their bottoms. The populated source page is 1271.5 px high.
- Left card: `Snapshots` in 15/20 px weight 600 at the upper left; `One per refresh, newest first` in faint 12 px at the upper right. Table columns are `Date and time`, `Total value`, `Change vs previous`, `Assets`, `Sources`. Header is 12/16 px faint; each row is 46 px with a `#1b1a1f` top rule. Numeric columns align right. The selected row has `#1a1c22` fill and a 2 px blue left rule. The date format is `31 Oct 09:41`; the day is weight 400 and the time is muted `#b4b6bc`. Money uses `$763,809.27`; signed money and percent use `+$1,533.16` and `+0.20%`. Source status uses a 6 px green dot and `5 of 5`, or a warning dot and `5 of 5, 1 retried`. The edited row has an 18 px blue `Edited` pill.
- The source fixture has 1,284 snapshots (51 representative October rows, 50 on page one). Its first six displayed totals are $763,809.27, $762,276.11, $762,191.07, $762,110.35, $757,799.94 and $752,642.71. The default selection is `28 Oct 2026, 08:51`. The table window scrolls internally. The bottom pager reads `1–50 of 1,284`, `Page 1 of 26`, `Previous`, `Next`; below it an info icon precedes `Shows 50 snapshots per page. Change History count in Settings › Currency & display.` The source 22 Oct retry is plain text after a warning dot; the stored partial fixture shows `4 of 5` in the same plain-text treatment.
- Right card: heading `28 Oct 2026, 08:51` at 17/24 px with the `Edited` pill. Three KPI columns follow: `Total value` $752,642.71 / `Includes 2 edits`; `Change` −$40.86 / `−0.01% vs 27 Oct`; `Assets` 8 / `5 of 5 sources`. Values are 22/28 px weight 500. The bordered pill actions are `Compare`, `Edit`, and right aligned red `Delete`, each 28 px high. Sections are separated by 1 px rules and 16 px spacing. The green edit amount is 12 px, weight 400, `#5fc39c`; the Edits section is absent when the selected snapshot has no edits.
- `Assets at that time` is a five column table: `Asset`, `Quantity`, `Price`, `Value`, `Share`. The design rows in order are BTC, USDT, ETH, SOL, BNB, USDC, AAPL, NVDA, followed by Total. Quantity has up to four decimals, stablecoin quantity two; prices and values have currency symbols and grouping; share has one decimal. Edited USDC quantity and AAPL price are blue, with a faint `was …` line. `Edits` contains two 48 px rows and the source header `2 edits · changes the total by +$103.49`. The product records a USDC asset restore and an AAPL transaction price edit: its truthful header is `2 edits · changes the total by +$39,853.99`, the AAPL market-price cell is unchanged, and the restore row shows `– → $39,853.99`. `Sources` contains Binance, OKX, Ledger cold wallet, 0x4f...a91c and Interactive Brokers in 40 px rows with totals right aligned.

## Variants

- **Delete:** the populated state is dimmed by a black 55% scrim. A centered 520 × 214 px surface dialog at x=540, y=405 uses 24 px padding and 10 px radius. It says `Delete this snapshot?`, `28 Oct 2026, 08:51 · $752,642.71 · 8 assets`, then explains removal from History/charts, recalculation of the next change and immediate undo. Footer pills are `Cancel` and red `Delete snapshot`.
- **Undo:** after deletion the subtitle count is 1,283 and the 28 Oct 08:51 row is absent; 28 Oct 21:46 becomes selected. A 330 × 62 px toast appears at x=1242, y=938, raised `#1b1a20`, 3 px green left rule. It says `Snapshot deleted`, `28 Oct 2026, 08:51` and offers an outlined 67 × 28 px `Undo` pill.
- **Empty:** the subtitle is `No snapshots saved yet`, there is no synced stamp. The whole filter card has 50% opacity, and its disabled filter labels omit counts. A full width card at (84,164), 1488 × 466 px, contains `Snapshots`, a dashed panel at y=217 that is 360 px high, `No snapshots yet`, `Track3 saves one snapshot each time you refresh your sources.`, a white pill `Refresh now`, then `Snapshots stay on this device. Change History count in Settings › Currency & display.`
- **Loading:** the same frame and populated subtitle remain. Two columns begin at y=164. The left card displays `Snapshots`, `Loading…`, column headings and fourteen 46 px skeleton rows, followed by a 39 px pager with one 90 × 12 px skeleton and no hint row. The right card has a heading skeleton, three KPI skeleton columns, two pill skeletons and nine table skeleton rows. Skeleton fill is `#24242a` and radius 4 px; the visible layout is 768 px high.
- **Error:** no approved desktop error image exists. A failed list query falls through to the empty card with no persisted rows loaded; a failed selected-detail query leaves the list usable and shows `Could not load snapshot details. Close and reopen to try again.` as an alert in the right card.
- **Edit dialog:** the `Edit` pill opens an accessible dialog containing the selected asset symbols as links to their existing coin detail routes, with a Cancel button. No edit-dialog design image was supplied.

## Interaction and product data

Snapshot selection changes the right card. Row click and keyboard activation must work. The filters, paging, detail Compare/Edit/Delete, confirmation and undo must preserve their existing data flows. A partial snapshot must keep its existing issue/unknown change indication; edits must continue to expose their audit log. Currency, quote colour, hide values and sync status follow app settings.

When a real snapshot has more than 50 assets, the detail table shows a 50 row window with Previous/Next controls and a `1–50 of N assets` count. This keeps the detail DOM bounded while retaining access to all assets. The eight asset design fixture has no pager.

The design has invented per-source totals and a precise `5 of 5` count. Current stored snapshots contain assets, transactions, edit logs and partial status, but no persisted per-source value totals. The fixture and UI can derive source grouping only where a stored wallet/source mapping is available.

## Product behaviour

The design rail icons stay consistent across desktop routes. The Track3 mark links to Overview, and a separate bottom button expands or collapses the rail. On Records, the bottom navigation control opens the existing Refresh and Pro live-total controls plus Settings. The empty History `Refresh now` action opens those controls and starts Refresh, so its progress and live announcement remain available. A configured sync control also appears in the empty History header, allowing unlock there; disabled sync renders no stamp. Captures seed completed runtime status at 09:41 for populated states.

The app selects the newest snapshot on load. The fidelity test selects 28 Oct to reproduce the design's preselected detail, delete dialog and undo sequence. The detail keeps asset deletion, optional blacklisting, confirmation and Undo inside the five-column grid. List and edit-log query errors remain visible and retryable where possible; empty filter results can be cleared. Light theme, locale formatting, keyboard access, and partial status use existing app behaviour.

When a background data change reloads the same filters, the current rows and selected detail remain visible until the new query finishes. A changed filter still shows the source's skeleton state. Captures check the 50 rows, latest total, count and selected detail immediately around screenshot creation, including the post-delete selection.

Chromium briefly sets a 1 × 1 viewport during some full page screenshots. The desktop layout keeps its current selection at that unusable size; a real phone width of at least 320 px still selects the phone layout.

## Remaining differences

**9 Nov 2026 layout audit:** history 10.773% at 1280 × 800, dark, against the rendered source HTML (RGB channel difference sum > 60). The dense CNY fixture and working product state differ from the static reference; the page-specific visible differences are listed below.

At 1280 px, the real-scale CNY fixture keeps the four visible History detail columns and full values within the card. With the expanded rail, the detail table uses a 10 px numeric font to keep seven-digit values readable while preserving the adjacent list pane. The source uses shorter USD amounts.

At 1100–1499 px the merged fixed-height two-pane layout keeps large CNY values readable. The list places asset and source counts below the date and shows Date, Total and Change columns; the detail places Share below each asset and shows Asset, Quantity, Price and Value columns. The same values remain visible without a horizontally cut amount. The reference fits its shorter USD values in five columns. At 1100–1179 px the merged History grid uses eleven tracks to keep both panes usable, so its edges differ from the general twelve-track rule. With only two saved assets, the fixed-height detail pane retains unused scroll area; no asset rows are invented.

The compact list uses complete English and Chinese source-status sentences. Partial snapshots retain the warning dot, and asset names remain clear of the detail row's Delete button. The reference has shorter values and no row Delete action, which explains the remaining compact column widths.

On 8 Nov 2026 the source HTML was rendered again in Chromium with scrollbars hidden at 1600 × 1024. `getBoundingClientRect()` puts its filter at (84, 88), its list at (84, 164) with width 861.33 px, and its detail at (961.33, 164) with width 610.67 px; `getComputedStyle()` reports 13/18 px body text and `rgb(19, 18, 23)` card backgrounds. The branch captures before this merge are preserved in `/tmp/ui43-captures-desktop/` and the source renders and measurements are in `/tmp/ui43-source/`. A pixel differs when the summed absolute RGB difference exceeds 60, with black padding to the larger canvas.

| State at 1600 × 1024 | Current source versus app difference |
| --- | ---: |
| Populated | 8.87% |
| Delete confirmation | 6.19% |
| Empty | 1.37% |
| Loading | 1.63% |
| Undo | 8.10% |

The populated, delete, and undo captures exceed 3% because History now follows the required fixed-height master-detail layout. The reference has a standalone full-width filter and 46 px rows on a 1271.5 px scrolling page. The app pins the filter inside the list, uses 39 px rows, pins the pager and detail header, and scrolls each pane separately. The section chips and expanders are also absent from the reference. The KPI/header block is taller relative to a short fixed pane; at 900 × 560 the detail has about 120 px of scrollable content. Those changes keep both panes aligned and all controls reachable at every tested height. The earlier ratios below use different fixtures or page structures and are retained as measurement history.

At 900–1099 px the app keeps Change visible by placing the amount above its percent in the 39 px row and using compact source text. The source table overflows its card at those widths. At 700 px desktop width the existing searchable detail opens as a full-window surface with Back; the source uses a phone-style layout below 760 px, so the two screens have different content density. The 700 px Back button initially shows the dialog's focus ring, a small visible difference kept for keyboard focus feedback. At 820 px the app shows one pane at a time with Back, while the source still shows two narrow columns. The iPad detail has no pointer-open focus outline; a keyboard Enter keeps a visible focus outline.

Before the fixed-height pane update, the 8 Nov 1600 × 1024 captures in `/tmp/fidelity-desktop/history/` differed from `/tmp/rv1103b/design/` by 6.26% populated, 4.54% delete, 1.45% empty, 0.66% loading, and 5.67% undo at the same RGB-sum threshold 60. Populated, delete, and undo compare the shared first 1024 px because the source document extends below the app's fixed viewport. The selected-row, stored-edit, scroll-gutter, sync, and shared-icon differences below explain those visible gaps.

UI42 uses the approved website-style neutral tile for saved asset and source marks. The older History page design renders those marks differently.

An earlier 8 Nov 2026 1600 × 1024 app viewport differs by **6.076%**
from the same area of the rendered `records-history.html` source at RGB-sum
threshold 60. Captures are `.local/tag-theme/desktop-history-edited-app.png`
and `/tmp/ui21-source-fresh/history.png`. This isolated fixture shows the
product's default newest selection and no completed sync, while the source
preselects the edited 28 Oct row and prints a synced stamp. The app selects
newest on load and shows a sync stamp only after a real completed pass. The
app's first column measures 207.45 px at x=85, against the
source's recorded 209.61 px at 1600 px, leaving room for date, time and
the Edited tag. The fixed-height shell and stored edit differences below
also remain visible.

The overflow fixture in `fix_ui37.md` describes 40/32/28 px amounts, while a fresh Chromium render of the authoritative History HTML measures 22/28 px amounts and 20 px column padding at 1600 px (`/tmp/history-kpi-overflow/design-history-bounds.json`). The app follows the rendered amount size. It uses 24 px padding when the three values fit, then 16 px, then 12 px, and finally stacks the rows to keep values unwrapped with at least 16 px between them. Wide cards distribute the three columns evenly. The fixed-height layout aligns the list and detail bottoms at both 1272 and 1024 px; the pager stays pinned within the list card.

At 761–899 px the app shows one pane at a time; at 900 px and above the cards sit side by side. The narrow two-pane layout uses 7/5 grid columns through 1099 px, 5/6 at 1100–1179 px, then 6/6 through 1279 px so shared asset icons, delete controls, KPI amounts, and numeric values fit. The Asset column is 72 px at 900–1099 px, 104 px at 1100–1279 px, and 124 px at larger widths. At 1280–1599 px the table sizes its numeric columns from their content, so large currency values stay clear of the Share column. The static source keeps fixed column fractions in that range.

The 7 Nov 2026 populated History capture is **5.71%** different from the
saved 1600 × 1272 source render at RGB-sum threshold 60 when the app's
1600 × 1024 scroll viewport is padded to the source height. The fixed shell
and truthful stored edits below explain the larger full-page ratio. The
sync stamp now uses a neutral cloud icon where the source has a green dot;
this distinguishes backup sync from live prices. Its button remains pinned
at x=1465 with a 92 px width, and the icon stays inside its box.

On 8 Nov, the current app capture at 1600 × 1272 differs by **5.81%** from the source page rendered at the same size (`/tmp/history-kpi-overflow/history-design-fixture-expanded.png` and `design-history-1600.png`; RGB-sum threshold 60). The previous capture measured **5.72%**. The source KPI strip starts at x=982.33 and uses 189.55 px columns with 20 px padding; the app starts at x=973.58 and uses 187.47 px columns with 24 px padding. Both use 22/28 px values. The app's 15 px scroll gutter and fixed shell shift the whole content grid, while the source scrolls the document. The current shared rail and asset icon styling also differs from the static source. The older **2.38%** expanded capture suppressed that gutter, so its ratio uses a different capture geometry. The page retains its visible scrollbar and working keyboard/page navigation. The owner's 11-asset extreme fixture has no matching source page; its 1100–1920 px screenshots and geometry checks are in `/tmp/history-kpi-overflow/`.

The CI capture test no longer opens machine-local source pages. The separate guarded source test measures the source at 1600 px.

With no saved snapshots, the shared empty state adds a centred icon and a 200px minimum to the source's dashed explanation. The Refresh action and disabled filters retain their existing behaviour.

The 5 Nov 2026 measurement compared a 1600 × 1272 populated History source render with the app's 1600 × 1024 fixed-shell viewport: **5.95%** differed at RGB sum threshold 60. Expanding the capture container to 1600 × 1272 gave **1.43%** against the source; images and bounds are in `/tmp/ui3-remeasure/`. A fresh 6 Nov source render and expanded app capture measured **2.38%**; their images and bounds are in `/tmp/ui21-source-fresh/`, `/tmp/ui21-design-history.json`, and `/tmp/ui21-history-expanded2.png`. The fixed viewport's scroll container clips lower rows and Sources in a full-page screenshot and creates a 15 px scrollbar. The source and app heading bounds match. This capture difference follows the product's fixed-height shell, which keeps Settings pinned while the content scrolls.

The 1600 px dark captures in `/tmp/fidelity-desktop/history/` were compared with fresh source HTML renders in `/tmp/rv1103b/design/`; side-by-side images are in `/tmp/wdb-final-sbs/`. Chromium computed style and rectangle measurements were repeated on the source pages: the populated list headers begin at x=85, 294.61, 431.31, 668.27 and 739.88 px, with widths 209.61, 136.70, 236.95, 71.61 and 204.45 px. The detail table headers begin at x=982.33, 1033.52, 1178.78, 1311.61 and 1456.88 px. At 1100 px the source table has a 402 px minimum width and extends about 20 px beyond its card; the app keeps its table and text inside the card. The delete summary is 12/18 px in `#b4b6bc`, and the detail action buttons are 89, 61 and 76 px wide with 14 px icons. A pixel differs when the sum of its absolute RGB channel differences exceeds 60; images are padded with black to the larger full-page size. The before column uses the last reviewer's saved captures in `/tmp/rv1103b/pre/` against the same source PNGs.

| Screen | Prior documented ratio | 6 Nov branch capture |
|---|---:|---:|
| History, All / page 1 / 28 Oct selected | 1.3752% | 2.3833% |
| Delete | 1.3688% | 1.9557% |
| Empty | 0.1619% | 0.8546% |
| Loading | 0.1774% | 0.5527% |
| Undo | 1.0854% | 1.9834% |

The 6 Nov app captures are `/tmp/ui21-history-expanded2.png`, `/tmp/ui21-history-delete-expanded.png`, `/tmp/ui21-history-empty-fresh.png`, `/tmp/ui21-history-loading-fresh.png`, and `/tmp/ui21-history-undo-expanded.png` in table order. Only the desktop capture container was expanded where the source page is taller than the fixed viewport.

- The source invents a `5 of 5` count for every complete snapshot. Stored complete snapshots have no source count, so their list rows say `All refreshed`. The source's 22 Oct row is complete after a retry, but the stored partial record has no retry count. The fixture now uses a real missing-source shape and shows `4 of 5`; showing `5 of 5` with a partial record would claim all sources refreshed.
- The source shows asset-level USDC quantity and AAPL market-price edits. The product's edit records support asset delete/restore and transaction price edits, not those snapshot value edits. The closest stored records are a USDC restore, worth +$39,853.99 to the snapshot, and an AAPL trade price edit, worth $0 to the snapshot. The Price column keeps the saved AAPL market price and has no `was` line; the Edits row labels the trade price as a transaction edit. A restore has no before quantity or value; the asset table shows `was –`, and the audit row shows `– → $39,853.99`. Using the previous day's 40,000 USDC as a before value would misstate what the record knows.
- After deleting the sole edited snapshot, the query returns `Edited 0`; the source still says `Edited 1`. The product reflects its remaining stored edit logs.
- The current two-peak mark and Settings cog differ from the source's blue chart tile and sun. History detail now resolves saved wallet aliases, exchange names and broker names. The source illustration has five named sources, while the three-source alias and exchange fixtures have no pixel-identical reference page.
- The populated Asset column is 124 px wide in the current app and holds the shared icon, symbol, and working 32 px delete target. The source has no delete targets, so its narrower Asset column and following header positions differ.

The fidelity fixture includes two stored unread Goals alerts, matching the source rail's red badge.

The loading list's numeric skeletons now end at the right edge of their cells, at source x positions 375.875, 561.922 and 757.078 px in the first row; the first bar starts at y=261.5. The Undo detail table headers start at x=982.33, 1034.66, 1170.45, 1306.25 and 1454.78. All five source and app states were remeasured with Chromium rectangles and compared with the RGB pixel threshold above.
