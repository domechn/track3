// Task Analyzer
//
// Given a user query, asks the LLM to classify the intent and produce
// a structured analysis plan listing which skills to invoke and in
// what order.  The plan can then be executed by the scheduler.
//
// This mirrors Codex's approach to task decomposition: instead of
// letting the model guess tools one at a time via trial-and-error,
// we plan first, execute in parallel, then synthesise.

import { callLlm } from "./llm";
import { listSkills } from "../tools";
import type { AnalysisPlan, LlmCallParams, SubTaskDefinition } from "./types";

// ── Prompt template ──

function buildAnalyzerPrompt(
  query: string,
  historySnapshot: string,
): string {
  const skills = listSkills();
  const toolCatalog = skills
    .map(
      (s) =>
        `- "${s.name}": ${s.description}\n  args schema: ${JSON.stringify(s.parameters)}`,
    )
    .join("\n");

  return [
    "You are a portfolio-analysis planner. Given a user query and recently available tools, produce a JSON plan.",
    "",
    "Rules:",
    "- Output ONLY valid JSON — no markdown, no commentary.",
    "- Include only skills listed below. Do not invent tools.",
    "- Set `complexity` to `\"simple\"` if 1 skill is sufficient, `\"multi\"` if >= 2 are needed.",
    "- For `complexity: \"simple\"`, set `tasks` to an empty array `[]`. The caller will let the model handle it directly.",
    "- For `complexity: \"multi\"`, define 1 task per skill needed.",
    "- Use `dependsOn: []` for independent tasks (they run in parallel).",
    "- If one task naturally feeds into another, set dependsOn accordingly.",
    "- Set `requiresRefinement: true` when the answer would benefit from a self-critique pass (analytical or comparative queries).",
    "- `maxOptimizerRounds`: 1 for refinement, 0 otherwise.",
    "",
    "JSON schema:",
    JSON.stringify(
      {
        complexity: "simple | multi",
        reasoning: "short explanation of your plan",
        tasks: [
          {
            id: "t1",
            skillName: "skill_name_here",
            args: { /* skill args as per schema above */ },
            description: "short label for UI",
            dependsOn: [],
          },
        ],
        requiresRefinement: false,
        maxOptimizerRounds: 0,
      },
      null,
      2,
    ),
    "",
    "Available tools:",
    toolCatalog,
    "",
    "Recent conversation context:",
    historySnapshot || "(none)",
    "",
    "User query:",
    query,
  ].join("\n");
}

// ── Public API ──

export async function analyzeQuery(
  params: LlmCallParams,
  query: string,
  historySnapshot: string,
): Promise<AnalysisPlan> {
  const prompt = buildAnalyzerPrompt(query, historySnapshot);
  const result = await callLlm({
    ...params,
    temperature: 0.1, // low temperature for reliable JSON
    messages: [
      { role: "system", content: prompt },
    ],
  });

  if (!result.ok || !result.content) {
    // Fall back to simplest possible plan: let the model figure it out
    return fallbackPlan(query);
  }

  const parsed = tryParseJson(result.content);
  if (!parsed || typeof parsed !== "object") {
    return fallbackPlan(query);
  }

  const obj = parsed as Record<string, unknown>;
  const complexity = String(obj.complexity ?? "simple");
  const rawTasks = obj.tasks;

  if (complexity === "simple" || !Array.isArray(rawTasks) || rawTasks.length === 0) {
    return fallbackPlan(query);
  }

  const tasks: SubTaskDefinition[] = [];
  const knownSkillNames = new Set(listSkills().map((s) => s.name));

  for (const raw of rawTasks) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const skillName = String(r.skillName ?? "");
    if (!knownSkillNames.has(skillName)) continue;

    tasks.push({
      id: String(r.id ?? `t${tasks.length + 1}`),
      skillName,
      args: (typeof r.args === "object" && r.args !== null
        ? r.args
        : {}) as Record<string, unknown>,
      description: String(r.description ?? skillName),
      dependsOn: Array.isArray(r.dependsOn)
        ? r.dependsOn.map(String).filter((d) => d !== String(r.id))
        : [],
    });
  }

  // If the LLM returned a plan with valid tasks, use it
  if (tasks.length > 0) {
    return {
      query,
      tasks,
      requiresRefinement: obj.requiresRefinement === true,
      maxOptimizerRounds:
        obj.requiresRefinement === true
          ? Math.max(0, Math.min(3, Number(obj.maxOptimizerRounds) || 1))
          : 0,
    };
  }

  return fallbackPlan(query);
}

// ── Fallback ──

function fallbackPlan(query: string): AnalysisPlan {
  return {
    query,
    tasks: [],
    requiresRefinement: false,
    maxOptimizerRounds: 0,
  };
}

function tryParseJson(raw: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(raw);
  } catch {
    // empty
  }
  // Strip markdown fences
  const trimmed = raw.trim();
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try {
      return JSON.parse(match[1]!.trim());
    } catch {
      return null;
    }
  }
  return null;
}
