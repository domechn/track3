# Track3 UI design system

The shared light and dark tokens live in `src/style.css`; iOS overrides and safe area tokens live in `src/mobile/ios-style.css`. Use the semantic Tailwind names from `tailwind.config.js` in components: `background`, `foreground`, `card`, `popover`, `raised`, `sunken`, `border`, `rule`, `control`, `accent-data`, `positive`, `negative`, and `warning`. Charts resolve these names through `src/utils/chart-theme.ts`. Use `gain` and `loss` for values affected by the user's quote color setting. Public Sans is the interface font; JetBrains Mono is for aligned numeric detail. Both are bundled.

The desktop shell keeps a 56 px collapsed rail and a 216 px expanded rail. `src/components/sidebar/index.tsx` reads `--sidebar-collapsed-width` and `--sidebar-width`, and `src/components/index/index.tsx` offsets the main content to match. The top bar holds the date and refresh controls. Rail expansion stays in memory.

The iOS shell in `src/mobile/components/index/` uses a bottom tab bar on phones and a side rail on wider screens. `src/mobile/components/mobile/mobile.css` owns those layouts; `src/mobile/ios-style.css` supplies the safe area insets. Keep the existing hash route targets and use at least 44 px touch controls on iOS.

The older `docs/ios/DESIGN.md` describes the original palette, fonts, and type scale. For the current UI, use Public Sans for interface text and JetBrains Mono for aligned numbers on both desktop and iOS. The retained phone treemap resolves `--ios-chart-1` through `--ios-chart-6` at runtime; keep all six defined while that component exists. For iOS type, use `ios-large-title`, `ios-footnote`, and `ios-money` where those styles fit; the former `ios-title`, `ios-headline`, `ios-body`, `ios-subhead`, and `ios-caption` utilities are no longer part of the stylesheet.

Screen specific layout notes and intentional differences from the design bundle are recorded in [terminal-design.md](terminal-design.md).
