# Overview phone design specification

References: `phone/core/overview-phone.jpg`, `phone-long/core/overview-phone-long.jpg`. Source: `source/ds/pages/core-overview.html` at 390 × 844, dark.

## Tokens and geometry

Public Sans with tabular numerals; body 13/18 regular. `--ground #0d0d0e`, `--surface #131217`, `--raised #1b1a20`, `--sunken #0a0a0b`, `--border #222224`, `--rule #1b1a1f`, `--control #3a3a3e`, `--muted #b4b6bc`, `--faint #9b9da3`, `--accent #4a8ad6`, `--positive #5fc39c`, `--negative #ee6a82`, `--warning #d9a441`. Main horizontal padding 16px. Cards x=16, width=358, 16px padding, 6px radius, 1px border, 12px vertical gap. Fixed bottom bar y=784, height=60, ground background.

## Ordered structure

| Block | Bounds (x,y,w,h), px | Content and format |
| --- | --- | --- |
| Header | 16,10,358,44 | `Live total` faint 13px, `$763,809.27` semibold 17px, green dot; 44px sync/cloud circle; 44px bell circle with coral `2` badge. Sync circle opens status popover. Bell opens Goals & alerts. |
| Title | 16,64,358,28 | `Overview`, 22/28 600. |
| Subtitle | 16,94,358,18 | `7-day gain of $26,011, mostly BTC and SOL.` Muted 13px, amount white 500. |
| Range | 16,122,358,44 | 306px raised pill, six equal segments `1D 7D 30D 90D 1Y All`, 12px 500, `30D` selected in `--selected #2a2a30`; 8px gap then 44px clock circle. Segments change the range; clock opens the date sheet. |
| Hero card | 16,182,358,516 | `Total value` faint 12px; `$763,809.27` white 32/36 600; `Last snapshot 31 Oct, 09:41` 12px muted. Hairline then three 108px KPI columns `Latest +0.20% +$1,533.16 vs 30 Oct`, `7 days +3.53% +$26,010.84 vs 24 Oct`, `30 days +4.75% +$34,641.48 vs 1 Oct`. Gains use positive; percentage 17/22 500, labels 12px. The 324 × 190 line chart has blue 2px stroke, 700K–780K Y labels, 1/11/21/31 Oct X labels, `$763,809` end label, and `29 Oct: +$9,571, best day (ETH +$3,743)` marker. Scrubbing gives a date/value tooltip. Bottom annotation starts y=602 with a rule and reads `All-time high $763,809.27`, `reached 31 Oct, the latest snapshot`, `0.00% below the high`. |
| Holdings | 16,710,358,514 | 15/20 600 `Holdings`, right `8 assets` faint 12px. Eight two-line rows, 56px high: BTC Bitcoin `$205,737.58` / `3.2226 $63,842.11 26.9%` / `+6.4% 7D`; USDT Tether `$182,446.74` / `182,446.74 $1.00 23.9%` / `0.0% 7D`; ETH Ethereum `$151,251.35`; SOL Solana `$69,044.00`; BNB `$49,774.10`; USDC USD Coin `$40,000.00`; AAPL Apple `$34,480.50`; NVDA NVIDIA `$31,075.00`. Values right aligned; gain/loss uses tokens. Rows open asset detail. |
| AI insights | 16,1236,358,457 | `AI insights` and blue `Pro` pill. Three facts separated by rules: `BTC drove the week`, `Stablecoins are 29.1% of the portfolio`, `AAPL is the one position down`. Each has explanatory sentence and three figures. `Ask the assistant` link and `From your local data` footer. Dismiss X hides the card; AI-off has its own dashed empty state. |
| Daily change | 16,1705,358,236 | `Daily change`, right `USD, last 30 days`; signed vertical blue/red bars over zero with ±10K/±5K axes and date ticks. |
| What moved | 16,1953,358,386 | `What moved`, right `7 days · +$26,011`; eight bar rows BTC `+$12,286`, SOL `+$8,663`, ETH `+$4,507`, BNB `+$1,324`, NVDA `+$532`, USDT `+$55`, USDC `$0`, AAPL `−$1,358`. Green/red bars and right aligned values. |
| Top coins | 16,2351,358,352 | `Top coins`, two-pill `By value` / `By price change`. Default three rows Bitcoin, Tether, Ethereum, each with name/ticker, value, market cap rank, price, 24h and 7D change; `Show more (3)` 44px outline pill. Footnote says `Rank is market-cap rank (sample data). Sorted by value, high to low.` |
| Sources | 16,2715,358,444 | `Sources`, `5 of 5 up to date`, `Refresh all` pill. Five source rows with 28px letter icon, name, kind/share, USD value, green `Updated` time: Binance `$358,418.17`, OKX `$142,475.77`, Ledger cold wallet `$129,127.05`, 0x4f…a91c `$68,232.78`, Interactive Brokers `$65,555.50`. Refresh triggers the existing refresh flow. |
| Footer | after sources | Local database, encrypted Cloudflare R2 sync, two devices, zero conflicts. |

Numbers use commas and two USD decimals except explanatory whole dollars, chart axes, and contributor bars. Signed changes use `+` or true minus `−`; dates use day + short month. Missing values stay a grey dash and real zeros display as zero. The quote-colour setting applies to gain and loss labels. Overview has no existing hide-values control; Comparison's masking remains available. No empty or error overview reference was supplied; retain real empty/error behavior.

The segmented controls, rank sort buttons, and insight dismiss icon have at least 44px touch boxes. The selected sort pill and dismiss glyph keep the source's visible dimensions within those boxes.

## Capture and pixel difference

App: `/tmp/fidelity/overview/overview-phone.png`. Source: `/tmp/fidelity/overview/design-overview.png`. The current 390px dark viewport comparison differs by **6.30%** at the threshold of 20 in any RGB channel; both captures are 844px high. The earlier 2.27% measurement used a prior app capture. The authoritative Chromium HTML render governs both comparisons.

A fresh 8 Nov source-page render at 390 × 844 differs from the same dark app capture by **7.254%** at a 16/255 RGB threshold (**6.969%** at 20/255). The source range remains 306 × 44px with a dark selected fill. The app now inherits that fill in Dark and the `--secondary` fill in Light; the light selected label has about **15.14:1** contrast.

Earlier long capture: `/tmp/fidelity/overview/overview-phone-long.png` vs `/tmp/fidelity/overview/design-overview-long.png`; **7.02%** pixel difference by the same threshold, heights 3299/3299px.

## Remaining differences

- UI42 uses the approved website-style neutral tile for asset and source marks. The older phone Overview page design renders those marks differently.

The latest dark 390 × 844 source and app viewport captures differ by
**9.14%** at an RGB-channel threshold of 20. Both first cards have
x=16, y=182, width 358px, height 516px, RGB (19, 18, 23) and 13px
computed text. The static source assumes configured sync, whereas
the app shows source status and a live price from its stored fixture.
The owner-required selected tab tile and offline text rendering add
visible pixels. Captures and computed bounds are in
`.local/tag-theme/phone-overview-*`.

The shared tab bar's measured source differences, including its owner-required selected tint and indicator, are recorded in [navigation.md](navigation.md).

- The earlier 8 Nov source-page and dark app first-screen captures at 390 × 844
  differ by **6.377%** at an RGB-channel threshold of 20. The tag-theme
  fixture has no configured sync or saved AI observations. Its header
  controls and insight content must reflect that local state, unlike
  the source's configured sample. The Pro tag uses the shared accent
  theme face, with a small border and text-size difference from the
  static source pill.
- The refreshed 7 Nov 2026 390px viewport capture differs by **6.30%** from the saved
  source-page render (any RGB channel differs by more than 20). The source
  assumes configured sync; the base app fixture has never configured sync, so
  it hides that control. The top status uses a lightning bolt and a source
  information icon in its place. This is the required configured versus
  unconfigured product behavior.
- The selected date range displays the saved snapshot in the phone header, so
  the price-stream dot is grey for its actual off state while the source
  sample shows a connected green dot. Tapping the header reading displays
  that state. A long amount reduces its font size on narrow phones so the
  amount and dot remain visible at 320, 375 and 390 px, including a
  trillion-unit amount without configured sync. The source has no
  corresponding long-amount state.
- The earlier 390px full-page comparison was **9.76%** with the same threshold;
  UI27 remeasured the affected viewport.
- Viewport: chart strokes, tab and header glyphs, and font rasterization differ slightly in the touch webview.
- Full page: the reference invents three AI observations, market-cap ranks, and configured Cloudflare R2 devices. The stored fixture has no saved AI observations, market-cap rank, or sync bucket; the app shows its real empty insight, portfolio ranks, and local sync state. Those data differences also shift later cards.
