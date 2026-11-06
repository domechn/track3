# Backup & sync desktop

Approved states: `sync`, `sync-setup`, `sync-locked`, `sync-loading`, `sync-testing`, `sync-test-fail`, `sync-rename`, `sync-confirm-use`, `sync-disable`, `sync-forget`, `sync-toast`, and six status popovers (`pop-never`, `pop-syncing`, `pop-ok`, `pop-error`, `pop-locked`, `pop-stopped`). Source: `ds/pages/settings-b-sync.html#<state>`. Shared measured shell and tokens: [settings-b-shell-desktop.md](settings-b-shell-desktop.md).

## Structure and exact content

The title is `Backup & sync`; subtitle: `Optional end-to-end encrypted sync to a bucket you own. Track3 never sees your passphrase.` A top-right status pill changes between `Synced 09:41`, `Sync locked`, and `Not synced`. Normal cards: first row at x 320/y 110, widths 723.7px and 512.3px, height 423px; second row y 549, height 427px; configuration conflicts full width 1252px at y 992, height 288px. Gaps are 16px. Setup uses two 517px cards and a full-width dashed empty panel at y 643.

1. **Connection**: status Connected, Testing or Failed; input fields Endpoint `https://3f9a1c7e2b4d.r2.cloudflarestorage.com`, Region `auto`, Bucket `track3-sync`, Prefix `dom/`, Access key ID masked after `a1b2c3d4e5f60718…`, and a masked secret with an eye button. Source `.v` field values compute to 22px/28px Public Sans, weight 500; empty placeholders are 13px/18px. Path-style addressing toggle is on. The footer has `Test connection` and an inline success (`Connected in 186 ms… Tested 09:42`), progress, or `403 AccessDenied` error. Setup instead shows `https://`, empty credentials, an R2 help banner, and `Not tested yet`.
2. **Passphrase**: green Unlocked pill and rows `Set on 12 Jan 2026`, `Unlocked Until you quit Track3`, `Encryption Key derived on this device`, `Remote sees Ciphertext only`, plus `Asked again after a restart` and an amber non-recovery warning. Locked shows a passphrase input, an incorrect-passphrase error and `Unlock`. Setup shows new/confirm fields, strength bar, non-recovery checkbox, and `Set passphrase`.
3. **Devices**: KPIs `Remote items 4,567`, `Remote size 38.2 MB`, `Devices 2`, `Last upload 09:41`. Rows are `Dom’s MacBook Pro / This device / Today, 09:41 · 312 items`, then `iPhone 15 Pro / Yesterday, 22:07 · 48 items`, each with a pencil rename control. Footer: `Sync now`, `Disable sync`, `Forget remote data`. Rename turns the first name into a focused inline field and `Save`.
4. **What to sync**: five switch rows in order History, Settings, exchange/wallet/assistant secrets, Rebalance targets, Assistant chats; first four on, chats off. A bordered note says goals and alerts stay on this device.
5. **Configuration conflicts**: `3 to resolve` amber pill and three rows: Base currency, Group USD stablecoins, History count. Each shows change times for this device and iPhone 15 Pro, with `Use this device’s value` / `Use the other device’s value`. Loading replaces rows, categories and devices with steady skeleton blocks.

Dialogs are centred on the dimmed page: `Use the other device’s value?`, `Disable sync?`, and `Forget remote data?`. The latter is destructive, cites 4,567 items/38.2 MB and irreversibility. `sync-toast` shows `Sync finished / 312 items uploaded, 0 downloaded.` The status popover is 392px wide, top 68px/right 28px. Never has a first-upload message; syncing has an upload progress bar and elapsed/speed/remaining values; ok shows uploaded/downloaded/device/remote rows; error and stopped group counts `Network timeout 14`, `Upload rejected (403 AccessDenied) 6`, `Checksum mismatch 2`, expandable phase/request/slowest-request diagnostics, `Retry now`, and `Copy diagnostics`; locked has a passphrase field and `Unlock`. Preserve the real sync scheduler, categories, conflict choices, and status details.

## Remaining differences

The owner requested a content-sized passphrase card, a separate Sync status card using real runtime values, and a full-width What to sync row. The source places Passphrase in a stretched 423px row and What to sync beside Devices. The resulting card positions differ because the source layout leaves a large empty area in the passphrase card. The new status card omits remote object size and next scheduled sync because the runtime does not expose them.

The live Refresh and date-range controls remain visible in wide Settings; the static reference omits them. This keeps both actions available while viewing Settings.

Settings toasts retain a visible 44px close × target for keyboard and pointer dismissal; the reference toasts omit it.

At 901–1085px, the Sync page reserves up to 38vw for its toast column. The earlier 35vw width wrapped status text past the 181px toast height cap.

The category switches remain usable during the first device load; the reference replaces them with skeletons. Loaded device and conflict rows remain in place while a later sync refreshes their details, so keyboard focus survives. The toast close × remains visible with a 44px target, including on pending and error toasts; the reference omits it.

The Goals unread dot follows actual alert state; its size and placement differ slightly from the source rail.

Small font, icon, spacing, and colour rendering differences could be matched but are not worth another round.

All 17 authoritative source renders and app captures were viewed side by side. Screenshots: `/tmp/fidelity-desktop/sync/<state>-desktop.png` (`sync-desktop.png` for the default). The table below uses a 1600px viewport and a 24/255 maximum-channel pixel threshold over the whole page; uncovered pixels in a shorter app capture count as different.

| State | Differing pixels |
| --- | ---: |
| sync | 4.44% |
| sync-setup | 4.69% |
| sync-locked | 5.25% |
| sync-loading | 3.66% |
| sync-testing | 4.39% |
| sync-test-fail | 4.49% |
| sync-rename | 4.47% |
| sync-confirm-use | 6.53% |
| sync-disable | 6.31% |
| sync-forget | 6.49% |
| sync-toast | 7.44% |
| sync-pop-never | 6.48% |
| sync-pop-syncing | 6.21% |
| sync-pop-ok | 6.02% |
| sync-pop-error | 6.23% |
| sync-pop-locked | 6.73% |
| sync-pop-stopped | 6.54% |

- **Connection and passphrase:** The fixture stores the approved endpoint, region, bucket, prefix, key ID, path-style switch and category flags using the real encrypted SyncSettings shape. The app masks the entire access key ID instead of showing the source's first 16 key characters; the secret field now has the source's eye control and only reveals its value after an explicit click. The green `Connected` and `Unlocked` pills now reflect real state. The 186 ms test result, last-tested time and “read and write work” message are absent because the current connection test does not retain them after navigation. Explicit Save appears when the user edits connection fields or path style; this preserves Track3's existing credential persistence flow while leaving the default card without the source's inline test result. The passphrase's original “Set on” date is not stored, so it shows a dash. Setup and locked panels retain the real passphrase creation/unlock/recovery controls; their hints and validation errors differ from the authored mockup.
- **Devices and categories:** The app's status report supplies last upload, pushed/downloaded counts and device ID/name/last-upload fields. It does not contain a remote object count, remote byte size, or per-device item counts. The four KPI values therefore use available fields instead of `4,567`, `38.2 MB` and `312/48 items`. The desktop device rows now display the real current-device badge, names, last upload and a rename button; `sync-rename` opens an editable name and Save. The category switches and their captions stay in the approved order. Save settings appears after a category edit because existing behaviour requires explicit persistence. Goals/alerts correctly remain local. Remote device removal is not supported and is not shown.
- **Configuration conflicts and confirm-use:** The `sync`, `sync-confirm-use`, `sync-disable` and unlocked popover fixtures perform concurrent edits against the fake bucket, producing real base-currency and history-count conflict tokens. The card shows both in aligned rows with a truthful `2 to resolve` count, and `sync-confirm-use` opens the real confirmation with the other device's name and consequences. Group USD stablecoins uses local configuration ID `996` and cannot produce a sync conflict. The source's third row and two-device timestamps therefore remain absent. The locked popover cannot load conflicts until unlock.
- **Loading, testing, failure, disable, forget and toast:** The connection's real busy/error copy remains. `sync-loading` holds remote detail queries and shows skeleton rows for devices and conflicts while category switches remain mounted. The desktop Disable button opens a confirmation with the source's consequence list before calling the existing disable action. `sync-forget` shows the actual confirmation with a required typed `FORGET`, because it deletes remote data. Dialog captures dim the entire viewport. `sync-toast` invokes the real Sync now handler and derives “312 items uploaded, 0 downloaded” from its report; a round with no changes says “Up to date”. The toast uses the approved bottom-right placement and width.
- **Six popovers:** The top-right pill and status popover preserve keyboard access, unlock, retry and diagnostics. Connected and Unlocked pills now show the real configured and ready state. The 392px panel, scrim, label and count rows follow the design. The report fixture supplies valid pushed/pulled/device/progress fields; elapsed time, speed and ETA are derived from the real progress and start time. The error fixture now supplies the existing diagnostics shape, and the popover shows real timeout counts, successful and failed PUTs, GET/LIST counts, phase timings and slowest verb/phase timings; Copy diagnostics works. The stopped variant collapses Details. The diagnostics format has no failed-object paths or HTTP status per request, and the scheduler status has no next automatic attempt or per-attempt number. It therefore cannot split the source's 14/6/2 sample into `Network timeout`, `403 AccessDenied`, and `Checksum mismatch` or show its request-path rows; the real diagnostic groups are 14 timeouts and 8 other PUT errors. The source's `09:12` last-good time conflicts with its background device `09:41` upload; the app uses one consistent status time. Remote byte count is unavailable. The locked flow retains the real recovery/unlock actions.

The source's first two card rows measure 423px and 427px, with its grid gap, column widths, card colours and standard text sizes. The Sync status control, date range and Refresh remain accessible at the top right. Remaining differences follow from the unavailable remote metadata and diagnostics described above. The ratios above include the copy, conflict fixture, toast, and wide Settings corrections.
