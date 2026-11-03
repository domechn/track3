# refresh-progress · phone

References viewed: `phone/flows/refresh-progress-phone.jpg`, `source/ds/pages/flows-refresh.html#progress`, `ds/ds.css`, `ds/ds.js`, `ds/BRIEF.md`, and `core-navigation-map.html`.
Source viewport: 390 × 844 dark; document height 1955px. Palette: ground #0d0d0e, card #131217, border #222224, rule #1b1a1f, accent #4a8ad6, positive #5fc39c, negative #ee6a82, warning #d9a441. Public Sans with tabular figures.

## Structure and exact copy

- **div.head** x16 y14 358×170; font 13px/18px/400; padding 0px; radius 0px; text rgb(255, 255, 255); fill rgba(0, 0, 0, 0). OverviewRefreshing 5 sources. Totals update when each source has finished or failed.1D7D30D90D1YAllRefreshing · 3 of 5 finished
- **section.card.s8** x16 y200 358×417; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Portfolio valueUSDTotal value$763,809.27+$34,641.48 · +4.75% since 1 OctToday+0.20%+$1,533.167 days+3.53%+$26,010.8430 days+4.75%+$34,641.48700K720K740K760K780K1 Oct11 Oct21 Oct30 Oct$763,809
- **section.card.s4** x16 y629 358×401; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Sources5 sourcesBnBinanceRefreshed 09:41$358,418.1746.9%OKOKXFailed · last good 30 Oct 21:14$142,090.44last knownLgLedger cold walletReading balances$129,127.05previous0x0x4f…a91cReading balances$68,232.78previousIBInteractive BrokersRefreshed 09:41$65,555.508.6%3 of 5 finished
- **section.card.s8** x16 y1042 358×427; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Holdings8 assetsAssetPriceValue7DBTC26.9%$63,842.11$205,737.58+6.4%USDT23.9%$1.00$182,446.740.0%ETH19.8%$2,527.14$151,251.35+3.1%SOL9.0%$168.40$69,044.00+14.3%BNB6.5%$579.58$49,774.10+2.7%USDC5.2%$1.00$40,000.000.0%AAPL4.5%$229.87$34,480.50−3.8%NVDA4.1%$141.25$31,075.00+1.7%
- **section.card.s4** x16 y1481 358×386; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). What moved7 daysBTC+$12,286SOL+$8,663ETH+$4,507BNB+$1,324NVDA+$532USDT+$55USDC$0AAPL−$1,358
- **div.sheet.tall** x0 y384 390×460; font 13px/18px/400; padding 8px 16px 28px; radius 16px 16px 0px 0px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Refreshing sources3 of 5 finished · 1 failedBnBinanceDone in 3.1 sOKOKXRequest timed out after 20 sRetryLgLedger cold walletReading balances0x0x4f…a91cReading balancesIBInteractive BrokersDone in 5.4 sCancel refresh

## Interactive controls and states

- button.btn.rf.busy x16 y140 358×44; Refreshing · 3 of 5 finished. 13px/18px/500; radius 999px.
- button.btn.sm x318 y524 56×44; Retry. 12px/16px/500; radius 999px.
- button.btn x16 y772 358×44; Cancel refresh. 13px/18px/500; radius 999px.

## Original capture and pixel difference

App: `/tmp/fidelity/flows/refresh-progress-phone.png`. Source: `/tmp/fidelity/flows/design-refresh-progress.png`. 390px dark, full page. Pixel difference: **14.81%** of pixels differ by more than 20 in at least one RGB channel; mean maximum-channel difference 20.04/255. Source/app heights 844/844px. Compared with `/tmp/fidelity/calc-ratios.mjs` using the authoritative Chromium HTML render. This numerical threshold does not waive any visible difference.

Long capture: `/tmp/fidelity/flows/refresh-progress-phone-long.png` vs `/tmp/fidelity/flows/design-refresh-progress-long.png`; **11.88%** pixel difference by the same threshold, heights 1955/3194px.

## Remaining differences

- Current 390px viewport pixel diff: **10.48%** (any RGB channel differs by more than 20).
- Current 390px full-page pixel diff: **10.20%** with the same threshold (source/app heights 1955/3239px).
- The flows HTML shows the top of its alternate Overview behind the sheet. The app preserves the approved core Overview, which is scrolled to Top coins with its compact live-total header in this capture; the background content, order, and header therefore differ.
- The capture holds the local fake HTTP transport pending and asserts one fixed live state: "0 of 5 finished · 0 failed", with all five rows reading balances. The design instead shows "3 of 5 finished · 1 failed": green check marks and durations for Binance and Interactive Brokers, a warning icon, "Request timed out after 20 s", and Retry for OKX, plus a longer blue progress fill. The real phone rows now render status icons and a disabled 44px Retry while a failure is pending; a focused component test covers those states. The capture cannot claim those source results without manufacturing outcomes, and the product reports safe error categories ("Stale · Network or timeout" or "Stale · Could not load") rather than untrusted upstream error text.
- Runtime refresh cancellation is unavailable; Close dismisses status without claiming to cancel work. Text and icon rasterization still differ in the sheet.
