# Shell theme color sweep

Checked CSS and TSX under `src/` for hex, `rgb()`, `white`, and `black` in rail, top bar, navigation, header, records toolbar, overview, tab bar, and sheet selectors. `node scripts/theme-raw-colors-guard.mjs` enforces the shell selectors; `src/test/theme-raw-colors-guard.test.ts` runs it in Vitest.

| Remaining raw colors | Reason |
| --- | --- |
| Dark palette values in `src/style.css` and `src/mobile/ios-style.css` | Preserve the approved near black rail and handle colors exactly. The light palette uses semantic tokens. |
| Dark Overview loading palette in `src/style.css` | Preserve the 1440px loading state colors while light loading cards use semantic surfaces and text. |
| Appearance preview thumbnails in `src/style.css` | The previews depict fixed light and dark options, independent of the selected theme. |
| Status colors and chart accents in page styles | Red, green, and blue encode status or data meaning. Rail badges use semantic tokens with the approved dark badge color. |
| Fidelity page styles in `rebalance-desktop.css` and `goals-desktop.css` | Their dense desktop views mount only in wide dark mode; the shared rail rules now use sidebar tokens. The light Goals kinds view has explicit semantic surface overrides. |
| Explicit `.dark` page overrides in Records and mobile Fidelity styles | These reproduce the dark page design; shared light and dark Records text and track surfaces now use semantic values. |
| Toasts, dialogs, and export scrims | They belong to the overlay theme work; the translucent scrims use black alpha on either palette. |
| Two translucent black control shadows marked `theme-exempt` | Alpha shadows give depth on either palette without fixing a surface or text color. |
| Operating system title bar | Tauri uses decorated windows, with no custom title bar CSS. Headless Playwright can check the WebView top bar and `color-scheme` for controls and scrollbars, but cannot inspect the native Windows or Linux title bar. |

Dialog, popover, and toast color rules remain in the separate overlay theme scope.
