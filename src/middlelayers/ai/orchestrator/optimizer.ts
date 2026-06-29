// Output Optimizer
//
// A self-critique loop: given a draft answer and the raw data, ask the
// LLM to review its own output for quality, completeness, and accuracy,
// then produce an improved version.  This mirrors Codex's ability to
// iterate on its output, but applied at the text level rather than the
// code level.
//
// The optimizer is the "multi-round optimization" the user asked for:
// it lets the assistant refine its own answer before presenting it.

import { callLlm } from "./llm";
import type { AnalysisPlan, LlmCallParams, SubTaskResult } from "./types";

// ── Prompt template ──

function buildOptimizerPrompt(
  query: string,
  draft: string,
  results: SubTaskResult[],
): string {
  const resultsBlock = results
    .map(
      (r) =>
        `[${r.skillName}]\n${r.text ?? "(no text)"}\nData: ${JSON.stringify(r.data).slice(0, 2000)}`,
    )
    .join("\n\n");

  return [
    "You are a portfolio-answer reviewer. Your job is to improve the draft answer to a user's question.",
    "",
    "Rules:",
    "- Review the draft critically. Check for:",
    "  1. **Completeness** — Does it fully answer the user's query?",
    "  2. **Accuracy** — Are the numbers and claims backed by the raw data?",
    "  3. **Clarity** — Is the answer easy to understand?",
    "  4. **Conciseness** — Remove redundant or filler content.",
    "  5. **Tone** — Professional and helpful.",
    "- If the draft is already good, output it with minor polish only.",
    "- If the draft is missing important information, add it from the raw data.",
    "- OUTPUT ONLY THE IMPROVED ANSWER. No explanations, no commentary, no meta-analysis.",
    "",
    "User query:",
    query,
    "",
    "Draft answer:",
    draft,
    "",
    "Raw data available:",
    resultsBlock,
  ].join("\n");
}

// ── Public API ──

export interface OptimizerOutput {
  text: string;
  rounds: number;
}

export async function refineOutput(
  params: LlmCallParams,
  plan: AnalysisPlan,
  draft: string,
  results: SubTaskResult[],
  maxRounds: number,
): Promise<OptimizerOutput> {
  if (maxRounds <= 0 || !draft.trim()) {
    return { text: draft, rounds: 0 };
  }

  let current = draft;
  let rounds = 0;

  for (let round = 0; round < Math.min(maxRounds, 3); round++) {
    const prompt = buildOptimizerPrompt(plan.query, current, results);
    const llmResult = await callLlm({
      ...params,
      temperature: 0.2, // low temperature for reliable improvement
      messages: [{ role: "system", content: prompt }],
    });

    if (!llmResult.ok || !llmResult.content) {
      break; // keep current version
    }

    const improved = llmResult.content.trim();
    // Only accept if it's meaningfully different (not just "looks good")
    if (improved.length < current.length * 0.3) {
      break; // empty/truncated response — keep current
    }

    current = improved;
    rounds++;
  }

  return { text: current, rounds };
}

/** Decide whether a query is worth the optimisation cost. */
export function shouldOptimize(plan: AnalysisPlan): boolean {
  // Only optimize for multi-tool analytical queries
  if (!plan.requiresRefinement) return false;
  if (plan.tasks.length < 2) return false;
  return true;
}
