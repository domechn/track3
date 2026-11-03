# refresh-quota desktop design specification

Approved image: `desktop/flows/refresh-quota-desktop.jpg`. Authoritative source: `source/ds/pages/flows-refresh.html#quota`, `flows.css`, `ds.css`, `ds.js`, and `lib.js`. Image and source render inspected at 1600 px in dark theme.

## Structure and measured geometry

Full-page size: **1600 × 1109 px**. The standard desktop rail is 56 px wide; the main area has 28 px horizontal and 20 px top padding. The design uses a 12-column grid with a 16 px gap; full/eight/four-column cards are 1488/987/485 px wide. Cards use 20 px padding, a 1 px border and 6 px radius.

| Block or component | Bounds | Opening copy |
| --- | --- | --- |
| `div.head` | (84, 20) 1488 × 52 px | OverviewRefreshed 09:42 · 4 of 5 sources1D7D30D90D1YAll4 of 5 sources · 09:42Refresh |
| `div.banner.warn` | (84, 88) 1488 × 64 px | 0x4f…a91c not refreshed: Pro limit reached. Totals exclude 0x4f…a91c.50 of 50 ERC20 refreshes used this month; the count resets on |
| `div.grid.g12` | (84, 168) 1488 × 900.5 px | Portfolio valueUSD · complete snapshotsTotal value, excluding 0x4f…a91c$695,576.49Partial0x4f…a91c last known $67,437.90Today—inco |
| `section.card.s8` | (84, 168) 986.7 × 450 px | Portfolio valueUSD · complete snapshotsTotal value, excluding 0x4f…a91c$695,576.49Partial0x4f…a91c last known $67,437.90Today—inco |
| `section.card.s4` | (1086.7, 168) 485.3 × 450 px | Sources5 sourcesBnBinanceRefreshed 09:41$358,418.1751.5%OKOKXRefreshed 09:41$142,475.7720.5%LgLedger cold walletRefreshed 09:40$12 |
| `section.card.s8` | (84, 634) 986.7 × 434.5 px | Holdings8 assets, 0x4f…a91c left outAssetPriceValue7DBTC29.6%$63,842.11$205,737.58—USDT26.2%$1.00$182,446.74—ETH11.9%$2,527.14$83, |
| `section.card.s4` | (1086.7, 634) 485.3 × 434.5 px | Left out: 0x4f…a91clast knownETH 27$67,437.90Last known total$67,437.90As of 30 Oct 21:14, at that day’s prices. Not part of the t |

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
| 0x4f…a91c not refreshed: Pro limit reached. Totals exclude 0x4f…a91c. | (129, 101) 1160 × 18 px | 13px/18px 600 | `rgb(217, 164, 65)` |
| 50 of 50 ERC20 refreshes used this month; the count resets on 1 Nov. | (129, 121) 1160 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Last refreshed 30 Oct 21:14, holding $67,437.90. | (558, 122) 320 × 15 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Manage plan | (1301, 101) 98 × 28 px | 12px/16px 500 | `rgb(155, 157, 163)` |
| Use last known values | (1407, 101) 150 × 28 px | 12px/16px 500 | `rgb(180, 182, 188)` |
| Portfolio value | (105, 189) 106 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| USD · complete snapshots | (901.7, 191) 148 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Total value, excluding 0x4f…a91c | (105, 221) 216.2 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $695,576.49 | (105, 241) 216.2 × 38 px | 34px/38px 600 | `rgb(255, 255, 255)` |
| Partial | (105, 279) 55 × 20 px | 12px/18px 500 | `rgb(217, 164, 65)` |
| 0x4f…a91c last known $67,437.90 | (105, 303) 216.2 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
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
| 51.5% | (1462, 250) 89 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| OK | (1107.7, 291.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| OKX | (1147.7, 288.5) 302.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Refreshed 09:41 | (1147.7, 306.5) 302.3 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| $142,475.77 | (1462, 288.5) 89 × 34 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| 20.5% | (1462, 306.5) 89 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Lg | (1107.7, 347.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| Ledger cold wallet | (1147.7, 344.5) 302.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Refreshed 09:40 | (1147.7, 362.5) 302.3 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| $129,127.05 | (1462, 344.5) 89 × 34 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| 18.6% | (1462, 362.5) 89 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| 0x | (1107.7, 403.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| 0x4f…a91c | (1147.7, 400.5) 311.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Quota used · last good 30 Oct 21:14 | (1147.7, 418.5) 311.3 × 16 px | 12px/16px 400 | `rgb(217, 164, 65)` |
| $67,437.90 | (1471, 401.5) 80 × 15 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| last known | (1471, 418.5) 80 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| IB | (1107.7, 459.5) 28 × 28 px | 10px/18px 700 | `rgb(207, 208, 212)` |
| Interactive Brokers | (1147.7, 456.5) 311.3 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Refreshed 09:41 | (1147.7, 474.5) 311.3 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| $65,555.50 | (1471, 456.5) 80 × 34 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| 9.4% | (1471, 474.5) 80 × 16 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| 4 of 5 refreshed at 09:42 | (1107.7, 579) 158 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Holdings | (105, 655) 65 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| 8 assets, 0x4f…a91c left out | (881.7, 657) 168 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Asset | (105, 687) 246.7 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Price | (351.7, 687) 288.8 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Value | (640.5, 687) 315.9 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| 7D | (956.4, 687) 93.3 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| BTC | (105, 711.5) 246.7 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 29.6% | (139, 725.5) 39 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $63,842.11 | (351.7, 711.5) 288.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $205,737.58 | (640.5, 711.5) 315.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (956.4, 711.5) 93.3 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| USDT | (105, 753.5) 246.7 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 26.2% | (148, 767.5) 39 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $1.00 | (351.7, 753.5) 288.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $182,446.74 | (640.5, 753.5) 315.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (956.4, 753.5) 93.3 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| ETH | (105, 795.5) 246.7 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 11.9% | (139, 809.5) 39 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $2,527.14 | (351.7, 795.5) 288.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $83,018.57 | (640.5, 795.5) 315.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (956.4, 795.5) 93.3 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| SOL | (105, 837.5) 246.7 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 9.9% | (140, 851.5) 31 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $168.40 | (351.7, 837.5) 288.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $69,044.00 | (640.5, 837.5) 315.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (956.4, 837.5) 93.3 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| BNB | (105, 879.5) 246.7 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 7.2% | (141, 893.5) 31 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $579.58 | (351.7, 879.5) 288.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $49,774.10 | (640.5, 879.5) 315.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (956.4, 879.5) 93.3 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| USDC | (105, 921.5) 246.7 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 5.8% | (149, 935.5) 31 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $1.00 | (351.7, 921.5) 288.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $40,000.00 | (640.5, 921.5) 315.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (956.4, 921.5) 93.3 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| AAPL | (105, 963.5) 246.7 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 5.0% | (147, 977.5) 31 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $229.87 | (351.7, 963.5) 288.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $34,480.50 | (640.5, 963.5) 315.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (956.4, 963.5) 93.3 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| NVDA | (105, 1005.5) 246.7 × 42 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 4.5% | (150, 1019.8) 31 × 14 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| $141.25 | (351.7, 1005.5) 288.8 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| $31,075.00 | (640.5, 1005.5) 315.9 × 42 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| — | (956.4, 1005.5) 93.3 × 42 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| Left out: 0x4f…a91c | (1107.7, 655) 145 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| last known | (1489, 657) 62 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| ETH | (1107.7, 701) 26 × 15 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 27 | (1142.7, 701) 18 × 15 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| $67,437.90 | (1471, 700) 80 × 18 px | 13px/18px 400 | `rgb(255, 255, 255)` |
| Last known total | (1107.7, 744.5) 351.3 × 18 px | 13px/18px 400 | `rgb(155, 157, 163)` |
| $67,437.90 | (1471, 744.5) 80 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| As of 30 Oct 21:14, at that day’s prices. Not part of the total above. | (1107.7, 787) 443.3 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Total excluding 0x4f…a91c | (1107.7, 979) 342.3 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| $695,576.49 | (1462, 979) 89 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| With 0x4f…a91c last known | (1107.7, 1019) 342.3 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| $763,014.39 | (1462, 1019) 89 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |

## Interactive parts and state variants

This specification covers the **refresh-quota** state. Segmented controls, pills, source rows, table links, buttons, calendar choices, popovers, dialogs, toasts, dismissals and keyboard focus are actionable only where present in the actual product. The source's visible controls are:

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
- button: `Manage plan` at (1301, 101) 98 × 28 px.
- button: `Use last known values` at (1407, 101) 150 × 28 px.

Loading preserves the containing card frame; error and partial states keep last-good data and show a reason plus recovery action; empty states keep the frame with an explicit next step. Overlays and popovers do not move the underlying grid. UI state does not add persisted fields. Any product-absent behavior is recorded below after comparing the real capture.

## Remaining differences

- Measured pixel difference: **9.72%** using the review gate's RGB-difference sum greater than 60. Source 1600 × 1109; app 1600 × 1603. [App capture](/tmp/fidelity-desktop/refresh/refresh-quota-desktop.png); [rendered design](/tmp/fidelity-desktop/design-flows/refresh-quota.png). The ratio uses the overlapping top-left rectangle; the dimensions show any size mismatch.
- The warning now shows the actual 50 of 50 ERC20 usage, 1 Nov reset date, and Manage plan action. The last-good refresh is 09:41 in the stored fixture rather than the design's 21:14 sample.
- The current page derives a total excluding the quota-limited source and shows its warning above the full three-row Overview. The hero selector can include last-known values or exclude the unavailable source; the stored partial fill remains last_known. The design's compact grid and Left out breakdown are absent. Change metrics, chart and card geometry still differ because the design uses a conflicting compact Overview presentation.
- The Sources card now labels the quota row `Quota used · last good` without a Retry chip or extra warning banner. It shows the latest stored portfolio balance ($68,232.78, 8.9%); the compact source shows the prior saved balance ($67,437.90) as `last known`. The card source query supplies only the latest balance.
