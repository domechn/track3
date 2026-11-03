# refresh-ptrrun · phone

References viewed: `phone/flows/refresh-ptrrun-phone.jpg`, `source/ds/pages/flows-refresh.html#ptrrun`, `ds/ds.css`, `ds/ds.js`, `ds/BRIEF.md`, and `core-navigation-map.html`.
Source viewport: 390 × 844 dark; document height 2031px. Palette: ground #0d0d0e, card #131217, border #222224, rule #1b1a1f, accent #4a8ad6, positive #5fc39c, negative #ee6a82, warning #d9a441. Public Sans with tabular figures.

## Structure and exact copy

- **div.ptr** x16 y14 358×76; font 12px/18px/400; padding 0px; radius 0px; text rgb(180, 182, 188); fill rgba(0, 0, 0, 0). Refreshing 3 of 5 · Ledger, 0x4f…a91c
- **div.head** x16 y90 358×170; font 13px/18px/400; padding 0px; radius 0px; text rgb(255, 255, 255); fill rgba(0, 0, 0, 0). OverviewRefreshing 5 sources. Totals update when each source has finished or failed.1D7D30D90D1YAllRefreshing · 3 of 5 finished
- **section.card.s8** x16 y276 358×417; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Portfolio valueUSDTotal value$763,809.27+$34,641.48 · +4.75% since 1 OctToday+0.20%+$1,533.167 days+3.53%+$26,010.8430 days+4.75%+$34,641.48700K720K740K760K780K1 Oct11 Oct21 Oct30 Oct$763,809
- **section.card.s4** x16 y705 358×401; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Sources5 sourcesBnBinanceRefreshed 09:41$358,418.1746.9%OKOKXFailed · last good 30 Oct 21:14$142,090.44last knownLgLedger cold walletReading balances$129,127.05previous0x0x4f…a91cReading balances$68,232.78previousIBInteractive BrokersRefreshed 09:41$65,555.508.6%3 of 5 finished
- **section.card.s8** x16 y1118 358×427; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Holdings8 assetsAssetPriceValue7DBTC26.9%$63,842.11$205,737.58+6.4%USDT23.9%$1.00$182,446.740.0%ETH19.8%$2,527.14$151,251.35+3.1%SOL9.0%$168.40$69,044.00+14.3%BNB6.5%$579.58$49,774.10+2.7%USDC5.2%$1.00$40,000.000.0%AAPL4.5%$229.87$34,480.50−3.8%NVDA4.1%$141.25$31,075.00+1.7%
- **section.card.s4** x16 y1557 358×386; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). What moved7 daysBTC+$12,286SOL+$8,663ETH+$4,507BNB+$1,324NVDA+$532USDT+$55USDC$0AAPL−$1,358

## Interactive controls and states

- button.btn.rf.busy x16 y216 358×44; Refreshing · 3 of 5 finished. 13px/18px/500; radius 999px.

## Original capture and pixel difference

App: `/tmp/fidelity/flows/refresh-ptrrun-phone.png`. Source: `/tmp/fidelity/flows/design-refresh-ptrrun.png`. 390px dark, full page. Pixel difference: **12.78%** of pixels differ by more than 20 in at least one RGB channel; mean maximum-channel difference 17.70/255. Source/app heights 844/844px. Compared with `/tmp/fidelity/calc-ratios.mjs` using the authoritative Chromium HTML render. This numerical threshold does not waive any visible difference.

Long capture: `/tmp/fidelity/flows/refresh-ptrrun-phone-long.png` vs `/tmp/fidelity/flows/design-refresh-ptrrun-long.png`; **11.52%** pixel difference by the same threshold, heights 2031/3194px.

## Remaining differences

- Current 390px viewport pixel diff: **12.74%** (any RGB channel differs by more than 20).
- Current 390px full-page pixel diff: **11.38%** with the same threshold.
- The pull starts the real refresh flow, but the flows HTML uses an alternate Overview without the approved core live-total header and holdings. The app retains the core route composition beneath the progress strip.
- The reference has a one-line strip naming Ledger and 0x4f…a91c as still running. The app follows the approved core Overview strip: two lines saying "Refreshing sources" and "3 of 5 done · Binance, OKX, Interactive Brokers", listing completed sources. The core and flows references conflict on this wording and layout.
