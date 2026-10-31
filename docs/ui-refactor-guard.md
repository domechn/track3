# UI refactor static guard (0.9.4 baseline)

`scripts/ui-refactor-guard.mjs <base-ref>` checks the committed diff from the
PR base to `HEAD`. It permits the UI, style, catalog, browser scene, image, and
`docs/ui/**` paths listed in the Phase 0 audit. Other paths require the owner
exception. In desktop and mobile components, changed lines containing storage,
Tauri, serialization, persistence calls, telemetry, and protocol values also
require the exception. Each of the four i18n catalogs must retain every base
key; existing persisted message labels and rebalance CSV strings must keep
their values.

The six Vitest goldens in `src/test/golden/` compare the current source with
the frozen JSON files in `tests/golden/`. They record storage keys and stored
values, persistence-bearing UI lines, routes and Settings destinations, config
IDs and sync categories, telemetry arguments, and all four 0.9.4 catalog key
sets. The inventory and route captures are static source checks; they do not
exercise runtime behavior.

To regenerate **only** those six JSON files after an intentional format review:

```bash
GOLDEN_UPDATE_APPROVED=1 corepack yarn golden:update
corepack yarn vitest run src/test/golden
node --test scripts/ui-refactor-guard.test.mjs
```

The update command refuses to run in CI and requires the explicit local
environment variable. Review the JSON diff against the released format before
opening a PR. The frozen file names still say `0.9.4` when extra i18n keys are
added; the tests allow additive keys without regenerating the fixture.

For a PR exception, `domechn` must apply the `format-exception-approved` label.
The quality job checks both the current label and the actor on the most recent
label event with `gh api`, then sets `FORMAT_EXCEPTION_APPROVED=true` for the
guard. Removing and reapplying the label by another actor does not qualify.
The same check runs in the iOS foundation web job for UI PRs. CODEOWNERS names
`domechn` for guarded source and fixtures; repository branch protection must
also enable **Require review from Code Owners** for that review to be
enforced.

For local checks against master:

```bash
node scripts/ui-refactor-guard.mjs origin/master
```

Phase 0 itself changes guarded scripts, goldens, workflow files, and
`package.json`, so its PR needs the owner label.

## Behavioural goldens

`golden:update` regenerates only the six static JSON files above. The
behavioural fixtures use test-specific `UPDATE_GOLDEN=1` commands so that a
static inventory refresh cannot silently rewrite released data formats. Run
these commands only against the reviewed 0.9.4 baseline, then review each
fixture diff:

| Golden file | What it pins | Regeneration |
| --- | --- | --- |
| `tests/golden/ui-shapes-0.9.4.json` | Desktop and mobile Settings saves, chat message mapping, stored option values, and alert cooldown | `UPDATE_GOLDEN=1 corepack yarn vitest run src/test/golden/ui-shapes.test.tsx` |
| `tests/golden/ui-sources-extra-0.9.4.json` | Inactive exchange, CEX-attached and unattached manual assets in Settings saves | `UPDATE_EXTRA_GOLDEN=1 corepack yarn vitest run src/test/golden/ui-shapes.test.tsx` |
| `tests/golden/rebalance-desktop-en.csv`, `rebalance-desktop-zh.csv`, `rebalance-mobile-en.csv`, `rebalance-mobile-zh.csv` | Rebalance CSV bytes for both catalogs and shells | `UPDATE_GOLDEN=1 corepack yarn vitest run src/test/golden/rebalance-csv.test.ts` |
| `tests/golden/export-0.9.4.json` | Complete historical export JSON and import round trip | `UPDATE_GOLDEN=1 corepack yarn vitest run src/middlelayers/golden-export.test.ts` |
| `tests/golden/backup-v2-0.9.4.json`, `backup-v2-part-0.9.4.json` | Backup metadata and exact part bytes for exported history | Same `golden-export.test.ts` command |
| `tests/golden/sync-real-wire-0.9.4.json`, `sync-real-bucket-0.9.4.json` | Decrypted pushed sync objects and encrypted bucket bytes; the bucket is pulled back into a fresh repository | `UPDATE_GOLDEN=1 corepack yarn vitest run src/middlelayers/sync/golden-wire.test.ts` |
| `tests/golden/sync-bucket-0.9.4.json`, `sync-snapshot.json`, `sync-session.json`, `sync-config.json` | Committed 0.9.4 bucket input and the snapshot, session, and config expected after pull | Kept from the released 0.9.4 fixture; `golden-wire.test.ts` reads these and does not regenerate them |
| `tests/golden/sync-manifest.json` | Archived decrypted manifest for the committed 0.9.4 bucket; no current test reads this file | Kept from the released 0.9.4 fixture; no updater |
| `src-tauri/tests/fixtures/schema-0.9.4.txt`, `migrations.sha256` | SQLite schema and migration SQL hashes | From `src-tauri/`: `UPDATE_GOLDEN=1 cargo test --locked -p track3-pure-tests schema_dump_matches_0_9_4` |

`tests/e2e/format-golden.spec.ts` reads the export fixture and the static
`tests/golden/storage-keys.json`; it has no separate fixture updater. The
`total-profit/` cache namespace is constructed from `CACHE_GROUP_KEYS` at
runtime, so the browser test recognizes it from that constant; the static
literal scanner does not capture it. The recorded two-click import behavior
is described in `docs/ui/golden-known-bugs.md`.
