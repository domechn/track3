# Wallets · OKX failed · phone

References viewed: `phone/analyze/wallets-okx-phone.jpg`, `phone-long/analyze/wallets-okx-phone-long.jpg`, `source/ds/pages/analyze-wallets-okx.html` and `analyze-wallets.js`. Same tokens and typography as [wallets-all-phone.md](wallets-all-phone.md); failure uses loss `#ee6a82`, dark red banner `#2c1a20`, warning dot `#d9a441`.

## Structure

1. Wallets title x16 y14. Two-line subtitle `What does OKX hold? Showing balances from 09:12; the 09:41 refresh failed, so today's prices are not applied.` 30D selected range y90 and three rows of chips y150; OKX selected white, still has amber warning dot.
2. Red alert banner x16 y302 w358 h116: alert triangle, **OKX refresh failed**, `Rate limit exceeded (HTTP 429) at 09:41. The numbers below are from the last good refresh at 09:12. Next automatic try 10:11.`, outlined Retry at right.
3. OKX card x16 y434 h379. Title OKX; red dot `Refresh failed · last good 09:12 · API key, read-only`. `OKX value (as of 09:12)` `$142,475.77`, `+$2,046.16 · +1.46% vs 1 Oct`. Three columns: Share of total **18.7%** of $763,809; Assets **3** exchange; Largest asset **USDT** 49.1% of source. The legend has two columns at 341–480px and one at 320px: USDT 49.1%, USDC 28.1%, ETH 22.8%.
4. Balances x16 y825 h257, header `as of 09:12`, three two-line rows: USDT 70,000.00 / `$70,000.00` / `$1.00 · 49.1%` / `−$7 · −0.01%`; USDC 40,000.00 / `$40,000.00` / `$1.00 · 28.1%` / `−$4 · −0.01%`; ETH 12.8508 / `$32,475.77` / `$2,527.14 · 22.8%` / `+$2,057 · +6.76%`.
5. Asset changes x16 y1094 h336, bars ETH `+$2,057`, USDC `−$4`, USDT `−$7`; Source change `+$2,046.16`, Share of portfolio change `5.9%`, unchanged-amount price-movement note. Full source page 1494px, bottom navigation fixed.

## Interactive and data rules

The banner and old-balance explanation require a real failed status with a last-good timestamp; never present fresh prices as applied when source refresh failed. Retry calls the real failed-source flow, next automatic try comes from the scheduler. Preserve masks, quote colors, and filters.

## Original capture and pixel difference

App: `/tmp/fidelity/wallets/wallets-okx-phone.png`. Source: `/tmp/fidelity/wallets/design-wallets-okx.png`. 390px dark, full page. Pixel difference: **6.78%** of pixels differ by more than 20 in at least one RGB channel; mean maximum-channel difference 7.34/255. Source/app heights 844/844px. Compared with `/tmp/fidelity/calc-ratios.mjs` using the authoritative Chromium HTML render. This numerical threshold does not waive any visible difference.

Long capture: `/tmp/fidelity/wallets/wallets-okx-phone-long.png` vs `/tmp/fidelity/wallets/design-wallets-okx-long.png`; **8.52%** pixel difference by the same threshold, heights 1494/1496px.

## Remaining differences

- Current 390px viewport pixel diff: **4.01%** (any RGB channel differs by more than 20).
- Current 390px full-page pixel diff: **5.22%** with the same threshold.
- The failed source, last-good balance, retry, and card positions match. The reference adds “API key, read-only”; persisted source status does not establish that claim, so it is omitted. The full page keeps Detailed analysis; text and icon rasterization differ.
- A 44px Back control remains visible at the upper right for the return route; the static reference omits it. It now clears the device's top safe area.
