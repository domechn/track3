# startup-applock · phone

References viewed: `phone/flows/startup-applock-phone.jpg`, `source/ds/pages/flows-startup.html#applock`, `ds/ds.css`, `ds/ds.js`, `ds/BRIEF.md`, and `core-navigation-map.html`.
Source viewport: 390 × 844 dark; document height 844px. Palette: ground #0d0d0e, card #131217, border #222224, rule #1b1a1f, accent #4a8ad6, positive #5fc39c, negative #ee6a82, warning #d9a441. Public Sans with tabular figures.

## Structure and exact copy

- **div.mid** x0 y0 390×844; font 13px/18px/400; padding 0px 16px 16px; radius 0px; text rgb(255, 255, 255); fill rgba(0, 0, 0, 0). Track3 is locked Unlock to see your portfolio. Unlock with Face ID Use passcode Balances stay hidden until you unlock. Change this in Settings, Security.

## Interactive controls and states

- button.btn.primary x25 y481 340×48; Unlock with Face ID. 15px/18px/500; radius 999px.
- button.btn.ghost x25 y537 340×44; Use passcode. 14px/18px/500; radius 999px.

## Original capture and pixel difference

Authoritative source render: `/tmp/fidelity/flows/design-startup-applock.png`. No matching product app capture or meaningful pixel ratio; reason below.

## Remaining differences

- Native iOS app lock is outside the browser webview and cannot be activated or captured through the Playwright Tauri bridge. Device unlock was not faked.
