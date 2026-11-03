# Overview · stale source · phone

Reference viewed: authoritative `source/ds/pages/core-overview.html#stale` at 390 × 844, dark; no separate approved JPG was supplied. The page uses the default Overview structure through Top coins. Source document height is 3451px.

## Structure and exact copy

The Sources card is x16 y2715, 358×596px, 16px padding, 6px radius, `--surface #131217` with `--border #222224`. Its header says `Sources`, `4 of 5 up to date`, and shows a 100×44px outlined `Refresh all` pill at x257 y2732. A warning banner inside the card is x33 y2788, 324×98px, padding 12px 14px, radius 6px, background `#2a2416`, warning `#d9a441`; triangular alert icon. Exact copy: `Interactive Brokers did not refresh` and `Flex Query timed out. Its value ($65,555.50) is from the last good refresh at 08:12.`

Five source rows follow in the normal order and retain their actual values: Binance, OKX, Ledger cold wallet, 0x4f…a91c, Interactive Brokers. The broker row at x33 y3214 grows to about 80px and says `Failed · last good 08:12` in warning colour with an outlined 69×44px `Retry` pill. Other rows say `Updated 09:41` or `Updated 09:40` in positive colour. The bottom local status line and fixed tab bar follow.

The banner, stale badge, and Retry appear only for a real failed/stale source status. Retry must dispatch the existing source refresh; total/value masking and quote colour remain active. The sample shows the broker's last good value and must not silently exclude it or invent a newer quote.

## Original capture and pixel difference

App: `/tmp/fidelity/overview/overview-stale-phone-long.png`. Source: `/tmp/fidelity/overview/design-overview-stale-long.png`. Both are 390px dark full-page renders. Pixel difference: **7.12%** of pixels differ by more than 20 in at least one RGB channel; mean maximum-channel difference 8.23/255. Source/app heights 3451/3451px.

## Remaining differences

- Current 390px viewport pixel diff: **2.81%** (any RGB channel differs by more than 20).
- Current 390px full-page pixel diff: **13.61%** with the same threshold.
- Viewport: chart, glyph, and text edges differ slightly.
- Full page: the source says “Flex Query timed out” and assumes market-cap ranks and Cloudflare R2 sync. Persisted status only supplies the sanitized “Source timed out” reason, and the fixture has no market-cap rank or sync bucket. The app shows those real states, shifting lower content.
