# Per-snapshot import

Settings → Backup → Review snapshots reads an existing export JSON and verifies
its checksum before comparing it with local history. New snapshots default to
Import, identical snapshots to Skip, and different snapshots to Keep mine.
The old Import button remains the global Ignore/Overwrite shortcut.
The comparison uses the assets and transactions present in the file; local
cost prices are excluded because the export format does not contain them.

Review snapshots imports history only; it does not apply the file's settings.
The per-snapshot path remaps asset and transaction IDs. Replace with file
preserves local cost prices for matching assets. If a file removes an asset
that has a local cost price, that snapshot fails without changing its rows.
Replace also refuses a snapshot containing orphan cost price rows, which can
remain after a legacy Replace import changes asset IDs. Their original asset
cannot be verified, so the review leaves those rows untouched and reports the
failure; resolve the orphan records from a trusted backup before retrying.

Each chosen snapshot is one database transaction. If one fails, earlier
snapshots remain committed, later snapshots are still attempted, and the
review displays every failed snapshot ID. There is no transaction spanning
the whole file.

Replace advances the existing sync snapshot revision for edit publication.
The Feature 2 local edit log is absent from this branch, so this phase does
not add a local audit row.
