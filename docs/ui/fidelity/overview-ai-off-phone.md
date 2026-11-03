# Overview · AI off · phone

Reference viewed: authoritative `source/ds/pages/core-overview.html#ai-off` at 390 × 844, dark; no separate approved JPG was supplied. The page uses the Overview structure in [overview-phone.md](overview-phone.md) through Holdings, then changes the AI card. Source document height is 3128px.

## Structure and exact copy

The AI card is x16 y1236, 358×286px with 16px padding, 6px radius, `--surface #131217`, and `--border #222224`. Its heading at x33 y1253 says `AI insights`, 15px/20px semibold. A neutral pill x121 y1254, 35×20px, `--raised #212023`, 12px/18px medium, says `Off`. The main inset box has a 1px dashed `--control #3a3a3e` border and 6px radius. It contains `Insights are turned off` in white 13px semibold, then `Three short observations about your portfolio, written from the numbers on this screen. Nothing is sent to your AI endpoint while this is off.` in muted 13px/18px. An outlined pill button says `Open AI settings` with a settings gear icon and navigates to AI settings. The footer x33 y1474 says `Settings › AI assistant › Insights. Pro feature.` in faint 12px. Daily change, What moved, Top coins, Sources, and the local status line follow, in the same order as the default Overview; Sources begins at y2544.

Disabling proactive insights is an existing local assistant setting. The card must keep the real setting and the rest of the portfolio intact; no generated insight text should be shown in this state. Its button remains keyboard and touch accessible.

## Original capture and pixel difference

App: `/tmp/fidelity/overview/overview-ai-off-phone-long.png`. Source: `/tmp/fidelity/overview/design-overview-ai-off-long.png`. Both are 390px dark full-page renders. Pixel difference: **5.63%** of pixels differ by more than 20 in at least one RGB channel; mean maximum-channel difference 5.80/255. Source/app heights 3128/3128px.

## Remaining differences

- Current 390px viewport pixel diff: **2.81%** (any RGB channel differs by more than 20).
- Current 390px full-page pixel diff: **9.20%** with the same threshold.
- Viewport: chart, glyph, and text edges differ slightly.
- Full page: the reference assumes market-cap ranks and Cloudflare R2 devices. Neither exists in the stored fixture, so the app shows portfolio ranks and its real unsynced status; source rows and their later positions differ.
