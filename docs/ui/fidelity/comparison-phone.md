# Comparison · phone

References viewed: `phone/analyze/comparison-phone.jpg`, `phone-long/analyze/comparison-phone-long.jpg`, `source/ds/pages/analyze-comparison.html`, `analyze-comparison.js`, `analyze-data.js`, `lib.js`. 390px dark design: ground `#0d0d0e`, card `#131217`, border `#222224`, rule `#1b1a1f`, blue `#4a8ad6`, gain `#5fc39c`, loss `#ee6a82`. Public Sans body 13/18, title 22/28 semibold, card headings 15/20 semibold, stats 22/28 medium. Cards x16 w358, 16px internal padding, 6px radius, 12px vertical gap.

## Structure

1. Title Comparison x16 y14. Three-line subtitle y44: `What changed between two snapshots? +$34,641.48 (+4.75%) from 1 Oct to 31 Oct; BTC and ETH made 68% of it.` Emphasize the money. No visible header actions.
2. Snapshots card x16 y124 h531. Snapshot A picker button: clock icon, `1 Oct 2026`, `09:41 · $729,168`, chevron. Snapshot B: `31 Oct 2026`, `09:41 · $763,809`. Labels above. `Quick range ending at B` with two-column 44px pills Yesterday, 7 days, **30 days** blue selected, Start of month. Rule and two-column, two-row KPI grid: Value at A · 1 Oct `$729,167.79` / Snapshot 09:41; Value at B · 31 Oct `$763,809.27` / 30 days later; Change `+$34,641.48` / absolute; Change % `+4.75%` / vs 1 Oct.
3. Per asset x16 y667 h920, subtitle `1 Oct → 31 Oct, sorted by absolute change`. Two-line compact grid rows in order BTC `+$14,040.03`, ETH `+$9,580.92`, SOL `+$7,449.70`, BNB `+$2,618.47`, NVDA `+$1,205.60`, AAPL `−$231.00`, USDT `−$18.24`, USDC `−$4.00`. Each shows held quantity, A→B price, change percent, and A→B value. BTC and ETH use blue left border and raised blue background. Total row and blue info banner: `Amounts are the same on both dates. Nothing was bought, sold or moved, so the whole +$34,641.48 is price movement.`
4. Biggest movers by value x16 y1599 h435: 40px signed bars in positive to negative order, and `BTC and ETH made 68% of the total change.` Biggest movers by percentage x16 y2046 h469: SOL, BTC, ETH, BNB, NVDA, USDT, USDC, AAPL with percent bars and value at right; final note says `SOL rose most in relative terms; stablecoins stayed within ±0.01%.` Full source page 2603px with fixed bottom navigation.

## Interactive and data rules

Both pickers open a calendar of real stored snapshots. Quick ranges choose the nearest available real prior snapshot ending at B. Comparison details derive from both stored asset sets; value masking leaves unit prices visible, and quote-color configuration applies. The price-only banner appears only when all quantities are equal. Preserve the sparse-month unknown-profit behavior.

The compact hide-values icon has a 44 × 44px touch box while keeping the reference's visible icon position.

## Original capture and pixel difference

App: `/tmp/fidelity/comparison/comparison-phone-long.png`. Source: `/tmp/fidelity/comparison/design-comparison-long.png`. 390px dark, full page. Pixel difference: **8.65%** of pixels differ by more than 20 in at least one RGB channel; mean maximum-channel difference 9.38/255. Source/app heights 2603/2599px. Compared with `/tmp/fidelity/calc-ratios.mjs` using the authoritative Chromium HTML render. This numerical threshold does not waive any visible difference.

## Remaining differences

- Current 390px full-page pixel diff: **2.85%** (any RGB channel differs by more than 20).
- Snapshot values, sections, and full-page geometry match. The visible mask control remains in the Snapshots card so users can hide values; the static source omits it. Chart strokes, text edges, and the calculated attribution note differ from the invented reference.
- A 44px Back control remains visible at the upper right so the Analytics subpage has an explicit return route; the static reference omits it. It now starts below the device's top safe area.
