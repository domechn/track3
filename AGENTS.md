# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React + TypeScript frontend (UI components, data middle layers, utilities).
- `src/components/`: screen and shared UI components (`ui/`, `common/`, feature modules).
- `src/middlelayers/`: app domain logic (wallet/config/data fetch/chart/data manager).
- `src-tauri/`: Rust/Tauri desktop backend, migrations, and platform packaging config.
- `public/` and `src/assets/`: static assets used by the frontend.
- `.github/workflows/`: CI/release pipelines used to validate and publish builds.

## Build, Test, and Development Commands
- `yarn install`: install JS dependencies (CI uses Yarn).
- `yarn dev`: run frontend locally with Vite on port `1420`.
- `yarn tauri dev`: run full desktop app (frontend + Rust backend).
- `yarn build`: type-check (`tsc`) and create production frontend bundle.
- `yarn tauri build`: build desktop binaries (same path used in CI release jobs).
- `yarn update-release`: generate update metadata used by release automation.

## Coding Style & Naming Conventions
- TypeScript is `strict`; fix type errors instead of suppressing them.
- Use 2-space indentation and semicolons in TS/TSX; keep imports grouped and alias local imports with `@/`.
- React components/files use kebab-case filenames (for example `auto-updater.tsx`), with PascalCase component exports.
- Rust code in `src-tauri/` follows `rustfmt` defaults (4 spaces, snake_case functions).
- Keep Tailwind utility usage readable; extract repeated UI patterns into `src/components/ui/`.

## Testing Guidelines
- There is no dedicated unit-test suite yet; validation is build-based.
- Before opening a PR, run:
  - `yarn build`
  - `yarn tauri build` (or at minimum `yarn tauri dev` smoke test)
- CI (`.github/workflows/test-on-pr.yaml`) verifies cross-platform Tauri builds on Ubuntu, macOS, and Windows.

## Commit & Pull Request Guidelines
- Follow existing commit style: short, imperative summaries (for example `support htx`, `refactor configuration storage`).
- Prefer including issue/PR references when relevant (for example `(#602)`).
- Keep commits focused by concern (UI, data layer, Rust backend, migrations).
- PRs should include: what changed, why, local verification steps, and screenshots/GIFs for UI changes.
- If backend schema or migration behavior changes, explicitly call out compatibility and upgrade impact.
