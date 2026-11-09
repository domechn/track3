# Wallets · Binance · phone

References viewed: `phone/analyze/wallets-binance-phone.jpg`, `phone-long/analyze/wallets-binance-phone-long.jpg`, `source/ds/pages/analyze-wallets-binance.html` and `analyze-wallets.js`. Same 390px palette, 13/18 Public Sans body, 22/28 title, 15/20 card headings, 32/36 big value, 16px card padding, 12px vertical card gap, 44px pills as [wallets-all-phone.md](wallets-all-phone.md).

## Structure

1. Wallets title x16 y14. Three-line subtitle: `What does Binance hold, and what moved it? USDT is 31.4% of Binance; the source gained +$18,487 in 30 days, all from price moves.` 30D selected range at y108; Binance selected white filter chip within the three wrapped rows at y168.
2. Binance card x16 y320 w358 h350. Title Binance and green dot `Refreshed 09:41 · API key, read-only`. Main `Binance value` `$358,418.17`, `+$18,486.62 · +5.44% vs 1 Oct`. Three columns: Share of total **46.9%** of $763,809; Assets **5** exchange; Largest asset **USDT**, 31.4% of source. Five-slice blue to charcoal split bar. Legend: USDT 31.4%, BTC 21.4%, SOL 19.3%, ETH 14.1%, BNB 13.9%.
3. Balances card x16 y682 h383, header `refreshed 09:41`. Five two-line rows: USDT 112,446.74 / `$112,446.74` / `$1.00 · 31.4%` / `−$11 · −0.01%`; BTC 1.2 / `$76,610.53` / `$63,842.11 · 21.4%` / `+$5,228 · +7.32%`; SOL 410 / `$69,044.00` / `$168.40 · 19.3%` / `+$7,450 · +12.09%`; ETH 20 / `$50,542.80` / `$2,527.14 · 14.1%` / `+$3,202 · +6.76%`; BNB 85.8796 / `$49,774.10` / `$579.58 · 13.9%` / `+$2,618 · +5.55%`.
4. Asset changes x16 y1077 h416: `30D, USD`; five 40px diverging bars SOL, BTC, ETH, BNB, USDT and a two-row fact footer: Source change `+$18,486.62`; Share of portfolio change `53.4%`. Footnote says `Amounts did not change in this range, so every change is price movement.` Fixed tab bar, full source page 1581px.

## Interactive and data rules

Source chips and range choose a real source and real snapshots; refresh is the existing action. The price movement note only appears when quantities truly match across snapshots. Retain masking, quote color, and routes. For an unavailable start snapshot, show unknown change.

## Original capture and pixel difference

App: `/tmp/fidelity/wallets/wallets-binance-phone.png`. Source: `/tmp/fidelity/wallets/design-wallets-binance.png`. 390px dark, full page. Pixel difference: **7.22%** of pixels differ by more than 20 in at least one RGB channel; mean maximum-channel difference 8.78/255. Source/app heights 844/844px. Compared with `/tmp/fidelity/calc-ratios.mjs` using the authoritative Chromium HTML render. This numerical threshold does not waive any visible difference.

Long capture: `/tmp/fidelity/wallets/wallets-binance-phone-long.png` vs `/tmp/fidelity/wallets/design-wallets-binance-long.png`; **7.84%** pixel difference by the same threshold, heights 1581/1580px.

## Remaining differences

- Current 390px viewport pixel diff: **2.95%** (any RGB channel differs by more than 20).
- Current 390px full-page pixel diff: **5.09%** with the same threshold.
- The card positions and balances match. The reference says “API key, read-only”, which the saved exchange configuration cannot verify; the app says “Exchange”. The full page keeps the product’s Detailed analysis action below Asset changes. Glyph and text edges also differ.
- A 44px Back control remains visible at the upper right for the return route; the static reference omits it. It now clears the device's top safe area.
