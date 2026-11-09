# Phone fidelity batch review

The original tables and verification logs below belong to earlier captures and are retained as history. The owner’s later 3% or documented-product-limitation rule supersedes the original strict gate. Current measurements appear in the last section; current verification is recorded there after the final run.

The tables below record the original batch measurements before the P0/P1 review fixes. The capture paths are overwritten by later test runs, so the current images no longer reproduce these original ratios. All ratios compare a 390px Chromium capture with the authoritative design HTML render. A pixel differs when any RGB channel differs by more than 20. The ratio covers the rendered viewport unless marked “long”. No golden or persisted format was changed.

## Group 1 · Overview

| Screen | Viewport difference | Full-page difference | Capture |
| --- | ---: | ---: | --- |
| [overview](overview-phone.md) | 2.27% | 7.02% | `/tmp/fidelity/overview/overview-phone.png` |
| [overview-more](overview-more-phone.md) | 6.93% | — | `/tmp/fidelity/overview/overview-more-phone.png` |
| [overview-ptr](overview-ptr-phone.md) | 2.66% | — | `/tmp/fidelity/overview/overview-ptr-phone.png` |
| [overview-range](overview-range-phone.md) | 5.12% | — | `/tmp/fidelity/overview/overview-range-phone.png` |
| [overview-sync](overview-sync-phone.md) | 9.86% | — | `/tmp/fidelity/overview/overview-sync-phone.png` |
| [overview-ai-off](overview-ai-off-phone.md) | 5.63% | same column | `/tmp/fidelity/overview/overview-ai-off-phone-long.png` |
| [overview-stale](overview-stale-phone.md) | 7.12% | same column | `/tmp/fidelity/overview/overview-stale-phone-long.png` |
| [overview-hover](overview-hover-phone.md) | 2.56% | — | `/tmp/fidelity/overview/overview-hover-phone.png` |

## Group 2 · Wallets and Comparison

| Screen | Viewport difference | Full-page difference | Capture |
| --- | ---: | ---: | --- |
| [wallets-all](wallets-all-phone.md) | 5.90% | 9.10% | `/tmp/fidelity/wallets/wallets-all-phone.png` |
| [wallets-binance](wallets-binance-phone.md) | 7.22% | 7.84% | `/tmp/fidelity/wallets/wallets-binance-phone.png` |
| [wallets-okx](wallets-okx-phone.md) | 6.78% | 8.52% | `/tmp/fidelity/wallets/wallets-okx-phone.png` |
| [comparison](comparison-phone.md) | 8.65% | same column | `/tmp/fidelity/comparison/comparison-phone-long.png` |
| [comparison-picker](comparison-picker-phone.md) | 5.40% | — | `/tmp/fidelity/comparison/comparison-picker-phone.png` |

## Group 3 · Flows

| Screen | Viewport difference | Full-page difference | Capture |
| --- | ---: | ---: | --- |
| [firstrun-empty](firstrun-empty-phone.md) | 6.71% | 6.86% | `/tmp/fidelity/flows/firstrun-empty-phone.png` |
| [firstrun-one](firstrun-one-phone.md) | 5.84% | 6.49% | `/tmp/fidelity/flows/firstrun-one-phone.png` |
| [guide-1](guide-1-phone.md) | 4.66% | — | `/tmp/fidelity/flows/guide-1-phone.png` |
| [guide-2](guide-2-phone.md) | 4.32% | — | `/tmp/fidelity/flows/guide-2-phone.png` |
| [guide-3](guide-3-phone.md) | 3.80% | — | `/tmp/fidelity/flows/guide-3-phone.png` |
| [guide-4](guide-4-phone.md) | 3.14% | — | `/tmp/fidelity/flows/guide-4-phone.png` |
| [guide-5](guide-5-phone.md) | 5.48% | — | `/tmp/fidelity/flows/guide-5-phone.png` |
| [loading](loading-phone.md) | 3.48% | — | `/tmp/fidelity/flows/loading-phone.png` |
| [patterns](patterns-phone.md) | N/A | — | `No real product capture` |
| [refresh-idle](refresh-idle-phone.md) | 13.48% | 11.76% | `/tmp/fidelity/flows/refresh-idle-phone.png` |
| [refresh-partial](refresh-partial-phone.md) | 5.47% | 7.34% | `/tmp/fidelity/flows/refresh-partial-phone.png` |
| [refresh-partial-pop](refresh-partial-pop-phone.md) | 6.09% | — | `/tmp/fidelity/flows/refresh-partial-pop-phone.png` |
| [refresh-progress](refresh-progress-phone.md) | 14.81% | 11.88% | `/tmp/fidelity/flows/refresh-progress-phone.png` |
| [refresh-ptr](refresh-ptr-phone.md) | 12.28% | 11.42% | `/tmp/fidelity/flows/refresh-ptr-phone.png` |
| [refresh-ptrrun](refresh-ptrrun-phone.md) | 12.78% | 11.52% | `/tmp/fidelity/flows/refresh-ptrrun-phone.png` |
| [refresh-quota](refresh-quota-phone.md) | 8.57% | 11.32% | `/tmp/fidelity/flows/refresh-quota-phone.png` |
| [refresh-quota-pop](refresh-quota-pop-phone.md) | 8.41% | — | `/tmp/fidelity/flows/refresh-quota-pop-phone.png` |
| [refresh-rule](refresh-rule-phone.md) | N/A | — | `No real product capture` |
| [refresh-states](refresh-states-phone.md) | N/A | — | `No real product capture` |
| [startup-applock-fail](startup-applock-fail-phone.md) | N/A | — | `No real product capture` |
| [startup-applock](startup-applock-phone.md) | N/A | — | `No real product capture` |
| [startup-error](startup-error-phone.md) | 8.81% | — | `/tmp/fidelity/flows/startup-error-phone.png` |
| [startup-migrate](startup-migrate-phone.md) | N/A | — | `No real product capture` |
| [startup-recovery](startup-recovery-phone.md) | N/A | — | `No real product capture` |
| [startup-syncunlock-error](startup-syncunlock-error-phone.md) | 10.34% | — | `/tmp/fidelity/flows/startup-syncunlock-error-phone.png` |
| [startup-syncunlock](startup-syncunlock-phone.md) | 10.88% | — | `/tmp/fidelity/flows/startup-syncunlock-phone.png` |
| [toasts-ok](toasts-ok-phone.md) | 13.13% | — | `/tmp/fidelity/flows/toasts-ok-phone.png` |
| [toasts-stack](toasts-stack-phone.md) | 12.09% | — | `/tmp/fidelity/flows/toasts-stack-phone.png` |

## Cross-screen limits

- Stored asset rows have no market-cap rank. Overview shows portfolio rank.
- The default fixture has no encrypted sync setup, so Overview states show the real disabled status. A separate configured fake S3 capture shows the product’s sync status sheet and its differences from the HTML popover.
- Persisted source status permits sanitized failure reasons and cannot prove that an exchange API key is read-only.
- The refresh pipeline has no cancellation operation. The in-progress source sheet uses Close to dismiss the sheet while refresh continues.
- The refresh storyboard’s alternate idle Overview composition conflicts with the approved core Overview composition for the same route and state. The app uses the core Overview.
- Patterns, refresh rules, and refresh states are design catalogues rather than simultaneous product states. Native app-lock and migration states occur before the Playwright webview bridge. The phone app does not mount the desktop updater.
- The preceding 390px review captured Overview 12.30%, Wallets all 17.59%, Comparison long 16.81%, first-run empty 21.84%, guide 1 4.69%, and refresh progress 12.29%. These measurements predate the current fixes. The strict pixel-identical gate is still not met.

## Original submission verification

- All 34 new phone fidelity E2E cases pass on the final locale and fixture code (`/tmp/fidelity/all-new-final.log`). These include the configured fake S3 status sheet, 320px width, masking controls, range persistence, Chinese calendar and guide labels, partial snapshots, and quota states.
- Full Vitest passes: 349 files and 3,039 tests, with 2 files and 7 tests skipped (`/tmp/fidelity/full-vitest-postlocale.log`). Rust pure tests pass 115/115 (`/tmp/fidelity/cargo-postlocale.log`). TypeScript passed twice. The original `node scripts/ui-refactor-guard.mjs HEAD` check compared an uncommitted tree with HEAD and therefore did not check this batch.
- The full mobile Playwright command with two workers reached the required 600-second command limit before completion (`/tmp/fidelity/mobile-full-postfinal.log`). It had already logged failures in existing tests targeting replaced Overview/Wallets markup and copy. The command started before the last localization and fixture edits, so its partial result is diagnostic rather than a final pass.
- The full desktop Playwright run recorded 173 passes, 64 skips, and 3 failures (`/tmp/fidelity/desktop-final-rerun.log`). One existing coarse-pointer check targets an unchanged desktop Wallets control; two unchanged sync-feedback cases passed when rerun alone (`/tmp/fidelity/desktop-sync-rerun.log`). Desktop presentation remains on its prior component path.

## Previous post-review verification

- The real Refresh button, source status sheet, locked-sync prompt, auto-backup indicator, Overview chart switches, first-run action, and Wallets detailed analysis are reachable again. The sync unlock flow uses the existing dismissible prompt. Insight rows come from stored insight data and retain the assistant-question handoff.
- The full desktop Playwright project passes: 176 passed, 80 skipped (`/tmp/fix-desktop-final2.txt`). The full Vitest run before the two new component test files passed 3,043 tests in 351 files, with 7 tests and 2 files skipped (`/tmp/fix-vitest-full.txt`). The new FirstRun and InsightsCard tests pass 3/3 (`/tmp/fix-first-run-unit.txt`, `/tmp/fix-insights-card-unit-final.txt`). Rust pure tests pass 115/115 (`/tmp/fix-cargo.txt`). App and E2E TypeScript pass (`/tmp/fix-tsc-stable.txt`, `/tmp/fix-e2e-tsc-stable.txt`).
- The complete mobile Playwright project passes in two shards with two workers each: 223/223 and 179/179, 402/402 combined (`/tmp/fix-mobile-shard1-stable.txt`, `/tmp/fix-mobile-shard2-final.txt`). The split keeps each command within the available session length.
- A temporary Git index and tree containing all uncommitted changes passed `ui-refactor-guard.mjs` against HEAD. No commit or real staging was made.

## Earlier batch review fixes and remaining differences

- Overview handles a failed total lookup without crashing, including when the existing `index-data-changed` test mock has no `queryTotalValue` export. The original unit test was not changed.
- Overview now shows Live total and the unread bell, and configured sync uses the designed dot-and-cloud pill. Percent and BTC base moved into the range sheet, the chart caption keeps the positive sign, and the extra header Refresh icon is hidden on compact Overview. Refresh remains available from Sources and pull to refresh. Chart strokes, typography, and lower sections still differ from the reference.
- The locked-sync prompt now uses the designed passphrase layout with dimming and an eye toggle. Its recovery and turn-off actions remain reachable below the fold. The runtime error wording and the underlying Overview still differ.
- The normal locked-sync prompt now includes the localized passphrase help text, and the inactive header bell is hidden behind its backdrop. The error state shows its error instead of that help text.
- Refreshing sources now has a dedicated per-source sheet. This fixture has six configured sources, including Others, where the reference has five. The runtime has no cancellation operation; Close only dismisses the sheet, and Retry becomes available on failure. The refresh storyboard uses a different idle Overview composition from the core Overview reference at the same route and state.
- The toast stack exposes Retry and Details; first-run source choice changes its button copy, the single-source mark uses initials, and startup error details are clamped inside their box.
- Comparison captures select 30 days, compact Wallets and Comparison have no extra Back bar, and the calendar arrows fit. The value-mask control remains visible because value masking must stay operable.
- The OKX failure uses its stored status. Read-only API-key status cannot be inferred from that record, and its row geometry remains visibly different. The first-run single-source capture now seeds two unread alerts for the real More badge.
- Wallets keeps its 44px source chip targets while reducing the gap above the allocation card. The post-fix 390px Wallets all capture measures 14.31% different with the same RGB threshold.
- Compact Assistant content, quick actions, and the composer now follow the device side safe insets. The phone matrix waits for the chat to mount before checking its geometry.
- Existing browser assertions again check sort-button width, symbol space, populated Insights, hero dates and chart height, holdings values, header equality, loading semantics, range delta, sheet detents, comparison mask alignment, and untruncated short labels. The coin fixture uses the stored hashed OKX wallet identity for the two-exchange case.
- Wallets writes range choices through the shared date-range callback. The desktop touch CSS changes were reverted, and the phone guide no longer renders duplicate hidden copy alongside its visible text.
- The strict pixel-identical gate remains unmet.
- The post-fix 390px captures measured with the same RGB threshold show Overview at 8.11%, Wallets all at 14.31%, first-run empty at 12.66%, normal sync unlock at 16.86%, and sync unlock error at 12.62%. These exact design/capture pairs are pinned in `/tmp/wbp1-review-captures/` so another session cannot overwrite them. The sync designs use the alternate refresh Overview underneath the sheet, while the app uses the core Overview.

## Earlier batch verification

- Full Vitest passed on the final worktree in four quarters: 863, 770, 629, and 786 tests passed, with 7 skipped overall in 355 files (`/tmp/wbp1-vitest-final-q1.log` through `/tmp/wbp1-vitest-final-q4.log`). The previously failing `index-data-changed` test also passed 15/15 in isolation (`/tmp/wbp1-index-data-final.log`).
- Desktop Playwright passed in two shards: 92 passed and 50 skipped, then 84 passed and 31 skipped (`/tmp/wbp1-desktop-shard1.log`, `/tmp/wbp1-desktop-shard2b.log`).
- The post-header mobile Playwright rerun passed all four shards: 114, 110, 115, and 65 tests, 404/404 overall (`/tmp/wbp1-mobile-header-final1.log` through `/tmp/wbp1-mobile-header-final4.log`). The sync-help, Wallets position, and strengthened ranking checks also passed in focused runs after their final edits (`/tmp/wbp1-sync-hint-green.log`, `/tmp/wbp1-wallet-geometry-green.log`, `/tmp/wbp1-rank-check-final3.log`).
- Rust pure tests passed 115/115 (`/tmp/wbp1-cargo-pure.log`). App and E2E TypeScript passed (`/tmp/wbp1-tsc-post-sync.log`, `/tmp/wbp1-e2e-tsc-final3.log`). Mobile English and Chinese catalogs each have 2,221 identical keys; the 295 added keys in each catalog did not change or remove an existing key. `git diff --check` passed, HEAD stayed at `d405969`, and no files were staged, committed, or pushed.
- These checks verify behavior and build health. They do not establish pixel identity.

## Review follow-up, 3 Nov 2026

- On regular-width iPad, a configured source without a snapshot again exposes Refresh. The compact first-run page retains its own Refresh now action.
- The locked-sync prompt's Unlock and Continue without sync buttons now announce their visible labels. Wallets announces What moved as its heading at every selected period. The app-error alert no longer includes duplicate hidden load-failure copy.
- The date sheet keeps the calendar at the reference position by placing the chart switches after Apply. From and To accept typed dates on Enter or blur, calendar buttons include the full date in their accessible names, and the selected end day is included in snapshot counts. Overview preserves a stored range during initial loading and clears it when the user chooses All.
- Compact loading and partial Overview states omit the live-total row. This removes the contradictory total in partial and quota states and aligns the loading reference. Comparison masking again leaves unit prices readable. The chart chip's missing-role check and the loading-grid capture check were restored.
- Fresh 390px captures using the reviewer's RGB-channel threshold now measure Overview **3.94%**, range **5.44%**, Wallets all **8.53%**, first-run empty **2.12%**, first-run one **4.19%**, loading **2.13%**, refresh partial **6.72%**, and refresh quota **9.90%**. The pairs and ratios are pinned in `/tmp/wbp1-review-final/` and `/tmp/review-current-ratios.txt`. Every captured page's Remaining differences section records its current ratio. Alternate refresh and sync-unlock references conflict with the core Overview composition; each affected page records that conflict. The current acceptance rule allows documented product limitations above 3%.

## Review follow-up verification

- Full Vitest passed in four shards: 863, 770, 629, and 786 tests passed, with 7 skipped overall (`/tmp/review-vitest-q1.log` through `/tmp/review-vitest-q4.log`). The final focused rerun after the last accessibility edits passed 31/31 (`/tmp/review-final-focused-vitest.log`).
- Mobile Playwright passed all four shards: 115, 111, 117, and 65 tests, 408/408 overall (`/tmp/review-mobile-final-q1.log`, `/tmp/review-mobile-pass-q2.log` through `/tmp/review-mobile-pass-q4.log`). Desktop Playwright passed 92 and 84 tests in its final two shards, with 83 skipped overall (`/tmp/review-desktop-clean-q1.log`, `/tmp/review-desktop-pass-q2.log`).
- The final Overview fidelity recapture passed 16/16 (`/tmp/review-overview-final-captures.log`). Rust pure tests passed 115/115 (`/tmp/review-final-cargo.log`). App and E2E TypeScript passed (`/tmp/review-postfix-tsc.log`, `/tmp/review-postfix-e2e-tsc.log`). The mobile catalogs retain 2,221 identical keys; `git diff --check` passed, the real index is unstaged, and HEAD remains `d405969`.

## Current owner-rule measurements

These 390px captures compare the design HTML with the product using the reviewer’s rule: a pixel differs when any RGB channel differs by more than 20. The table is measured from the current affected-spec captures. Each linked page records the visible leftovers and why the product retains them. Full-page values include content below the first viewport.

| Screen | Viewport / primary capture | Full page, if captured |
| --- | ---: | ---: |
| [overview](overview-phone.md) | 2.81% | 9.76% |
| [overview-more](overview-more-phone.md) | 6.92% | — |
| [overview-ptr](overview-ptr-phone.md) | 3.23% | — |
| [overview-range](overview-range-phone.md) | 4.96% | — |
| [overview-sync](overview-sync-phone.md) | 9.46% | — |
| [overview-hover](overview-hover-phone.md) | 3.10% | — |
| [overview-ai-off](overview-ai-off-phone.md) | 2.81% | 9.20% |
| [overview-stale](overview-stale-phone.md) | 2.81% | 13.61% |
| [wallets-all](wallets-all-phone.md) | 2.40% | 5.20% |
| [wallets-binance](wallets-binance-phone.md) | 2.95% | 5.09% |
| [wallets-okx](wallets-okx-phone.md) | 4.01% | 5.22% |
| [comparison](comparison-phone.md) | — | 2.85% |
| [comparison-picker](comparison-picker-phone.md) | 4.97% | — |
| [firstrun-empty](firstrun-empty-phone.md) | 2.12% | 2.63% |
| [firstrun-one](firstrun-one-phone.md) | 2.27% | 2.78% |
| [guide-1](guide-1-phone.md) | 3.79% | — |
| [guide-2](guide-2-phone.md) | 3.95% | — |
| [guide-3](guide-3-phone.md) | 2.86% | — |
| [guide-4](guide-4-phone.md) | 2.46% | — |
| [guide-5](guide-5-phone.md) | 5.52% | — |
| [loading](loading-phone.md) | 2.13% | — |
| [refresh-idle](refresh-idle-phone.md) | 13.52% | 11.56% |
| [refresh-partial](refresh-partial-phone.md) | 3.87% | 6.59% |
| [refresh-partial-pop](refresh-partial-pop-phone.md) | 4.38% | — |
| [refresh-progress](refresh-progress-phone.md) | 10.70% | 10.26% |
| [refresh-ptr](refresh-ptr-phone.md) | 12.42% | 11.32% |
| [refresh-ptrrun](refresh-ptrrun-phone.md) | 12.74% | 11.38% |
| [refresh-quota](refresh-quota-phone.md) | 4.13% | 6.62% |
| [refresh-quota-pop](refresh-quota-pop-phone.md) | 4.46% | — |
| [startup-error](startup-error-phone.md) | 9.13% | — |
| [startup-syncunlock](startup-syncunlock-phone.md) | 16.86% | — |
| [startup-syncunlock-error](startup-syncunlock-error-phone.md) | 12.61% | — |
| [toasts-ok](toasts-ok-phone.md) | 13.09% | — |
| [toasts-stack](toasts-stack-phone.md) | 12.02% | — |

The flows refresh, sync-unlock, and toast HTML uses an alternate Overview composition for the same route. The app retains the approved core Overview behind those states. Noncaptured catalogue/native startup states and the desktop-only updater are explained in their own page notes.

## Current verification

- TypeScript: app and E2E `tsc --noEmit` both passed.
- Vitest: 353 files passed, 2 skipped; 3,049 tests passed, 7 skipped.
- Rust pure tests: 115 passed.
- UI refactor guard: passed on a temporary committed copy of this working tree; the main repository was not committed.
- Desktop Playwright: 176 passed, 83 capture-only skips.
- Mobile Playwright, four shards with two workers: 115 + 111 + 117 + 65 = 408 passed.
- The previously load-sensitive mobile data-change test passed alone (15/15), and desktop sync feedback plus format golden passed alone (16/16). The original five-second format golden timeout also passed alone (4/4).

## Toast tap-target follow-up

- The toast design source renders each Close area as 44×44px, including x329 on the stack. The compact Overview toast now keeps that area while the visible glyph stays 16px. Retry, Details, and Undo use the source widths of 42, 50, and 40px; Details uses the muted source colour. A mobile browser test checks these sizes and verifies that a long notification keeps its action below the description.
- The new stack capture differs by 12.02%, down from 12.04%; the success capture remains 13.09%. The dominant remaining difference is the alternate Overview composition in the flows source, documented per screen. Fresh source and app pairs are in `/tmp/wbp1-r7/`.
