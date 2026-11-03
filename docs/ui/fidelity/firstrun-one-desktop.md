# firstrun-one desktop design specification

Approved image: `desktop/flows/firstrun-one-desktop.jpg`. Authoritative source: `source/ds/pages/flows-firstrun.html#one`, `flows.css`, `ds.css`, `ds.js`, and `lib.js`. Image and source render inspected at 1600 px in dark theme.

## Structure and measured geometry

Full-page size: **1600 × 900 px**. The standard desktop rail is 56 px wide; the main area has 28 px horizontal and 20 px top padding. The design uses a 12-column grid with a 16 px gap; full/eight/four-column cards are 1488/987/485 px wide. Cards use 20 px padding, a 1 px border and 6 px radius.

| Block or component | Bounds | Opening copy |
| --- | --- | --- |
| `div.head` | (84, 20) 1488 × 52 px | OverviewBinance is added. Refresh to load its balances.1D7D30D90D1YAllRefresh now |
| `div.banner.info` | (84, 88) 1488 × 64 px | Binance has not been refreshed yet.Totals, charts and history start with the first refresh. It reads balances only; nothing is tra |
| `div.grid.g12` | (84, 168) 1488 × 454 px | Portfolio valueUSDTotal value—Never refreshedToday— 7 days— 30 days— Chart starts after the first refreshThe line starts after the |
| `section.card.s8` | (84, 168) 986.7 × 266 px | Portfolio valueUSDTotal value—Never refreshedToday— 7 days— 30 days— Chart starts after the first refreshThe line starts after the |
| `section.card.s4` | (1086.7, 168) 485.3 × 266 px | Sources1 sourceBnBinanceNever refreshed—0 of 1 refreshed |
| `section.card.s8` | (84, 450) 986.7 × 172 px | Holdings0 assetsNo holdings yetHoldings appear after Binance refreshes. |
| `section.card.s4` | (1086.7, 450) 485.3 × 172 px | What moved7 daysNothing to compare yetMoves appear after the second refresh. |

## Exact visible copy, order, type and colour

The source uses Public Sans with tabular numerals. Tokens: ground `#0d0d0e`, card `#131217`, raised `#1b1a20`, border `#222224`, rule `#1b1a1f`, control `#3a3a3e`, text `#fff`, muted `#b4b6bc`, faint `#9b9da3`, accent `#4a8ad6`, positive `#5fc39c`, negative `#ee6a82`, warning `#d9a441`. Icons are 18 px stroked SVG by default. Values are USD with comma groups and two decimals, signed changes use + or −, percent values use the precision shown below, dates use abbreviated month names, and source times use 24-hour `HH:MM`.

| Copy | Bounds | Font (size/line height weight) | Computed colour |
| --- | --- | --- | --- |
| Overview | (84, 20) 1074 × 32 px | 26px/32px 600 | `rgb(255, 255, 255)` |
| Binance is added. Refresh to load its balances. | (84, 54) 1074 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| 1D | (1176, 41) 40 × 28 px | 12px/18px 500 | `rgb(155, 157, 163)` |
| 7D | (1216, 41) 40 × 28 px | 12px/18px 500 | `rgb(155, 157, 163)` |
| 30D | (1256, 41) 48 × 28 px | 12px/18px 500 | `rgb(255, 255, 255)` |
| 90D | (1304, 41) 48 × 28 px | 12px/18px 500 | `rgb(155, 157, 163)` |
| 1Y | (1352, 41) 39 × 28 px | 12px/18px 500 | `rgb(155, 157, 163)` |
| All | (1391, 41) 41 × 28 px | 12px/18px 500 | `rgb(155, 157, 163)` |
| Refresh now | (1444, 38) 128 × 34 px | 13px/18px 500 | `rgb(13, 13, 14)` |
| Binance has not been refreshed yet. | (129, 101) 1428 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Totals, charts and history start with the first refresh. It reads balances only; nothing is traded. | (129, 121) 1428 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Portfolio value | (105, 189) 106 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| USD | (1025.7, 191) 24 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Total value | (105, 221) 216.2 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| — | (105, 240) 38.3 × 40 px | 34px/38px 600 | `rgb(155, 157, 163)` |
| Never refreshed | (105, 279) 216.2 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Today | (362.2, 231) 195.2 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| — | (362.2, 252) 25 × 26 px | 22px/28px 500 | `rgb(155, 157, 163)` |
| 7 days | (598.3, 231) 195.2 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| — | (598.3, 252) 25 × 26 px | 22px/28px 500 | `rgb(155, 157, 163)` |
| 30 days | (834.5, 231) 195.2 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| — | (834.5, 252) 25 × 26 px | 22px/28px 500 | `rgb(155, 157, 163)` |
| Chart starts after the first refresh | (462.8, 344) 229 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| The line starts after the second refresh. | (462.8, 366) 229 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Sources | (1107.7, 189) 59 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| 1 source | (1501, 191) 50 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Bn | (1107.7, 235) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| Binance | (1147.7, 232) 376.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Never refreshed | (1147.7, 250) 376.3 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| — | (1536, 241) 15 × 15 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| 0 of 1 refreshed | (1107.7, 395) 105 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Holdings | (105, 471) 65 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| 0 assets | (1001.7, 473) 48 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| No holdings yet | (459.3, 532) 236 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Holdings appear after Binance refreshes. | (459.3, 554) 236 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| What moved | (1107.7, 471) 89 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| 7 days | (1514, 473) 37 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Nothing to compare yet | (1215.8, 532) 227 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Moves appear after the second refresh. | (1215.8, 554) 227 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |

## Interactive parts and state variants

This specification covers the **firstrun-one** state. Segmented controls, pills, source rows, table links, buttons, calendar choices, popovers, dialogs, toasts, dismissals and keyboard focus are actionable only where present in the actual product. The source's visible controls are:

- a: `Overview` at (10, 62) 35 × 36 px.
- a: `Summary` at (10, 119) 35 × 36 px.
- a: `Wallets` at (10, 157) 35 × 36 px.
- a: `Comparison` at (10, 195) 35 × 36 px.
- a: `Cost basis` at (10, 233) 35 × 36 px.
- a: `History` at (10, 290) 35 × 36 px.
- a: `Rebalance` at (10, 328) 35 × 36 px.
- a: `Goals & alerts2` at (10, 366) 35 × 36 px.
- a: `Assistant` at (10, 404) 35 × 36 px.
- a: `Settings` at (10, 852) 35 × 36 px.
- button: `Refresh now` at (1444, 38) 128 × 34 px.

Loading preserves the containing card frame; error and partial states keep last-good data and show a reason plus recovery action; empty states keep the frame with an explicit next step. Overlays and popovers do not move the underlying grid. UI state does not add persisted fields. Any product-absent behavior is recorded below after comparing the real capture.

## Remaining differences

- Measured pixel difference: **1.11%** using the review gate's RGB-difference sum greater than 60. Source 1600 × 900; app 1600 × 900. [App capture](/tmp/fidelity-desktop/firstrun/firstrun-one-desktop.png); [rendered design](/tmp/fidelity-desktop/design-flows/firstrun-one.png). The ratio uses the overlapping top-left rectangle; the dimensions show any size mismatch.
- The new source banner and two by two card grid are aligned. No product behavior is omitted from this state.
