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
