---
name: version-upgrade
description: Use when bumping the Track3 app version across frontend and Tauri release files.
---

# Track3 Version Upgrade

## When to Use

Use this skill when the user asks to:

- bump the app version
- prepare a new release tag/build
- sync version numbers before packaging
- update the release-related manifest files

## Recurring File Pattern in This Repo

The current Track3 version bump workflow updates the same version string in these files:

| File | Field to update |
| --- | --- |
| `package.json` | top-level `"version"` |
| `src-tauri/Cargo.toml` | package `version` |
| `src-tauri/Cargo.lock` | `[[package]]` entry where `name = "track3"` |
| `src-tauri/tauri.conf.json` | top-level `"version"` |

From the observed unstaged upgrade pattern, the semantic change is the version bump itself. Formatter-only churn in `tauri.conf.json` can happen, but it is not part of the required release logic.

## Default Workflow

1. Determine the target version from the user request. If the target version is not explicit, ask first.
2. Read the four tracked files above and confirm the current version.
3. Update the same target version in all four places.
4. Keep the edit surgical:
   - do **not** change dependency versions
   - do **not** change `productName`, `identifier`, bundle settings, or updater settings
   - avoid unrelated formatting churn when possible
5. Review the resulting diff and confirm it only contains the expected version-sync changes.
6. If validation is appropriate for the task, run the normal repo verification command(s), typically `yarn build`.

## Practical Notes

- `src-tauri/Cargo.lock` should only be updated for the `track3` package entry, not unrelated crates.
- `src-tauri/tauri.conf.json` must stay in sync with the frontend/package versions or packaged app metadata will drift.
- If the user says “do the normal version upgrade”, assume these four files are the required baseline set unless they explicitly mention additional release assets.

## Example Upgrade Shape

Example of the recurring pattern:

- `0.6.0` -> `0.6.1` in `package.json`
- `0.6.0` -> `0.6.1` in `src-tauri/Cargo.toml`
- `0.6.0` -> `0.6.1` in the `track3` package entry inside `src-tauri/Cargo.lock`
- `0.6.0` -> `0.6.1` in `src-tauri/tauri.conf.json`

## Expected Response Shape

When using this skill, summarize:

- target version applied
- files updated
- whether any non-version changes were intentionally left untouched
