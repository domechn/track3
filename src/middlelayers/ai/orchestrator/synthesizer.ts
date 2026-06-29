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

function buildSynthesisPrompt(
  query: string,
  completedTasks: SubTaskResult[],
): string {
  const resultsBlock = completedTasks
    .map(
      (r, i) =>
        `[Agent ${i + 1}: ${r.description} — ${r.skillName}]
${r.text ?? "(no text summary)"}
${r.data ? `\nData: ${JSON.stringify(r.data, null, 2).slice(0, 3000)}` : ""}`,
    )
    .join("\n\n");

  return [
    "You are the Track3 portfolio assistant synthesising analysis results into a final answer.",
    "",
    "Rules:",
    "- Synthesise the data below into a natural, helpful answer for the user.",
    "- Do NOT describe which tools you called or that results came from 'agents'. Just answer the question.",
    "- Be concise. Use short paragraphs or compact lists.",
    "- If some data is missing or errors occurred, acknowledge it briefly.",
    "- Use the user's language (the query language).",
    "- If the data doesn't answer the query, say so plainly.",
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
): Promise<SynthesisOutput> {
  const completed = results.filter((r) => r.status === "completed");

  if (completed.length === 0) {
    return {
      text: "I wasn't able to gather any data to answer your question. Please check your portfolio configuration.",
    };
  }

  const prompt = buildSynthesisPrompt(plan.query, completed);
  const llmResult = await callLlm({
    ...params,
    temperature: 0.3,
    messages: [{ role: "system", content: prompt }],
  });

  if (!llmResult.ok || !llmResult.content) {
    // Fallback: concatenate agent summaries
    const text = completed
      .map((r) => r.text ?? "")
      .filter(Boolean)
      .join("\n\n");
    return { text: text || "Analysis complete. See data above." };
  }

  return { text: llmResult.content };
}
