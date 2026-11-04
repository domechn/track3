# Track3 in-app mark

The in-app mark is the two interlocking peaks above the lettering in `src-tauri/icons/icon.png`. It has no `TRACK3` text. `src/components/brand/track-logo-paths.ts` is the geometry source for the reusable inline SVG in `track-logo.tsx`. Both polygons fit a 28 × 28 viewBox, preserve the native icon's proportions, and sit centered vertically. Use `<TrackLogo size={24} />` for a standalone image; use `decorative` when visible Track3 text or a named link already identifies it.

To swap in the next logo, edit only the two polygon point lists in `track-logo-paths.ts`; layout and callers use the same component. Update the derived browser tab assets `public/track3-light.svg` and `public/track3-dark.svg` from those points. The native files under `src-tauri/icons/` are a separate app icon and are not changed by this UI mark.

The first peak uses `hsl(var(--accent-data))`; the second uses `hsl(var(--foreground))`. Desktop and iOS palettes define these tokens: light uses the light data accent and near black foreground, dark uses the dark data accent and near white foreground. The static favicon pair uses those palette values because external SVGs cannot read the app's CSS variables. The favicon's `media` attributes follow the browser color scheme; the inline mark follows the app's selected theme.

The phone About card and wide desktop onboarding keep dark fidelity surfaces even when the app is in light mode. They place a light token surface behind the mark in that case so the near black peak stays legible.

The desktop sidebar, separate fidelity rail, and iPad brand slots link to Overview. The desktop sidebar keeps an independent expand/collapse button at the bottom of the rail. Phone screens have no persistent top-left brand slot; the onboarding guide and About card show the mark.
