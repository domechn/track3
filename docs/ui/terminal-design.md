# Terminal UI update

The current desktop and iOS interface uses bundled Public Sans for interface text and JetBrains Mono for numeric details. iOS touch controls remain at least 44 pt tall. The shared chart theme reads semantic color tokens in both themes; phone charts use the same tokens through the mobile palette. Trend fills fade vertically. Content cards that have no inner padding remain flat on phone and iPad. Loading skeletons pulse except when reduced motion is requested.

This update supersedes the font, chart color, and card surface guidance in the earlier iOS design notes at `docs/ios/DESIGN.md`.

## Intentional layout deviations

- The desktop sidebar starts collapsed at every desktop width. It can still be expanded to show the grouped navigation.
- The desktop date popover aligns to the right edge of its trigger.
- Overview puts the total value trend in the hero card and removes the separate P&L chart. Profit is under Show More.
- iOS shows source status in the Sources card and refresh sheet, without an Overview source teaser. Its Source status button remains available while a refresh runs, as on desktop.
- The phone's 10/30/50/100/All presets are in the date sheet, rather than inline on Overview. Desktop shows them in the top bar.
- During a desktop refresh, the Source status popover shows one progress bar and the previous source results. It does not show live rows for each source because desktop refresh does not receive per-source progress events.
- An empty Overview insight card says that there are no significant changes yet. It does not infer whether AI summaries are enabled, so the design's “AI insights off” screen is deferred; that would require an additional encrypted AI configuration read.
- Holdings shows Amount and Value instead of Value and 7D. The current holdings query does not supply a seven-day asset change.
- The all-time high reference remains an all-time value when a shorter range is selected. The chart can look flat when an earlier high is much larger than recent values.
- The redesigned phone hero uses a 32 px minimum value size in the narrow screenshot fixture, down from 44 px. The wide iOS hero plot has a 160 px minimum, down from 220 px. The hero now has a 1 px inset border, where the prior check required a flat edge. These are the current screenshot geometry checks.
- Source names in the Overview Sources card use an ellipsis when space runs out. Source status popover rows wrap their names, so the former source row ellipsis checks no longer describe this layout.
- Toast viewports use `role="none"` because Radix renders an ordered list containing toast elements with `role="status"`. Axe flags those status roles as invalid direct list children; each toast retains its live status announcement.
