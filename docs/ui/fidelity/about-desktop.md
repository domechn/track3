# About desktop

Approved states: `about`, `about-checking`, `about-check-error`, `about-update`, `about-downloading`, `about-ready`, `about-later`, `about-toast-ok`, `about-guide`. Source: `ds/pages/settings-b-about.html#<state>`. Shared measured shell and tokens: [settings-b-shell-desktop.md](settings-b-shell-desktop.md).

## Structure and exact content

The title is `About`; subtitle: `Version, updates and links.` At x 320/y 110, the top row is 723.7px + 16px + 512.3px and 314px high. The next row starts at y 440 and is 442px high. `about-later` adds a full-width 62px blue update banner above both rows and shifts them 78px down.

1. **App card**: blue 56px Track3 logo, `Track3` at 22px/28px weight 600, `Version 0.9.4 · Stable channel`. Four definition rows: `Version 0.9.4 (build 2026.10.28)`, `Platform macOS 15, Apple silicon`, `Database SQLite, schema 14`, `Data folder ~/Library/…/Track3`. Footer has `Check for updates` and green up-to-date text, a Checking spinner, an error (`Could not reach the update server… Last successful check: 30 Oct, 18:02`), or an available update message.
2. **Help and links**: `First-run guide` with description and `Replay`; Documentation `docs.track3.dev`, Website `track3.dev`, GitHub `github.com/domechn/track3`, each with an external-link icon.
3. **Open-source licenses**: `214 packages` and a three-column table with React 18.3.1 MIT, Tauri 2.1.0 MIT or Apache-2.0, SQLite 3.46.0 Public domain, Radix UI 1.1.2 MIT, Recharts 2.13.0 MIT, Tailwind CSS 3.4.14 MIT. `View all licenses` outlined pill at the bottom.
4. **What’s new in 0.9.4**: release date 28 Oct 2026, four checked release rows, then 0.9.3 / 12 Oct 2026 and three checked rows, ending with blue `Full release notes`. The listed 0.9.4 claims must reflect actual shipped features rather than invented features.

`about-update` opens a centred update dialog `Track3 0.9.5 is available`, with 62.1 MB macOS download metadata, New/Improved/Fixed lists, and `Skip this version`, `Remind me later`, `Download and install`. `about-downloading` shows a 30% bar, 18.4 of 62.1 MB, 3.2 MB/s, about 1 min 14 s left and `Cancel download`. `about-ready` shows a verified banner and `Restart and install`. `about-guide` opens a smaller confirmation `Replay the first-run guide?` with `Cancel` and `Start guide`. `about-toast-ok` has a green bottom-right `Track3 is up to date` toast. Preserve actual updater/replay actions and focus management.

## Remaining differences

The live Refresh and date-range controls remain visible in wide Settings; the static reference omits them. This keeps both actions available while viewing Settings.

Settings toasts retain a visible 44px close × target for keyboard and pointer dismissal; the reference toasts omit it.

The Goals unread dot follows actual alert state; its size and placement differ slightly from the source rail.

Small font, icon, spacing, and colour rendering differences could be matched but are not worth another round.

All nine source renders and captures were viewed side by side. Screenshots: `/tmp/fidelity-desktop/about/<state>-desktop.png` (`about-desktop.png` for the default). Full-page 1600px pixel ratios at a 24/255 maximum-channel threshold, measured before the Track3 mark change:

| State | Differing pixels |
| --- | ---: |
| about | 2.05% |
| about-checking | 2.00% |
| about-check-error | 2.13% |
| about-update | 3.88% |
| about-downloading | 3.97% |
| about-ready | 3.89% |
| about-later | 3.24% |
| about-toast-ok | 3.27% |
| about-guide | 3.22% |

- **Brand mark:** The app uses the current text-free, two-peak Track3 mark in place of the reference's blue chart tile.
- **App metadata:** The Tauri APIs provide a version and app-data path; the browser fixture identifies Linux x86_64 and `/e2e/app`. The approved source depicts macOS 15, Apple silicon and `~/Library/…/Track3`. The app does not expose the approved `build 2026.10.28` or `schema 14` metadata, so it displays the actual version and `SQLite` without those invented suffixes. The top four-row geometry remains the same while the values differ.
- **Dependency card:** There is no inventory of 214 installed dependency licenses in the product. The source's Recharts entry is not a Track3 dependency. The card shows five real dependencies and their declared package versions from `package.json`, without range markers; its footer opens the project's actual license rather than promising a nonexistent all-dependency license viewer. The package count, rows and footer label differ from the source.
- **Release notes:** The design labels its invented list “What’s new in 0.9.4” and assigns future release dates. The app shows actual supported Track3 features and links to the real GitHub releases page. It omits fabricated version history and unverified change claims, making the second-row right card visibly less dense.
- **Default, checking, error and up-to-date toast:** The updater does not persist a last-successful-check timestamp. The default says “not checked”, `about-checking` invokes the actual updater check, and `about-check-error` shows the caught updater error without the source's 30 Oct time. The up-to-date toast now uses the approved bottom-right placement, width, success border and icon treatment.
- **Update, later, downloading, ready:** The dialog is driven by a valid updater metadata response and preserves real Download/Install and Remind me later actions. The fixture supplies the approved release date and feature categories through the updater's existing date and body fields, and the dialog now renders the six release-note rows at the approved size. The updater does not supply macOS package size, download speed or time remaining before download; the progress bar only shows bytes delivered by updater events, and the test bridge holds the download for the pending state. The ready state confirms the real install call and offers restart. The source's “Skip this version” preference does not exist. The `later` banner can re-open the same update, but uses the version the updater returned.
- **Guide:** The first-run guide replay is the real app event. Its confirmation now uses the approved copy, width, height and button treatment.

The measured 7/5 card grid, card sizes, typography scale and colours match the source. Remaining content differences follow from the metadata and release data described above. The ratios above include the wide Settings strip and package version corrections.
