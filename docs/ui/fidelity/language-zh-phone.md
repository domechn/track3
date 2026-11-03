# Settings A · language-zh · phone

Design: [language-zh-phone.jpg](/home/ubuntu/.hermes/projects/track3-design/phone/settings-a/language-zh-phone.jpg). Source: `ds/pages/settings-a-language.html#zh`. Viewed in a fresh Chromium page at 390 × 844 CSS px, dark theme, 2× image scale; full page height 844px. Source HTML/CSS/JS is authoritative.

## Structure, top to bottom

- y=14: **div.head** — 设置 语言 选择应用界面的显示语言。
- y=40: **h1** — 语言
- y=114: **section.card.pad0.flat** — 应用语言 菜单、标签和提示信息。你的数据不会改变。 EN English English 中 简体中文 Simplified Chinese 立即生效。
- y=135: **h2** — 应用语言
- y=392: **section.card.s6** — 预览 简体中文 总览 Overview 历史 History 总价值 Total value 今天 Today 左列为当前语言。
- y=409: **h2** — 预览

## Labels, geometry, and type

Values below are CSS pixels from headless Chromium. Type is font size / weight / line height. Coordinates are relative to the viewport before scrolling.

| y | x | size | element | text | type | colour | background | padding | radius |
|---:|---:|---:|---|---|---|---|---|---|---|
| 14 | 16 | 358×84 | `div.head` | 设置 语言 选择应用界面的显示语言。 | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 40 | 16 | 358×28 | `h1` | 语言 | 22px/600/28px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 70 | 16 | 358×18 | `div.sub` | 选择应用界面的显示语言。 | 13px/400/18px | rgb(180, 182, 188) | rgba(0, 0, 0, 0) | 0px | 0px |
| 114 | 16 | 358×543 | `div.stc` | 应用语言 菜单、标签和提示信息。你的数据不会改变。 EN English English 中 简体中文 Simplified Chinese 立即生效。 预览 简体中文 总览 Overview 历史 History 总价值 Total value 今天 Today 左列为当前语言。 | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 114 | 16 | 358×266 | `section.card.pad0.flat` | 应用语言 菜单、标签和提示信息。你的数据不会改变。 EN English English 中 简体中文 Simplified Chinese 立即生效。 | 13px/400/18px | rgb(255, 255, 255) | rgb(19, 18, 23) | 0px | 6px |
| 135 | 37 | 316×20 | `h2` | 应用语言 | 15px/600/20px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 188 | 17 | 356×72 | `div.opt` | EN English English | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px 16px | 0px |
| 260 | 17 | 356×72 | `div.opt.on` | 中 简体中文 Simplified Chinese | 13px/400/18px | rgb(255, 255, 255) | rgba(74, 138, 214, 0.14) | 0px 16px | 0px |
| 392 | 16 | 358×265 | `section.card.s6` | 预览 简体中文 总览 Overview 历史 History 总价值 Total value 今天 Today 左列为当前语言。 | 13px/400/18px | rgb(255, 255, 255) | rgb(19, 18, 23) | 16px | 6px |
| 409 | 33 | 30×20 | `h2` | 预览 | 15px/600/20px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |

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

- y=188: div.opt — EN English English
- y=260: div.opt.on — 中 简体中文 Simplified Chinese

The source depicts the **zh** state. Inputs and buttons retain their existing Track3 data flows and accessibility semantics. Numeric values, dates, and identifiers above are invented design fixture data and must be rendered from real stored shapes where available.

## Remaining differences

- The app translates the bottom navigation when Chinese is selected; the design keeps those labels in English. The working language setting is preserved.
- Minor glyph strokes and text rasterization remain below the 3% threshold.

## Pixel difference

- Difference ratio: **2.726%** at 390 × 844 CSS px, dark theme, threshold 16 in any RGB channel.
- Design viewport: `/tmp/fidelity/settings-a/design-language-zh.png` (top 780×1688); app viewport: `/tmp/fidelity/settings-a/language-zh.png` (780×1688).
