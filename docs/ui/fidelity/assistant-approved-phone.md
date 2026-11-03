# Approved assistant action · phone

Design: `phone/plan/assistant-approved-phone.jpg`; source: `ds/pages/plan-assistant-approved.html`, `plan-assistant.js`, `ds.css`. Shared assistant thread measurements are in `assistant-phone.md`.

## Structure and measurements

1. Shared 56px header now has **2 replies · $0.024 · gpt-4.1**. The thread scrolls to the bottom, leaving the last AAPL bullet and BTC alert offer above the card.
2. The approval card is x=16, width 358px, `--surface` `#131217`, 1px `--border`, 8px corners, 14px padding and 330px height in the measured source. A green check icon replaces the bell; labels are **Alert created** and green **Approved 09:43**. The title and the four ruled key/value rows keep the pending card's values and order. Privacy text remains. A blue text link **Open in Goals & alerts** with chevron replaces the two approval buttons and navigates to the rule.
3. Right aligned user bubble **Yes, approve it.** with **09:43** below it follows the card. Assistant tool pill **Created alert / BTC above $70,000** uses green check icon. Final markdown reads: **Done. The rule BTC price above $70,000 is on, with a 24 hour cooldown. It starts at 91.2% progress and is checked at each refresh.** The new usage line is **gpt-4.1 · 4,024 in · 58 out · about $0.011** and has a copy icon.
4. The 117px pinned composer and three visible outline quick action pills match the thread state. Approval is a real alert action and must reflect its persisted result.

## Remaining differences

Capture: `/tmp/fidelity/assistant/approved.png`; design and capture were viewed side by side.

- The card includes the saved asset type and enabled state alongside “What will change”, and reads **24 hours** for cooldown. The source omits those alert fields; hiding them would make the approval preview incomplete.
- The source status reads **Approved 09:43**; the app reads **Approved**. The existing persisted action stores `status` and `createdAt`, but has no approval timestamp. Assigning the creation time to approval would be false.
- Minor glyph strokes and text spacing differ.

Measured pixel difference: **3.097%** at 390 × 844 CSS px, threshold 16 in any RGB channel.
