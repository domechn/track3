# startup-migrate desktop design specification

Approved image: `desktop/flows/startup-migrate-desktop.jpg`. Authoritative source: `source/ds/pages/flows-startup.html#migrate`, `flows.css`, `ds.css`, `ds.js`, and `lib.js`. Image and source render inspected at 1600 px in dark theme.

## Structure and measured geometry

Full-page size: **1600 × 900 px**. This is a full-screen migration view with no app rail or dashboard grid. A 480 px content column starts at x=560. It contains the version row, 26/32 px heading, explanatory paragraph, then a 438 px raised progress card with a title/count row, progress bar and five ordered steps. A final 12/18 px hint sits below the card.

| Block or component | Bounds | Opening copy |
| --- | --- | --- |
| `div.mid` | (0, 0) 1600 × 900 px | Track3 2.4.0 Updating your database This version stores data in a newer format (schema 14 to 15). It runs once and keeps your hist |
| `div` | (560, 168) 480 × 536 px | Track3 2.4.0 Updating your database This version stores data in a newer format (schema 14 to 15). It runs once and keeps your hist |

## Exact visible copy, order, type and colour

The source uses Public Sans. Tokens: ground `#0d0d0e`, card `#131217`, raised `#1b1a20`, border `#222224`, rule `#1b1a1f`, control `#3a3a3e`, text `#fff`, muted `#b4b6bc`, faint `#9b9da3`, accent `#4a8ad6`, positive `#5fc39c`, negative `#ee6a82`, warning `#d9a441`. Completed steps have check glyphs; the current step and progress bar are blue; future steps are faint. The sample file path, schema numbers and timestamp must come from actual migration data.

| Copy | Bounds | Font (size/line height weight) | Computed colour |
| --- | --- | --- | --- |
| Track3 2.4.0 | (608, 177) 76 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Updating your database | (560, 228) 480 × 32 px | 26px/32px 600 | `rgb(255, 255, 255)` |
| This version stores data in a newer format (schema 14 to 15). It runs once and keeps your history. | (560, 266) 480 × 38 px | 13px/19px 400 | `rgb(180, 182, 188)` |
| Migrating snapshots | (581, 345) 126 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 19 of 31 · 61% | (926, 345) 93 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Backup saved | (613, 401) 406 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Documents/Track3/backups, 31 Oct 09:44 | (613, 419) 406 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Schema updated | (613, 458) 406 × 18 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| 14 to 15 | (613, 476) 406 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Migrating snapshots | (613, 515) 406 × 18 px | 13px/18px 600 | `rgb(255, 255, 255)` |
| 1 Oct to 19 Oct done | (613, 533) 406 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Rebuilding indexes | (613, 572) 406 × 18 px | 13px/18px 500 | `rgb(155, 157, 163)` |
| Checking integrity | (613, 616) 406 × 18 px | 13px/18px 500 | `rgb(155, 157, 163)` |
| Keep Track3 open. This usually takes under a minute. | (560, 686) 480 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |

## Interactive parts and state variants

This specification covers the **startup-migrate** state. It has no interactive controls. The steps and 61% bar show progress while the app remains unavailable. The completion variant proceeds to the app; no popover, toast or dashboard is visible during migration.

## Remaining differences

- Measured pixel difference: **9.24%** using the review gate's RGB-difference sum greater than 60. Source 1600 × 900; app 1600 × 977. [App capture](/tmp/fidelity-desktop/startup/startup-migrate-desktop.png); [rendered design](/tmp/fidelity-desktop/design-flows/startup-migrate.png). The ratio uses the overlapping top-left rectangle; the dimensions show any size mismatch.
- The reference shows a native pre-app migration progress sequence with named steps. The existing tauri bridge starts after migration has completed and exposes no migration progress state, so the capture shows the real portfolio reading skeleton during a delayed data query. Its rail, four cards and copy differ from the migration screen; the native pre-app composition remains unverified.
