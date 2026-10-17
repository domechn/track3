# Automated testing

## What runs

- `cd src-tauri && cargo test --locked -p track3-pure-tests --lib` compiles the original `ent.rs`, `info.rs`, `binance.rs`, and `migration.rs` through a small GTK free crate. It runs encryption, fixture parsing, a signed Binance request against a local HTTP listener, and SQLite migration tests. The test crate does not replace these source files with copies.
- `cd src-tauri && cargo test --locked --lib` runs the full Tauri library when GTK and GLib development libraries are available.
- `corepack yarn test:e2e` starts Vite and headless Chromium. Playwright supplies a Tauri invoke bridge with SQL backed by in-memory `sql.js`, a test file store, and controlled HTTP replies. The smoke test opens Overview, refreshes, deletes and undoes a History snapshot while watching for a loading overlay, and renders assistant content plus `reasoning_content` from an OpenAI-compatible SSE response.
- `corepack yarn tsc -p tests/e2e/tsconfig.json --noEmit` checks the Playwright spec, bridge, and config; CI runs it before the browser smoke test.
- `corepack yarn test` runs the Vitest suite. `corepack yarn test:coverage` applies the existing coverage gate.

## Executed on this host (2026-10-17, latest leftovers pass)

| Command | Result |
| --- | --- |
| `cargo test --locked -p track3-pure-tests --lib` | 44 passed |
| `cargo test --locked --lib` | Not run in this pass; the Tauri library needs `gobject-2.0.pc`, unavailable on this host |
| `corepack yarn test:e2e` | 1 passed in headless Chromium |
| `corepack yarn vitest run` | 1,285 passed across 171 files |
| `corepack yarn tsc --noEmit` | Passed |
| `corepack yarn tsc -p tests/e2e/tsconfig.json --noEmit` | Passed |

Rust was installed with the rustup minimal profile. Chromium was installed with `corepack yarn playwright install --with-deps chromium`. The PR workflow runs both Rust test targets on a Linux runner with the GTK development packages and runs the browser smoke test in a separate Node 24 job.

The browser bridge tests renderer behavior and SQL statements. Native Tauri plugins, actual disk encryption, and external APIs are outside this smoke test. The `export-assistant-chats` binary was left to the full Tauri test target: its argument parsing uses process state and the remaining flow performs database and file I/O.
