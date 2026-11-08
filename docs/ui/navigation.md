# Navigation and selected controls

The desktop sidebar, records rail, iPad rail, and phone tab bar use the same active paint from `.t3-nav-item` in `src/style.css`. The active fill is `--nav-selected-background`: `accent-data` at 12% in light mode and 16% in dark mode. This follows the Terminal UI semantic palette in `terminal-design.md` and the design source's quiet selected tile. The tint also keeps the active icon at foreground contrast. Hover uses `--raised`; inactive icons use `--sidebar-muted`. The focus ring is an inset 2 px ring.

The collapsed desktop and iPad rails are 56 px wide with 40 × 40 px tiles, an 8 px radius, and 4 px between rows. Expanded rail rows are 36 px high. Their first tile follows a 44 px brand block and a 12 px gap. Group dividers are 1 px with 8 px above and below. The Settings group and collapse button stay at the bottom. Active state changes only colour: it never changes row size, border, margin, or padding. The 3 × 20 px `accent-data` indicator is vertically centred, rounded on its right edge, and flush with the rail's left edge. Phone tabs use the same paint and indicator at each tab's left edge while retaining their full width tap targets.

On coarse pointers, the clickable row is 44 px high. Background clipping keeps the painted tile at 40 px collapsed or 36 px expanded, with the same radius and 8 px visual divider margins. The scroll viewport reaches the rail edge so it does not clip the indicator.

Other selections use the same tint and foreground colour:

| Control | Selected state |
| --- | --- |
| Settings menu links and desktop or iOS assistant sessions | Tint and the same 3 × 20 px left indicator |
| Date range presets, range pills, chart mode and source pickers, segmented controls | Tint, with no indicator |
| Settings source tabs and other underlined tabs | Tint and a 3 px `accent-data` underline |
| Pagination current page, filters and history chips, selected snapshot and currency choices | Tint, with no indicator |

The former page specific Overview link height and top padding, records header and group spacing, duplicate wide fidelity rail, and phone page specific tab grids are superseded by this geometry. The dark source's solid `#1c1c20` selected tile is intentionally replaced by the semantic tint so the same rule works in both themes.

The phone date sheet uses the tint for the range track and keeps solid endpoint circles to distinguish the two bounds.

The measured source comparison and remaining visible differences are in [fidelity/navigation.md](fidelity/navigation.md).
