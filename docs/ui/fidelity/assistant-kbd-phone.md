# Assistant with phone keyboard · phone

Design: `phone/plan/assistant-kbd-phone.jpg`; source: `ds/pages/plan-assistant-kbd.html`, `plan-assistant.js`, `ds.css`. Public Sans, 390 × 844 CSS pixels.

## Structure and measurements

1. Same 56px header and pending action thread as `assistant-phone.md`. The thread viewport shrinks to 428px, ends at y=484 and scrolls so the approval card is visible. The card is x=16, width 358px, 356px tall.
2. Quick action chips are hidden while editing. Composer is y=484 to 553, with x=12, y=493, 366 × 50px input. It contains **What would it take to hit $800,000?** and a visible caret. The border is `--accent` `#4a8ad6`; 3px soft blue focus ring. The 44px circular send target is white with dark send icon and remains enabled.
3. The design's y=553 to 844 keyboard is a 291px placeholder with dark rectangle keys. Production must show the actual iOS keyboard instead of reproducing those placeholders; it must respect the visual viewport and keep the composer above the keyboard. The placeholder key pattern is a design only representation.

## Remaining differences

Capture: `/tmp/fidelity/assistant/kbd.png`; design and capture were viewed side by side.

- The Playwright capture draws the source's placeholder keyboard in the test only. Production displays the active iOS keyboard, whose key shapes depend on OS and locale and cannot be styled by the app.
- The approval card shows the saved asset type and enabled state alongside “What will change”. The source omits them; an approver must still see those alert fields. The bell and send glyph strokes also differ.

Measured pixel difference: **6.441%** at 390 × 844 CSS px, threshold 16 in any RGB channel.
