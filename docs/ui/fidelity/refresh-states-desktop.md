# refresh-states desktop design specification

Approved image: `desktop/flows/refresh-states-desktop.jpg`. Authoritative source: `source/ds/pages/flows-refresh.html#states`, `flows.css`, `ds.css`, `ds.js`, and `lib.js`. Image and source render inspected at 1600 px in dark theme.

## Structure and measured geometry

Full-page size: **1600 × 992 px**. The standard desktop rail is 56 px wide; the main area has 28 px horizontal and 20 px top padding. The design uses a 12-column grid with a 16 px gap; full/eight/four-column cards are 1488/987/485 px wide. Cards use 20 px padding, a 1 px border and 6 px radius.

| Block or component | Bounds | Opening copy |
| --- | --- | --- |
| `div.head` | (84, 20) 1488 × 74 px | FlowsRefresh statesThe control in the Overview header, and what it says in each state. |
| `div.grid.g12` | (84, 110) 1488 × 842 px | StateControlStatus textBehaviourIdleRefreshSynced 09:41 · on this deviceRefresh starts all active sources in parallel. Inactive so |
| `section.card.s12` | (84, 110) 1488 × 512 px | StateControlStatus textBehaviourIdleRefreshSynced 09:41 · on this deviceRefresh starts all active sources in parallel. Inactive so |
| `section.card.s6` | (84, 638) 736 × 314 px | Per-source statusin popover, Sources card and phone sheet BnBinanceDone in 3.1 sLgLedger cold walletReading balancesOKOKXRequest t |
| `section.card.s6` | (836, 638) 736 × 314 px | Rules A failure names its reason. Plain words and the number that matters (20 s, 50 of 50). No raw stack in the row; Copy diagnost |

## Exact visible copy, order, type and colour

The source uses Public Sans with tabular numerals. Tokens: ground `#0d0d0e`, card `#131217`, raised `#1b1a20`, border `#222224`, rule `#1b1a1f`, control `#3a3a3e`, text `#fff`, muted `#b4b6bc`, faint `#9b9da3`, accent `#4a8ad6`, positive `#5fc39c`, negative `#ee6a82`, warning `#d9a441`. Icons are 18 px stroked SVG by default. Values are USD with comma groups and two decimals, signed changes use + or −, percent values use the precision shown below, dates use abbreviated month names, and source times use 24-hour `HH:MM`.

| Copy | Bounds | Font (size/line height weight) | Computed colour |
| --- | --- | --- | --- |
| Flows | (84, 20) 1472 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Refresh states | (84, 42) 1472 × 32 px | 26px/32px 600 | `rgb(255, 255, 255)` |
| The control in the Overview header, and what it says in each state. | (84, 76) 1472 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| State | (105, 131) 150 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Control | (255, 131) 254 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Status text | (509, 131) 250 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Behaviour | (759, 131) 792 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Idle | (105, 155.5) 150 × 55 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Refresh | (255, 166) 100 × 34 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Synced 09:41 · on this device | (525, 174.5) 179 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Refresh starts all active sources in parallel. Inactive sources are skipped. | (759, 155.5) 792 × 55 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Refreshing | (105, 210.5) 150 × 55 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Refreshing · 3 of 5 finished | (255, 221) 238 × 34 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Updating totals when 5 of 5 finish | (525, 228) 210 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Button stays enabled: it opens the progress popover. Totals keep the last complete value and are marked while running. | (759, 210.5) 792 × 55 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Done | (105, 265.5) 150 × 55 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Refresh | (255, 276) 100 × 34 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| 5 of 5 refreshed at 09:41 | (525, 284.5) 158 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Popover closes itself after 2 s unless the pointer is inside. Toast: Refresh complete. | (759, 265.5) 792 × 55 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Partial failure | (105, 320.5) 150 × 61 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Refresh | (255, 334) 100 × 34 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| 4 of 5 sources · 09:42 | (525, 342.5) 138 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Header button stays Refresh (all sources). The banner holds Retry (failed sources only) and stays on Overview, Summary and Wallets until resolved. | (759, 320.5) 792 × 61 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Pro quota used | (105, 381.5) 150 × 55 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Refresh | (255, 392) 100 × 34 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| 4 of 5 sources · 09:42 | (525, 400.5) 138 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Source row says Quota used with the reset date. Action: Manage plan on desktop, See usage on iOS (no checkout there). | (759, 381.5) 792 × 55 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Offline | (105, 436.5) 150 × 55 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Refresh | (255, 447) 100 × 34 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Offline · last refresh 09:41 | (525, 455.5) 165 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Disabled with a reason. Sources are not marked failed; stale banner shows instead. Refresh enables when the network returns. | (759, 436.5) 792 × 55 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| No sources | (105, 491.5) 150 × 55 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Refresh | (255, 502) 100 × 34 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| No sources yet | (525, 510.5) 97 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Disabled; the empty Overview carries the one primary action, Add a source. | (759, 491.5) 792 × 55 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Never refreshed | (105, 546.5) 150 × 54.5 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Refresh now | (255, 557) 128 × 34 px | 13px/18px 500 | `rgb(13, 13, 14)` |
| Binance never refreshed | (525, 565.5) 152 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| The only primary-weight Refresh. Totals and chart stay empty until it finishes. | (759, 546.5) 792 × 54.5 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Per-source status | (105, 659) 128 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| in popover, Sources card and phone sheet | (560, 661) 239 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Bn | (105, 705) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| Binance | (145, 702) 642 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Done in 3.1 s | (145, 720) 642 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Lg | (105, 761.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| Ledger cold wallet | (145, 758.5) 642 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Reading balances | (145, 776.5) 642 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| OK | (105, 817.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| OKX | (145, 814.5) 586 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Request timed out after 20 s | (165, 832.5) 164 × 16 px | 12px/16px 400 | `rgb(238, 106, 130)` |
| Retry | (743, 817.5) 56 × 28 px | 12px/16px 500 | `rgb(155, 157, 163)` |
| 0x | (105, 873.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| 0x4f…a91c | (145, 870.5) 544 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Pro limit reached: 50 of 50 ERC20 refreshes used, resets 1 Nov | (165, 888.5) 363 × 16 px | 12px/16px 400 | `rgb(217, 164, 65)` |
| Manage plan | (701, 873.5) 98 × 28 px | 12px/16px 500 | `rgb(155, 157, 163)` |
| Rules | (857, 659) 41 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| A failure names its reason. | (857, 693) 160 × 15 px | 13px/19px 600 | `rgb(255, 255, 255)` |
| Plain words and the number that matters (20 s, 50 of 50). No raw stack in the row; Copy diagnostics lives in the sync popover. | (857, 691) 694 × 38 px | 13px/19px 400 | `rgb(180, 182, 188)` |
| Retry is per source. | (857, 741) 117 × 15 px | 13px/19px 600 | `rgb(255, 255, 255)` |
| Retry on a row, Retry failed in the popover footer, and Retry in the banner re-run only failed sources; finished ones keep their values. | (857, 739) 694 × 38 px | 13px/19px 400 | `rgb(180, 182, 188)` |
| Colour carries state, text carries meaning. | (857, 789) 253 × 15 px | 13px/19px 600 | `rgb(255, 255, 255)` |
| Red for a failed request, amber when the action is on the user (quota, key, limit). | (857, 787) 694 × 38 px | 13px/19px 400 | `rgb(180, 182, 188)` |
| Offline is not failure. | (857, 837) 124 × 15 px | 13px/19px 600 | `rgb(255, 255, 255)` |
| With no network the sources are not marked failed; the stale banner explains it and Refresh is disabled until the connection returns. | (857, 835) 694 × 38 px | 13px/19px 400 | `rgb(180, 182, 188)` |
| Inactive sources are skipped. | (857, 885) 176 × 15 px | 13px/19px 600 | `rgb(255, 255, 255)` |
| A source switched off in Settings is not counted in “of 5”. | (857, 883) 694 × 19 px | 13px/19px 400 | `rgb(180, 182, 188)` |
| Timing. | (857, 914) 45 × 15 px | 13px/19px 600 | `rgb(255, 255, 255)` |
| A source is failed after 20 s with no response; one automatic retry happens before it is shown as failed. | (857, 912) 694 × 19 px | 13px/19px 400 | `rgb(180, 182, 188)` |

## Interactive parts and state variants

This specification covers the **refresh-states** state. Segmented controls, pills, source rows, table links, buttons, calendar choices, popovers, dialogs, toasts, dismissals and keyboard focus are actionable only where present in the actual product. The source's visible controls are:

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
- button: `Refresh` at (255, 166) 100 × 34 px.
- button: `Refreshing · 3 of 5 finished` at (255, 221) 238 × 34 px.
- button: `Refresh` at (255, 276) 100 × 34 px.
- button: `Refresh` at (255, 334) 100 × 34 px.
- button: `Refresh` at (255, 392) 100 × 34 px.
- button: `Refresh` at (255, 447) 100 × 34 px.
- button: `Refresh` at (255, 502) 100 × 34 px.
- button: `Refresh now` at (255, 557) 128 × 34 px.
- button: `Retry` at (743, 817.5) 56 × 28 px.
- button: `Manage plan` at (701, 873.5) 98 × 28 px.

Loading preserves the containing card frame; error and partial states keep last-good data and show a reason plus recovery action; empty states keep the frame with an explicit next step. Overlays and popovers do not move the underlying grid. UI state does not add persisted fields. Any product-absent behavior is recorded below after comparing the real capture.

## Remaining differences

- Measured pixel difference: **8.60%** using the review gate's RGB-difference sum greater than 60. Source 1600 × 992; app 1600 × 1523. [App capture](/tmp/fidelity-desktop/refresh/refresh-states-desktop.png); [rendered design](/tmp/fidelity-desktop/design-flows/refresh-states.png). The ratio uses the overlapping top-left rectangle; the dimensions show any size mismatch.
- The reference is a control and behavior matrix with eight refresh modes, source examples and written rules, rather than a runtime state. Track3 has no route for this catalogue. The capture shows the closest real Overview.
