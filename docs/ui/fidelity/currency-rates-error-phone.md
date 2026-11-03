# Settings A · currency-rates-error · phone

Design: [currency-rates-error-phone.jpg](/home/ubuntu/.hermes/projects/track3-design/phone/settings-a/currency-rates-error-phone.jpg). Source: `ds/pages/settings-a-currency.html#rates-error`. Viewed in a fresh Chromium page at 390 × 844 CSS px, dark theme, 2× image scale; full page height 1355px. Source HTML/CSS/JS is authoritative.

## Structure, top to bottom

- y=14: **div.head** — Settings Currency & display How values and lists look. Stored on this device.
- y=40: **h1** — Currency & display
- y=131: **h2** — Currency
- y=435: **h2** — Display
- y=741: **h2** — Rates preview
- y=1041: **section.card** — Stablecoin grouping Group USD stablecoins is on Holdings lists USDT and USDC as one line. USDT 182,446.74 $182,446.74 USDC 40,000.00 $40,000.00 USD stablecoins $222,446.74
- y=1058: **h2** — Stablecoin grouping

## Labels, geometry, and type

Values below are CSS pixels from headless Chromium. Type is font size / weight / line height. Coordinates are relative to the viewport before scrolling.

| y | x | size | element | text | type | colour | background | padding | radius |
|---:|---:|---:|---|---|---|---|---|---|---|
| 14 | 16 | 358×84 | `div.head` | Settings Currency & display How values and lists look. Stored on this device. | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 40 | 16 | 358×28 | `h1` | Currency & display | 22px/600/28px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 70 | 16 | 358×18 | `div.sub` | How values and lists look. Stored on this device. | 13px/400/18px | rgb(180, 182, 188) | rgba(0, 0, 0, 0) | 0px | 0px |
| 131 | 33 | 66×20 | `h2` | Currency | 15px/600/20px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 159 | 33 | 324×103 | `div.sr` | Base currency Every total and value in the app uses this currency. USD · US dollar | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 14px 0px | 0px |
| 189 | 207 | 150×44 | `div.select` | USD · US dollar | 13px/400/18px | rgb(255, 255, 255) | rgb(10, 10, 11) | 0px 12px | 6px |
| 262 | 33 | 324×153 | `div.sr.stack` | Currency rates Couldn’t reach the rates service. Showing the rates from 30 Oct, 09:30. Update rates | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 14px 0px | 0px |
| 357 | 33 | 324×44 | `button.btn` | Update rates | 13px/500/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px 14px | 999px |
| 435 | 33 | 53×20 | `h2` | Display | 15px/600/20px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 463 | 33 | 324×85 | `div.sr` | Group USD stablecoins Show USDT, USDC and similar coins as one line. | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 14px 0px | 0px |
| 548 | 33 | 324×72 | `div.sr` | Hide inactive sources Leave paused sources out of lists and charts. | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 14px 0px | 0px |
| 620 | 33 | 324×75 | `div.sr` | History results per page Snapshots shown per page in History. 20 | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 14px 0px 4px | 0px |
| 641 | 261 | 96×44 | `div.select` | 20 | 13px/400/18px | rgb(255, 255, 255) | rgb(10, 10, 11) | 0px 12px | 6px |
| 741 | 33 | 102×20 | `h2` | Rates preview | 15px/600/20px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 1041 | 16 | 358×226 | `section.card` | Stablecoin grouping Group USD stablecoins is on Holdings lists USDT and USDC as one line. USDT 182,446.74 $182,446.74 USDC 40,000.00 $40,000.00 USD stablecoins $222,446.74 | 13px/400/18px | rgb(255, 255, 255) | rgb(19, 18, 23) | 16px | 6px |
| 1058 | 33 | 145×20 | `h2` | Stablecoin grouping | 15px/600/20px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |

## Colour tokens

- `--ground`: #0d0d0e
- `--surface`: #131217
- `--sunken`: #0a0a0b
- `--text`: #ffffff
- `--muted`: #b4b6bc
- `--faint`: #9b9da3
- `--border`: #222224
- `--rule`: #1b1a1f
- `--accent`: #4a8ad6
- `--accent-soft`: rgba(74,138,214,.14)
- `--positive`: #5fc39c
- `--negative`: #ee6a82
- `--pill-info-bg`: #14243a
- `--pill-neg-bg`: #2c1a20

## Interactive elements

- y=189: div.select — USD · US dollar
- y=357: button.btn — Update rates
- y=641: div.select — 20

The source depicts the **rates-error** state. Inputs and buttons retain their existing Track3 data flows and accessibility semantics. Numeric values, dates, and identifiers above are invented design fixture data and must be rendered from real stored shapes where available.

## Remaining differences

- The error row now uses the source's measured 153px height. The real stored currency rates determine the fallback date and preview values; minor refresh icon and text rasterization differences remain.

## Pixel difference

- Difference ratio: **2.037%** at 390 × 844 CSS px, dark theme, threshold 16 in any RGB channel.
- Design viewport: `/tmp/fidelity/settings-a/design-currency-rates-error.png` (top 780×1688); app viewport: `/tmp/fidelity/settings-a/currency-rates-error.png` (780×1688).
