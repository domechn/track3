# Assistant without an API key · phone

Design: `phone/plan/assistant-nokey-phone.jpg`; source: `ds/pages/plan-assistant-nokey.html`, `plan-assistant.js`, `ds.css`. Public Sans, 390 × 844 CSS pixels.

## Structure and measurements

1. This state retains the More tab bar. Outer page margin 16px. Page title **Assistant** in 22px/28px weight 600; description **Ask questions about your holdings in plain language.** in 13px `--muted`; yellow pill **Pro · key missing**.
2. A `--surface` card begins at x=16, y=108, width 358px, height 459px, 1px `--border`, 6px corners. Inside is the 56px chat header with back chevron, **Assistant**, **Pro · not configured**, and more icon. At y=193, centered 52px charcoal key icon circle; heading **Add an API key to use the assistant**, 20px/26px weight 600; explanation **Track3 sends your questions and a summary of your portfolio to the model endpoint you choose. Nothing is sent until a key is set.** in 13px/18px `--muted`.
3. Full width white pill button **Open AI assistant settings** with chevron links to settings. Small help text: **Settings, AI assistant: endpoint, API key, model and token prices.** The 69px composer inside the card has a disabled 50px pill input **Add an API key to start chatting** and disabled circular send control. No quick actions.
4. More tab bar remains at bottom, with Overview, History, Analytics, More.

## Remaining differences

Capture: `/tmp/fidelity/assistant/nokey.png`; design and capture were viewed side by side.

- The key, back, chevron, and send glyphs use the app icon set and have slightly different strokes from the design SVGs. Layout and visible copy align.

Measured pixel difference: **1.518%** at 390 × 844 CSS px, threshold 16 in any RGB channel.
