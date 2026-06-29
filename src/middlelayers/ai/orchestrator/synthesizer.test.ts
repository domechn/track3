import { describe, expect, it, vi, beforeEach } from "vitest";
import { synthesizeResults } from "./synthesizer";
import type { AnalysisPlan, LlmCallParams, SubTaskResult } from "./types";

vi.mock("./llm", () => ({
  callLlm: vi.fn(),
}));

import { callLlm } from "./llm";
const mockCallLlm = vi.mocked(callLlm);

const baseParams: LlmCallParams = {
  endpoint: "https://test.com",
  apiKey: "sk-test",
  model: "gpt-4o-mini",
  messages: [],
};

const dummyPlan: AnalysisPlan = {
  query: "how is my portfolio?",
  tasks: [],
  requiresRefinement: true,
  maxOptimizerRounds: 1,
};

beforeEach(() => {
  mockCallLlm.mockReset();
});

describe("orchestrator.synthesizer", () => {
  it("returns a fallback message when no results are completed", async () => {
    const result = await synthesizeResults(baseParams, dummyPlan, []);

    expect(result.text).toContain("I wasn't able to gather any data");
  });

  it("uses LLM response as the synthesized text", async () => {
    mockCallLlm.mockResolvedValue({
      content: "Your portfolio is valued at $10,000 across 5 assets.",
      ok: true,
    });

    const results: SubTaskResult[] = [
      {
        id: "t1",
        skillName: "portfolio_summary",
        status: "completed",
        description: "test",
        data: { totalValue: 10000, assetCount: 5 },
        text: "Total: $10,000, 5 assets",
      },
    ];

    const output = await synthesizeResults(baseParams, dummyPlan, results);

    expect(output.text).toBe("Your portfolio is valued at $10,000 across 5 assets.");
  });

  it("falls through to concatenated summaries when LLM call fails", async () => {
    mockCallLlm.mockResolvedValue({
      content: "",
      ok: false,
      error: "LLM error",
    });

    const results: SubTaskResult[] = [
      {
        id: "t1",
        skillName: "portfolio_summary",
        status: "completed",
        description: "test",
        data: {},
        text: "Summary result A",
      },
      {
        id: "t2",
        skillName: "health_score",
        status: "completed",
        description: "test",
        data: {},
        text: "Health score result B",
      },
    ];

    const output = await synthesizeResults(baseParams, dummyPlan, results);

    expect(output.text).toContain("Summary result A");
    expect(output.text).toContain("Health score result B");
  });});
