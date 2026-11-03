# Settings A · sources-empty · phone

Design: [sources-empty-phone.jpg](/home/ubuntu/.hermes/projects/track3-design/phone/settings-a/sources-empty-phone.jpg). Source: `ds/pages/settings-a-sources.html#empty`. Viewed in a fresh Chromium page at 390 × 844 CSS px, dark theme, 2× image scale; full page height 844px. Source HTML/CSS/JS is authoritative.

## Structure, top to bottom

- y=14: **div.head** — Settings Data sources Nothing connected in exchanges yet. Add exchange
- y=40: **h1** — Data sources
- y=158: **div.tabs** — Exchanges Wallets Brokers Custom
- y=214: **section.card.pad0.flat** — No exchanges yet Add one to start reading balances. Nothing leaves this device. Add exchange
- y=235: **div.empty** — No exchanges yet Add one to start reading balances. Nothing leaves this device. Add exchange
- y=432: **div.banner.info** — Read-only access Read-only API keys are enough: Track3 never trades or withdraws. Keys stay encrypted on this device.

## Labels, geometry, and type

Values below are CSS pixels from headless Chromium. Type is font size / weight / line height. Coordinates are relative to the viewport before scrolling.

| y | x | size | element | text | type | colour | background | padding | radius |
|---:|---:|---:|---|---|---|---|---|---|---|
| 14 | 16 | 358×128 | `div.head` | Settings Data sources Nothing connected in exchanges yet. Add exchange | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 40 | 16 | 358×28 | `h1` | Data sources | 22px/600/28px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 70 | 16 | 358×18 | `div.sub` | Nothing connected in exchanges yet. | 13px/400/18px | rgb(180, 182, 188) | rgba(0, 0, 0, 0) | 0px | 0px |
| 98 | 16 | 358×44 | `button.btn.primary` | Add exchange | 13px/500/18px | rgb(13, 13, 14) | rgb(255, 255, 255) | 0px 14px | 999px |
| 158 | 16 | 358×40 | `div.tabs` | Exchanges Wallets Brokers Custom | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 214 | 16 | 358×206 | `section.card.pad0.flat` | No exchanges yet Add one to start reading balances. Nothing leaves this device. Add exchange | 13px/400/18px | rgb(255, 255, 255) | rgb(19, 18, 23) | 0px | 6px |
| 235 | 37 | 316×164 | `div.empty` | No exchanges yet Add one to start reading balances. Nothing leaves this device. Add exchange | 13px/400/18px | rgb(180, 182, 188) | rgba(0, 0, 0, 0) | 28px | 6px |
| 336 | 126 | 139×34 | `button.btn.primary` | Add exchange | 13px/500/18px | rgb(13, 13, 14) | rgb(255, 255, 255) | 0px 14px | 999px |
| 432 | 16 | 358×98 | `div.banner.info` | Read-only access Read-only API keys are enough: Track3 never trades or withdraws. Keys stay encrypted on this device. | 13px/400/18px | rgb(255, 255, 255) | rgb(20, 36, 58) | 12px 14px | 6px |

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

- y=98: button.btn.primary — Add exchange
- y=336: button.btn.primary — Add exchange

The source depicts the **empty** state. Inputs and buttons retain their existing Track3 data flows and accessibility semantics. Numeric values, dates, and identifiers above are invented design fixture data and must be rendered from real stored shapes where available.

## Remaining differences

- The remaining difference is minor icon stroke and text rasterization; it could be matched but is below the 3% threshold. The copy, dashed panel, actions, and measured block positions match.

## Pixel difference

- Difference ratio: **2.878%** at 390 × 844 CSS px, dark theme, threshold 16 in any RGB channel.
- Design viewport: `/tmp/fidelity/settings-a/design-sources-empty.png` (top 780×1688); app viewport: `/tmp/fidelity/settings-a/sources-empty.png` (780×1688).
