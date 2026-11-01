# Phase 6 owner exception

The desktop Appearance page adds a **System** theme choice. Its
`RadioGroupItem value="system"` in `src/components/appearance.tsx` is a
protected UI line under `scripts/ui-refactor-guard.mjs`, even though `system`
is an existing stored theme value. This exception covers that one new UI
choice and its matching addition to
`tests/golden/ui-persistence-inventory.json`. It makes no persistence or stored
format change.

The read-only `src/middlelayers/backup-summary.ts` query and its test are
outside the guard's UI allowlist. They count existing snapshots, current
assets, and transactions for the Backup page and do not write or change formats.

The inventory adds one line for this System choice. The golden inventory edit
requires `domechn` to apply the `format-exception-approved` label to the PR.
The local guard compares the base with `HEAD` and reports this documented
exception on the committed diff.
