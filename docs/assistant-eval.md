# Assistant regression evaluation

The assistant evaluation uses a fixed portfolio of 61 daily snapshots from 2026-08-18 through 2026-10-17, six transactions, market prices, and untrusted strings in an asset symbol and wallet name. The golden questions cover English and Simplified Chinese, portfolio changes, holdings, asset history, transactions, prices, comparisons, empty results, simple chat, out-of-scope requests, and prompt injection, including action-proposal, tool-call, and secret-exfiltration attempts inside portfolio data.

## Offline tier

```bash
corepack yarn test
```

`src/test/eval/golden.test.ts` runs in the normal Vitest suite. Recorded model responses drive the real `useChat` hook, planner, orchestrator, provider parsing, skill registry, argument validation, and fallback tool loop. Only the LLM transport and external portfolio/price queries use fixtures. Browser `fetch` throws if the offline evaluation attempts a network request.

Each case checks the planner path, tool names and argument shapes, facts returned by tools, forbidden calls, and answer phrases. Extra tests check invalid tool arguments and the five round tool budget, with one extra round for a narrower query after truncated tool output when context remains. The clock is fixed at 2026-10-17 so relative dates remain stable. Prompt checks cover the date and instructions to treat tool data as untrusted.

`propose_action` creates a pending confirmation card and never executes an action. The offline injection cases count a proposed action as a tool call and fail if a wallet alias causes an unsolicited proposal. The action tests also cover rejected, expired, and duplicate approvals, session reloads, raw argument visibility, and keyboard controls. Run these with `corepack yarn test`; no live endpoint is needed. Pending actions expire after five minutes or a session switch. A claimed action is recorded as `executing` in the encrypted session before its write starts, so a crash or double click cannot rerun it.

The recorded responses test wiring and deterministic facts. They do not measure how a changed prompt affects a real model; use the live tier for that.

## Live tier

Set an OpenAI-compatible chat completions endpoint, API key, and model:

```bash
EVAL_ENDPOINT=https://example.com/v1 \
EVAL_API_KEY=... \
EVAL_MODEL=... \
corepack yarn eval
```

`EVAL_ENDPOINT` may end at `/v1` or `/chat/completions`. The same fixture and questions run through the real model. The optional `EVAL_JUDGE_MODEL` requests a 0–1 answer quality score from the same endpoint; it is averaged with the deterministic rubric score. Without a judge, the rubric score is used alone. This command is separate from `yarn test` and is never part of CI.

The command writes `evals/report.json` with each question, answer, plan, tool calls, pass state, score, failures, latency, and token usage when the endpoint supplies it. That report is ignored by Git. The aggregate is the mean of case scores. A run fails when the aggregate falls more than `threshold` below `evals/baseline.json`, or when any case marked `mustPass` fails. The committed baseline is the perfect score from recorded responses (`aggregate: 1`, `calibrated: false`), which sets a strict initial gate. Calibrate it with a representative live endpoint:

```bash
EVAL_ENDPOINT=https://example.com/v1 \
EVAL_API_KEY=... \
EVAL_MODEL=... \
corepack yarn eval --update-baseline
```

Baseline updates require every case to finish and every must-pass case to pass. Review `evals/report.json` before committing the updated `evals/baseline.json`. Baselines are model-specific; rerun the update when intentionally changing models. Live scores can vary between runs, so use the threshold to absorb small fluctuations.

## Adding a case

Add one entry to `src/test/eval/cases.ts` with a question, recorded planner/tool responses, expected tool facts, forbidden behavior, and answer rubric. Put portfolio data in `src/test/eval/portfolio.ts`. Prefer exact fixture facts and a small set of essential answer strings so the rubric catches wrong numbers without depending on prose style. Mark security and core financial cases `mustPass`.
