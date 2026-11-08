# Overview configured sync phone state

Reference: the `#sync` state of `source/ds/pages/core-overview.html`, rendered at 390 × 844 in dark mode as `/tmp/fidelity/overview/design-overview-sync.png`. Its source CSS and computed styles govern the measurements below. The associated Overview page is specified in [overview-phone.md](overview-phone.md).

## Ordered structure and exact presentation

The 44px header sync button opens a 360 × 352px surface popover at **x=−34, y=62** in the supplied HTML. It has 16px padding, 10px corners and 13px body text. The phone viewport clips its left 34px. Its first row is `Backup & sync` (15/20, 600) and a green `Up to date` pill (12px, 20px tall, `--positive #5fc39c` on `#1b2828`).

Five 40px list rows follow, each with a muted left label and right-aligned value: `Last upload` / `09:41 · this device`; `Destination` / `Cloudflare R2 · encrypted`; `Devices` / `2 · Dom's MacBook, iPhone`; `Waiting to upload` / `0 changes`; `Errors` / `None`. The rows use a 12px grid gap and hairline dividers. A 12/18 muted line reads `Last run took 2 s. Next check in 5 min.` The final row contains `Details`, `Copy diagnostics` and `Sync now`; buttons are 44px high with pill radius. Details opens diagnostics, Copy diagnostics writes them to the clipboard, and Sync now requests a sync.

The sample source assumes two devices and an already completed Cloudflare R2 sync. The product keeps encrypted connection settings in its existing configuration and derives run state, devices, errors and progress from the sync runtime. The E2E fixture uses a local `FakeS3` and fake credentials with that real persisted configuration shape. It unlocks with a demo passphrase, runs a first sync to upload the stored portfolio, then runs a second sync and waits for its clean "Everything is up to date" result before capture. It does not insert a fabricated run report or second device.

## Capture and pixel difference

App: `/tmp/fidelity/overview/overview-sync-phone.png`. Source: `/tmp/fidelity/overview/design-overview-sync.png`. Both are 390 × 844px. **10.260%** of pixels differ by more than 20 in one RGB channel. The images were viewed side by side and compared through a Chromium canvas.

## Remaining differences

- The refreshed 8 Nov 2026 390px viewport pixel diff is **10.260%** (any RGB channel
  differs by more than 20). The same saved source and refreshed app capture
  are 390 × 844 px.
- The source's connected green price and sync dots are replaced by the phone
  header's actual off price state for the selected snapshot and one neutral
  cloud sync button. The price state is available by tapping the amount.
  Tapping sync shows its relative status in the sheet; the source does not
  have that text.
- The reference places a 360px popover partly off the phone viewport. The app uses its focus-managed, in-bounds sync sheet, so its position and shape remain different for accessibility.
- The design assumes two named remote devices, a pending-change count, and a next-check time. The fake S3 bucket has only this device and the runtime does not expose the other counts; the sheet reports its actual clean result and last-sync time. The reference's five diagnostic rows and action layout therefore differ from the real status sheet. Cloud and status glyph strokes also differ.
