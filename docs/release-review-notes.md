# Release review notes

## Goals and rebalance leftovers pass (0.9.0)

Checked the findings in `round1.claude_out.md` (goals) and `round4.claude_out.md` (rebalance) against this branch.

| Finding | Current disposition |
| --- | --- |
| Goals: allocation uses raw assets and default stablecoins | Fixed: alert snapshots now exclude blacklisted symbols and carry configured stablecoin symbols into allocation calculations. |
| Goals: period P&L always unavailable on the page | Fixed: the page loads P&L for its enabled period rules. |
| Goals: granted notification permission still says Enable | Fixed: the page reads the current OS permission on mount. |
| Goals: rule Delete has no confirmation | Fixed with `ConfirmDeleteDialog`. |
| Goals: nav badge accessibility | Fixed in both nav layouts with a hidden visible count and screen reader text. |
| Goals: unused `TriggeredAlert.rearmed` | Removed. |
| Goals: refresh spinner waits for alert evaluation | Fixed: evaluation and delivery start after refresh completion. |
| Goals: unrelated `Cargo.lock` Windows dependency changes | Fixed: restored the pre-goals entries for existing crates. Only 15 notification transitive crates and required version labels were added; `cargo metadata --locked` resolves. |
| Goals: missing UI coverage for rule toggle, history clear, stale label | Added regression tests. The rebalance migration's fresh 0.9.0 profile is already covered by the existing Rust migration test. |
| Rebalance: draft target symbols with whitespace create phantom trades | Fixed in the calculator, including CSV and preview output. |
| Rebalance: unrequested version bump | Current release is explicitly 0.9.0; all four version locations remain at 0.9.0. |
| Rebalance: `fs:allow-write-text-file` permission needs explanation | The permission is required by the existing CSV `writeTextFile` call and also permits the existing data and backup exports. No additional permission was added in this pass. |
| Rebalance: Normalize silently fails for invalid weights | Already fixed on this branch: an error appears; `rebalance.test.tsx` covers it. |
| Rebalance: a cleared weight displays `NaN%` | Already fixed on this branch: the total treats non-finite weights as zero; `rebalance.test.tsx` covers it. |
| Rebalance: background reload removes editor focus | Already fixed on this branch: the editor stays mounted; `rebalance.test.tsx` covers focus. |
| Rebalance: duplicate blacklist filter | Removed; `queryLatestAssets()` already filters the blacklist. |
| Rebalance: missing-price pause, unlisted holding sales, tolerance units | Verified as designed: the first two are shown in calculator behavior and the tolerance is in percentage points. |

### Checks requiring a real environment

- System notification permission prompts and delivery on Windows and macOS need those operating systems and their notification services. Unit tests cover permission decisions and in-app fallback.
- Windows and macOS compilation need those toolchains. Cargo lock resolution is checked here, and existing crate versions were restored, but a platform build is still needed.
- The native CSV save dialog and write on a packaged Tauri app need a desktop shell. Component tests cover the selected path, cancellation, and the required filesystem capability.
