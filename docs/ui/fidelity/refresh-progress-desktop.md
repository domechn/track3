# refresh-progress desktop design specification

Approved image: `desktop/flows/refresh-progress-desktop.jpg`. Authoritative source: `source/ds/pages/flows-refresh.html#progress`, `flows.css`, `ds.css`, `ds.js`, and `lib.js`. Image and source render inspected at 1600 px in dark theme.

## Structure and measured geometry

Full-page size: **1600 × 979 px**. The standard desktop rail is 56 px wide; the main area has 28 px horizontal and 20 px top padding. The design uses a 12-column grid with a 16 px gap; full/eight/four-column cards are 1488/987/485 px wide. Cards use 20 px padding, a 1 px border and 6 px radius.

| Block or component | Bounds | Opening copy |
| --- | --- | --- |
| `div.head` | (84, 20) 1488 × 52 px | OverviewRefreshing 5 sources. Totals update when each source has finished or failed.1D7D30D90D1YAllRefreshing · 3 of 5 finished |
| `div.grid.g12` | (84, 88) 1488 × 850.5 px | Portfolio valueUSDTotal value$763,809.27+$34,641.48 · +4.75% since 1 OctToday+0.20%+$1,533.167 days+3.53%+$26,010.8430 days+4.75%+ |
| `section.card.s8` | (84, 88) 986.7 × 400 px | Portfolio valueUSDTotal value$763,809.27+$34,641.48 · +4.75% since 1 OctToday+0.20%+$1,533.167 days+3.53%+$26,010.8430 days+4.75%+ |
| `section.card.s4` | (1086.7, 88) 485.3 × 400 px | Sources5 sourcesBnBinanceRefreshed 09:41$358,418.1746.9%OKOKXFailed · last good 30 Oct 21:14$142,090.44last knownLgLedger cold wal |
| `section.card.s8` | (84, 504) 986.7 × 434.5 px | Holdings8 assetsAssetPriceValue7DBTC26.9%$63,842.11$205,737.58+6.4%USDT23.9%$1.00$182,446.740.0%ETH19.8%$2,527.14$151,251.35+3.1%S |
| `section.card.s4` | (1086.7, 504) 485.3 × 434.5 px | What moved7 daysBTC+$12,286SOL+$8,663ETH+$4,507BNB+$1,324NVDA+$532USDT+$55USDC$0AAPL−$1,358 |
| `div.pop.rf` | (1180, 82) 392 × 396 px | Refreshing sources3 of 5 finished · 1 failedBnBinanceDone in 3.1 sOKOKXRequest timed out after 20 sRetryLgLedger cold walletReadin |

## Exact visible copy, order, type and colour

The source uses Public Sans with tabular numerals. Tokens: ground `#0d0d0e`, card `#131217`, raised `#1b1a20`, border `#222224`, rule `#1b1a1f`, control `#3a3a3e`, text `#fff`, muted `#b4b6bc`, faint `#9b9da3`, accent `#4a8ad6`, positive `#5fc39c`, negative `#ee6a82`, warning `#d9a441`. Icons are 18 px stroked SVG by default. Values are USD with comma groups and two decimals, signed changes use + or −, percent values use the precision shown below, dates use abbreviated month names, and source times use 24-hour `HH:MM`.

| Copy | Bounds | Font (size/line height weight) | Computed colour |
| --- | --- | --- | --- |
| Overview | (84, 20) 964 × 32 px | 26px/32px 600 | `rgb(255, 255, 255)` |
| Refreshing 5 sources. Totals update when each source has finished or failed. | (84, 54) 964 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| 1D | (1066, 41) 40 × 28 px | 12px/18px 500 | `rgb(155, 157, 163)` |
| 7D | (1106, 41) 40 × 28 px | 12px/18px 500 | `rgb(155, 157, 163)` |
| 30D | (1146, 41) 48 × 28 px | 12px/18px 500 | `rgb(255, 255, 255)` |
| 90D | (1194, 41) 48 × 28 px | 12px/18px 500 | `rgb(155, 157, 163)` |
| 1Y | (1242, 41) 39 × 28 px | 12px/18px 500 | `rgb(155, 157, 163)` |
| All | (1281, 41) 41 × 28 px | 12px/18px 500 | `rgb(155, 157, 163)` |
| Refreshing · 3 of 5 finished | (1334, 38) 238 × 34 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Portfolio value | (105, 109) 106 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| USD | (1025.7, 111) 24 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Total value | (105, 141) 216.2 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $763,809.27 | (105, 161) 216.2 × 38 px | 34px/38px 600 | `rgb(255, 255, 255)` |
| +$34,641.48 · +4.75% | (105, 199) 216.2 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| since 1 Oct | (242, 201) 65 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Today | (362.2, 151) 195.2 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| +0.20% | (362.2, 171) 195.2 × 28 px | 22px/28px 500 | `rgb(95, 195, 156)` |
| +$1,533.16 | (362.2, 199) 195.2 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| 7 days | (598.3, 151) 195.2 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| +3.53% | (598.3, 171) 195.2 × 28 px | 22px/28px 500 | `rgb(95, 195, 156)` |
| +$26,010.84 | (598.3, 199) 195.2 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| 30 days | (834.5, 151) 195.2 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| +4.75% | (834.5, 171) 195.2 × 28 px | 22px/28px 500 | `rgb(95, 195, 156)` |
| +$34,641.48 | (834.5, 199) 195.2 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| 700K | (109, 434) 32 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 720K | (109, 384.5) 32 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 740K | (109, 335) 32 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 760K | (109, 285.5) 32 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 780K | (109, 236) 32 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 1 Oct | (149, 448) 32 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 6 Oct | (271.4, 448) 32 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 11 Oct | (405.9, 448) 40 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 16 Oct | (544.3, 448) 40 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 21 Oct | (682.8, 448) 40 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 26 Oct | (821.2, 448) 40 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| 30 Oct | (932, 448) 40 × 14 px | 12px/18px 400 | `rgb(255, 255, 255)` |
| $763,809 | (985.7, 276.1) 60 × 14 px | 12px/18px 600 | `rgb(255, 255, 255)` |
| Sources | (1107.7, 109) 59 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| 5 sources | (1495, 111) 56 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Bn | (1107.7, 155) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| Binance | (1147.7, 152) 302.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Refreshed 09:41 | (1147.7, 170) 302.3 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| $358,418.17 | (1462, 152) 89 × 34 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| 46.9% | (1462, 170) 89 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| OK | (1107.7, 211.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| OKX | (1147.7, 208.5) 302.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Failed · last good 30 Oct 21:14 | (1147.7, 226.5) 302.3 × 16 px | 12px/16px 400 | `rgb(238, 106, 130)` |
| $142,090.44 | (1462, 209.5) 89 × 15 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| last known | (1462, 226.5) 89 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Lg | (1107.7, 267.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| Ledger cold wallet | (1147.7, 264.5) 302.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Reading balances | (1147.7, 282.5) 302.3 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| $129,127.05 | (1462, 265.5) 89 × 15 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| previous | (1462, 282.5) 89 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| 0x | (1107.7, 323.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| 0x4f…a91c | (1147.7, 320.5) 311.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Reading balances | (1147.7, 338.5) 311.3 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| $68,232.78 | (1471, 321.5) 80 × 15 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| previous | (1471, 338.5) 80 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| IB | (1107.7, 379.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| Interactive Brokers | (1147.7, 376.5) 311.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Refreshed 09:41 | (1147.7, 394.5) 311.3 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| $65,555.50 | (1471, 376.5) 80 × 34 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| 8.6% | (1471, 394.5) 80 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| 3 of 5 finished | (1107.7, 447) 100 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Holdings | (105, 525) 65 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| 8 assets | (1001.7, 527) 48 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Asset | (105, 557) 222 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Price | (327, 557) 259.8 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Value | (586.8, 557) 284.2 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| 7D | (871, 557) 178.7 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| BTC | (105, 581.5) 222 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 26.9% | (139, 595.5) 39 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $63,842.11 | (327, 581.5) 259.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $205,737.58 | (586.8, 581.5) 284.2 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| +6.4% | (871, 581.5) 178.7 × 42 px | 13px/18px 400 | `rgb(95, 195, 156)` |
| USDT | (105, 623.5) 222 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 23.9% | (148, 637.5) 39 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $1.00 | (327, 623.5) 259.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $182,446.74 | (586.8, 623.5) 284.2 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| 0.0% | (871, 623.5) 178.7 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| ETH | (105, 665.5) 222 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 19.8% | (139, 679.5) 39 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $2,527.14 | (327, 665.5) 259.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $151,251.35 | (586.8, 665.5) 284.2 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| +3.1% | (871, 665.5) 178.7 × 42 px | 13px/18px 400 | `rgb(95, 195, 156)` |
| SOL | (105, 707.5) 222 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 9.0% | (140, 721.5) 31 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $168.40 | (327, 707.5) 259.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $69,044.00 | (586.8, 707.5) 284.2 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| +14.3% | (871, 707.5) 178.7 × 42 px | 13px/18px 400 | `rgb(95, 195, 156)` |
| BNB | (105, 749.5) 222 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 6.5% | (141, 763.5) 31 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $579.58 | (327, 749.5) 259.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $49,774.10 | (586.8, 749.5) 284.2 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| +2.7% | (871, 749.5) 178.7 × 42 px | 13px/18px 400 | `rgb(95, 195, 156)` |
| USDC | (105, 791.5) 222 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 5.2% | (149, 805.5) 31 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $1.00 | (327, 791.5) 259.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $40,000.00 | (586.8, 791.5) 284.2 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| 0.0% | (871, 791.5) 178.7 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| AAPL | (105, 833.5) 222 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 4.5% | (147, 847.5) 31 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $229.87 | (327, 833.5) 259.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $34,480.50 | (586.8, 833.5) 284.2 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| −3.8% | (871, 833.5) 178.7 × 42 px | 13px/18px 400 | `rgb(238, 106, 130)` |
| NVDA | (105, 875.5) 222 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 4.1% | (150, 889.8) 31 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $141.25 | (327, 875.5) 259.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $31,075.00 | (586.8, 875.5) 284.2 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| +1.7% | (871, 875.5) 178.7 × 42 px | 13px/18px 400 | `rgb(95, 195, 156)` |
| What moved | (1107.7, 525) 89 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| 7 days | (1514, 527) 37 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| BTC | (1107.7, 568) 44 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| +$12,286 | (1467, 568) 84 × 18 px | 13px/18px 400 | `rgb(95, 195, 156)` |
| SOL | (1107.7, 608) 44 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| +$8,663 | (1467, 608) 84 × 18 px | 13px/18px 400 | `rgb(95, 195, 156)` |
| ETH | (1107.7, 648) 44 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| +$4,507 | (1467, 648) 84 × 18 px | 13px/18px 400 | `rgb(95, 195, 156)` |
| BNB | (1107.7, 688) 44 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| +$1,324 | (1467, 688) 84 × 18 px | 13px/18px 400 | `rgb(95, 195, 156)` |
| NVDA | (1107.7, 728) 44 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| +$532 | (1467, 728) 84 × 18 px | 13px/18px 400 | `rgb(95, 195, 156)` |
| USDT | (1107.7, 768) 44 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| +$55 | (1467, 768) 84 × 18 px | 13px/18px 400 | `rgb(95, 195, 156)` |
| USDC | (1107.7, 808) 44 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| $0 | (1467, 808) 84 × 18 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| AAPL | (1107.7, 848) 44 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| −$1,358 | (1467, 848) 84 × 18 px | 13px/18px 400 | `rgb(238, 106, 130)` |
| Refreshing sources | (1197, 97) 140 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| 3 of 5 finished · 1 failed | (1420, 99) 135 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Bn | (1197, 158) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| Binance | (1237, 155) 306 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Done in 3.1 s | (1237, 173) 306 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| OK | (1197, 214.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| OKX | (1237, 211.5) 250 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Request timed out after 20 s | (1257, 229.5) 164 × 16 px | 12px/16px 400 | `rgb(238, 106, 130)` |
| Retry | (1499, 214.5) 56 × 28 px | 12px/16px 500 | `rgb(155, 157, 163)` |
| Lg | (1197, 270.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| Ledger cold wallet | (1237, 267.5) 306 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Reading balances | (1237, 285.5) 306 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| 0x | (1197, 326.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| 0x4f…a91c | (1237, 323.5) 306 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Reading balances | (1237, 341.5) 306 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| IB | (1197, 382.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| Interactive Brokers | (1237, 379.5) 306 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Done in 5.4 s | (1237, 397.5) 306 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Sources refresh in parallel | (1197, 442) 153 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Cancel | (1491, 437) 64 × 28 px | 12px/16px 500 | `rgb(180, 182, 188)` |

## Interactive parts and state variants

This specification covers the **refresh-progress** state. Segmented controls, pills, source rows, table links, buttons, calendar choices, popovers, dialogs, toasts, dismissals and keyboard focus are actionable only where present in the actual product. The source's visible controls are:

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
- button: `Refreshing · 3 of 5 finished` at (1334, 38) 238 × 34 px.
- button: `Retry` at (1499, 214.5) 56 × 28 px.
- button: `Cancel` at (1491, 437) 64 × 28 px.

Loading preserves the containing card frame; error and partial states keep last-good data and show a reason plus recovery action; empty states keep the frame with an explicit next step. Overlays and popovers do not move the underlying grid. UI state does not add persisted fields. Any product-absent behavior is recorded below after comparing the real capture.

## Remaining differences

- Current 1280 × 800 dark eight-source running capture: **9.34%** of pixels differ by an RGB sum greater than 60 (**10.16%** by a maximum channel difference greater than 20). [App capture](/tmp/ui36-final-desktop-dark-running.png); [rendered design](/tmp/ui36-design-progress-1280.png). The source DOM measurement at 1600px gives a 392 × 396px popup at (1180, 82), background `rgb(19, 18, 23)`; see `/tmp/ui36-source-measure.json`.
- The source HTML still opens its popup automatically, repeats a progress bar inside it, and offers `Cancel`. The owner's later rule requires a user click, exactly one 3px bar beneath the toolbar, and `Hide` because an in-flight network refresh cannot be cancelled safely.
- The live eight-row popup uses the required 420px height cap and internal scroll, so its height and row spacing differ from the static 396px five-row popup.
- The required eight-source live fixture shows the actual 2-of-8 run with parallel Binance, OKX, and broker rows and sequential wallets. The source is a fixed five-source 3-of-5 example with a timeout and different names. Showing its fabricated results would make the app's status false.
- The real Overview retains its three-row cards, live toolbar, and source data. The static source page has a two-row Overview and different rail glyphs, chart labels, card text, and typography. Replacing those product sections just for the refresh screen would change unrelated Overview content and behavior.
