# Failed assistant request · phone

Design: `phone/plan/assistant-error-phone.jpg`; source: `ds/pages/plan-assistant-error.html`, `plan-assistant.js`, `ds.css`. Public Sans, 390 × 844 CSS pixels.

## Structure and measurements

1. Shared 56px header: **Which positions are riskiest?**, subline **Request failed**, back and more icon targets.
2. Scroll pane x=16 to 374, 16px padding/gap. Centered **Today** at 12px `--faint`, then right aligned user bubble **Which of my positions is the riskiest right now?**, time **09:51**.
3. Two 28px tool status pills: **Looked up holdings / 8 assets** with green check, and **Compared snapshots / failed** with red warning triangle, `--pill-neg-bg`.
4. Inset failure banner has `--negative` border and dark red fill. Warning triangle sits left of **Request failed**. Explanation is **The model endpoint answered 429 (rate limit) after 3 tries. Your message is saved; last good reply was at 09:43.** Controls are white **Retry** pill with refresh icon and outline **AI assistant settings** pill; final line **Details: HTTP 429, retry after 20 s**. Retry must repeat the saved user question, and settings must navigate to AI configuration. No fabricated success state.
5. Unused thread area stays neutral ground. Composer at y=727 is the same 117px quick action and pill input block as the regular thread.

The source page was remeasured in Chromium at 390 × 844: `.th` is 390 × 56 at y=0 with 6px side padding; the first `.tc` is 207 × 28 at x=16, y=186 with 12px type; `.erb` is 358 × 174 at x=16, y=262 with 12px × 14px padding; `.cmp` is 390 × 117 at y=727.

## Remaining differences

Capture: `/tmp/fidelity/assistant/error.png`; design and capture were viewed side by side after adding the composer divider. Neither capture shows a tab bar below the composer. At 780 × 1688 output pixels, 23.470% of pixels differ by more than 16/255 in any RGB channel (source-page and app Chromium captures).

- The two source tool pills are absent in a reloaded error session because the current persisted chat format removes `agent_activity` blocks. A live session now shows per-tool pills within an expandable activity control. Their absence in this capture moves the error card from source y=259 to app y=184.
- The app shows the accessible 29% context indicator in the header; the source leaves that space blank.
- The source explanation gives three attempts and a last good reply at 09:43. The persisted error contains only **HTTP 429, retry after 20 s** and cannot establish either claim. The app accurately says **The request failed. Your message is saved.**
- The warning, reload, and send glyphs now use the reference SVG paths. The real Retry and AI settings actions remain available.

Measured pixel difference: **23.470%** at 390 × 844 CSS px, threshold 16 in any RGB channel.
