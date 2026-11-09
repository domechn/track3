# New assistant chat · phone

Design: `phone/plan/assistant-new-phone.jpg`; source: `ds/pages/plan-assistant-new.html`, `plan-assistant.js`, `ds.css`. Public Sans, 390 × 844 CSS pixels.

## Structure and measurements

1. The shared 56px chat header has a left back chevron, **New chat** at 15px/18px weight 600, **Pro · gpt-4.1** at 12px/16px `--faint`, and a right 44px more target. Ground is `#0d0d0e`; 1px `--border` divider.
2. Scroll pane starts with a 52px blue `#1d2a3f` circle holding a spark icon, centered above **Ask about your portfolio** at 20px/26px weight 600. The 13px/18px `--muted` explanation says **Answers use your holdings and snapshots from the latest refresh. Anything that changes data asks for your approval first.** Gap from header to content starts at 28px.
3. **Insights for today** is a `--surface` card (`#131217`), x=16, width 358px, 1px `--border`, 6px corners, 16px × 20px padding. Header has 15px weight 600 title, clock icon and **Generated 09:41 · about 1,120 tokens**, plus a Refresh button. Three separated insight rows use 14px vertical padding; titles are 13px weight 500, descriptions 12px/16px `--muted`. Rows: **SOL is +14.3% in 7 days** / **It is now 9.0% of the portfolio, 1.0 pts above your 8.0% target.** / **Ask about SOL**; **BTC is 3.1 pts under target** / **Buying $23,405.22 of BTC would bring it back to 30.0%, funded by selling USDT.** / **Plan a rebalance**; **95.5% of the way to $800,000** / **$763,809.27 today, $36,190.73 to go. The last 7 days added $26,010.84.** / **What would it take?** Row actions are 36px outline pills.
4. Composer matches `assistant-phone.md`: pinned action chips and 50px pill input. Insights Refresh and question actions are interactive and must use live insight/portfolio data.

## Data and states

The sample holdings, targets, 7 day change and generated insight time come from the design's T3 data. Insights are a real existing feature; an unavailable insight must retain its actual empty/error behavior.

## Remaining differences

**9 Nov 2026 layout audit:** assistant 13.157% at 390 × 844, dark, against the approved phone JPEG (RGB channel difference sum > 60). The dense CNY fixture and working product state differ from the static reference; the page-specific visible differences are listed below.

The earlier 8 Nov 390 × 844 dark real-data capture differed by **12.880%** from the static phone image at RGB-sum threshold 60. The real-scale fixture now has seven loadable encrypted chats behind the phone's Chats button and a saved insight card. The source still uses illustrative USD holdings, context settings, usage totals and generated responses; the product shows the fixture's actual CNY portfolio and stored choices. The new chat screen keeps the Chats pane closed until requested at phone and iPad widths.

Capture: `/tmp/fidelity/assistant/new.png`; design and capture were viewed side by side.

- The existing iOS navigation tests require an **Assistant** top bar and a tab bar below the composer. The source shows **New chat** aligned left and no tab bar.
- The source says **Generated 09:41 · about 1,120 tokens**. The stored insight card has no generation time or token count. The app labels its available timestamp **Data refreshed 09:41** so it does not misstate when the insight was generated.
- Each insight has a small labeled Dismiss control. The source omits it, but the existing card supports dismissal and the phone welcome card preserves that action.
- The fixture uses the exact target map from the design's `ds/pages/plan-common.js`, and the app now names **USDT**, the largest stablecoin sale in the real rebalance result. The design trade engine assigns its 2¢ target-rounding remainder to BTC, producing **$23,405.22**. Track3's calculator keeps the remainder in cash and displays **$23,405.20**.
- The spark, clock, reload, and send glyph strokes and some text spacing differ.

Measured pixel difference: **10.303%** at 390 × 844 CSS px, threshold 16 in any RGB channel.
