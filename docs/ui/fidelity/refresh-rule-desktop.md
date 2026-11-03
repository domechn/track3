# refresh-rule desktop design specification

Approved image: `desktop/flows/refresh-rule-desktop.jpg`. Authoritative source: `source/ds/pages/flows-refresh.html#rule`, `flows.css`, `ds.css`, `ds.js`, and `lib.js`. Image and source render inspected at 1600 px in dark theme.

## Structure and measured geometry

Full-page size: **1600 × 900 px**. The standard desktop rail is 56 px wide; the main area has 28 px horizontal and 20 px top padding. The design uses a 12-column grid with a 16 px gap; full/eight/four-column cards are 1488/987/485 px wide. Cards use 20 px padding, a 1 px border and 6 px radius.

| Block or component | Bounds | Opening copy |
| --- | --- | --- |
| `div.head` | (84, 20) 1488 × 74 px | Flows · RefreshTotals never silently drop a sourceWhat the Overview total says after OKX fails. Same data, three honest labels. |
| `div.grid.g12` | (84, 110) 1488 × 660.5 px | Total value$763,809.275 of 5 refreshedAll active sources at 09:41. Today +0.20% · 7D +3.53% · 30D +4.75% Total value, excluding OK |
| `section.card.s12` | (84, 110) 1488 × 168 px | Total value$763,809.275 of 5 refreshedAll active sources at 09:41. Today +0.20% · 7D +3.53% · 30D +4.75% Total value, excluding OK |
| `section.card.s8` | (84, 294) 986.7 × 476.5 px | The rule The word total needs 5 of 5.Total value is only unlabelled when every active source refreshed in this run. Otherwise the  |
| `section.card.s4` | (1086.7, 294) 485.3 × 476.5 px | Where the flag showsSurfaceWhat changes Overview totalLabel, Partial pill Top bar totalAmber dot, tooltip names source Sources car |

## Exact visible copy, order, type and colour

The source uses Public Sans with tabular numerals. Tokens: ground `#0d0d0e`, card `#131217`, raised `#1b1a20`, border `#222224`, rule `#1b1a1f`, control `#3a3a3e`, text `#fff`, muted `#b4b6bc`, faint `#9b9da3`, accent `#4a8ad6`, positive `#5fc39c`, negative `#ee6a82`, warning `#d9a441`. Icons are 18 px stroked SVG by default. Values are USD with comma groups and two decimals, signed changes use + or −, percent values use the precision shown below, dates use abbreviated month names, and source times use 24-hour `HH:MM`.

| Copy | Bounds | Font (size/line height weight) | Computed colour |
| --- | --- | --- | --- |
| Flows · Refresh | (84, 20) 1472 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Totals never silently drop a source | (84, 42) 1472 × 32 px | 26px/32px 600 | `rgb(255, 255, 255)` |
| What the Overview total says after OKX fails. Same data, three honest labels. | (84, 76) 1472 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Total value | (105, 131) 462 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $763,809.27 | (105, 151) 462 × 38 px | 30px/38px 600 | `rgb(255, 255, 255)` |
| 5 of 5 refreshed | (105, 195) 109 × 20 px | 12px/18px 500 | `rgb(95, 195, 156)` |
| All active sources at 09:41. Today +0.20% · 7D +3.53% · 30D +4.75% | (105, 221) 462 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Total value, excluding OKX | (608, 131) 441 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $621,333.50 | (608, 151) 441 × 38 px | 30px/38px 600 | `rgb(255, 255, 255)` |
| Partial | (608, 195) 55 × 20 px | 12px/18px 500 | `rgb(217, 164, 65)` |
| default after a failure | (672, 198) 125 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Excludes $142,475.77 at current prices, or $142,090.44 as last known. Changes hidden. | (608, 221) 441 × 36 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Total value, with OKX last known | (1090, 131) 441 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $763,423.94 | (1090, 151) 441 × 38 px | 30px/38px 600 | `rgb(255, 255, 255)` |
| Includes stale OKX | (1090, 195) 124 × 20 px | 12px/18px 500 | `rgb(217, 164, 65)` |
| OKX value from 30 Oct 21:14: $142,090.44. Changes hidden; mixed times. | (1090, 221) 441 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| The rule | (105, 315) 60 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| The word total needs 5 of 5. | (105, 359) 944.7 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Total value is only unlabelled when every active source refreshed in this run. Otherwise the label says what is excluded or stale. | (105, 379) 944.7 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| The default is exclusion, in the open. | (105, 422) 944.7 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| A failed source is left out of the total, named in the label, and flagged by the Partial pill and the banner. Nothing is guessed. | (105, 442) 944.7 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Last known values are a choice. | (105, 485) 944.7 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Use last known values adds the source back at its last good value and says so in the label, with its date. The user picks it; it never happens by itself. | (105, 505) 944.7 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Changes need a complete baseline. | (105, 548) 944.7 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Today, 7D and 30D show a grey dash while the total is partial or mixed, with the reason under them. | (105, 568) 944.7 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| History keeps the truth. | (105, 611) 944.7 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| A snapshot taken during a partial refresh is stored as Partial, shows 4 of 5, and is skipped by charts and comparisons by default. | (105, 631) 944.7 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| It clears itself. | (105, 674) 944.7 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| The flag disappears when Retry succeeds. No acknowledge step. | (105, 694) 944.7 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Where the flag shows | (1107.7, 315) 157 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Surface | (1107.7, 347) 152.3 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| What changes | (1260, 347) 291 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Overview total | (1107.7, 371.5) 152.3 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Label, Partial pill | (1260, 371.5) 291 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| Top bar total | (1107.7, 413.5) 152.3 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Amber dot, tooltip names source | (1260, 413.5) 291 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| Sources card | (1107.7, 455.5) 152.3 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Failed row, last known value | (1260, 455.5) 291 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| History | (1107.7, 497.5) 152.3 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Partial pill, 4 of 5 | (1260, 497.5) 291 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| Summary, Wallets | (1107.7, 539.5) 152.3 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Same banner, same actions | (1260, 539.5) 291 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| Rebalance | (1107.7, 581.5) 152.3 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Trades disabled until complete | (1260, 581.5) 291 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| Sync | (1107.7, 623.5) 152.3 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Snapshot uploads as Partial | (1260, 623.5) 291 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| Assistant | (1107.7, 665.5) 152.3 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Context says totals are partial | (1260, 665.5) 291 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| Goals & alerts | (1107.7, 707.5) 152.3 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Value rules wait for a full total | (1260, 707.5) 291 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |

## Interactive parts and state variants

This specification covers the **refresh-rule** state. Segmented controls, pills, source rows, table links, buttons, calendar choices, popovers, dialogs, toasts, dismissals and keyboard focus are actionable only where present in the actual product. The source's visible controls are:

- a: `Overview` at (10, 62) 35 × 36 px.
- a: `Summary` at (10, 119) 35 × 36 px.
- a: `Wallets` at (10, 157) 35 × 36 px.
- a: `Comparison` at (10, 195) 35 × 36 px.
- a: `Cost basis` at (10, 233) 35 × 36 px.
- a: `History` at (10, 290) 35 × 36 px.
- a: `Rebalance` at (10, 328) 35 × 36 px.
- a: `Goals & alerts` at (10, 366) 35 × 36 px.
- a: `Assistant` at (10, 404) 35 × 36 px.
- a: `Settings` at (10, 852) 35 × 36 px.

Loading preserves the containing card frame; error and partial states keep last-good data and show a reason plus recovery action; empty states keep the frame with an explicit next step. Overlays and popovers do not move the underlying grid. UI state does not add persisted fields. Any product-absent behavior is recorded below after comparing the real capture.

## Remaining differences

- Measured pixel difference: **9.11%** using the review gate's RGB-difference sum greater than 60. Source 1600 × 900; app 1600 × 1631. [App capture](/tmp/fidelity-desktop/refresh/refresh-rule-desktop.png); [rendered design](/tmp/fidelity-desktop/design-flows/refresh-rule.png). The ratio uses the overlapping top-left rectangle; the dimensions show any size mismatch.
- The reference is an explanatory page with a three-total comparison, six prose rules and a where-flags-show table. Track3 has no route for this design catalogue. The capture shows the actual partial Overview state; the entire informational page is absent.
