# Settings A · blacklist-undo · phone

Design: [blacklist-undo-phone.jpg](/home/ubuntu/.hermes/projects/track3-design/phone/settings-a/blacklist-undo-phone.jpg). Source: `ds/pages/settings-a-blacklist.html#undo`. Viewed in a fresh Chromium page at 390 × 844 CSS px, dark theme, 2× image scale; full page height 1062px. Source HTML/CSS/JS is authoritative.

## Structure, top to bottom

- y=14: **div.head** — Settings Blacklist Tokens you chose to hide. 2 hidden.
- y=40: **h1** — Blacklist
- y=246: **div.srow.bl** — ETH ETHG ERC20 · contract 0x9e1c…3b02 0x4f…a91c wallet Remove from blacklist
- y=387: **div.srow.bl** — CLA CLAIM-USDT ERC20 · contract 0x71af…c4d8 0x4f…a91c wallet Remove from blacklist
- y=528: **div.cfoot** — 2 hidden tokens
- y=605: **h2** — What hiding does
- y=706: **div.toast** — Removed SHIBAI from the blacklist It will show up again after the next refresh. Undo

## Labels, geometry, and type

Values below are CSS pixels from headless Chromium. Type is font size / weight / line height. Coordinates are relative to the viewport before scrolling.

| y | x | size | element | text | type | colour | background | padding | radius |
|---:|---:|---:|---|---|---|---|---|---|---|
| 14 | 16 | 358×84 | `div.head` | Settings Blacklist Tokens you chose to hide. 2 hidden. | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 40 | 16 | 358×28 | `h1` | Blacklist | 22px/600/28px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 70 | 16 | 358×18 | `div.sub` | Tokens you chose to hide. 2 hidden. | 13px/400/18px | rgb(180, 182, 188) | rgba(0, 0, 0, 0) | 0px | 0px |
| 131 | 33 | 324×44 | `div.input` | Token symbol, for example SHIBAI | 13px/400/18px | rgb(255, 255, 255) | rgb(10, 10, 11) | 0px 12px | 6px |
| 185 | 33 | 324×44 | `button.btn.primary` | Hide token | 13px/500/18px | rgb(13, 13, 14) | rgb(255, 255, 255) | 0px 14px | 999px |
| 246 | 17 | 356×141 | `div.srow.bl` | ETH ETHG ERC20 · contract 0x9e1c…3b02 0x4f…a91c wallet Remove from blacklist | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 14px 16px | 0px |
| 279 | 73 | 186×16 | `small` | ERC20 · contract 0x9e1c…3b02 | 12px/400/16px | rgb(155, 157, 163) | rgba(0, 0, 0, 0) | 0px | 0px |
| 329 | 33 | 324×44 | `button.btn.sm` | Remove from blacklist | 13px/500/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px 11px | 999px |
| 387 | 17 | 356×141 | `div.srow.bl` | CLA CLAIM-USDT ERC20 · contract 0x71af…c4d8 0x4f…a91c wallet Remove from blacklist | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 14px 16px | 0px |
| 420 | 73 | 183×16 | `small` | ERC20 · contract 0x71af…c4d8 | 12px/400/16px | rgb(155, 157, 163) | rgba(0, 0, 0, 0) | 0px | 0px |
| 470 | 33 | 324×44 | `button.btn.sm` | Remove from blacklist | 13px/500/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px 11px | 999px |
| 528 | 17 | 356×47 | `div.cfoot` | 2 hidden tokens | 13px/400/18px | rgb(180, 182, 188) | rgba(0, 0, 0, 0) | 14px 16px | 0px |
| 605 | 33 | 124×20 | `h2` | What hiding does | 15px/600/20px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 685 | 65 | 292×16 | `small` | The balance stays on the exchange or wallet. | 12px/400/16px | rgb(155, 157, 163) | rgba(0, 0, 0, 0) | 0px | 0px |
| 706 | 16 | 358×62 | `div.toast` | Removed SHIBAI from the blacklist It will show up again after the next refresh. Undo | 13px/400/18px | rgb(255, 255, 255) | rgb(27, 26, 32) | 12px 14px | 8px |
| 744 | 65 | 292×32 | `small` | Remove a token from the list and it returns on the next refresh. | 12px/400/16px | rgb(155, 157, 163) | rgba(0, 0, 0, 0) | 0px | 0px |
| 819 | 65 | 292×16 | `small` | Never interact with tokens you did not buy. | 12px/400/16px | rgb(155, 157, 163) | rgba(0, 0, 0, 0) | 0px | 0px |

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
- y=329: button.btn.sm — Remove from blacklist
- y=470: button.btn.sm — Remove from blacklist

The source depicts the **undo** state. Inputs and buttons retain their existing Track3 data flows and accessibility semantics. Numeric values, dates, and identifiers above are invented design fixture data and must be rendered from real stored shapes where available.

## Remaining differences

- The toast uses the real optimistic delete and Undo flow. Its position is close, but the missing blacklist metadata changes the page height behind it.
- The persisted blacklist stores token symbols only. Contract address, source wallet, and hidden date in the design have no stored fields, so the app shows the supported symbol and all sources label.
- Row icons and the informational card spacing still differ from the approved render.

## Pixel difference

- Difference ratio: **9.430%** at 390 × 844 CSS px, dark theme, threshold 16 in any RGB channel.
- Design viewport: `/tmp/fidelity/settings-a/design-blacklist-undo.png` (top 780×1688); app viewport: `/tmp/fidelity/settings-a/blacklist-undo.png` (780×1688).
