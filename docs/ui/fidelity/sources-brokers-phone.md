# Settings A · sources-brokers · phone

Design: [sources-brokers-phone.jpg](/home/ubuntu/.hermes/projects/track3-design/phone/settings-a/sources-brokers-phone.jpg). Source: `ds/pages/settings-a-sources.html#brokers`. Viewed in a fresh Chromium page at 390 × 844 CSS px, dark theme, 2× image scale; full page height 844px. Source HTML/CSS/JS is authoritative.

## Structure, top to bottom

- y=14: **div.head** — Settings Data sources Everything Track3 reads: 3 exchanges, 2 wallets, 1 broker and 2 custom assets. Add broker
- y=40: **h1** — Data sources
- y=176: **div.tabs** — Exchanges Wallets Brokers Custom
- y=232: **section.card.pad0.flat** — IB Interactive Brokers Flex Query · ID 912…406 Active Today 09:41 $65,555.50 Quick look 1 active $65,555.50
- y=233: **div.srow.ok** — IB Interactive Brokers Flex Query · ID 912…406 Active Today 09:41 $65,555.50 Quick look
- y=414: **div.cfoot** — 1 active $65,555.50
- y=474: **div.banner.info** — Read-only access Interactive Brokers is read through a Flex Query: a read-only report with its own token.

## Labels, geometry, and type

Values below are CSS pixels from headless Chromium. Type is font size / weight / line height. Coordinates are relative to the viewport before scrolling.

| y | x | size | element | text | type | colour | background | padding | radius |
|---:|---:|---:|---|---|---|---|---|---|---|
| 14 | 16 | 358×146 | `div.head` | Settings Data sources Everything Track3 reads: 3 exchanges, 2 wallets, 1 broker and 2 custom assets. Add broker | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 40 | 16 | 358×28 | `h1` | Data sources | 22px/600/28px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 70 | 16 | 358×36 | `div.sub` | Everything Track3 reads: 3 exchanges, 2 wallets, 1 broker and 2 custom assets. | 13px/400/18px | rgb(180, 182, 188) | rgba(0, 0, 0, 0) | 0px | 0px |
| 116 | 16 | 358×44 | `button.btn.primary` | Add broker | 13px/500/18px | rgb(13, 13, 14) | rgb(255, 255, 255) | 0px 14px | 999px |
| 176 | 16 | 358×40 | `div.tabs` | Exchanges Wallets Brokers Custom | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 232 | 16 | 358×230 | `section.card.pad0.flat` | IB Interactive Brokers Flex Query · ID 912…406 Active Today 09:41 $65,555.50 Quick look 1 active $65,555.50 | 13px/400/18px | rgb(255, 255, 255) | rgb(19, 18, 23) | 0px | 6px |
| 233 | 17 | 356×181 | `div.srow.ok` | IB Interactive Brokers Flex Query · ID 912…406 Active Today 09:41 $65,555.50 Quick look | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 14px 16px | 0px |
| 266 | 73 | 142×16 | `small` | Flex Query · ID 912…406 | 12px/400/16px | rgb(155, 157, 163) | rgba(0, 0, 0, 0) | 0px | 0px |
| 290 | 33 | 65×20 | `span.pill.pos` | Active | 12px/500/18px | rgb(95, 195, 156) | rgb(27, 40, 40) | 0px 8px | 999px |
| 356 | 33 | 220×44 | `button.btn.sm` | Quick look | 13px/500/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px 11px | 999px |
| 414 | 17 | 356×47 | `div.cfoot` | 1 active $65,555.50 | 13px/400/18px | rgb(180, 182, 188) | rgba(0, 0, 0, 0) | 14px 16px | 0px |
| 474 | 16 | 358×80 | `div.banner.info` | Read-only access Interactive Brokers is read through a Flex Query: a read-only report with its own token. | 13px/400/18px | rgb(255, 255, 255) | rgb(20, 36, 58) | 12px 14px | 6px |

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

- y=116: button.btn.primary — Add broker
- y=356: button.btn.sm — Quick look

The source depicts the **brokers** state. Inputs and buttons retain their existing Track3 data flows and accessibility semantics. Numeric values, dates, and identifiers above are invented design fixture data and must be rendered from real stored shapes where available.

## Remaining differences

- The design uses separate refresh times per source. The existing snapshot stores one shared refresh time, so the app shows the available snapshot time and a dash for paused Kraken.
- Source logo artwork, some row icon strokes, and sheet spacing still differ from the approved render.

## Pixel difference

- Difference ratio: **4.053%** at 390 × 844 CSS px, dark theme, threshold 16 in any RGB channel.
- Design viewport: `/tmp/fidelity/settings-a/design-sources-brokers.png` (top 780×1688); app viewport: `/tmp/fidelity/settings-a/sources-brokers.png` (780×1688).
