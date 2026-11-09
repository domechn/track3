# Backup & data desktop

Approved states: `backup`, `backup-no-folder`, `backup-exporting`, `backup-conflicts`, `backup-restore`, `backup-toast-ok`, `backup-toast-err`. Source: `ds/pages/settings-b-backup.html#<state>`. Shared measured shell and tokens: [settings-b-shell-desktop.md](settings-b-shell-desktop.md).

## Structure and exact content

The title is `Backup & data`; subtitle: `Export, import and automatic local backups. Cloud sync is under Backup & sync.` The 1252px content starts at x 320/y 110 and uses a 723.7px left and 512.3px right column with 16px gaps. The first-row cards are each 536px high; second-row cards each 630px high at y 662.

1. **Export**: seven checkbox rows, in order `History snapshots`, `Data sources`, `Settings`, `Rebalance targets`, `Goals and alerts`, `Assistant chats`, `Blacklist`. The first four are checked. Secondary text and right totals include `1,284 snapshots, 1 Jan 2025 to 31 Oct 2026`, `5 sources and 3 custom assets, without secrets`, `8 assets, tolerance 5%`, `4 rules and 17 triggered events`, `6 sessions, 212 messages`, and `3 hidden entries`. The footer explains that API keys are excluded, shows `Estimated size 4.2 MB`, and has a white `Export JSON` pill. Exporting replaces the size with a dash and disables the button as `Exporting…`.
2. **Import**: description, dashed drop/file box with `track3-export-2026-10-01.json` and `4.1 MB · 1,279 snapshots · 5 sources · exported 1 Oct 2026, 03:00`, three option rows (snapshots/data sources and blacklist checked, configuration off), warning `3 conflicts found`, `Choose another file`, and white `Review conflicts` pill.
3. **Automatic monthly backup**: desktop folder section with on/off toggle, `Next backup: 1 Nov 2026`, folder `~/Documents/Track3 backups` and `Change`, then `Last backup 1 Oct 2026`, `Kept 5 backups`, `Total size 85.1 MB`. Restore list has five rows from 1 Oct back to 1 Jun 2026, each with a size, `track3-backup-YYYY-MM.json`, and `Restore`. The `no-folder` state switches the toggle off, shows `Not set`, dashes for statistics, and a dashed `No backup folder chosen` panel with `Choose folder`.
4. **On this device**: definition rows for `Database SQLite, 18.6 MB`, `Location ~/Library/…/Track3/track3.db`, `Snapshots 1,284`, `Sources 5`, oldest/latest snapshots, 730 snapshots in 2025 and 554 in 2026, 8 rebalance assets, 4 goals/alerts, 6 chats, and 3 blacklist entries; footer has `Show in Finder` and `Copy path`.

`backup-conflicts` opens a centred 640px `Resolve 3 conflicts` dialog. Rows are Binance, OKX, Cash EUR, each with `Keep local` / `Take imported` segmented choices; footer `Cancel` and `Apply and import`. `backup-restore` has a 560px destructive confirmation for `Restore from 1 Oct 2026?` and notes 112 later snapshots would be lost. Success and failure toasts are bottom-right, green or pink, with the file/result count. All import and restore controls must retain the real preview and selection flow.

## Remaining differences

**9 Nov 2026 layout audit:** backup 8.772% at 1280 × 800, dark, against the rendered source HTML (RGB channel difference sum > 60). The dense CNY fixture and working product state differ from the static reference; the page-specific visible differences are listed below.

The live Refresh and date-range controls remain visible in wide Settings; the static reference omits them. This keeps both actions available while viewing Settings.

Settings toasts retain a visible 44px close × target for keyboard and pointer dismissal; the reference toasts omit it.

Captures wait for the real background backup to finish before taking a screenshot. The runtime's “Backing up data” indicator can still appear while a backup is running; the static reference has no such progress state. Toasts keep a visible close × for accessibility, which the reference omits.

The Goals unread dot follows actual alert state; its size and placement differ slightly from the source rail.

Small font, icon, spacing, and colour rendering differences could be matched but are not worth another round.

All seven source renders and captures were viewed side by side. Screenshots: `/tmp/fidelity-desktop/backup/<state>-desktop.png` (`backup-desktop.png` for the default). Full-page pixel ratios, 1600px viewport and 24/255 maximum-channel threshold:

| State | Differing pixels |
| --- | ---: |
| backup | 4.26% |
| backup-no-folder | 3.84% |
| backup-exporting | 4.26% |
| backup-conflicts | 6.29% |
| backup-restore | 5.82% |
| backup-toast-ok | 5.96% |
| backup-toast-err | 6.04% |

- **Export in every state:** The actual JSON export contains historical data and, if selected, a single configuration payload. It cannot separately select History, Data sources, Settings, Rebalance, Goals, Chats and Blacklist as the source's seven checkboxes suggest. The card therefore has only History and Configuration controls, leaving the middle of the 536px card empty. The actual configuration export can include credentials, so the app explicitly warns to review it before sharing rather than showing the source's false “API keys are never written” assurance. Export file size is unknown until written, so the 4.2 MB estimate is a dash. The fixture now has 1,284 actual snapshots.
- **Import in every state:** The source assumes a previously chosen 4.1 MB file and three data-source conflicts. Track3's current import picker immediately opens the real item-level review dialog and does not retain a selected-file summary on the page. The default card shows “No file chosen”; `backup-conflicts` captures the real snapshot item preview after exporting and selecting a valid Track3 file. Its layout and item choices differ from the source's three named source-conflict segmented rows because the import protocol resolves snapshot items, not those source identities.
- **Folder and restore:** Automatic backup currently maintains one latest copy per device, not monthly restore points. The fixture supplies a coherent October 2026 latest copy, so Last backup and the restore row show that date. The actual list shows a `device-a` copy with a Review action, and `backup-restore` captures the real review/import dialog for a selected backup with the header and rail covered by the scrim. The five dated monthly rows, kept-count, total size, next monthly date, and overwrite confirmation would invent data and a destructive restore mode. The `no-folder` state shows the real unset-folder status and picker. The card keeps the source grid and height but its row density is visibly lower.
- **On this device:** The existing backup summary supplies snapshots, assets and transactions. It does not return SQLite byte size, date histograms, chat count, alert count, or the source's Finder path and copy-path actions. The definition list is shorter and has no footer buttons. The path and configured backup folder in the fixture use the fake Tauri bridge's `/e2e` locations, not macOS paths.
- **Exporting and toasts:** `backup-exporting` now disables and labels the real export action while the Tauri save dialog is pending. The green toast comes from a completed real-format export. The error toast comes from choosing a missing file and therefore reports that file-read error, not the source's invented import-failure text. The toast now uses the approved bottom-right placement, width and success/error border treatments.

The remaining differences follow from the backup and import formats described above. The ratios above use the corrected viewport restore capture and include the toast and wide Settings corrections.
