// Orchestrator — main entry point
//
// Implements the SQ/EQ pattern inspired by Codex:
//   Submit tasks (SQ) → Orchestrator processes → Consume events (EQ)
//
// The orchestrator decides whether a query needs full orchestration
// (analysis → parallel execution → synthesis → refinement) or can
// fall through to the normal tool-calling loop.
//
// Usage from useChat:
//   const events = orchestrateQuery({ endpoint, apiKey, model, ... }, query);
//   for await (const ev of events) { /* dispatch to UI */ }

import { analyzeQuery } from "./analyzer";
import { executePlan } from "./scheduler";
import { synthesizeResults } from "./synthesizer";
import { refineOutput, shouldOptimize } from "./optimizer";
import type {
  AnalysisPlan,
  LlmCallParams,
  OrchestratorEvent,
  OrchestratorOptions,
  SubTaskResult,
} from "./types";

// ── Top-level API ──

/**
 * Analyse a user query and produce orchestration events.
 *
 * The caller (e.g. useChat.send) consumes these events and maps them
 * to UI blocks (agent status, text, chart, error, done).
 *
 * When the yield is empty (no analysis → no tasks) the caller should
 * fall back to the normal tool-calling loop.
 */
export async function* orchestrateQuery(
  options: OrchestratorOptions,
  query: string,
  historySnapshot: string,
): AsyncGenerator<OrchestratorEvent> {
  if (options.signal?.aborted) {
    yield { kind: "done" };
    return;
  }

  // ── 1. Analyse ──
  let plan: AnalysisPlan;

  if (options.skipAnalyzer && options.planOverride) {
    plan = options.planOverride;
  } else {
    const llmParams = llmParamsFromOptions(options);
    plan = await analyzeQuery(llmParams, query, historySnapshot);
  }

  // If the query is simple (no tasks), let the caller handle it the
  // normal way.  Yield nothing so the caller detects this case.
  if (plan.tasks.length === 0) {
    return;
  }

  if (options.signal?.aborted) {
    yield { kind: "done" };
    return;
  }

  // ── 2. Execute (parallel scheduling) ──
  const ctx = {
    baseCurrency: {
      alias: options.baseCurrency.alias ?? "",
      symbol: options.baseCurrency.symbol ?? "",
      currency: options.baseCurrency.currency,
      rate: options.baseCurrency.rate,
    },
    signal: options.signal,
  };

  const collectedResults: SubTaskResult[] = [];

  for await (const ev of executePlan(plan, ctx, options.signal)) {
    yield ev;
    if (ev.kind === "agent_complete") {
      collectedResults.push(ev.result);
    }
  }

  if (options.signal?.aborted) {
    yield { kind: "done" };
    return;
  }

  // ── 3. Synthesize ──
  yield { kind: "synthesizing" };

  const llmParams = llmParamsFromOptions(options);
  const synth = await synthesizeResults(
    llmParams,
    plan,
    collectedResults,
  );

  if (options.signal?.aborted) {
    yield { kind: "done" };
    return;
  }


  // ── 4. Optimize (self-critique loop) ──
  const optimize = shouldOptimize(plan);
  let finalText = synth.text;

  if (optimize && finalText.trim()) {
    const maxRounds = Math.max(1, Math.min(3, plan.maxOptimizerRounds));
    const totalRounds = maxRounds;

    for (let round = 0; round < maxRounds; round++) {
      if (options.signal?.aborted) break;
      yield { kind: "optimizing", round: round + 1, totalRounds };

      const optResult = await refineOutput(
        llmParams,
        plan,
        finalText,
        collectedResults,
        1,
      );

      if (options.signal?.aborted) break;
      if (optResult.text.trim()) {
        finalText = optResult.text;
      }
    }
  }

  // ── 5. Stream final text ──
  if (finalText.trim()) {
    yield { kind: "text", delta: finalText };
  } else {
    yield {
      kind: "text",
      delta:
        "I analysed your portfolio but couldn't generate a summary. The data is available in the agent results above.",
    };
  }

  yield { kind: "done" };
}


function llmParamsFromOptions(options: OrchestratorOptions): LlmCallParams {
  return {
    endpoint: options.endpoint,
    apiKey: options.apiKey,
    model: options.model,
    messages: [],
  };
}
