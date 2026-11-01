# Terminal UI update

The current desktop and iOS interface uses bundled Public Sans for interface text and JetBrains Mono for numeric details. iOS touch controls remain at least 44 pt tall. The shared chart theme reads semantic color tokens in both themes; phone charts use the same tokens through the mobile palette. Trend fills fade vertically. History records stay flat on phone and iPad; Summary metrics and Comparison controls use 1 px inset borders. Loading skeletons pulse except when reduced motion is requested.

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
- Summary shows profit attribution in the Profit card's Attribution tab, which is also available from Overview.
- The Cost basis dashboard replaces the cumulative gains chart, cost composition doughnut, and realized return rates with realized and open P&L amounts, holding period totals, and per-asset bars. The old `CostCharts` component is not mounted on either page.
- Wallets and coin detail use compact source allocation rows in place of treemaps. Wallets shows value and share. Coin detail also shows each source's quantity and opens supported wallet explorer links from the source name.
- Desktop Top Profit lists positive assets and Top Loss lists negative assets, matching the phone grouping.
- The desktop coin price strip shows Price and Total Value. Positions and Profit remain in the detail cards below it.
- The phone Summary profit metrics place the realized amount on its own row, with the other two amounts aligned on the next row. The former two-pair vertical alignment check no longer applies.
- Comparison's mask control stays within 17 px of its card edge, and the quick segments fill the card apart from its inset padding.
- The Wallets source list shows distinct sources. The retained treemap tests continue to check per-tile colors until its frozen golden can be regenerated in phase 7.
- Summary dialog accessibility checks request reduced motion so the animated entry settles before axe measures the dialog.
- ATH shows the current peak, distance, gain needed, and current value; Previous high and Lowest since ATH remain deferred. On phone, the Analytics destination tiles follow the Summary sections to keep the summary results together.
