# refresh-partial desktop design specification

Approved image: `desktop/flows/refresh-partial-desktop.jpg`. Authoritative source: `source/ds/pages/flows-refresh.html#partial`, `flows.css`, `ds.css`, `ds.js`, and `lib.js`. Image and source render inspected at 1600 px in dark theme.

## Structure and measured geometry

Full-page size: **1600 × 1109 px**. The standard desktop rail is 56 px wide; the main area has 28 px horizontal and 20 px top padding. The design uses a 12-column grid with a 16 px gap; full/eight/four-column cards are 1488/987/485 px wide. Cards use 20 px padding, a 1 px border and 6 px radius.

| Block or component | Bounds | Opening copy |
| --- | --- | --- |
| `div.head` | (84, 20) 1488 × 52 px | OverviewRefreshed 09:42 · 4 of 5 sources1D7D30D90D1YAll4 of 5 sources · 09:42Refresh |
| `div.banner.warn` | (84, 88) 1488 × 64 px | OKX failed, 4 of 5 sources refreshed. Totals exclude OKX.Request timed out after 20 s. OKX was last refreshed 30 Oct 21:14 and hel |
| `div.grid.g12` | (84, 168) 1488 × 900.5 px | Portfolio valueUSD · complete snapshotsTotal value, excluding OKX$621,333.50PartialOKX last known $142,090.44Today—incomplete7 day |
| `section.card.s8` | (84, 168) 986.7 × 450 px | Portfolio valueUSD · complete snapshotsTotal value, excluding OKX$621,333.50PartialOKX last known $142,090.44Today—incomplete7 day |
| `section.card.s4` | (1086.7, 168) 485.3 × 450 px | Sources5 sourcesBnBinanceRefreshed 09:41$358,418.1757.7%OKOKXFailed · last good 30 Oct 21:14$142,090.44last knownLgLedger cold wal |
| `section.card.s8` | (84, 634) 986.7 × 434.5 px | Holdings8 assets, OKX left outAssetPriceValue7DBTC33.1%$63,842.11$205,737.58—ETH19.1%$2,527.14$118,775.58—USDT18.1%$1.00$112,446.7 |
| `section.card.s4` | (1086.7, 634) 485.3 × 434.5 px | Left out: OKXlast knownETH 12.8508$32,097.44USDT 70,000.00$69,993.00USDC 40,000.00$40,000.00Last known total$142,090.44As of 30 Oc |

## Exact visible copy, order, type and colour

The source uses Public Sans with tabular numerals. Tokens: ground `#0d0d0e`, card `#131217`, raised `#1b1a20`, border `#222224`, rule `#1b1a1f`, control `#3a3a3e`, text `#fff`, muted `#b4b6bc`, faint `#9b9da3`, accent `#4a8ad6`, positive `#5fc39c`, negative `#ee6a82`, warning `#d9a441`. Icons are 18 px stroked SVG by default. Values are USD with comma groups and two decimals, signed changes use + or −, percent values use the precision shown below, dates use abbreviated month names, and source times use 24-hour `HH:MM`.

| Copy | Bounds | Font (size/line height weight) | Computed colour |
| --- | --- | --- | --- |
| Overview | (84, 20) 954 × 32 px | 26px/32px 600 | `rgb(255, 255, 255)` |
| Refreshed 09:42 · | (84, 54) 954 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| 4 of 5 | (198, 55) 36 × 15 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| sources | (84, 54) 954 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| 1D | (1056, 41) 40 × 28 px | 12px/18px 500 | `rgb(155, 157, 163)` |
| 7D | (1096, 41) 40 × 28 px | 12px/18px 500 | `rgb(155, 157, 163)` |
| 30D | (1136, 41) 48 × 28 px | 12px/18px 500 | `rgb(255, 255, 255)` |
| 90D | (1184, 41) 48 × 28 px | 12px/18px 500 | `rgb(155, 157, 163)` |
| 1Y | (1232, 41) 39 × 28 px | 12px/18px 500 | `rgb(155, 157, 163)` |
| All | (1271, 41) 41 × 28 px | 12px/18px 500 | `rgb(155, 157, 163)` |
| 4 of 5 sources · 09:42 | (1324, 46) 138 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Refresh | (1472, 38) 100 × 34 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| OKX failed, 4 of 5 sources refreshed. Totals exclude OKX. | (129, 101) 1202 × 18 px | 13px/18px 600 | `rgb(217, 164, 65)` |
| Request timed out after 20 s. OKX was last refreshed 30 Oct 21:14 and held $142,090.44. | (129, 121) 1202 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Today, 7-day and 30-day changes stay hidden until every source is included. | (693, 122) 469 × 15 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Retry | (1343, 101) 56 × 28 px | 12px/16px 500 | `rgb(155, 157, 163)` |
| Use last known values | (1407, 101) 150 × 28 px | 12px/16px 500 | `rgb(180, 182, 188)` |
| Portfolio value | (105, 189) 106 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| USD · complete snapshots | (901.7, 191) 148 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Total value, excluding OKX | (105, 221) 216.2 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $621,333.50 | (105, 241) 216.2 × 38 px | 34px/38px 600 | `rgb(255, 255, 255)` |
| Partial | (105, 279) 55 × 20 px | 12px/18px 500 | `rgb(217, 164, 65)` |
| OKX last known $142,090.44 | (105, 303) 216.2 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Today | (362.2, 255) 195.2 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| — | (362.2, 276) 25 × 26 px | 22px/28px 500 | `rgb(155, 157, 163)` |
| incomplete | (362.2, 303) 195.2 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| 7 days | (598.3, 255) 195.2 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| — | (598.3, 276) 25 × 26 px | 22px/28px 500 | `rgb(155, 157, 163)` |
| incomplete | (598.3, 303) 195.2 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| 30 days | (834.5, 255) 195.2 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| — | (834.5, 276) 25 × 26 px | 22px/28px 500 | `rgb(155, 157, 163)` |
| incomplete | (834.5, 303) 195.2 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| 700K | (109, 538) 32 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 720K | (109, 488.5) 32 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 740K | (109, 439) 32 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 760K | (109, 389.5) 32 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 780K | (109, 340) 32 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 1 Oct | (149, 552) 32 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 6 Oct | (288.3, 552) 32 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 11 Oct | (439.6, 552) 40 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 16 Oct | (594.9, 552) 40 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 21 Oct | (750.1, 552) 40 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 26 Oct | (905.4, 552) 40 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 30 Oct | (1009.7, 552) 40 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| The line is complete snapshots, OKX included, up to 30 Oct ($762,276.11). Today’s partial total is not comparable, so it is not plotted. | (105, 579) 944.7 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Sources | (1107.7, 189) 59 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| 5 sources | (1495, 191) 56 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Bn | (1107.7, 235) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| Binance | (1147.7, 232) 302.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Refreshed 09:41 | (1147.7, 250) 302.3 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| $358,418.17 | (1462, 232) 89 × 34 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| 57.7% | (1462, 250) 89 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| OK | (1107.7, 291.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| OKX | (1147.7, 288.5) 302.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Failed · last good 30 Oct 21:14 | (1147.7, 306.5) 302.3 × 16 px | 12px/16px 400 | `rgb(238, 106, 130)` |
| $142,090.44 | (1462, 289.5) 89 × 15 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| last known | (1462, 306.5) 89 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Lg | (1107.7, 347.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| Ledger cold wallet | (1147.7, 344.5) 302.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Refreshed 09:40 | (1147.7, 362.5) 302.3 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| $129,127.05 | (1462, 344.5) 89 × 34 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| 20.8% | (1462, 362.5) 89 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| 0x | (1107.7, 403.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| 0x4f…a91c | (1147.7, 400.5) 311.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Refreshed 09:40 | (1147.7, 418.5) 311.3 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| $68,232.78 | (1471, 400.5) 80 × 34 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| 11.0% | (1471, 418.5) 80 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| IB | (1107.7, 459.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| Interactive Brokers | (1147.7, 456.5) 311.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Refreshed 09:41 | (1147.7, 474.5) 311.3 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| $65,555.50 | (1471, 456.5) 80 × 34 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| 10.6% | (1471, 474.5) 80 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| 4 of 5 refreshed at 09:42 | (1107.7, 579) 158 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Holdings | (105, 655) 65 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| 8 assets, OKX left out | (923.7, 657) 126 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Asset | (105, 687) 302 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Price | (407, 687) 265.9 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Value | (672.9, 687) 290.9 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| 7D | (963.8, 687) 85.9 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| BTC | (105, 711.5) 302 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 33.1% | (139, 725.5) 39 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $63,842.11 | (407, 711.5) 265.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $205,737.58 | (672.9, 711.5) 290.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (963.8, 711.5) 85.9 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| ETH | (105, 753.5) 302 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 19.1% | (139, 767.5) 39 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $2,527.14 | (407, 753.5) 265.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $118,775.58 | (672.9, 753.5) 290.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (963.8, 753.5) 85.9 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| USDT | (105, 795.5) 302 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 18.1% | (148, 809.5) 39 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $1.00 | (407, 795.5) 265.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $112,446.74 | (672.9, 795.5) 290.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (963.8, 795.5) 85.9 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| SOL | (105, 837.5) 302 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 11.1% | (140, 851.5) 39 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $168.40 | (407, 837.5) 265.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $69,044.00 | (672.9, 837.5) 290.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (963.8, 837.5) 85.9 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| BNB | (105, 879.5) 302 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 8.0% | (141, 893.5) 31 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $579.58 | (407, 879.5) 265.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $49,774.10 | (672.9, 879.5) 290.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (963.8, 879.5) 85.9 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| AAPL | (105, 921.5) 302 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 5.5% | (147, 935.5) 31 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $229.87 | (407, 921.5) 265.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $34,480.50 | (672.9, 921.5) 290.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (963.8, 921.5) 85.9 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| NVDA | (105, 963.5) 302 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 5.0% | (150, 977.5) 31 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $141.25 | (407, 963.5) 265.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $31,075.00 | (672.9, 963.5) 290.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (963.8, 963.5) 85.9 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| USDC | (105, 1005.5) 302 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| only in OKX | (149, 1019.8) 65 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $1.00 | (407, 1005.5) 265.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (948.8, 1018.8) 15 × 15 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| — | (963.8, 1005.5) 85.9 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| Left out: OKX | (1107.7, 655) 99 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| last known | (1489, 657) 62 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| ETH | (1107.7, 701) 26 × 15 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 12.8508 | (1142.7, 701) 58 × 15 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| $32,097.44 | (1471, 700) 80 × 18 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| USDT | (1107.7, 745.5) 35 × 15 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 70,000.00 | (1151.7, 745.5) 71 × 15 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| $69,993.00 | (1471, 744.5) 80 × 18 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| USDC | (1107.7, 789.5) 36 × 15 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 40,000.00 | (1152.7, 789.5) 71 × 15 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| $40,000.00 | (1471, 788.5) 80 × 18 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| Last known total | (1107.7, 832.5) 342.3 × 18 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| $142,090.44 | (1462, 832.5) 89 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| As of 30 Oct 21:14, at that day’s prices. Not part of the total above. | (1107.7, 875) 443.3 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Total excluding OKX | (1107.7, 979) 342.3 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| $621,333.50 | (1462, 979) 89 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| With OKX last known | (1107.7, 1019) 342.3 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| $763,423.94 | (1462, 1019) 89 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |

## Interactive parts and state variants

This specification covers the **refresh-partial** state. Segmented controls, pills, source rows, table links, buttons, calendar choices, popovers, dialogs, toasts, dismissals and keyboard focus are actionable only where present in the actual product. The source's visible controls are:

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
- button: `Retry` at (1343, 101) 56 × 28 px.
- button: `Use last known values` at (1407, 101) 150 × 28 px.

Loading preserves the containing card frame; error and partial states keep last-good data and show a reason plus recovery action; empty states keep the frame with an explicit next step. Overlays and popovers do not move the underlying grid. UI state does not add persisted fields. Any product-absent behavior is recorded below after comparing the real capture.

## Remaining differences

- Measured pixel difference: **9.79%** using the review gate's RGB-difference sum greater than 60. Source 1600 × 1109; app 1600 × 1631. [App capture](/tmp/fidelity-desktop/refresh/refresh-partial-desktop.png); [rendered design](/tmp/fidelity-desktop/design-flows/refresh-partial.png). The ratio uses the overlapping top-left rectangle; the dimensions show any size mismatch.
- The current page derives an excluded-source display total from the persisted partial snapshot and the last complete snapshot. It shows the warning above the full three-row Overview; its hero selector can include last-known values or exclude the unavailable source. The persisted partial snapshot still uses fill=last_known; the displayed total is a view of that data. The design's compact grid and Left out card are absent, and chart labels and card geometry differ.
- The source status fixture reports a later success time than the preceding complete snapshot. The excluded value is labelled with that snapshot's actual time; if no complete snapshot exists, the value is unknown and the last-known action is disabled.
