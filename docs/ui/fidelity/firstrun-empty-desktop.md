# firstrun-empty desktop design specification

Approved image: `desktop/flows/firstrun-empty-desktop.jpg`. Authoritative source: `source/ds/pages/flows-firstrun.html#empty`, `flows.css`, `ds.css`, `ds.js`, and `lib.js`. Image and source render inspected at 1600 px in dark theme.

## Structure and measured geometry

Full-page size: **1600 × 900 px**. The standard desktop rail is 56 px wide; the main area has 28 px horizontal and 20 px top padding. The design uses a 12-column grid with a 16 px gap; full/eight/four-column cards are 1488/987/485 px wide. Cards use 20 px padding, a 1 px border and 6 px radius.

| Block or component | Bounds | Opening copy |
| --- | --- | --- |
| `div.head` | (84, 20) 1488 × 52 px | OverviewAdd a source to start tracking your portfolio.Refresh |
| `div.grid.g12` | (84, 88) 1488 × 528 px | Add your first source Track3 reads balances only and keeps them on this device. Pick what you want to track; you can add more late |
| `section.card.s8` | (84, 88) 986.7 × 340 px | Add your first source Track3 reads balances only and keeps them on this device. Pick what you want to track; you can add more late |
| `section.card.s4` | (1086.7, 88) 485.3 × 340 px | Have a backup? Restore a JSON export from another device. Sources, history and settings come back as they were. Local fileTrack3 J |
| `section.card.s8` | (84, 444) 986.7 × 172 px | Portfolio valueUSD Total value over time appears hereAdd a source and refresh to begin. |
| `section.card.s4` | (1086.7, 444) 485.3 × 172 px | Holdings No holdings yetHoldings appear after your first refresh. |

## Exact visible copy, order, type and colour

The source uses Public Sans with tabular numerals. Tokens: ground `#0d0d0e`, card `#131217`, raised `#1b1a20`, border `#222224`, rule `#1b1a1f`, control `#3a3a3e`, text `#fff`, muted `#b4b6bc`, faint `#9b9da3`, accent `#4a8ad6`, positive `#5fc39c`, negative `#ee6a82`, warning `#d9a441`. Icons are 18 px stroked SVG by default. Values are USD with comma groups and two decimals, signed changes use + or −, percent values use the precision shown below, dates use abbreviated month names, and source times use 24-hour `HH:MM`.

| Copy | Bounds | Font (size/line height weight) | Computed colour |
| --- | --- | --- | --- |
| Overview | (84, 20) 1372 × 32 px | 26px/32px 600 | `rgb(255, 255, 255)` |
| Add a source to start tracking your portfolio. | (84, 54) 1372 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Refresh | (1472, 38) 100 × 34 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Add your first source | (105, 109) 944.7 × 26 px | 20px/26px 600 | `rgb(255, 255, 255)` |
| Track3 reads balances only and keeps them on this device. Pick what you want to track; you can add more later. | (105, 141) 560 × 38 px | 13px/19px 400 | `rgb(180, 182, 188)` |
| Exchange | (122, 243) 272.9 × 18 px | 15px/18px 600 | `rgb(255, 255, 255)` |
| Binance, OKX, Bitget, Kraken, Gate.io, Coinbase, Bybit, HTX, MEXC, Backpack | (122, 265) 272.9 × 36 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Read-only API key | (122, 301) 272.9 × 29 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Wallet | (440.9, 243) 272.9 × 18 px | 15px/18px 600 | `rgb(255, 255, 255)` |
| BTC, ETH and ERC20, SOL, DOGE, TRON and TRC20, TON, SUI | (440.9, 265) 272.9 × 36 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Public address | (440.9, 301) 272.9 × 29 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Broker | (759.8, 243) 272.9 × 18 px | 15px/18px 600 | `rgb(255, 255, 255)` |
| Interactive Brokers: stocks and ETFs from a Flex Query report | (759.8, 265) 272.9 × 36 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Flex Query token | (759.8, 301) 272.9 × 29 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Add an exchange | (105, 367) 147 × 40 px | 13px/18px 500 | `rgb(13, 13, 14)` |
| Takes about two minutes with an API key ready. | (266, 378) 270 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Have a backup? | (1107.7, 109) 113 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Restore a JSON export from another device. Sources, history and settings come back as they were. | (1107.7, 141) 443.3 × 38 px | 13px/19px 400 | `rgb(180, 182, 188)` |
| Local file | (1107.7, 207) 443.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Track3 JSON export | (1107.7, 237) 443.3 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Encrypted sync | (1107.7, 280) 443.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| From an S3-compatible bucket, needs your passphrase | (1107.7, 310) 443.3 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Import a backup | (1107.7, 373) 150 × 34 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Portfolio value | (105, 465) 106 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| USD | (1025.7, 467) 24 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Total value over time appears here | (474.3, 526) 206 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Add a source and refresh to begin. | (474.3, 548) 206 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Holdings | (1107.7, 465) 65 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| No holdings yet | (1214.8, 526) 229 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Holdings appear after your first refresh. | (1214.8, 548) 229 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |

## Interactive parts and state variants

This specification covers the **firstrun-empty** state. Segmented controls, pills, source rows, table links, buttons, calendar choices, popovers, dialogs, toasts, dismissals and keyboard focus are actionable only where present in the actual product. The source's visible controls are:

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
- button: `Refresh` at (1472, 38) 100 × 34 px.
- button: `Add an exchange` at (105, 367) 147 × 40 px.
- button: `Import a backup` at (1107.7, 373) 150 × 34 px.

Loading preserves the containing card frame; error and partial states keep last-good data and show a reason plus recovery action; empty states keep the frame with an explicit next step. Overlays and popovers do not move the underlying grid. UI state does not add persisted fields. Any product-absent behavior is recorded below after comparing the real capture.

## Remaining differences

- Measured pixel difference: **2.52%** using the review gate's RGB-difference sum greater than 60. Source 1600 × 900; app 1600 × 900. [App capture](/tmp/fidelity-desktop/firstrun/firstrun-empty-desktop.png); [rendered design](/tmp/fidelity-desktop/design-flows/firstrun-empty.png). The ratio uses the overlapping top-left rectangle; the dimensions show any size mismatch.
- The source picker, backup card, empty chart and holdings grid are aligned. No product behavior is omitted from this state.
