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

## 0.9.0 profit leftovers — 2026-10-17

Current-branch review of the attribution and cost basis reports:

| Finding | Result |
| --- | --- |
| Attribution refresh flicker | Fixed: existing results remain visible during a data refresh. |
| Empty contributor or detractor list | Fixed: an empty market list says “No market change.” |
| Unbounded all-time attribution assets | Fixed: snapshots and matching transactions load in batches of 100 UUIDs. |
| Different asset and transaction date filters | Fixed: transactions join selected snapshots by UUID, including edited transaction dates. |
| English stock suffix in Chinese | Fixed: the coin group uses the selected language’s stock label. |
| Sign mismatch, zero starting value, mixed-case symbol tests | Added regression cases; current attribution arithmetic already handled each case. |
| Rewards and airdrops as quantity change | Already stated in both UI translations; no change needed. |
| Tiny cost basis quantities | Fixed: relative floating-point tolerance retains real small lots and disposals, and the UI and CSV show their quantities. |
| Date text ordering | Fixed: events, lots, and transfer candidates use actual timestamps; equal times keep input order. |
| Reversed cost basis date range | Fixed: the page displays an error and does not load or export the invalid range. |
| Price symbol whitespace | Fixed: latest price keys use trimmed symbols. |
| Duplicate end-date filter | Kept: the data loader filters before transfer pairing, while the report builder also protects direct callers. |
| Transfer symbols with whitespace | Fixed during the touched-code check: transfer legs use normalized symbols. |

### Checks requiring a real environment

- Tauri desktop layout and interaction density still need a running desktop window. Component tests and code review cannot verify native WebView rendering.
- Native cost basis CSV and JSON save dialogs still need a running Tauri app and a real filesystem. Automated tests cover the generated content and mocked dialog/file calls, but cannot verify the operating system dialog or completed file write.
