# Update flow · phone

Authoritative source: `source/ds/pages/flows-update.html#toast`, `#notes`, `#downloading`, `#ready`, and `#failed`, with `ds/ds.css`, `ds/ds.js`, `ds/BRIEF.md`, and the navigation map. No approved phone JPG was supplied for this flow. The source uses the 390px dark phone shell, Public Sans 13px/18px body, 16px page inset, `--ground #0d0d0e`, `--surface #131217`, `--border #222224`, `--accent #4a8ad6`, `--positive #5fc39c`, `--negative #ee6a82`, and `--warning #d9a441`.

## Structure and exact copy

Each state overlays the same portfolio shell. The toast state has an information toast: `Track3 2.4.0 is available`, `You have 2.3.1.`, `See what’s new`, `Later`. The notes state is a centered dialog: `Track3 2.4.0 is available`, `You have 2.3.1 · released 29 Oct 2026 · 84.2 MB`, headings `New`, `Fixed`, `Under the hood`, with bullets for per-source refresh progress, excluded-source totals, grouped sync errors, History delete/undo, cost basis CSV tax year, and schema 14 to 15 migration after backup. Footer buttons are `Skip this version`, `Later`, and `Download and install`.

The downloading dialog says `Downloading Track3 2.4.0`, `You can keep using Track3 while this downloads.`, `38.0 of 84.2 MB`, `45% · 6.2 MB/s · about 7 s left`, with a 45% progress bar and `Hide` and `Cancel download` actions. The ready dialog has a positive check icon, `Ready to restart`, the verified download and backup/migration description, an information banner about installing on next quit, and `Later` / `Restart now`. The failed dialog has a negative alert icon, `Update failed`, a connection-lost description naming 38.0 of 84.2 MB, a monospace diagnostic block, and `Copy details`, `Download manually`, and `Try again` actions.

The independent toast catalogue in `#toasts` shows available, background download, ready, and failed notifications with replacement and dismissal rules. Dialogs and buttons are keyboard and touch accessible in the source design.

## Original capture and pixel difference

Authoritative HTML captures at 390 × 844: `/tmp/fidelity/update/design-toast.png`, `/tmp/fidelity/update/design-notes.png`, `/tmp/fidelity/update/design-downloading.png`, `/tmp/fidelity/update/design-ready.png`, and `/tmp/fidelity/update/design-failed.png`. The notes dialog measures x0, y184, 560×476px; downloading x0, y316.5, 560×211px; ready x0, y282.5, 560×279px; failed x0, y276.5, 560×291px. Each uses 24px padding and 10px radius. The 560px width clips at a 390px viewport, so the source itself has no complete phone layout. No matching approved phone JPGs were delivered. There is no matching mobile app capture or meaningful pixel ratio.

## Remaining differences

- The iOS app in `src/mobile/App.tsx` does not mount the Tauri updater or expose desktop download/install events. The existing updater is mounted in the desktop app only. A phone update toast, release notes dialog, download progress, ready prompt, or failed download cannot be driven from real iOS product state within the allowed UI-only scope. None was faked.
- The source update dialogs use a fixed 560px width at a 390px phone viewport, clipping the dialog content and actions. There is no approved phone update reference to resolve this source layout.
