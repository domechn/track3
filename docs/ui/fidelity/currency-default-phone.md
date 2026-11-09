# Settings A · currency-default · phone

Design: [currency-default-phone.jpg](/home/ubuntu/.hermes/projects/track3-design/phone/settings-a/currency-default-phone.jpg). Source: `ds/pages/settings-a-currency.html`. Viewed in a fresh Chromium page at 390 × 844 CSS px, dark theme, 2× image scale; full page height 1337px. Source HTML/CSS/JS is authoritative.

## Structure, top to bottom

- y=14: **div.head** — Settings Currency & display How values and lists look. Stored on this device.
- y=40: **h1** — Currency & display
- y=131: **h2** — Currency
- y=417: **h2** — Display
- y=723: **h2** — Rates preview
- y=1023: **section.card** — Stablecoin grouping Group USD stablecoins is on Holdings lists USDT and USDC as one line. USDT 182,446.74 $182,446.74 USDC 40,000.00 $40,000.00 USD stablecoins $222,446.74
- y=1040: **h2** — Stablecoin grouping

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
| 262 | 33 | 324×135 | `div.sr.stack` | Currency rates Last updated today, 09:30. Update rates | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 14px 0px | 0px |
| 339 | 33 | 324×44 | `button.btn` | Update rates | 13px/500/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px 14px | 999px |
| 417 | 33 | 53×20 | `h2` | Display | 15px/600/20px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 445 | 33 | 324×85 | `div.sr` | Group USD stablecoins Show USDT, USDC and similar coins as one line. | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 14px 0px | 0px |
| 530 | 33 | 324×72 | `div.sr` | Hide inactive sources Leave paused sources out of lists and charts. | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 14px 0px | 0px |
| 602 | 33 | 324×75 | `div.sr` | History results per page Snapshots shown per page in History. 20 | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 14px 0px 4px | 0px |
| 623 | 261 | 96×44 | `div.select` | 20 | 13px/400/18px | rgb(255, 255, 255) | rgb(10, 10, 11) | 0px 12px | 6px |
| 723 | 33 | 102×20 | `h2` | Rates preview | 15px/600/20px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 1023 | 16 | 358×226 | `section.card` | Stablecoin grouping Group USD stablecoins is on Holdings lists USDT and USDC as one line. USDT 182,446.74 $182,446.74 USDC 40,000.00 $40,000.00 USD stablecoins $222,446.74 | 13px/400/18px | rgb(255, 255, 255) | rgb(19, 18, 23) | 16px | 6px |
| 1040 | 33 | 145×20 | `h2` | Stablecoin grouping | 15px/600/20px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |

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
- y=339: button.btn — Update rates
- y=623: div.select — 20

The source depicts the **default** state. Inputs and buttons retain their existing Track3 data flows and accessibility semantics. Numeric values, dates, and identifiers above are invented design fixture data and must be rendered from real stored shapes where available.

## Remaining differences

**9 Nov 2026 layout audit:** currency 7.528% at 390 × 844, dark, against the approved phone JPEG (RGB channel difference sum > 60). The dense CNY fixture and working product state differ from the static reference; the page-specific visible differences are listed below.

- The page title, rate timestamp, stablecoin switch, history page size, and unread badge match. Some descriptions wrap at different words, the preview card begins slightly lower, and the refresh and navigation icon strokes differ. The app's touch scroller does not paint the source browser's visible scrollbar. Locally bundled Public Sans rasterizes differently from the reference browser's web font.
- The light-theme cards, selects, menu options, and update action now follow the page tokens.

## Pixel difference

- Fresh difference ratio: **5.395%** at 390 × 844 CSS px, dark theme, threshold 16 in any RGB channel. The earlier 2.215% used a seeded currency fixture.
- Fresh design viewport: `/tmp/wui30-design/currency.png` (780×1688); app viewport: `/tmp/fidelity/settings-a/currency-default.png` (780×1688).
