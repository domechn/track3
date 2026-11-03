# Assistant sessions · phone

Design: `phone/plan/assistant-sessions-phone.jpg`; source: `ds/pages/plan-assistant-sessions.html`, `plan-assistant.js`, `ds.css`. Public Sans, 390 × 844 CSS pixels.

## Structure and measurements

1. This is a More tab page, not the full viewport chat. Outer x=16 margin. Page heading **Assistant** in 22px/28px weight 600 and description **Ask about your holdings, P&L and allocation. Actions wait for your approval.**
2. At y=106, **Chats** heading in 15px/20px and 36px outline pill **New chat** with plus icon. **Today** and **Earlier** are 12px `--faint` group labels. Seven 64px minimum rows have 1px `--rule` top lines, title in 13px weight 500, preview beneath in about 11px, and right aligned date/time in 12px `--faint`. Order and text: **What drove my gain this week?** / **BTC added most in dollars, SOL in percent** / 09:42; **Rebalance plan, 30% BTC** / **Sell USDT, buy BTC to reach 30%…** / Yesterday; **Explain my 30D P&L** / **+$34,641.48 in 30 days, led by BTC** / 29 Oct; **Is my stablecoin share too high?** / **USDT and USDC are 29.1% of the total** / 27 Oct; **Compare 24 Oct with 31 Oct** / **Total rose by $26,010.84** / 24 Oct; **Alert ideas for SOL** / **A 7d move above 10% fits its recent range** / 22 Oct; **What changed since 1 Oct?** / **Total went from $729,167.79 to $763,809.27** / 20 Oct.
3. Footer line with lock icon: **Chats are stored on this device and in encrypted sync.** Rows navigate, New chat creates a session on first send, and row actions remain accessible. Four item bottom tab bar remains.

## Remaining differences

Capture: `/tmp/fidelity/assistant/sessions.png`; design and capture were viewed side by side.

- The Back control in the upper right returns to the current thread. Active and pinned sessions retain visible indicators because they change how a user navigates or manages a saved conversation; the source omits these controls and states.
- The tab, lock, and plus glyph strokes and list text spacing differ.

Measured pixel difference: **6.068%** at 390 × 844 CSS px, threshold 16 in any RGB channel.
