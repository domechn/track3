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

## Remaining differences

- Current 390 × 844 dark eight-source running capture: **11.28%** of pixels differ by more than 20 in a channel (**10.24%** by an RGB sum greater than 60). [App capture](/tmp/ui36-final-phone-dark-running.png); [rendered design](/tmp/ui36-design-progress-390.png). The source DOM measurement puts its sheet at (0, 384), 390 × 460px with background `rgb(19, 18, 23)`; see `/tmp/ui36-source-measure.json`.
- The source HTML's sheet repeats the progress bar and offers `Cancel`. The owner's later rule keeps the single 3px header bar and a dismissive `Hide` action; runtime cancellation of network work is unavailable. The phone sheet also respects the 420px cap and 44px touch rows, so its top edge and row spacing differ from the 460px source sheet.
- The eight-source live fixture shows its actual 2-of-8 state with distinct wallet names and parallel exchange rows. The source is a fixed five-source 3-of-5 example with a timeout. Showing the source's durations or error text without those outcomes would be false; real errors use safe categories rather than untrusted upstream messages.
- The static source shows its alternate Overview behind the sheet. The app preserves the real Overview and its scroll position, which puts Top coins and the compact live-total header behind this capture. Its content, order, icons, and text rasterization remain visible differences.
- The dialog title, subtitle, avatar, progress track, fill, and footer use semantic colours in Light and Dark; the light text and avatar contrast pass 4.5:1.
