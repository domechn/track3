# Assistant thread · phone

Design: `phone/plan/assistant-phone.jpg`, `phone-long/plan/assistant-phone-long.jpg`; source: `ds/pages/plan-assistant.html`, `plan-assistant.js`, `ds.css`. Measured in Chromium at a 390 × 844 CSS pixel viewport with Public Sans loaded.

## Structure and measurements

1. Full viewport chat on neutral ground `#0d0d0e`. The 56px header has a 1px `--border` bottom rule, 6px horizontal padding, a 44px back target, left aligned title **What drove my gain this week?** in 15px/18px weight 600, subline **1 reply · $0.013 · gpt-4.1** in 12px/16px `--faint`, and a 44px more target.
2. Independently scrolling thread between header and composer, 16px padding and 16px vertical gap. At its beginning: centered **Today** in 12px `--faint`; right aligned user bubble **What drove my gain this week? And should I set an alert on BTC?** with 09:42 below it. The bubble is `#23232a`, 1px `--border`, 12/12/4/12px corners, 10px × 14px padding, 13px/20px type.
3. Assistant output is plain content on ground: two 28px pill tool chips, **Looked up holdings** / **8 assets** and **Compared snapshots** / **24 Oct and 31 Oct**, each `#1a1a1e` with a check icon; the 13px/21px markdown reply follows. It states **+$26,010.84 (+3.53%)**, from **$737,798.43 on 24 Oct** to **$763,809.27 today**.
4. A four column table states **Change in value by asset, 24 Oct to 31 Oct. Stables = USDT + USDC.** Columns are Asset, Value now, Price, 7D, Value change. Rows: BTC $205,737.58 +6.4% +$12,286.29; SOL $69,044.00 +14.3% +$8,663.30; ETH $151,251.35 +3.1% +$4,507.36; BNB $49,774.10 +2.7% +$1,324.26; NVDA $31,075.00 +1.7% +$532.40; Stables $222,446.74 – +$54.73; AAPL $34,480.50 −3.8% −$1,357.50; Total $763,809.27 and +$26,010.84. Number columns are right aligned, changes use `--positive` and `--negative`, header is 12px on `#17161b`.
5. Three bullet conclusions name SOL, BTC and AAPL; a final paragraph says BTC is at **$63,842.11**, needs **9.6%** more to reach **$70,000**, and offers an alert. This is model supplied markdown, not fixed interface copy.
6. Approval card is 358px wide at x=16, `#14161c`, 1px `#2f4f7a` border, 8px radius, 14px padding. Bell icon, **Approval needed**, yellow **Waiting** pill; title **Create alert: BTC above $70,000** in 16px/22px weight 600. **What will change** precedes four 1px ruled rows: Adds / 1 rule in Goals & alerts; Condition / Asset price target: BTC goes above $70,000; Cooldown / 24 hours; Right now / $63,842.11, 91.2% of the way. Two 44px minimum pill buttons **Approve** and **Reject** split the row. Approval executes only after a persisted session claim.
7. Usage line has spark and copy icons, **gpt-4.1 · 3,412 in · 486 out · about $0.013** in 12px/18px `--faint`.
8. Pinned composer begins at y=727, 117px tall. A horizontally scrolling row of 40px outline pill actions reads **Summarize this week**, **Biggest risks**, **Plan a rebalance**, **Explain 30D P&L**. The input outline is x=12, y=784, 366 × 50px, `#0a0a0b`, 1px `--control`, 24px radius; placeholder **Ask about your portfolio…**, 44px circular send target. All actions, copy, back and more controls are interactive.

## Data and states

The table, prose, token counts and action preview are stored chat content; the fixture seeds the existing encrypted chat file plus `chat_sessions` metadata, and actual holdings/snapshots for the contextual figures. Tool activity is transient in the product and disappears on session reload. The first viewport is scrolled to the end; the long image exposes the complete thread.

## Remaining differences

Capture: `/tmp/fidelity/assistant/phone.png`; design and capture were viewed side by side.

- The card includes asset type and enabled state alongside “What will change” so the approver sees those saved alert fields. The source omits both; hiding them would make the approval preview incomplete. Cooldown now reads **24 hours**.
- The source's two tool activity pills do not survive a saved session reload: the existing chat persistence removes `agent_activity` blocks. They are outside the viewport in this capture.
- The bell, copy, and send glyph strokes and a small amount of card text spacing differ.

Measured pixel difference: **3.583%** at 390 × 844 CSS px, threshold 16 in any RGB channel.
