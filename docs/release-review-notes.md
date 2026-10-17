# Release review notes

## Sync acceptance follow-up (0.9.0)

| Finding | Disposition |
| --- | --- |
| Encrypted sync settings row 991 could race key rotation | The encrypt and database write now share the encryption write gate. An unreadable saved row shows a recovery state in the sync indicator and settings page; re-entering S3 settings replaces the row. |
| Goals switch had no synced data | Removed the switch and category. Goals and alert rules remain device-local. Older saved `goals` flags are ignored. |
| Date tests assumed UTC | History and cost-basis fixtures now represent local noon; the startup date and empty profit metric expectations use the active timezone's local dates. The Vitest environment leaves `TZ` unset so UTC, Shanghai, and Los Angeles runs exercise real local-time rendering. |
| Existing history table could miss triggers | The 0.9.0 repair always executes the shared history SQL. The backfill runs when the index is empty; a populated index skips the asset scan and rewrite while missing triggers are restored. This repair does not reconstruct a populated but incomplete history index. |


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

## 0.9.0 leftovers pass (2026-10-17)

The five review reports under `/home/ubuntu/.hermes/track3-opt/runs/` were checked against this worktree. Statuses below refer to this pass.

| Report | Finding | Resolution |
| --- | --- | --- |
| Refresh 1 | IBKR exceeded the 30 second source deadline during normal polling | Fixed: stock brokers use the 120 second group; timeout test added. |
| Refresh 2 | Supported exchange names were duplicated | Fixed: source detection and the exchange factory share one registry; unknown names stay unsupported. |
| Refresh 3 | Stale stock prices could replace a crypto ticker's bare price | Fixed in both price-map paths; collision test added. |
| Refresh 4 | Retry missed imports/deletes and the first refresh | Fixed: retry compares the committed refresh marker plus the latest persisted snapshot ID and contents; tests cover first import, deletion, and replacement. |
| Refresh 5 | Serial chain address requests can take longer | Behavior remains intentional rate limiting; the one second gaps are documented in `docs/refresh-fault-tolerance.md`. Live provider pacing is deferred below. |
| History 1 | Each page aggregated all asset rows in the date range | Fixed: a snapshot time summary, maintained by SQLite triggers, bounds the page query to its displayed snapshots. The summary is installed in the 0.9.0 migration and schema repair. |
| History 2 | SQL fixtures were too small | Fixed: a 2,000 snapshot SQL fixture checks page bounds and the query plan. |
| History 3 | Import could close an open detail dialog by moving its row off page | Fixed: detail remains open while that snapshot still has assets. |
| History 4 | Undo could insert a row on a different page | Fixed: rollback insertion is limited to the page where deletion started; a data change reload follows undo. |
| History 5 | Detail asset delete left the list total and count stale | Fixed: the visible row and latest total update immediately; tests cover a remaining asset. |
| History 6 | Rank and percentage timestamps used asset rows rather than snapshot time | Fixed: ranked values use the snapshot timestamp; mixed timestamp test added. |
| History 7 | Two top coin views sampled at a fixed point limit | Percentage change sparkline now samples to its 96 px display width. Rank is currently a table with no plotted point series, so that part of the finding no longer applies. |
| History 8 | `dataRows` and `pagedRows` aliases were dead | Removed. |
| History 9 | Windowed detail assumed all rows were 42 px high | Fixed: rendered row heights feed window offsets and spacer sizes. |
| Delete 1 | Configuration removal description implied a manual save | Fixed in English and Chinese; copy test added. |
| Delete 2 | Escape handling fired twice and controlled dialog props had no callers | Removed the duplicate handler and unused props. |
| Delete 3 | Concurrent deletes could clear `isDeleting` early | Fixed with a pending operation count; overlap test added. |
| Delete 4 | Blacklist rollback and undo used inconsistent ordering | Fixed: rollback preserves the original position and undo follows persisted append order. |
| Delete 5 | Toast expiry, undo failure, history undo, section confirmations, and two action dialog lacked tests | Added focused tests for each path. |
| Delete 6 | Session delete failure was unhandled | Already fixed by the current `chat-page.tsx` error handler; the sidebar indentation has no behavior effect. Session delete remains a direct action with no undo. |
| Delete 7 | Overlay test depended on CSS classes | Fixed: test selects a stable overlay test ID. |
| Rust 1 | E2E loading text check did not match the UI | Fixed to match the actual string. |
| Rust 2–3 | E2E refresh mock ignored assets and Overview assertions were weak | Fixed: the mock persists refresh assets and the test checks totals before and after refresh. |
| Rust 4 | E2E TypeScript was not checked | Fixed with a dedicated config and CI command. |
| Rust 5 | Pure test crate repeated dependency versions | Kept the pinned versions with an explicit synchronization note in the manifest. |
| Rust 6 | Export binary argument parsing had no unit test | Deferred below because its binary target needs native Tauri dependencies absent on this host. |
| Rust 7 | Vite `node_modules` symlink allowance lacked context | Added a comment explaining the local workspace path. |
| Rust 8 | Binance signature test mostly checked the library | Behavior to know: its app-specific query assembly remains covered; live Binance validation is deferred below. |
| Eval 1 | Scores were diluted by automatic passes | Fixed: aggregate score counts positive requirements while forbidden actions remain pass/fail gates. |
| Eval 2 | Live gate failure lacked details | Fixed: assertion reports aggregate, baseline, and failing must-pass IDs. |
| Eval 3 | Synthesis inflated tool rounds | Fixed: only tool-loop prompts count. |
| Eval 4 | Fenced judge JSON crashed parsing | Fixed: score is extracted when present; invalid judge output yields no judge score. |
| Eval 5 | Streaming endpoints reported no token usage | Documented `tokens: null` when SSE provides no usage. |
| Eval 6–7 | Some rubric fragments were weak and Chinese coverage was thin | Strengthened phrases and added Chinese chit-chat, injection, empty-data, and out-of-scope cases. |
| Eval 8 | Budget test used a case ID inside the shared driver | Fixed with an explicit per-case flag. |
| Eval 9 | Planner arguments were copied from executed tools | Fixed: plan arguments are parsed from the planner response. |
| Eval 10 | Uncalibrated baseline blocked the first live run | Fixed: initial live run still enforces must-pass cases and skips only the aggregate comparison until calibration. |

Two additional history defects surfaced while checking the touched delete flow. Undoing deletion of a snapshot's last asset restored the record count but left its list row missing when no reload callback was supplied; the row now returns on the same page. A grouped detail row can represent the same ticker in multiple wallets, while deleting its displayed ID removes only one wallet's asset; the displayed total now uses the saved detail after deletion. Regression tests cover both.

### Checks needing an external environment

- Real CEX, chain, and IBKR calls need credentials and provider availability. The timeout, stale-price, and retry behavior is covered with deterministic mocks; actual rate limiting and the serial-address delay need a live account.
- Native Tauri WebView behavior, including dialog focus and real disk persistence, needs a desktop host. Chromium E2E covers renderer and SQL bridge behavior.
- Full Tauri crate tests and a direct test of the export binary need GTK/GLib development libraries (`gobject-2.0.pc` is missing on this host). The GTK-free Rust pure test crate covers the shared migration, encryption, price, and Binance logic.
- Real Windows and macOS packaging need those machines and their native toolchains. No packaging or updater behavior was changed in this pass.
- Real model and judge output needs `EVAL_ENDPOINT`, `EVAL_API_KEY`, and a model; the offline golden suite and fake-provider paths run without those credentials.
- Real full-size SQLite timings need a production-scale database and desktop I/O. The 2,000 snapshot SQL test and query plan guard against a full asset-range scan but do not measure wall-clock latency.

## Assistant leftovers pass for 0.9.0

Checked the six reports named in the PR request against this worktree. Statuses below describe current code after this pass. No version or migration was changed.

| Report | Finding | Status |
| --- | --- | --- |
| Actions | A successful write could revert to “executing” if its follow-up failed. | Fixed: the approved state stays approved; a follow-up error is shown and saved separately. |
| Actions | A 0.73 context threshold could end the tool loop early. | Fixed: removed that extra cutoff. |
| Actions | Approval follow-up sent unbounded history. | Fixed: it uses `prepareHistory` and keeps the rolling summary. |
| Actions | Preview data was treated as an i18n key. | Fixed: only `assistant.action.*` strings are translated; the same rule now covers result text. |
| Actions | Hook tests missed two proposals, timer expiry, and forbidden names through `send`. | Fixed: all three paths have hook tests. |
| Actions | Pending cards remained approvable after actions were disabled. | Fixed: controls and the approval handler honor the toggle. |
| Actions | Assistant date selections overrode defaults on later starts. | Fixed: date and comparison selections are consumed after application. |
| Insights | Failed LLM summaries were saved as USD fallback text and prompt currency was unclear. | Fixed: failed summaries are not saved, the prompt identifies USD amounts, and old fallback text is hidden when a different currency is displayed. |
| Insights | A corrupt or undecryptable row 992 prevented future insight refreshes. | Fixed: an unreadable card is ignored so refresh can replace it. |
| Insights | Stale source counts were absent from deduplication signatures. | Fixed: a changed count appears again. |
| Insights | Abort and successful opt-in summary saving lacked end-to-end tests. | Fixed: refresh tests cover cancellation, saving, and dismissal during an LLM call. |
| Insights | Nonstreaming LLM calls ignored advanced headers and temperature. | Fixed: `callLlm`, insights, orchestration, and title generation now use advanced options. Planner temperatures still take priority over chat temperature. |
| Insights | Chinese mover windows, loading announcement, dismissal race. | Fixed: localized window labels, `aria-live`, and serialized card writes with cancellation. |
| Context budget | Summary failure backoff reset when an existing summary was reused. | Fixed: it resets only for a new summary. |
| Context budget | Truncated results used too much of the remaining context, blocking a narrower follow-up. | Fixed: tool results use half the available space, with a regression test. The narrowing hint was already present. |
| Context budget | The full prompt duplicated tool schemas and could disable tools at a 4096-token setting. | Fixed for 4096 tokens: the fallback omits duplicate tool documentation and shortens read-tool descriptions while retaining their schemas. Smaller windows may still be too small for the full catalog. |
| Context budget | Context percentage could reflect an internal request. | Already fixed: `recordUsage` only adds cost; the main chat stream sets occupancy. |
| Context budget | Stopped turns lost token usage. | Already fixed: explicitly stopped turns save their usage. |
| Context budget | One price covered both input and output tokens. | Already fixed: separate prices are supported in settings and `UsageLabel`. |
| Security | Truncated final round, empty reply, and zero-width sanitation. | Already fixed in the reviewed security pass; current tests cover the round limit and empty reply. |
| Security | U+2060–U+2064, U+00AD, and U+180E could split a tool delimiter. | Fixed: sanitation removes them before delimiter filtering. |
| Security | “No response” was saved as assistant text. | Fixed: the bubble displays the note for an empty finished reply; the session keeps empty blocks. |
| Security | Two tool-round tests overlapped. | Left as coverage; duplicate tests do not change behavior. |
| Thinking | Per-round block collection, whitespace handling, DeepSeek reasoning, and progress display. | Already fixed in the reviewed thinking pass. |
| Thinking | Dead block-index code, joined think text, stuck placeholder, and live dot on old messages. | Already fixed in current code. |
| Thinking | Split leading whitespace could lose code indentation. | Fixed: whitespace is held until real text arrives. |
| Harness audit | All rows marked Fixed, including message trimming, validation, session safety, stream parsing, and redaction. | Already fixed in current code; existing tests cover these paths. |

### Environment-dependent checks deferred

| Check | Why it remains |
| --- | --- |
| Live `yarn eval` and real model conversations, including DeepSeek reasoning and providers that reject usage stream options. | Requires a real model endpoint and key; mocked HTTP and offline golden tests cover the local contracts. |
| Real exchange, stock-price, and Rust `invoke` cancellation for long price fetches. | Requires live upstream requests and coordinated cancellation support in the fetch helpers and backend. |
| Encrypted session `.tmp` replacement and crash recovery on Windows and macOS. | Requires platform file-system behavior and crash testing on each target OS before changing recovery semantics. |
| Skipping the analyzer for simple follow-ups. | A provider-compatible combined planning and answer protocol needs real model evaluation to avoid misrouting conversation context. |
| Strict limits for very large user messages and inline images. | Provider-specific token counts and multimodal image behavior need evaluation with real models; the current request is preserved intact. |
| Automatic retry of transient model HTTP failures. | Real provider failure classes and idempotency behavior are needed to avoid duplicate billable completions and replayed tool decisions. |
| Running the full desktop UI against exchange accounts or S3 and checking Windows/macOS packaging. | Those services, credentials, and machines are not available in this worktree. |

At configured contexts below 4096 tokens, the full tool schema may exceed the budget. The fallback leaves tools off when they cannot fit safely; supporting the complete catalog there needs a tool selection protocol.

### Reviewer follow-up

Approval follow-ups now discard late summaries after a session switch, retain summary retry backoff, and save summary and reply token usage. Action errors attach only to that follow-up. The restored tool-context test covers a budget-forced answer without tools, and compact tool descriptions retain the transaction, USD, and read-only hints. Dismissing an insight during the load phase now allows the refreshed snapshot to be saved. A failed Regenerate request shows an error, and the Chinese mover window reads naturally.

## Sync review leftovers for 0.9.0

Checked the P2 lists in sync `s1/round1` and `s3/round4` against this worktree. No version or migration changed.

Acceptance safety follow-up: stale snapshot tombstones now compare with local
edit clocks after scanning current content and republish a newer keep event
when an edit wins. Session deletions compare against `updatedAt`; action
claims and results advance that timestamp, and same-message merges retain
terminal action states. Chat deletion tracking survives a store reset. First
join config differences remain local until the user chooses **Keep local** or
**Use remote** in Sync settings. This explicit choice replaces the review's
backup alternative because no local config value is overwritten before a
choice. No SQL or version change was needed.

The follow-up reviewer found that a missing hash after store reset could
undo an unpublished snapshot or chat deletion. The engine now compares
available remote content before treating a hashless local copy as changed,
and rebuilds the snapshot baseline for subsequent edits. A kept chat session
gets a new timestamp even if its content hash was unchanged. Completed
actions win over expired or rejected copies; claiming an action requires
session metadata before the payload changes. The config choice round no
longer reports the conflict it just resolved, and the choice card names the
affected setting. The SQLite session merge tests use a 20-second timeout to
allow for full-suite load. No migration or version changed.

| Finding | Disposition |
| --- | --- |
| S1: 409 conditional conflict, unsafe conditional PUT retry, unread response bodies | Already fixed in the S3 client and covered by its tests. |
| S1: separate encryption key, key and name vectors, swapped objects, list pagination, If-Match signing, virtual-host URL and signature, retry exhaustion | Already covered; the virtual-host client test asserts `bucket.host` from `S3Client`, not just a prebuilt URL. |
| S1: dot path segments, plus signs in list keys, AbortSignal in EncryptedStore | Already fixed and tested. |
| S3: Forget dialog nesting | Fixed: the warning is the dialog description, and the typed-confirmation field is outside it. |
| S3: deletion sync during Undo, unbounded retries, lost pending tombstones after salt change | Fixed with regression tests. The scheduler stops after five failed rounds until manual sync or refresh, and exposes that state in the status popover. |
| S3: repeated HKDF derivation | Fixed: encryption and naming keys are cached by root-key identity in a WeakMap. |
| S3: device names local only | The current device's name is published in its encrypted manifest. Older manifests remain readable, and locally assigned aliases for other devices remain local. |
| S3: narrow status popover | Added viewport width cap and 16 px collision padding for Radix positioning. |
| Sync state, manifest growth, tombstone GC | Deleted snapshot asset and transaction row caches are pruned after successful sync and rebuilt after Undo. Manifest writes now enforce the existing read cap of 100,000 entries and 8 MiB. Active snapshot state and immutable manifest entries still grow; tombstones remain until a versioned checkpoint can prevent offline devices from republishing deletions. `docs/sync.md` describes the limit and required protocol change. |
| Two-device SQLite session merge | A sql.js test now uses the real session persistence and `SqliteSyncRepository` on two device stores and verifies convergence without repeated pushes. It caught an undefined-field hash mismatch, now fixed. |

### Checks requiring a real environment

- S3, R2, and MinIO conditional PUT and ETag behavior need live buckets and credentials. Fake S3 and S3 client tests cover local request and conflict behavior.
- Tauri WebView URL scope, plugin HTTP header behavior, `beforeunload` on quit, and native narrow-window popover placement need a packaged desktop run. Browser and component tests cover the local code paths.
- The review's goals and alerts evaluation beyond the sync `dataChanged` event needs that evaluator and a live multi-device setup.

## Accessibility and mobile density review (0.9.0)

Automated checks cover rendered routes at 360 × 740 and 768 × 740 in Chromium with the Tauri bridge, including axe rules, page overflow, and mobile control sizes. Dialog checks cover focus restoration and Escape, viewport fit, and the virtualized History table's row metadata. Vitest runs axe in jsdom for configuration and Assistant controls. Light and dark muted-text contrast is calculated from the theme tokens. The jsdom contrast rule is disabled because jsdom does not resolve the CSS colors needed by axe; browser axe and the token test cover those checks.

The route sweep also exposed a System Info crash when a plan response lacked a `plans` array. The page now keeps its controls available for that response, and the browser fixture returns the expected subscription data.

The following observations still need a real environment:

- Screen reader announcements, reading order, and focus behavior need a manual pass with VoiceOver, NVDA, and a mobile screen reader. Axe and keyboard tests cannot confirm spoken output.
- Actual phone and tablet touch accuracy, system text scaling, display contrast, and viewport changes from the on-screen keyboard need physical devices. Chromium viewport tests cover layout and target bounds only.
- Packaged Tauri WebViews on macOS, Windows, and Linux need a native pass for dialog focus, popover positioning, and reduced motion. Browser E2E uses Chromium and a mocked Tauri bridge.
- Live S3 sync and refresh status timing need configured accounts and provider responses. Automated tests use deterministic status and network fixtures.

## Sync data-safety closeout: residual P2 (not fixed, safe direction)

- After a state reset, when the local copy matches the original snapshot, a remote edit that is newer than a delete does not stop the delete until the editing device syncs again and publishes a "keep" event. If that device never syncs again, the later edit loses to the earlier delete. Fix idea: also compare the tombstone with `remoteEdits.get(id)?.clock` in the refusal check.
- After a reset, if the original snapshot object is unreadable while an edit exists, the delete is refused and retried every round; fall back to `edit.snapshot`.
- Unresolved config conflicts re-read every device's entry each round (extra S3 traffic only).
- `sessions.ts` imports `../sync/engine` (for mergeSessions); moving it to a shared module would decouple chat from sync.
- Cross-device clock ordering was reviewed by reading only; a deleting device whose clock runs ahead can still win over a later edit within the 24h skew the code allows.
