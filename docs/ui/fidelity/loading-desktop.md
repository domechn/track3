# loading desktop design specification

Approved image: `desktop/flows/loading-desktop.jpg`. Authoritative source: `source/ds/pages/flows-loading.html`, `flows.css`, `ds.css`, `ds.js`, and `lib.js`. Image and source render inspected at 1600 px in dark theme.

## Structure and measured geometry

Full-page size: **1600 × 977 px**. The standard desktop rail is 56 px wide; the main area has 28 px horizontal and 20 px top padding. The design uses a 12-column grid with a 16 px gap; full/eight/four-column cards are 1488/987/485 px wide. Cards use 20 px padding, a 1 px border and 6 px radius.

| Block or component | Bounds | Opening copy |
| --- | --- | --- |
| `div.head` | (84, 20) 1488 × 52 px | OverviewReading this deviceRefresh |
| `div.grid.g12` | (84, 88) 1488 × 848.5 px | Portfolio value Sources HoldingsAssetPriceValue7D What moved7 days |
| `section.card.s8` | (84, 88) 986.7 × 398 px | Portfolio value |
| `section.card.s4` | (1086.7, 88) 485.3 × 398 px | Sources |
| `section.card.s8` | (84, 502) 986.7 × 434.5 px | HoldingsAssetPriceValue7D |
| `section.card.s4` | (1086.7, 502) 485.3 × 434.5 px | What moved7 days |

## Exact visible copy, order, type and colour

The source uses Public Sans with tabular numerals. Tokens: ground `#0d0d0e`, card `#131217`, raised `#1b1a20`, border `#222224`, rule `#1b1a1f`, control `#3a3a3e`, text `#fff`, muted `#b4b6bc`, faint `#9b9da3`, accent `#4a8ad6`, positive `#5fc39c`, negative `#ee6a82`, warning `#d9a441`. Icons are 18 px stroked SVG by default. Values are USD with comma groups and two decimals, signed changes use + or −, percent values use the precision shown below, dates use abbreviated month names, and source times use 24-hour `HH:MM`.

| Copy | Bounds | Font (size/line height weight) | Computed colour |
| --- | --- | --- | --- |
| Overview | (84, 20) 1234 × 32 px | 26px/32px 600 | `rgb(255, 255, 255)` |
| Reading this device | (1334, 46) 128 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Refresh | (1472, 38) 100 × 34 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Portfolio value | (105, 109) 106 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Sources | (1107.7, 109) 59 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Holdings | (105, 523) 65 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Asset | (105, 555) 186.4 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Price | (291.4, 555) 248.6 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Value | (540, 555) 310.7 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| 7D | (850.8, 555) 198.9 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| What moved | (1107.7, 523) 89 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| 7 days | (1514, 525) 37 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |

## Interactive parts and state variants

This specification covers the **loading** state. Segmented controls, pills, source rows, table links, buttons, calendar choices, popovers, dialogs, toasts, dismissals and keyboard focus are actionable only where present in the actual product. The source's visible controls are:

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
- button: `Refresh` at (1472, 38) 100 × 34 px.

Loading preserves the containing card frame; error and partial states keep last-good data and show a reason plus recovery action; empty states keep the frame with an explicit next step. Overlays and popovers do not move the underlying grid. UI state does not add persisted fields. Any product-absent behavior is recorded below after comparing the real capture.

## Remaining differences

- Measured pixel difference: **2.36%** using the review gate's RGB-difference sum greater than 60. Source 1600 × 977; app 1600 × 977. [App capture](/tmp/fidelity-desktop/loading/loading-desktop.png); [rendered design](/tmp/fidelity-desktop/design-flows/loading.png).
- The four-card skeleton grid and placeholder data shapes are present. Their KPI bars now share the source's bottom alignment. Rail glyphs and a few placeholder/table strokes still differ.
