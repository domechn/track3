# Overlay theme tokens

No raw colours in overlay surfaces. Dialogs, editors, popovers, toasts, sheets, scrims, backdrops, tooltips, and menus must read semantic tokens so they follow Light, Dark, and System appearance.

| Role | Token |
| --- | --- |
| Surface and text | `hsl(var(--popover))`, `hsl(var(--foreground))` |
| Recessed field and edge | `hsl(var(--sunken))`, `hsl(var(--input))` |
| Border, rule, control, and faint text | `hsl(var(--border))`, `hsl(var(--rule))`, `hsl(var(--control))`, `hsl(var(--faint))` |
| Primary action | `hsl(var(--primary))`, `hsl(var(--primary-foreground))` |
| Link and information | `hsl(var(--accent-data))` |
| Error and warning | `hsl(var(--negative))`, `hsl(var(--warning))` |
| Scrim and shadow | `var(--overlay-scrim)`, `var(--shadow-overlay)` |
| Dialog and button corners | `var(--radius-overlay)`, `var(--radius-pill)` |
| Keyboard focus | `2px solid hsl(var(--ring))`, `1px` offset |

The locked phone sheet on Overview retains its `16px` top corners. Its full-screen body scrim and the separate Sync Settings sheet backdrop use `--overlay-scrim` at `.55` opacity. Sheet handles use `--sheet-handle` so their dark appearance stays consistent.

The overlay colour guard in `src/components/overlay-theme-tokens.test.ts` scans CSS declarations. A fixed overlay colour requires `/* theme-exempt: reason */` on the same line. The shell colour guard in `scripts/theme-raw-colors-guard.mjs` accepts that comment immediately before a CSS declaration (or on the same or previous line for TSX utilities). Use the format required by every guard that covers the rule. Current exemptions are the onboarding illustration palette, which has explicit light and dark artwork values, and black pixels in SVG masks, which define a shape and do not appear on screen.

Fixed colours that remain outside overlay surfaces include the exported Track3 brand art in `docs/brand/app-icon-light.svg` (`#FFFFFF`, `#E2E2E6`), chart series colours in `src/components/finance-charts.tsx` (`#6366f1`, `#06b6d4`), and exchange logo art such as `src/assets/icons/binance-logo.svg` (`#f3ba2f`) and `src/assets/icons/backpack-logo.svg` (`#E33E3F`). These encode brand identity or distinguish data series.

The Data-sources, Language, Currency, and desktop coin-detail pages now use the same surface and text tokens in both themes. The Language appearance preview and colour preview retain fixed sample palettes because they illustrate how each selected theme and quote-colour choice will look. The restored `tests/e2e/public-ip-contrast.ts` helper is currently unused; it stays in the tree to preserve the protected UI guard's path rules.

The desktop Comparison quick-range selection now uses foreground text on the accent tint, giving about 14.7:1 contrast in Light appearance. The desktop Coin range and transaction segments use the shared range track and selected fills so the active option remains visible in Dark appearance.
