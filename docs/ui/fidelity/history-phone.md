# History · phone fidelity specification

Source: `phone-long/records/history-phone-long.jpg`, all `phone/records/history*.jpg` states, and the HTML/CSS/JS under `/home/ubuntu/.hermes/projects/track3-design/source/ds/`. Measurements are Chromium `getBoundingClientRect` and `getComputedStyle` at a 390 × 844 CSS pixel viewport.

## Structure and measurements

- Shell: `--ground` #0d0d0e; Public Sans, tabular numbers, body 13/18 regular. Main content has 16 px side margins, 14 px top padding. Fixed bottom navigation is 60 px high with Overview, History, Analytics, More; History is white, other items `--faint` #9b9da3.
- Header at x16 y14: “History” 22/28 weight 600. At y44, 13/18 `--muted` #b4b6bc: “1,284 snapshots, one per refresh. Latest 31 Oct, 09:41.” The count is emphasized. Empty state reads “No snapshots saved yet”.
- Chips at x16 y90: 44 px high, 8 px gaps, 999 px radius, 14 px horizontal padding, 13/18 weight 500. Clock “All time” is selected with #1c1c20 fill; filter icon “Status: all” and “Edited” are outlined `--control` #3a3a3e. Tapping the chips opens filters; Edited applies the edited filter.
- Snapshot card at x16 y148, width 358, surface `--surface` #131217, border `--border` #222224, radius 6. Header inner x33 y165, height 44 including 16 top and 8 bottom padding: “Snapshots” 15/20 weight 600 and “One per refresh, newest first” 12/18 `--faint`, right aligned.
- Each snapshot is a 64 px two-line row with 16 px side padding and a `--rule` #1b1a1f upper divider. First line 13/18: bold date such as “31 Oct”, `--muted` time “09:41”, optional blue “Edited” pill, then right aligned 13/18 weight 500 total “$763,809.27”. Second line 12/18: “8 assets · 5 of 5 sources” at left and a signed amount plus signed percent at right, e.g. “+$1,533.16 +0.20%”. Gains use `--positive` #5fc39c; losses `--negative` #ee6a82. A partial snapshot shows its actual refreshed source count; a retry flag remains where available.
- The design lists 50 newest rows per page and then “1–50 of 1,284”, a white-text “Load 50 more” pill, and a note about swipe delete, 50 rows per page, and History count in Settings. Pagination queries one bounded page of 50 on the phone; its button says “Next 50” and later pages expose “Previous 50” so the first page remains reachable. It resets to the wide layout's selected page size after a resize. Dollar change and percent are separate spans with a 6 px gap.
- The light theme resolves page, card, tab, chip, filter-sheet, delete-sheet and undo-toast colours from theme tokens. Light title, selected chip, filter controls and selected tab each retain at least 4.5:1 text contrast.

## States and interactions

- Filter sheet: scrim rgba(0,0,0,.55), surface bottom sheet with 16 px top corners at y312, 16 px side padding. Grab handle x177 y321, 36 × 4 px, #44454b; “Filter history” at y339 with 18/24 weight 600; count line 12/18. Range segmented control (7 days, 30 days, 90 days, All), From and To date fields (“Any date”), Show segmented control (All, Issues 2, Edited 1), white “Show 1,284 snapshots” pill, Reset. Segment labels and Reset use weight 500 and tabular figures; the apply text is 144 px wide. Date and status changes apply on submit; Reset clears them. The product's complete/partial/edited query filters are the real status options.
- Swipe: the row moves 96 px left to expose a dark red delete action and trash icon. Delete confirmation is a bottom sheet with a 36 × 4 px #44454b handle at x177 y615: “Delete this snapshot?”, a date/value/assets summary, explanation of chart and following change at y696, Cancel and outlined red “Delete snapshot” with 18 px line height. Undo is a raised toast above bottom navigation showing a check, “Snapshot deleted” at x63 y720 with 18 px line height, date at x63 y739 in muted text with 18 px line height, and an Undo pill at x292 y719 sized 67 × 36 with faint text and 16 px line height. The Undo icon starts at x304 y728, and its text starts at x318 y731. The check sits at the top of the copy block.

## Shared verification fixture notes

- The sync feedback scene waits for its first stored device object, inserts a real test snapshot, then expects “Pushed 1” for the next sync. That removes a race with background writes and makes the count follow the new object.
- The desktop light-theme scene waits for the `html.light` class and checks that the existing rail is hidden. CSS hides the rail without removing its DOM node.
- Empty: disabled chips; card holds “No snapshots yet”, “Track3 saves one snapshot each time you refresh your sources.”, white “Refresh now” pill, and a local storage/History count note. Loading: eight 64 px skeleton rows and a skeleton pager inside the normal card, no shimmer. An error belongs inside the card with Retry and last good data if known.
- Tapping a row opens the History detail surface. Quote colour reverses gain/loss colours. The supplied History states have no hide-values control; the existing comparison-page masking stays in its own route.

## Product data constraints

The design invents 1,284 snapshots and source refresh names/counts. The existing stored snapshot and partial tables supply actual counts, totals, change, asset count, edited status, and partial source counts. Complete snapshots do not store a count of configured sources or a per-source refresh status, so the UI must avoid claiming “5 of 5” without that data. The source note's “History count” control does not exist in Settings: “Count of Results” sets the app's initial date range, while the phone's 50-row page size is fixed. The app says only what its History page actually does. The fixture uses real `assets_v2`, `history_snapshots`, `snapshot_partial`, and `snapshot_edit_log` shapes.

“All time” stays inside the app's selected date range. The fidelity fixture sets the existing query-size preference to 2,000 so that range includes its 1,284 stored snapshots. The phone list retains at most 50 rows after Next 50; that control advances to the next page.

## Remaining differences

**9 Nov 2026 layout audit:** history 9.084% at 390 × 844, dark, against the approved phone JPEG (RGB channel difference sum > 60). The dense CNY fixture and working product state differ from the static reference; the page-specific visible differences are listed below.

The no-snapshot card now uses the source's dashed treatment, title, hint, and action. Its note describes the app's actual fixed page size rather than a setting that does not exist.

The HTML source pages are present at `/home/ubuntu/.hermes/projects/track3-design/source/ds/pages/`. On 8 Nov 2026 they were re-rendered in Chromium with scrollbars hidden into `/tmp/ui43-source/`; branch captures before this merge are preserved in `/tmp/ui43-captures-phone/`. The source list card begins at (16, 148) with width 358 px and its card background is `rgb(19, 18, 23)` by `getBoundingClientRect()` and `getComputedStyle()`. Both images use a 390 × 844 viewport. A pixel differs when its summed absolute RGB difference exceeds 48. The source long page is 3687 px; the app's fixed shell scrolls inside its main area, so a `fullPage` screenshot captures only the 844 px viewport and cannot serve as a like-for-like long-page comparison. The viewport ratios below describe those captures.

| State | Source vs app difference |
| --- | ---: |
| First screen | 1.20% |
| Filter | 1.51% |
| Swipe | 1.17% |
| Delete confirmation | 1.52% |
| Undo | 1.13% |
| Empty | 2.36% |
| Loading | 3.11% |

Before the latest History adjustments, the 8 Nov 390 × 844 viewport captures in `/tmp/fidelity/history/` versus the saved source render in `/tmp/fidelity/source-review/` measured 3.37% populated, 1.72% delete, 4.92% empty, 5.15% loading, 1.50% filter, 3.33% swipe, and 2.79% undo at the same threshold. The guarded source test measured the loading list at x17, y193, 356 × 520 px. Its fresh render had different text rasterization from the saved design render and differed from the app by 5.44%.

The no-snapshot card uses the shared title, hint, and action inside the source's dashed panel. Its decorative, screen-reader-hidden icon is hidden only on phone History because the design has no icon; other empty states keep it. The saved-data and refresh flows are unchanged.

Remaining visible differences, with product reasons:

- The shared selected tab uses the app-wide tinted background and indicator. The static source uses an untinted active icon. Keeping the same tab treatment across routes preserves the current navigation system; it contributes to the populated, swipe, empty, and loading ratios.
- Detail asset rows use the current shared AssetIcon marks instead of the older source artwork; ticker and type still come from the stored snapshot.
- The initial loading frame says “Loading…” in the subtitle; the static source shows its invented count and latest date before loading has finished. The product has not queried those values yet, causing the loading viewport to exceed 3%.
- Complete rows show “8 assets” without “5 of 5 sources”; the complete snapshot has no stored per-source refresh count. The retry note on 22 Oct is absent for the same reason: retry history is not stored with a complete snapshot. Partial rows use the actual stored source count.
- The filter shows actual counts from bounded status queries: Issues 1 and Edited 1 for this fixture. The design's Issues 2 includes a retry on a complete snapshot; retry history is not stored, so the product cannot count it. While a new filter range is loading, the last available count remains visible. The count/latest date are unavailable before the initial query completes.
- Some invented source row change amounts do not equal the difference between adjacent stored totals, beginning on 21 Oct. The app shows the calculated change from actual adjacent snapshots.
- The source's History hint and empty note direct the user to change “History count” in Settings. No such page-size setting exists; the app's hints describe the real fixed 50-row phone page and how a snapshot is saved.
- The pager says “Next 50” where the design says “Load 50 more”. The product replaces the bounded 50-row page when pressed, so “Load 50 more” would incorrectly promise appended rows.
- History keeps the shared sync lock/status control above the page so the existing unlock and sync flow remains reachable and its state visible; the reference has no sync control.
