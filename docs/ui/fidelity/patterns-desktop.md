# patterns desktop design specification

Approved image: `desktop/flows/patterns-desktop.jpg`. Authoritative source: `source/ds/pages/flows-patterns.html`, `flows.css`, `ds.css`, `ds.js`, and `lib.js`. Image and source render inspected at 1600 px in dark theme.

## Structure and measured geometry

Full-page size: **1600 × 2785 px**. The standard desktop rail is 56 px wide; the main area has 28 px horizontal and 20 px top padding. The design uses a 12-column grid with a 16 px gap; full/eight/four-column cards are 1488/987/485 px wide. Cards use 20 px padding, a 1 px border and 6 px radius.

| Block or component | Bounds | Opening copy |
| --- | --- | --- |
| `div.head` | (84, 20) 1488 × 74 px | FlowsPatternsLoading, error, stale and empty states, and the toast catalogue. Every block keeps its frame and says what to do next |
| `div.grid.g12` | (84, 110) 1488 × 2634.5 px | LoadingSkeletons at the real size of what they replace. No shimmer, no spinner in the block; one status line in the header. Portfo |
| `div.s12` | (84, 122) 1488 × 46 px | LoadingSkeletons at the real size of what they replace. No shimmer, no spinner in the block; one status line in the header. |
| `section.card.s8` | (84, 180) 986.7 × 398 px | Portfolio valueChart |
| `section.card.s4` | (1086.7, 180) 485.3 × 398 px | SourcesList |
| `section.card.s8` | (84, 594) 986.7 × 350.5 px | HoldingsTableAssetPriceValue7D |
| `section.card.s4` | (1086.7, 594) 485.3 × 350.5 px | RulesTitles and column heads are real. Only data is a placeholder.Same heights as loaded. Nothing jumps when data arrives.Wait 150 |
| `div.s12` | (84, 972.5) 1488 × 46 px | Error inside a blockThe failing block says what failed, when it last worked, and offers Retry. The rest of the page stays usable. |
| `section.card.s8` | (84, 1030.5) 986.7 × 404 px | Portfolio valueUSDCould not update the chartThe request for price history timed out after 20 s.Showing data from 30 Oct 21:14Retry |
| `section.card.s4` | (1086.7, 1030.5) 485.3 × 404 px | SourcesSources did not loadThe local database was busy. Try again in a moment.Showing data from 30 Oct 21:14RetryDetails |
| `div.s12` | (84, 1462.5) 1488 × 46 px | Stale and offlineOld data is shown, dated, and never presented as current. |
| `section.card.s8` | (84, 1520.5) 986.7 × 334 px | Showing data from 29 Oct 09:41.The last refresh was more than 24 hours ago. Totals may differ from the market.Refresh You are offl |
| `div.banner.warn` | (105, 1541.5) 944.7 × 64 px | Showing data from 29 Oct 09:41.The last refresh was more than 24 hours ago. Totals may differ from the market.Refresh |
| `div.banner` | (105, 1617.5) 944.7 × 64 px | You are offline.Showing values from 09:41. Refresh turns on again when the connection returns; local data and History still work. |
| `div.banner.info` | (105, 1693.5) 944.7 × 64 px | Sync is locked.Enter your passphrase to resume syncing. Track3 keeps working on this device.Unlock |
| `div.banner.err` | (105, 1769.5) 944.7 × 64 px | Could not reach 3 of 5 sources.Binance, OKX and Interactive Brokers did not respond. Totals exclude them.Retry |
| `section.card.s4` | (1086.7, 1520.5) 485.3 × 334 px | Freshness stampFreshUnder 1 hourSynced 09:41Aging1 to 24 hoursRefreshed 6 hours agoStaleOver 24 hoursLast refreshed 29 Oct 09:41Of |
| `div.s12` | (84, 1882.5) 1488 × 46 px | EmptyKeep the frame, one sentence, one action. |
| `section.card.s8` | (84, 1940.5) 986.7 × 314 px | Portfolio valueUSDNo snapshots in this rangeTry a wider range to see your history.Show 1Y |
| `section.card.s4` | (1086.7, 1940.5) 485.3 × 314 px | TransactionsBTCNo transactions in this rangeBuys, sells and transfers appear here.Show all time |
| `div.s12` | (84, 2282.5) 1488 × 46 px | Toast catalogueBottom-right on desktop, above the tab bar on phone. Newest at the bottom. Three at most on desktop, two on phone. |
| `section.card.s4` | (84, 2340.5) 485.3 × 186 px | Success4 sSnapshot saved5 of 5 sources refreshed at 09:41. |
| `div.toast.ok` | (105, 2393.5) 443.3 × 62 px | Snapshot saved5 of 5 sources refreshed at 09:41. |
| `section.card.s4` | (585.3, 2340.5) 485.3 × 186 px | Info5 sNext backup 1 NovSaved to Documents/Track3. |
| `div.toast` | (606.3, 2393.5) 443.3 × 62 px | Next backup 1 NovSaved to Documents/Track3. |
| `section.card.s4` | (1086.7, 2340.5) 485.3 × 186 px | Warning8 sPro refresh limit nearly used48 of 50 ERC20 refreshes used. Resets 1 Nov.See usage |
| `div.toast.warn` | (1107.7, 2393.5) 443.3 × 88 px | Pro refresh limit nearly used48 of 50 ERC20 refreshes used. Resets 1 Nov.See usage |
| `section.card.s4` | (84, 2542.5) 485.3 × 202 px | ErrorUntil dismissedOKX refresh failedRequest timed out after 20 s.RetryDetails |
| `div.toast.err` | (105, 2595.5) 443.3 × 88 px | OKX refresh failedRequest timed out after 20 s.RetryDetails |
| `section.card.s4` | (585.3, 2542.5) 485.3 × 202 px | With action8 s, paused on hoverSnapshot deleted30 Oct 21:14 removed from History.Undo |
| `div.toast` | (606.3, 2595.5) 443.3 × 88 px | Snapshot deleted30 Oct 21:14 removed from History.Undo |
| `section.card.s4` | (1086.7, 2542.5) 485.3 × 202 px | Long error, clampedUntil dismissedSync upload failedPutObject to bucket track3-dom returned 403 SignatureDoesNotMatch: the request |
| `div.toast.err` | (1107.7, 2595.5) 443.3 × 124 px | Sync upload failedPutObject to bucket track3-dom returned 403 SignatureDoesNotMatch: the request signature we calculated does not  |

## Exact visible copy, order, type and colour

The source uses Public Sans with tabular numerals. Tokens: ground `#0d0d0e`, card `#131217`, raised `#1b1a20`, border `#222224`, rule `#1b1a1f`, control `#3a3a3e`, text `#fff`, muted `#b4b6bc`, faint `#9b9da3`, accent `#4a8ad6`, positive `#5fc39c`, negative `#ee6a82`, warning `#d9a441`. Icons are 18 px stroked SVG by default. Values are USD with comma groups and two decimals, signed changes use + or −, percent values use the precision shown below, dates use abbreviated month names, and source times use 24-hour `HH:MM`.

| Copy | Bounds | Font (size/line height weight) | Computed colour |
| --- | --- | --- | --- |
| Flows | (84, 20) 1472 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Patterns | (84, 42) 1472 × 32 px | 26px/32px 600 | `rgb(255, 255, 255)` |
| Loading, error, stale and empty states, and the toast catalogue. Every block keeps its frame and says what to do next. | (84, 76) 1472 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Loading | (84, 122) 1488 × 26 px | 20px/26px 600 | `rgb(255, 255, 255)` |
| Skeletons at the real size of what they replace. No shimmer, no spinner in the block; one status line in the header. | (84, 150) 1488 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Portfolio value | (105, 201) 106 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Chart | (1017.7, 203) 32 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Sources | (1107.7, 201) 59 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| List | (1530, 203) 21 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Holdings | (105, 615) 65 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Table | (1018.7, 617) 31 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Asset | (105, 647) 186.4 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Price | (291.4, 647) 248.6 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Value | (540, 647) 310.7 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| 7D | (850.8, 647) 198.9 × 24.5 px | 12px/16px 400 | `rgb(155, 157, 163)` |
| Rules | (1107.7, 615) 41 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Titles and column heads are real. | (1107.7, 649) 200 × 15 px | 13px/19px 600 | `rgb(255, 255, 255)` |
| Only data is a placeholder. | (1107.7, 647) 443.3 × 19 px | 13px/19px 400 | `rgb(180, 182, 188)` |
| Same heights as loaded. | (1107.7, 678) 148 × 15 px | 13px/19px 600 | `rgb(255, 255, 255)` |
| Nothing jumps when data arrives. | (1107.7, 676) 443.3 × 19 px | 13px/19px 400 | `rgb(180, 182, 188)` |
| Wait 150 ms first. | (1107.7, 707) 111 × 15 px | 13px/19px 600 | `rgb(255, 255, 255)` |
| Local reads that finish faster show no skeleton at all. | (1107.7, 705) 443.3 × 19 px | 13px/19px 400 | `rgb(180, 182, 188)` |
| After 10 s | (1107.7, 736) 61 × 15 px | 13px/19px 600 | `rgb(255, 255, 255)` |
| the header line changes to “Still loading” with a Retry link. | (1107.7, 734) 443.3 × 19 px | 13px/19px 400 | `rgb(180, 182, 188)` |
| Announced. | (1107.7, 765) 74 × 15 px | 13px/19px 600 | `rgb(255, 255, 255)` |
| The grid carries aria-busy, so screen readers hear one loading message, not blocks. | (1107.7, 763) 443.3 × 38 px | 13px/19px 400 | `rgb(180, 182, 188)` |
| Error inside a block | (84, 972.5) 1488 × 26 px | 20px/26px 600 | `rgb(255, 255, 255)` |
| The failing block says what failed, when it last worked, and offers Retry. The rest of the page stays usable. | (84, 1000.5) 1488 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Portfolio value | (105, 1051.5) 106 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| USD | (1025.7, 1053.5) 24 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Could not update the chart | (495.8, 1212) 163 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| The request for price history timed out after 20 s. | (428.3, 1236) 298 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Showing data from 30 Oct 21:14 | (483.3, 1260) 188 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Retry | (512.3, 1292) 56 × 28 px | 12px/16px 500 | `rgb(155, 157, 163)` |
| Details | (578.3, 1292) 64 × 28 px | 12px/16px 500 | `rgb(180, 182, 188)` |
| Sources | (1107.7, 1051.5) 59 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Sources did not load | (1267.3, 1212) 124 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| The local database was busy. Try again in a moment. | (1170.8, 1236) 317 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Showing data from 30 Oct 21:14 | (1235.3, 1260) 188 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Retry | (1264.3, 1292) 56 × 28 px | 12px/16px 500 | `rgb(155, 157, 163)` |
| Details | (1330.3, 1292) 64 × 28 px | 12px/16px 500 | `rgb(180, 182, 188)` |
| Stale and offline | (84, 1462.5) 1488 × 26 px | 20px/26px 600 | `rgb(255, 255, 255)` |
| Old data is shown, dated, and never presented as current. | (84, 1490.5) 1488 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Showing data from 29 Oct 09:41. | (150, 1554.5) 803.7 × 18 px | 13px/18px 600 | `rgb(217, 164, 65)` |
| The last refresh was more than 24 hours ago. Totals may differ from the market. | (150, 1574.5) 803.7 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Refresh | (965.7, 1554.5) 69 × 28 px | 12px/16px 500 | `rgb(155, 157, 163)` |
| You are offline. | (150, 1630.5) 884.7 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Showing values from 09:41. Refresh turns on again when the connection returns; local data and History still work. | (150, 1650.5) 884.7 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Sync is locked. | (150, 1706.5) 808.7 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Enter your passphrase to resume syncing. Track3 keeps working on this device. | (150, 1726.5) 808.7 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Unlock | (970.7, 1706.5) 64 × 28 px | 12px/16px 500 | `rgb(155, 157, 163)` |
| Could not reach 3 of 5 sources. | (150, 1782.5) 816.7 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Binance, OKX and Interactive Brokers did not respond. Totals exclude them. | (150, 1802.5) 816.7 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Retry | (978.7, 1782.5) 56 × 28 px | 12px/16px 500 | `rgb(155, 157, 163)` |
| Freshness stamp | (1107.7, 1541.5) 123 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Fresh | (1121.7, 1583.5) 35 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Under 1 hour | (1477, 1583.5) 74 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Synced 09:41 | (1107.7, 1603.5) 443.3 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Aging | (1121.7, 1642.5) 36 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 1 to 24 hours | (1474, 1642.5) 77 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Refreshed 6 hours ago | (1107.7, 1662.5) 443.3 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Stale | (1121.7, 1701.5) 32 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Over 24 hours | (1470, 1701.5) 81 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Last refreshed 29 Oct 09:41 | (1107.7, 1721.5) 443.3 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Offline | (1123.7, 1760.5) 42 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| No network | (1485, 1760.5) 66 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Offline · last refresh 09:41 | (1107.7, 1780.5) 443.3 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Empty | (84, 1882.5) 1488 × 26 px | 20px/26px 600 | `rgb(255, 255, 255)` |
| Keep the frame, one sentence, one action. | (84, 1910.5) 1488 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Portfolio value | (105, 1961.5) 106 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| USD | (1025.7, 1963.5) 24 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| No snapshots in this range | (496.3, 2072.5) 162 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Try a wider range to see your history. | (472.3, 2094.5) 210 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Show 1Y | (540.8, 2126.5) 73 × 28 px | 12px/16px 500 | `rgb(155, 157, 163)` |
| Transactions | (1107.7, 1961.5) 92 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| BTC | (1528, 1963.5) 23 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| No transactions in this range | (1242.3, 2072.5) 174 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Buys, sells and transfers appear here. | (1220.8, 2094.5) 217 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Show all time | (1278.8, 2126.5) 101 × 28 px | 12px/16px 500 | `rgb(155, 157, 163)` |
| Toast catalogue | (84, 2282.5) 1488 × 26 px | 20px/26px 600 | `rgb(255, 255, 255)` |
| Bottom-right on desktop, above the tab bar on phone. Newest at the bottom. Three at most on desktop, two on phone. | (84, 2310.5) 1488 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Success | (105, 2361.5) 60 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| 4 s | (531.3, 2363.5) 17 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Snapshot saved | (152, 2406.5) 349.3 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 5 of 5 sources refreshed at 09:41. | (152, 2426.5) 198 × 14 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Info | (606.3, 2361.5) 28 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| 5 s | (1032.7, 2363.5) 17 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Next backup 1 Nov | (653.3, 2406.5) 349.3 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Saved to Documents/Track3. | (653.3, 2426.5) 166 × 14 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Warning | (1107.7, 2361.5) 58 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| 8 s | (1534, 2363.5) 17 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Pro refresh limit nearly used | (1154.7, 2406.5) 349.3 × 18 px | 13px/18px 600 | `rgb(217, 164, 65)` |
| 48 of 50 ERC20 refreshes used. Resets 1 Nov. | (1154.7, 2426.5) 266 × 14 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| See usage | (1154.7, 2450.5) 60 × 18 px | 12px/18px 600 | `rgb(255, 255, 255)` |
| Error | (105, 2563.5) 36 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Until dismissed | (463.3, 2565.5) 85 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| OKX refresh failed | (152, 2608.5) 349.3 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Request timed out after 20 s. | (152, 2628.5) 168 × 14 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Retry | (152, 2652.5) 32 × 18 px | 12px/18px 600 | `rgb(255, 255, 255)` |
| Details | (198, 2652.5) 40 × 18 px | 12px/18px 500 | `rgb(180, 182, 188)` |
| With action | (606.3, 2563.5) 81 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| 8 s, paused on hover | (932.7, 2565.5) 117 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Snapshot deleted | (653.3, 2608.5) 349.3 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 30 Oct 21:14 removed from History. | (653.3, 2628.5) 208 × 14 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Undo | (653.3, 2652.5) 30 × 18 px | 12px/18px 600 | `rgb(255, 255, 255)` |
| Long error, clamped | (1107.7, 2563.5) 144 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Until dismissed | (1466, 2565.5) 85 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Sync upload failed | (1154.7, 2608.5) 349.3 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| PutObject to bucket track3-dom returned 403 SignatureDoesNotMatch: the request signature we calculated does not match the signature you provided. Check your secret access key and path-style setting, then try again from Settings, Backup and sync. | (1154.7, 2626.5) 349.3 × 54 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Copy details | (1154.7, 2688.5) 71 × 18 px | 12px/18px 600 | `rgb(255, 255, 255)` |
| Details | (1239.7, 2688.5) 40 × 18 px | 12px/18px 500 | `rgb(180, 182, 188)` |

## Interactive parts and state variants

This specification covers the **patterns** state. Segmented controls, pills, source rows, table links, buttons, calendar choices, popovers, dialogs, toasts, dismissals and keyboard focus are actionable only where present in the actual product. The source's visible controls are:

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
- button: `Retry` at (512.3, 1292) 56 × 28 px.
- button: `Details` at (578.3, 1292) 64 × 28 px.
- button: `Retry` at (1264.3, 1292) 56 × 28 px.
- button: `Details` at (1330.3, 1292) 64 × 28 px.
- button: `Refresh` at (965.7, 1554.5) 69 × 28 px.
- button: `Unlock` at (970.7, 1706.5) 64 × 28 px.
- button: `Retry` at (978.7, 1782.5) 56 × 28 px.
- button: `Show 1Y` at (540.8, 2126.5) 73 × 28 px.
- button: `Show all time` at (1278.8, 2126.5) 101 × 28 px.
- a: `See usage` at (1154.7, 2450.5) 60 × 18 px.
- a: `Retry` at (152, 2652.5) 32 × 18 px.
- a: `Details` at (198, 2652.5) 40 × 18 px.
- a: `Undo` at (653.3, 2652.5) 30 × 18 px.
- a: `Copy details` at (1154.7, 2688.5) 71 × 18 px.
- a: `Details` at (1239.7, 2688.5) 40 × 18 px.

Loading preserves the containing card frame; error and partial states keep last-good data and show a reason plus recovery action; empty states keep the frame with an explicit next step. Overlays and popovers do not move the underlying grid. UI state does not add persisted fields. Any product-absent behavior is recorded below after comparing the real capture.

## Remaining differences

- Measured pixel difference: **7.85%** using the review gate's RGB-difference sum greater than 60. Source 1600 × 2785; app 1600 × 1523. [App capture](/tmp/fidelity-desktop/patterns/patterns-desktop.png); [rendered design](/tmp/fidelity-desktop/design-flows/patterns.png). The ratio uses the overlapping top-left rectangle; the dimensions show any size mismatch.
- The reference is a standalone pattern catalogue, not an app route or functional state. The capture shows the closest real Overview and therefore differs in every catalogue section, page height and copy. A static catalogue would invent a product screen, so none is shown in the app.
