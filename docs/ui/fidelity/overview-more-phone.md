# Overview rankings expanded phone design specification

Reference: `phone/core/overview-more-phone.jpg`; authoritative source `source/ds/pages/core-overview.html#more#scroll`. This is the same 390px dark Overview page and tokens specified in [overview-phone.md](overview-phone.md), scrolled to the rankings.

The fixed 60px bottom bar overlays the page at y=784 and keeps Overview active and More badge `2`. The viewport begins with the end of `What moved` (AAPL `−$1,358`). The Top coins card is a 358px wide surface card with 16px padding and 6px radius. The heading `Top coins` is 15/20 600; selected `By value` and unselected `By price change` are 12px 500 in a raised two-option pill. Expanded two-line rows are 56px high, separated by `--rule`:

| Order | First line | Second line |
| --- | --- | --- |
| 1 | Bitcoin BTC; `$205,737.58` | Rank #1; `$63,842.11`; `−0.1% 24h · +6.4% 7D` |
| 2 | Tether USDT; `$182,446.74` | Rank #3; `$1.00`; `0.0% 24h · 0.0% 7D` |
| 3 | Ethereum ETH; `$151,251.35` | Rank #2; `$2,527.14`; `+1.2% 24h · +3.1% 7D` |
| 4 | Solana SOL; `$69,044.00` | Rank #6; `$168.40`; `+1.5% 24h · +14.3% 7D` |
| 5 | BNB BNB; `$49,774.10` | Rank #4; `$579.58`; `−1.0% 24h · +2.7% 7D` |
| 6 | USD Coin USDC; `$40,000.00` | Rank #7; `$1.00`; `0.0% 24h · 0.0% 7D` |

Rows open coin detail. Expanded rows remain expanded when Back returns from coin detail and collapse when the Overview tab is tapped again. `Show fewer` is a full-width 44px outline pill with upward chevron. The footnote is muted 12px: `Rank is market-cap rank (sample data). Sorted by value, high to low.` The Sources card follows with `5 of 5 up to date`, Refresh all, and the same five source rows as the base page. Gains/losses use `--positive`/`--negative`; zero uses `--faint`.

## Original capture and pixel difference

App: `/tmp/fidelity/overview/overview-more-phone.png`. Source: `/tmp/fidelity/overview/design-overview-more.png`. 390px dark, full page. Pixel difference: **6.93%** of pixels differ by more than 20 in at least one RGB channel; mean maximum-channel difference 6.81/255. Source/app heights 844/844px. Compared with `/tmp/fidelity/calc-ratios.mjs` using the authoritative Chromium HTML render. This numerical threshold does not waive any visible difference.

## Remaining differences

- Current 390px viewport pixel diff: **6.92%** (any RGB channel differs by more than 20).
- The reference uses invented market-cap ranks. Asset records contain no market-cap rank, so the app shows and labels portfolio-value ranks; the explanatory note differs accordingly. Remaining row text edges and refresh glyphs are rasterization differences.
