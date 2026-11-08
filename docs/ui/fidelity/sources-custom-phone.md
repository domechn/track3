# Settings A · sources-custom · phone

Design: [sources-custom-phone.jpg](/home/ubuntu/.hermes/projects/track3-design/phone/settings-a/sources-custom-phone.jpg). Source: `ds/pages/settings-a-sources.html#custom`. Viewed in a fresh Chromium page at 390 × 844 CSS px, dark theme, 2× image scale; full page height 844px. Source HTML/CSS/JS is authoritative.

## Structure, top to bottom

- y=14: **div.head** — Settings Data sources Everything Track3 reads: 3 exchanges, 2 wallets, 1 broker and 2 custom assets. Add custom asset
- y=40: **h1** — Data sources
- y=176: **div.tabs** — Exchanges Wallets Brokers Custom
- y=233: **div.srow.ok.cu** — AU GOLD Gold bars · 4 oz Manual · $2,650.00 Attached to Standalone $10,600.00 Attach
- y=396: **div.srow.ok.cu** — NV NVDA-RSU Unvested shares · 60 Follows NVDA · $141.25 Attached to Interactive Brokers $8,475.00 Attach
- y=559: **div.cfoot** — 2 custom assets $19,075.00
- y=619: **div.banner.info** — Placeholder data These two custom assets are samples and are not part of the $763,809.27 total used on other screens.

## Labels, geometry, and type

Values below are CSS pixels from headless Chromium. Type is font size / weight / line height. Coordinates are relative to the viewport before scrolling.

| y | x | size | element | text | type | colour | background | padding | radius |
|---:|---:|---:|---|---|---|---|---|---|---|
| 14 | 16 | 358×146 | `div.head` | Settings Data sources Everything Track3 reads: 3 exchanges, 2 wallets, 1 broker and 2 custom assets. Add custom asset | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 40 | 16 | 358×28 | `h1` | Data sources | 22px/600/28px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 70 | 16 | 358×36 | `div.sub` | Everything Track3 reads: 3 exchanges, 2 wallets, 1 broker and 2 custom assets. | 13px/400/18px | rgb(180, 182, 188) | rgba(0, 0, 0, 0) | 0px | 0px |
| 116 | 16 | 358×44 | `button.btn.primary` | Add custom asset | 13px/500/18px | rgb(13, 13, 14) | rgb(255, 255, 255) | 0px 14px | 999px |
| 176 | 16 | 358×40 | `div.tabs` | Exchanges Wallets Brokers Custom | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px | 0px |
| 233 | 17 | 356×163 | `div.srow.ok.cu` | AU GOLD Gold bars · 4 oz Manual · $2,650.00 Attached to Standalone $10,600.00 Attach | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 14px 16px | 0px |
| 266 | 73 | 88×16 | `small` | Gold bars · 4 oz | 12px/400/16px | rgb(155, 157, 163) | rgba(0, 0, 0, 0) | 0px | 0px |
| 310 | 33 | 202×16 | `small` | Attached to Standalone | 12px/400/16px | rgb(155, 157, 163) | rgba(0, 0, 0, 0) | 0px | 0px |
| 338 | 33 | 220×44 | `button.btn.sm` | Attach | 13px/500/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px 11px | 999px |
| 396 | 17 | 356×163 | `div.srow.ok.cu` | NV NVDA-RSU Unvested shares · 60 Follows NVDA · $141.25 Attached to Interactive Brokers $8,475.00 Attach | 13px/400/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 14px 16px | 0px |
| 429 | 73 | 119×16 | `small` | Unvested shares · 60 | 12px/400/16px | rgb(155, 157, 163) | rgba(0, 0, 0, 0) | 0px | 0px |
| 473 | 33 | 214×16 | `small` | Attached to Interactive Brokers | 12px/400/16px | rgb(155, 157, 163) | rgba(0, 0, 0, 0) | 0px | 0px |
| 501 | 33 | 220×44 | `button.btn.sm` | Attach | 13px/500/18px | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | 0px 11px | 999px |
| 559 | 17 | 356×47 | `div.cfoot` | 2 custom assets $19,075.00 | 13px/400/18px | rgb(180, 182, 188) | rgba(0, 0, 0, 0) | 14px 16px | 0px |
| 619 | 16 | 358×98 | `div.banner.info` | Placeholder data These two custom assets are samples and are not part of the $763,809.27 total used on other screens. | 13px/400/18px | rgb(255, 255, 255) | rgb(20, 36, 58) | 12px 14px | 6px |

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

- y=116: button.btn.primary — Add custom asset
- y=338: button.btn.sm — Attach
- y=501: button.btn.sm — Attach

The source depicts the **custom** state. Inputs and buttons retain their existing Track3 data flows and accessibility semantics. Numeric values, dates, and identifiers above are invented design fixture data and must be rendered from real stored shapes where available.

## Remaining differences

- The approved source is dark only. The live page honors the selected light theme, so its light colours cannot match that reference.
- The static source uses its pencil for the amount and price editor and has no Rename flow. The live pencil opens Rename; the labeled symbol opens the full editor, and the avatar retains its action menu.
- Custom asset enabled switches in the design do not exist in the persisted custom-asset format; the app keeps its existing add, edit, attach, and remove behaviour. The design placeholder exclusion note conflicts with the product, where custom assets contribute to totals after refresh.
- NVDA-RSU cannot show "Attached to Interactive Brokers": the real attachment type supports exchanges and wallets only. A broker attachment would change the data model and refresh pipeline. The app shows the stored standalone state.
- The stored amount has no unit field, so "Gold bars · 4 oz" appears as "Gold bars · 4". The custom rows now match the source row heights and order; missing switches and different informational copy remain visible.
- Source logo artwork, some icon strokes, and value alignment differ slightly; they could be matched but are not worth another round. The phone Sources page uses "Public Sans" to match the design CSS.
- Existing custom asset aliases may be 41–100 characters long. The new Rename dialog enforces the requested 40-character limit, so opening one of those older aliases shows a length error until it is shortened; the original custom asset editor still accepts up to 100 characters.
- The live back control and bottom tabs retain the app's routes and hit areas, with different icon shapes and text rendering. Small glyph and alignment differences remain in the custom rows.

## Pixel difference

- Last captured matched-fixture difference: **10.934% dark** and **92.051% light** at 390 × 844 CSS px, threshold 16 in any RGB channel. The light ratio compares the selected light theme with the dark-only source. The dark overage includes unsupported custom switches, broker attachment, amount unit, and placeholder-exclusion copy, plus the live app shell. A subsequent scoped font and value-position correction awaits recapture under the one-run limit.
- Current measurements and screenshots: `/tmp/track3-source-rename/phone-dark-measure.json`, `phone-light-measure.json`, and `/tmp/track3-source-rename/phone-{dark,light}-{design,sample}-custom.png`. Both dark rows begin at y=233.
