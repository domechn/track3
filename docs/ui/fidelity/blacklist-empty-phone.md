# Settings A · blacklist-empty · phone

Design: [blacklist-empty-phone.jpg](/home/ubuntu/.hermes/projects/track3-design/phone/settings-a/blacklist-empty-phone.jpg). Source: `ds/pages/settings-a-blacklist.html#empty`. Viewed in a fresh Chromium page at 390 × 844 CSS px, dark theme, 2× image scale; full page height 844px. Source HTML/CSS/JS is authoritative.

## Structure, top to bottom

- y=14: **div.head** — Settings Blacklist Tokens you chose to hide. None hidden.
- y=40: **h1** — Blacklist
- y=114: **section.card.pad0.flat** — Token symbol, for example SHIBAI Hide token No hidden tokens Tokens you hide, such as airdrop spam, are listed here. Hide one with its symbol above.
- y=266: **div.empty** — No hidden tokens Tokens you hide, such as airdrop spam, are listed here. Hide one with its symbol above.
- y=450: **h2** — What hiding does

## Labels, geometry, and type

Values below are CSS pixels from headless Chromium. Type is font size / weight / line height. Coordinates are relative to the viewport before scrolling.

| y | x | size | element | text | type | colour | background | padding | radius |
|---:|---:|---:|---|---|---|---|---|---|---|
| 14 | 16 | 358×84 | `div.head` | Settings Blacklist Tokens you chose to hide. None hidden. | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 40 | 16 | 358×28 | `h1` | Blacklist | 22px/600/28px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 70 | 16 | 358×18 | `div.sub` | Tokens you chose to hide. None hidden. | 13px/400/18px | rgb(180, 182, 188) | rgba(0, 0, 0, 0) | 0px | 0px |
| 114 | 16 | 358×307 | `section.card.pad0.flat` | Token symbol, for example SHIBAI Hide token No hidden tokens Tokens you hide, such as airdrop spam, are listed here. Hide one with its symbol above. | 13px/400/18px | rgb(255, 255, 255) | rgb(19, 18, 23) | 0px | 6px |
| 131 | 33 | 324×44 | `div.input` | Token symbol, for example SHIBAI | 13px/400/18px | rgb(255, 255, 255) | rgb(10, 10, 11) | 0px 12px | 6px |
| 185 | 33 | 324×44 | `button.btn.primary` | Hide token | 13px/500/18px | rgb(13, 13, 14) | rgb(255, 255, 255) | 0px 14px | 999px |
| 266 | 37 | 316×134 | `div.empty` | No hidden tokens Tokens you hide, such as airdrop spam, are listed here. Hide one with its symbol above. | 13px/400/18px | rgb(180, 182, 188) | rgba(0, 0, 0, 0) | 28px | 6px |
| 450 | 33 | 124×20 | `h2` | What hiding does | 15px/600/20px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 530 | 65 | 292×16 | `small` | The balance stays on the exchange or wallet. | 12px/400/16px | rgb(155, 157, 163) | rgba(0, 0, 0, 0) | 0px | 0px |
| 589 | 65 | 292×32 | `small` | Remove a token from the list and it returns on the next refresh. | 12px/400/16px | rgb(155, 157, 163) | rgba(0, 0, 0, 0) | 0px | 0px |
| 664 | 65 | 292×16 | `small` | Never interact with tokens you did not buy. | 12px/400/16px | rgb(155, 157, 163) | rgba(0, 0, 0, 0) | 0px | 0px |

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

- y=131: div.input — Token symbol, for example SHIBAI
- y=185: button.btn.primary — Hide token

The source depicts the **empty** state. Inputs and buttons retain their existing Track3 data flows and accessibility semantics. Numeric values, dates, and identifiers above are invented design fixture data and must be rendered from real stored shapes where available.

## Remaining differences

- The persisted blacklist stores token symbols only. Contract address, source wallet, and hidden date in the design have no stored fields, so the app shows the supported symbol and all sources label.
- Row icons and the informational card spacing still differ from the approved render.

## Pixel difference

- Difference ratio: **8.184%** at 390 × 844 CSS px, dark theme, threshold 16 in any RGB channel.
- Design viewport: `/tmp/fidelity/settings-a/design-blacklist-empty.png` (top 780×1688); app viewport: `/tmp/fidelity/settings-a/blacklist-empty.png` (780×1688).
