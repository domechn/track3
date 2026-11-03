# startup-migrate · phone

References viewed: `phone/flows/startup-migrate-phone.jpg`, `source/ds/pages/flows-startup.html#migrate`, `ds/ds.css`, `ds/ds.js`, `ds/BRIEF.md`, and `core-navigation-map.html`.
Source viewport: 390 × 844 dark; document height 844px. Palette: ground #0d0d0e, card #131217, border #222224, rule #1b1a1f, accent #4a8ad6, positive #5fc39c, negative #ee6a82, warning #d9a441. Public Sans with tabular figures.

## Structure and exact copy

- **div.mid** x0 y0 390×844; font 13px/18px/400; padding 0px 16px 16px; radius 0px; text rgb(255, 255, 255); fill rgba(0, 0, 0, 0). Track3 2.4.0 Updating your database This version stores data in a newer format (schema 14 to 15). It runs once and keeps your history. Migrating snapshots19 of 31 · 61% Backup savedDocuments/Track3/backups, 31 Oct 09:44Schema updated14 to 15Migrating snapshots1 Oct to 19 Oct doneRebuilding indexesChecking integrity Keep Track3 open. This usually takes under a minute.
- **div.card** x16 y304 358×338; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Migrating snapshots19 of 31 · 61% Backup savedDocuments/Track3/backups, 31 Oct 09:44Schema updated14 to 15Migrating snapshots1 Oct to 19 Oct doneRebuilding indexesChecking integrity

## Interactive controls and states


## Original capture and pixel difference

Authoritative source render: `/tmp/fidelity/flows/design-startup-migrate.png`. No matching product app capture or meaningful pixel ratio; reason below.

## Remaining differences

- The database migration happens in Tauri before the webview bridge is available. A Playwright fixture cannot pause the native startup at this screen. No fake migration state was added.
