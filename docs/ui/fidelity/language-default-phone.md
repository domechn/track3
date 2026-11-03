# Settings A · language-default · phone

Design: [language-default-phone.jpg](/home/ubuntu/.hermes/projects/track3-design/phone/settings-a/language-default-phone.jpg). Source: `ds/pages/settings-a-language.html`. Viewed in a fresh Chromium page at 390 × 844 CSS px, dark theme, 2× image scale; full page height 844px. Source HTML/CSS/JS is authoritative.

## Structure, top to bottom

- y=14: **div.head** — Settings Language Choose the language of the app.
- y=40: **h1** — Language
- y=114: **section.card.pad0.flat** — App language Menus, labels and messages. Your data is not changed. EN English English 中 简体中文 Simplified Chinese Takes effect immediately.
- y=135: **h2** — App language
- y=392: **section.card.s6** — Preview English Overview 总览 History 历史 Total value 总价值 Today 今天 Left column is the current language.
- y=409: **h2** — Preview

## Labels, geometry, and type

Values below are CSS pixels from headless Chromium. Type is font size / weight / line height. Coordinates are relative to the viewport before scrolling.

| y | x | size | element | text | type | colour | background | padding | radius |
|---:|---:|---:|---|---|---|---|---|---|---|
| 14 | 16 | 358×84 | `div.head` | Settings Language Choose the language of the app. | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 40 | 16 | 358×28 | `h1` | Language | 22px/600/28px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 70 | 16 | 358×18 | `div.sub` | Choose the language of the app. | 13px/400/18px | rgb(180, 182, 188) | rgba(0, 0, 0, 0) | 0px | 0px |
| 114 | 16 | 358×266 | `section.card.pad0.flat` | App language Menus, labels and messages. Your data is not changed. EN English English 中 简体中文 Simplified Chinese Takes effect immediately. | 13px/400/18px | rgb(255, 255, 255) | rgb(19, 18, 23) | 0px | 6px |
| 135 | 37 | 316×20 | `h2` | App language | 15px/600/20px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 188 | 17 | 356×72 | `div.opt.on` | EN English English | 13px/400/18px | rgb(255, 255, 255) | rgba(74, 138, 214, 0.14) | 0px 16px | 0px |
| 260 | 17 | 356×72 | `div.opt` | 中 简体中文 Simplified Chinese | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px 16px | 0px |
| 392 | 16 | 358×265 | `section.card.s6` | Preview English Overview 总览 History 历史 Total value 总价值 Today 今天 Left column is the current language. | 13px/400/18px | rgb(255, 255, 255) | rgb(19, 18, 23) | 16px | 6px |
| 409 | 33 | 58×20 | `h2` | Preview | 15px/600/20px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |

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

- y=188: div.opt.on — EN English English
- y=260: div.opt — 中 简体中文 Simplified Chinese

The source depicts the **default** state. Inputs and buttons retain their existing Track3 data flows and accessibility semantics. Numeric values, dates, and identifiers above are invented design fixture data and must be rendered from real stored shapes where available.

## Remaining differences

- Minor navigation icon strokes and text rasterization remain below the 3% threshold.

## Pixel difference

- Difference ratio: **2.867%** at 390 × 844 CSS px, dark theme, threshold 16 in any RGB channel.
- Design viewport: `/tmp/fidelity/settings-a/design-language-default.png` (top 780×1688); app viewport: `/tmp/fidelity/settings-a/language-default.png` (780×1688).
