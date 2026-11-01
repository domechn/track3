# 0.9.4 compatibility harness

Run `node scripts/compat/run-094.mjs` from the repository root. The runner uses the real `app-v0.9.4` tag in a temporary `.compat/v094` worktree, installs its locked dependencies, and copies the compatibility tests and current-build fixtures into it. The worktree and generated fixtures are removed when the run ends.

The current checkout produces an export through `DATA_MANAGER.exportHistoricalData`, a backup through `writeBackupV2`, a sync bucket through `SyncEngine` and `FakeS3`, and a DB through `run_migrations(..., "0.9.5")`. The export and sync fixtures carry the real optional `partial` marker, and the DB fixture includes `snapshot_partial`. The released 0.9.4 code imports the export and backup, pulls and pushes the bucket, and opens the DB after version row `999` is reset. The current checkout then re-pulls the 0.9.4 bucket.

When a later phase adds optional fields or tables, extend the forward fixtures and assertions here to cover them. Add new table data to `write_forward_database_fixture`; the old Rust check compares every table's schema and rows before and after its migration run. Do not add real credentials or use a real S3 bucket in these fixtures.
