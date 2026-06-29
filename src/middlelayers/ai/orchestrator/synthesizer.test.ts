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
    expect(result.charts).toHaveLength(0);
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
  });

  it("collects charts from completed tasks", async () => {
    mockCallLlm.mockResolvedValue({
      content: "Analysis complete.",
      ok: true,
    });

    const chart1 = { type: "doughnut" as const, labels: ["A", "B"], datasets: [], title: "Chart1" };
    const chart2 = { type: "line" as const, labels: ["x"], datasets: [], title: "Chart2" };

    const results: SubTaskResult[] = [
      {
        id: "t1",
        skillName: "portfolio_summary",
        status: "completed",
        description: "test",
        data: {},
        text: "summary",
        chart: chart1,
      },
      {
        id: "t2",
        skillName: "health_score",
        status: "completed",
        description: "test",
        data: {},
        text: "health",
        chart: chart2,
      },
    ];

    const output = await synthesizeResults(baseParams, dummyPlan, results);

    expect(output.charts).toHaveLength(2);
    expect(output.charts[0]?.title).toBe("Chart1");
    expect(output.charts[1]?.title).toBe("Chart2");
  });
});
