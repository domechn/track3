---
name: version-upgrade
description: Use when bumping the Track3 app version, preparing release notes, and syncing updater metadata.
---

# Track3 Version Upgrade

## When to Use

Use this skill when the user asks to:

- bump the app version
- prepare a new release tag/build
- sync version numbers before packaging
- update the release-related manifest files
- draft or refine release notes for a version range

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

## Release Note Workflow

When the user also wants release notes, follow this after version inspection:

1. Determine the release range explicitly.
   - Prefer `previous tag...new tag` when both ends are tagged releases.
   - If the user provides a commit SHA, resolve whether it already corresponds to a release tag.
   - If the user says "latest version" and the repo has newer commits after the latest tag, ask whether they want the latest tag or current `HEAD`.
2. Inspect the commits and changed files in that range before drafting.
   - Group user-facing changes into **Features**, **Optimization**, and **Bug Fixes**.
   - Ignore purely internal repo maintenance unless it affects shipped behavior, packaging, security, or runtime compatibility.
3. Prefer concise, user-facing wording over raw commit text.
   - Merge closely related commits into one release note item when that reads better.
   - Do not invent version numbers or claim a tagged release exists when the target is only `HEAD`.
4. Use this release note shape by default:

```md
See the assets to download this version and install.

# 🎉 Features

1. ...

# 👍 Optimization

1. ...

# 🔧 Bug Fixes

1. ...

**Full Changelog**: https://github.com/domechn/track3/compare/<from>...<to>
```

5. Build the compare link from the same resolved range.
   - Use tag names when available, for example `app-v0.6.0...app-v0.6.1`.
   - Use commit SHAs when the target is not tagged yet.
6. Keep the opening line exactly as shown above unless the user asks for a different template.

## Practical Notes

- `src-tauri/Cargo.lock` should only be updated for the `track3` package entry, not unrelated crates.
- `src-tauri/tauri.conf.json` must stay in sync with the frontend/package versions or packaged app metadata will drift.
- If the user says “do the normal version upgrade”, assume these four files are the required baseline set unless they explicitly mention additional release assets.
- `scripts/update.mjs` copies the GitHub release body into `update.json` via `updateData.notes`, so release note content affects updater metadata as well.
- If the repo version files still say the previous release version but the user wants notes through `HEAD`, describe the range accurately and avoid presenting that unpublished state as a finalized version number.

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
- release note range used, if applicable
- compare link used, if applicable
- whether any non-version changes were intentionally left untouched
