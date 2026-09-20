// Result Synthesizer
//
// Takes the outputs of multiple parallel sub-agents and asks the LLM
// to weave them into a single, coherent answer.  The synthesizer is
// the "merge" step of the orchestrator: it replaces the model's
// turn-by-turn tool calling with a single informed response.
//
// This mirrors Codex's approach: let the system gather context in
// parallel, then let the model reason over the full context in one
// shot instead of incrementally.

import { callLlm } from "./llm";
import type { AnalysisPlan, LlmCallParams, SubTaskResult } from "./types";

// ── Prompt template ──

export type SynthesisOptions = {
  /** Recent conversation turns so follow-ups like "ok" keep their meaning. */
  historySnapshot?: string;
  /** Model context window in tokens; bounds how much raw data we inline. */
  contextSize?: number;
};

const DEFAULT_CONTEXT_SIZE = 8192;
// Compact JSON tokenizes densely (~2.5 chars/token measured on transaction
// rows); give data 60% of the window and leave the rest for prompt + answer.
export const JSON_CHARS_PER_TOKEN = 2.5;
const DATA_SHARE_OF_CONTEXT = 0.6;
const MIN_CHARS_PER_AGENT = 1500;

/** Character budget for one agent's raw data when n agents share the window. */
export function perAgentDataChars(contextSize: number | undefined, n: number): number {
  const ctx = contextSize ?? DEFAULT_CONTEXT_SIZE;
  return Math.max(
    MIN_CHARS_PER_AGENT,
    Math.floor((ctx * JSON_CHARS_PER_TOKEN * DATA_SHARE_OF_CONTEXT) / Math.max(1, n)),
  );
}

export function serializeData(data: unknown, maxChars: number): string {
  const json = JSON.stringify(data);
  if (json.length <= maxChars) return json;
  return `${json.slice(0, maxChars)}\n[truncated: showing ${maxChars} of ${json.length} chars — narrow the query (date range, limit) if the missing part matters]`;
}

function buildSynthesisPrompt(
  query: string,
  completedTasks: SubTaskResult[],
  options: SynthesisOptions,
): string {
  const perAgentChars = perAgentDataChars(options.contextSize, completedTasks.length);

  const resultsBlock = completedTasks
    .map(
      (r, i) =>
        `[Agent ${i + 1}: ${r.description} — ${r.skillName}]
${r.text ?? "(no text summary)"}
${r.data ? `\nData: ${serializeData(r.data, perAgentChars)}` : ""}`,
    )
    .join("\n\n");

  return [
    "You are the Track3 portfolio assistant synthesising analysis results into a final answer.",
    "",
    "Rules:",
    "- Synthesise the data below into a natural, helpful answer for the user.",
    "- Do NOT describe which tools you called or that results came from 'agents'. Just answer the question.",
    "- Be concise. Use short paragraphs or compact lists.",
    "- If some data is missing, truncated, or errors occurred, say so briefly.",
    "- Reply in the language the user writes in (see the conversation below).",
    "- If the data doesn't answer the query, say so plainly.",
    "- You cannot draw charts or create files; present numbers as tables instead.",
    "",
    "Recent conversation:",
    options.historySnapshot || "(none)",
    "",
    "User query:",
    query,
    "",
    "Analysis results:",
    resultsBlock,
  ].join("\n");
}

// ── Public API ──

export interface SynthesisOutput {
  text: string;
}

export async function synthesizeResults(
  params: LlmCallParams,
  plan: AnalysisPlan,
  results: SubTaskResult[],
  options: SynthesisOptions = {},
): Promise<SynthesisOutput> {
  const completed = results.filter((r) => r.status === "completed");

  if (completed.length === 0) {
    return {
      text: "I wasn't able to gather any data to answer your question. Please check your portfolio configuration.",
    };
  }

  const prompt = buildSynthesisPrompt(plan.query, completed, options);
  const llmResult = await callLlm({
    ...params,
    temperature: 0.3,
    messages: [{ role: "system", content: prompt }],
  });

  if (!llmResult.ok || !llmResult.content) {
    // Fallback: concatenate agent summaries, and say why so a failing
    // endpoint is not mistaken for a finished answer.
    const text = completed
      .map((r) => r.text ?? "")
      .filter(Boolean)
      .join("\n\n");
    const reason = llmResult.error ? `\n\n[synthesis failed: ${llmResult.error}]` : "";
    return { text: (text || "Analysis complete. See data above.") + reason };
  }

  return { text: llmResult.content };
}
