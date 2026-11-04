# Track3 Peaks mark

The owner selected the two-peak mark without lettering. The tall left peak uses the data accent blue (`hsl(213 63% 43%)` in light mode, `hsl(213 63% 56%)` in dark mode). The shorter right peak uses a lighter tint at the same hue and saturation (`65%` and `73%` lightness). Both peaks share a baseline, have rounded joins, and occupy about 78% of the icon width including their edge. The dark and light tiles have 22% corner radii and 1px hairlines at 512px. The iOS source is square and opaque for the system mask.

`src/components/brand/track-logo-paths.ts` holds the only peak coordinates and stroke width. `TrackLogo` consumes it, and `scripts/brand-export.mjs` uses it to write the SVG sources in `docs/brand/`, both favicons in `public/`, all native icon formats, `images/app-icon.png`, and the existing iOS AppIcon catalog. Run from the repo root:

- `logo-mark.svg`: theme-aware mark without a tile.
- `app-icon-light.svg` and `app-icon-dark.svg`: rounded tiles for the README and raster exports.
- `app-icon-ios.svg`: square, opaque dark source for iOS masking.
- `logo-mono.svg`: single-color `currentColor` mark.

```bash
timeout 600 node scripts/brand-export.mjs
timeout 600 node --test scripts/brand-export.test.mjs
```

The export uses the installed Playwright browser and Tauri CLI without network access or new dependencies. It redraws the small Windows PNGs and the 16–32px ICO entries at their native sizes to keep the peaks crisp. `logo-mark.svg` follows the browser color scheme and allows `--peak-primary` / `--peak-tint` overrides. `logo-mono.svg` uses only `currentColor`. Desktop OS icons always use the dark tile. The README picture switches between the dark and light SVG tiles. The iOS catalog is the existing legacy per-size format; it has no iOS 18 appearance entries.

The UI refactor guard denies required brand files outside its allowed paths, including `README.md`, `docs/brand/`, `images/app-icon.png`, `scripts/brand-export*.mjs`, and native icons. The PR needs the owner-applied `format-exception-approved` label to pass that guard.

Use `<TrackLogo size={24} />` for a standalone named mark, or `decorative` when nearby visible text already says Track3. The sidebar, iPad rail, onboarding, and About pages use this component. The phone About card and wide desktop onboarding retain their light backing behind the inline mark on fixed dark surfaces.
