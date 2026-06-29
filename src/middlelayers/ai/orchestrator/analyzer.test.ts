import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { analyzeQuery } from "./analyzer";
import { clearSkillRegistry, registerSkill } from "../tools";
import type { AnalysisPlan } from "./types";

// Mock the LLM helper
vi.mock("./llm", () => ({
  callLlm: vi.fn(),
}));

import { callLlm } from "./llm";

const mockCallLlm = vi.mocked(callLlm);

function registerDummySkills(): void {
  registerSkill({
    name: "portfolio_summary",
    description: "Return portfolio snapshot",
    parameters: { type: "object", properties: { topN: { type: "number" } } },
    async run() {
      return { data: {} };
    },
  });
  registerSkill({
    name: "health_score",
    description: "Compute portfolio health",
    parameters: { type: "object", properties: {} },
    async run() {
      return { data: {} };
    },
  });
}

beforeEach(() => {
  clearSkillRegistry();
  registerDummySkills();
  mockCallLlm.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("orchestrator.analyzer", () => {
  it("returns a fallback plan when LLM call fails", async () => {
    mockCallLlm.mockResolvedValue({
      content: "",
      ok: false,
      error: "Network error",
    });

    const plan = await analyzeQuery(
      { endpoint: "https://test.com", apiKey: "sk-test", model: "gpt-4o-mini", messages: [] },
      "what is my portfolio?",
      "",
    );

    expect(plan.tasks).toHaveLength(0);
    expect(plan.requiresRefinement).toBe(false);
  });

  it("returns a fallback plan when LLM returns simple complexity", async () => {
    mockCallLlm.mockResolvedValue({
      content: JSON.stringify({
        complexity: "simple",
        reasoning: "simple query",
        tasks: [],
        requiresRefinement: false,
        maxOptimizerRounds: 0,
      }),
      ok: true,
    });

    const plan = await analyzeQuery(
      { endpoint: "https://test.com", apiKey: "sk-test", model: "gpt-4o-mini", messages: [] },
      "what is my portfolio?",
      "",
    );

    expect(plan.tasks).toHaveLength(0);
  });

  it("parses a multi-task plan from LLM response", async () => {
    mockCallLlm.mockResolvedValue({
      content: JSON.stringify({
        complexity: "multi",
        reasoning: "need portfolio data and health score",
        tasks: [
          {
            id: "t1",
            skillName: "portfolio_summary",
            args: { topN: 5 },
            description: "Fetch portfolio summary",
            dependsOn: [],
          },
          {
            id: "t2",
            skillName: "health_score",
            args: {},
            description: "Compute health score",
            dependsOn: [],
          },
        ],
        requiresRefinement: true,
        maxOptimizerRounds: 1,
      }),
      ok: true,
    });

    const plan = await analyzeQuery(
      { endpoint: "https://test.com", apiKey: "sk-test", model: "gpt-4o-mini", messages: [] },
      "how healthy is my portfolio?",
      "",
    );

    expect(plan.tasks).toHaveLength(2);
    expect(plan.tasks[0]!.skillName).toBe("portfolio_summary");
    expect(plan.tasks[1]!.skillName).toBe("health_score");
    expect(plan.requiresRefinement).toBe(true);
    expect(plan.maxOptimizerRounds).toBe(1);
  });

  it("skips tasks referencing unknown skills", async () => {
    mockCallLlm.mockResolvedValue({
      content: JSON.stringify({
        complexity: "multi",
        reasoning: "test",
        tasks: [
          {
            id: "t1",
            skillName: "nonexistent_skill",
            args: {},
            description: "does not exist",
            dependsOn: [],
          },
        ],
        requiresRefinement: false,
        maxOptimizerRounds: 0,
      }),
      ok: true,
    });

    const plan = await analyzeQuery(
      { endpoint: "https://test.com", apiKey: "sk-test", model: "gpt-4o-mini", messages: [] },
      "test query",
      "",
    );

    // Unknown skill should be filtered, resulting in empty tasks => fallback
    expect(plan.tasks).toHaveLength(0);
  });
});
