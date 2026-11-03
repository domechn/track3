# Overview pull-to-refresh phone design specification

Reference: `phone/core/overview-ptr-phone.jpg`; source `source/ds/pages/core-overview.html#ptr`. Same tokens, hero and fixed bottom bar as [overview-phone.md](overview-phone.md).

A 390 × 72px `--surface` pull-to-refresh status strip appears above the live-total row, separated by a `--border` hairline. A 22px circular blue progress arc sits beside `Refreshing sources` (13px 600) and `3 of 5 done · Binance, OKX, Ledger` (12px muted). The header shifts from y=10 to y=76, title from y=64 to y=130, range from y=122 to y=188, hero from y=182 to y=248. The hero contents and remaining cards retain the same dimensions and sample data. The strip belongs to the active refresh flow; actual progress and source names reflect real source statuses. Tapping refresh while active must not start a duplicate fetch.

## Original capture and pixel difference

App: `/tmp/fidelity/overview/overview-ptr-phone.png`. Source: `/tmp/fidelity/overview/design-overview-ptr.png`. 390px dark, full page. Pixel difference: **2.66%** of pixels differ by more than 20 in at least one RGB channel; mean maximum-channel difference 2.74/255. Source/app heights 844/844px. Compared with `/tmp/fidelity/calc-ratios.mjs` using the authoritative Chromium HTML render. This numerical threshold does not waive any visible difference.

## Remaining differences

- Current 390px viewport pixel diff: **3.23%** (any RGB channel differs by more than 20).
- The pull strip, chart, and cards align; header glyphs, chart stroke edges, and touch-webview text rasterization remain visible.
