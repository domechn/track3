# startup-syncunlock · phone

References viewed: `phone/flows/startup-syncunlock-phone.jpg`, `source/ds/pages/flows-startup.html#syncunlock`, `ds/ds.css`, `ds/ds.js`, `ds/BRIEF.md`, and `core-navigation-map.html`.
Source viewport: 390 × 844 dark; document height 1954px. Palette: ground #0d0d0e, card #131217, border #222224, rule #1b1a1f, accent #4a8ad6, positive #5fc39c, negative #ee6a82, warning #d9a441. Public Sans with tabular figures.

## Structure and exact copy

- **div.head** x16 y14 358×170; font 13px/18px/400; padding 0px; radius 0px; text rgb(255, 255, 255); fill rgba(0, 0, 0, 0). Overview7-day gain of $26,010.84 comes mostly from BTC and SOL; AAPL is the one position down.1D7D30D90D1YAllSynced 09:41 · on this deviceRefresh
- **section.card.s8** x16 y200 358×417; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Portfolio valueUSDTotal value$763,809.27+$34,641.48 · +4.75% since 1 OctToday+0.20%+$1,533.167 days+3.53%+$26,010.8430 days+4.75%+$34,641.48700K720K740K760K780K1 Oct11 Oct21 Oct30 Oct$763,809
- **section.card.s4** x16 y629 358×400; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Sources5 sourcesBnBinanceRefreshed 09:41$358,418.1746.9%OKOKXRefreshed 09:41$142,475.7718.7%LgLedger cold walletRefreshed 09:40$129,127.0516.9%0x0x4f…a91cRefreshed 09:40$68,232.788.9%IBInteractive BrokersRefreshed 09:41$65,555.508.6%5 of 5 refreshed at 09:41
- **section.card.s8** x16 y1041 358×427; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Holdings8 assetsAssetPriceValue7DBTC26.9%$63,842.11$205,737.58+6.4%USDT23.9%$1.00$182,446.740.0%ETH19.8%$2,527.14$151,251.35+3.1%SOL9.0%$168.40$69,044.00+14.3%BNB6.5%$579.58$49,774.10+2.7%USDC5.2%$1.00$40,000.000.0%AAPL4.5%$229.87$34,480.50−3.8%NVDA4.1%$141.25$31,075.00+1.7%
- **section.card.s4** x16 y1480 358×386; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). What moved7 daysBTC+$12,286SOL+$8,663ETH+$4,507BNB+$1,324NVDA+$532USDT+$55USDC$0AAPL−$1,358
- **div.sheet** x0 y384 390×460; font 13px/18px/400; padding 8px 16px 28px; radius 16px 16px 0px 0px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Sync is locked Enter your sync passphrase to unlock encrypted data in your Cloudflare R2 bucket. Until then, Track3 keeps working on this device only. Sync passphrase●●●●●●●●●●●● The passphrase never leaves your devices. Without it, remote data cannot be read. Forgot the passphrase? Continue without syncUnlock

## Interactive controls and states

- button.btn.rf x16 y140 358×44; Refresh. 13px/18px/500; radius 999px.
- button.btn.ghost x16 y772 358×44; Continue without sync. 13px/18px/500; radius 999px.
- button.btn.primary x16 y720 358×44; Unlock. 13px/18px/500; radius 999px.

## Original capture and pixel difference

App: `/tmp/fidelity/flows/startup-syncunlock-phone.png`. Source: `/tmp/fidelity/flows/design-startup-syncunlock.png`. 390px dark, full page. Pixel difference: **10.88%** of pixels differ by more than 20 in at least one RGB channel; mean maximum-channel difference 9.85/255. Source/app heights 844/844px. Compared with `/tmp/fidelity/calc-ratios.mjs` using the authoritative Chromium HTML render. This numerical threshold does not waive any visible difference.

## Remaining differences

- Current 390px viewport pixel diff: **11.70%** (any RGB channel differs by more than 20); within the sheet (y385–844) it is **10.82%**.
- The title, hint, Forgot, Unlock, and Continue controls now land at the reference's measured vertical positions. The real password input keeps a 44px touch target, while the mockup draws a 36px field with larger drawn dots. Native password masking uses smaller dots, and its focus ring differs; the secure input and Show/Hide control remain usable.
- The flows reference dims an alternate Overview without the core live-total header and holdings. The real sync prompt opens over the approved core Overview. The focus-managed sheet also contains working recovery controls below the viewport; glyph and text edges differ.
