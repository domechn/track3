# update-toasts desktop design specification

Approved image: `desktop/flows/update-toasts-desktop.jpg`. Authoritative source: `source/ds/pages/flows-update.html#toasts`, `flows.css`, `ds.css`, `ds.js`, and `lib.js`. Image and source render inspected at 1600 px in dark theme.

## Structure and measured geometry

Full-page size: **1600 × 900 px**. The standard desktop rail is 56 px wide; the main area has 28 px horizontal and 20 px top padding. The design uses a 12-column grid with a 16 px gap; full/eight/four-column cards are 1488/987/485 px wide. Cards use 20 px padding, a 1 px border and 6 px radius.

| Block or component | Bounds | Opening copy |
| --- | --- | --- |
| `div.head` | (84, 20) 1488 × 74 px | Flows · UpdateUpdate toastsBottom-right on desktop. Only one update toast exists at a time; each replaces the previous. |
| `div.grid.g12` | (84, 110) 1488 × 254 px | AvailableTrack3 2.4.0 is availableYou have 2.3.1.See what’s newLaterStays until dismissed. Appears once per version after the dail |
| `section.card.s3` | (84, 110) 360 × 254 px | AvailableTrack3 2.4.0 is availableYou have 2.3.1.See what’s newLaterStays until dismissed. Appears once per version after the dail |
| `div.toast` | (105, 163) 318 × 88 px | Track3 2.4.0 is availableYou have 2.3.1.See what’s newLater |
| `section.card.s3` | (460, 110) 360 × 254 px | Downloading in backgroundDownloading 2.4.038.0 of 84.2 MB · 45%ShowShown after Hide. Updates in place; no sound or motion beyond t |
| `div.toast` | (481, 163) 318 × 100 px | Downloading 2.4.038.0 of 84.2 MB · 45%Show |
| `section.card.s3` | (836, 110) 360 × 254 px | ReadyUpdate readyRestart to finish installing 2.4.0.Restart nowLaterStays until dismissed. Later installs on next quit. |
| `div.toast.ok` | (857, 163) 318 × 88 px | Update readyRestart to finish installing 2.4.0.Restart nowLater |
| `section.card.s3` | (1212, 110) 360 × 254 px | FailedUpdate failedConnection lost at 38.0 of 84.2 MB.Try againDetailsDetails opens the failed dialog. 2.3.1 keeps working. |
| `div.toast.err` | (1233, 163) 318 × 88 px | Update failedConnection lost at 38.0 of 84.2 MB.Try againDetails |

## Exact visible copy, order, type and colour

The source uses Public Sans with tabular numerals. Tokens: ground `#0d0d0e`, card `#131217`, raised `#1b1a20`, border `#222224`, rule `#1b1a1f`, control `#3a3a3e`, text `#fff`, muted `#b4b6bc`, faint `#9b9da3`, accent `#4a8ad6`, positive `#5fc39c`, negative `#ee6a82`, warning `#d9a441`. Icons are 18 px stroked SVG by default. Values are USD with comma groups and two decimals, signed changes use + or −, percent values use the precision shown below, dates use abbreviated month names, and source times use 24-hour `HH:MM`.

| Copy | Bounds | Font (size/line height weight) | Computed colour |
| --- | --- | --- | --- |
| Flows · Update | (84, 20) 1472 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Update toasts | (84, 42) 1472 × 32 px | 26px/32px 600 | `rgb(255, 255, 255)` |
| Bottom-right on desktop. Only one update toast exists at a time; each replaces the previous. | (84, 76) 1472 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Available | (105, 131) 318 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Track3 2.4.0 is available | (152, 176) 224 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| You have 2.3.1. | (152, 196) 89 × 14 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| See what’s new | (152, 220) 87 × 18 px | 12px/18px 600 | `rgb(255, 255, 255)` |
| Later | (253, 220) 31 × 18 px | 12px/18px 500 | `rgb(180, 182, 188)` |
| Stays until dismissed. Appears once per version after the daily check. Later hides it until the next launch. | (105, 307) 318 × 36 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Downloading in background | (481, 131) 318 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Downloading 2.4.0 | (528, 176) 224 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 38.0 of 84.2 MB · 45% | (528, 196) 132 × 14 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Show | (528, 232) 31 × 18 px | 12px/18px 600 | `rgb(255, 255, 255)` |
| Shown after Hide. Updates in place; no sound or motion beyond the bar. | (481, 307) 318 × 36 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Ready | (857, 131) 318 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Update ready | (904, 176) 224 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Restart to finish installing 2.4.0. | (904, 196) 187 × 14 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Restart now | (904, 220) 69 × 18 px | 12px/18px 600 | `rgb(255, 255, 255)` |
| Later | (987, 220) 31 × 18 px | 12px/18px 500 | `rgb(180, 182, 188)` |
| Stays until dismissed. Later installs on next quit. | (857, 307) 318 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Failed | (1233, 131) 318 × 20 px | 15px/20px 600 | `rgb(255, 255, 255)` |
| Update failed | (1280, 176) 224 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| Connection lost at 38.0 of 84.2 MB. | (1280, 196) 208 × 14 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Try again | (1280, 220) 54 × 18 px | 12px/18px 600 | `rgb(255, 255, 255)` |
| Details | (1348, 220) 40 × 18 px | 12px/18px 500 | `rgb(180, 182, 188)` |
| Details opens the failed dialog. 2.3.1 keeps working. | (1233, 307) 318 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |

## Interactive parts and state variants

This specification covers the **update-toasts** state. Segmented controls, pills, source rows, table links, buttons, calendar choices, popovers, dialogs, toasts, dismissals and keyboard focus are actionable only where present in the actual product. The source's visible controls are:

- a: `Overview` at (10, 62) 35 × 36 px.
- a: `Summary` at (10, 119) 35 × 36 px.
- a: `Wallets` at (10, 157) 35 × 36 px.
- a: `Comparison` at (10, 195) 35 × 36 px.
- a: `Cost basis` at (10, 233) 35 × 36 px.
- a: `History` at (10, 290) 35 × 36 px.
- a: `Rebalance` at (10, 328) 35 × 36 px.
- a: `Goals & alerts` at (10, 366) 35 × 36 px.
- a: `Assistant` at (10, 404) 35 × 36 px.
- a: `Settings` at (10, 852) 35 × 36 px.
- a: `See what’s new` at (152, 220) 87 × 18 px.
- a: `Later` at (253, 220) 31 × 18 px.
- a: `Show` at (528, 232) 31 × 18 px.
- a: `Restart now` at (904, 220) 69 × 18 px.
- a: `Later` at (987, 220) 31 × 18 px.
- a: `Try again` at (1280, 220) 54 × 18 px.
- a: `Details` at (1348, 220) 40 × 18 px.

Loading preserves the containing card frame; error and partial states keep last-good data and show a reason plus recovery action; empty states keep the frame with an explicit next step. Overlays and popovers do not move the underlying grid. UI state does not add persisted fields. Any product-absent behavior is recorded below after comparing the real capture.

## Remaining differences

- Measured pixel difference: **7.42%** using the review gate's RGB-difference sum greater than 60. Source 1600 × 900; app 1600 × 1523. [App capture](/tmp/fidelity-desktop/update/update-toasts-desktop.png); [rendered design](/tmp/fidelity-desktop/design-flows/update-toasts.png). The ratio uses the overlapping top-left rectangle; the dimensions show any size mismatch.
- The reference is a four-column visual catalogue of update notifications, not a product route. The capture shows the real available-update toast over Overview; the catalogue grid, four samples and page height are absent by design.
