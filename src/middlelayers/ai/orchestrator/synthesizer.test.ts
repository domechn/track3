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
  });

  it("includes the conversation history in the synthesis prompt", async () => {
    mockCallLlm.mockResolvedValue({ content: "ok", ok: true });
    const results: SubTaskResult[] = [
      { id: "t1", skillName: "x", status: "completed", description: "d", data: { a: 1 }, text: "t" },
    ];

    await synthesizeResults(baseParams, { ...dummyPlan, query: "ok" }, results, {
      historySnapshot: "user: 能算出我的 BTC 买入均价吗\nassistant: 我按月分批拉取",
    });

    const prompt = mockCallLlm.mock.calls[0]![0].messages[0]!.content;
    expect(prompt).toContain("买入均价");
    expect(prompt).toContain("ok");
  });

  it("emits compact JSON and an explicit truncation marker when data exceeds the budget", async () => {
    mockCallLlm.mockResolvedValue({ content: "ok", ok: true });
    const big = { rows: Array.from({ length: 200 }, (_, i) => ({ i, symbol: "BTC", amount: i })) };
    const results: SubTaskResult[] = [
      { id: "t1", skillName: "x", status: "completed", description: "d", data: big, text: "t" },
    ];

    await synthesizeResults(baseParams, dummyPlan, results, { contextSize: 1024 });

    const prompt = mockCallLlm.mock.calls[0]![0].messages[0]!.content;
    expect(prompt).not.toContain('{\n  "rows"');
    expect(prompt).toContain("[truncated:");
    expect(prompt.length).toBeLessThan(JSON.stringify(big).length);
  });

  it("does not truncate when the data fits the budget", async () => {
    mockCallLlm.mockResolvedValue({ content: "ok", ok: true });
    const results: SubTaskResult[] = [
      { id: "t1", skillName: "x", status: "completed", description: "d", data: { a: 1 }, text: "t" },
    ];

    await synthesizeResults(baseParams, dummyPlan, results, { contextSize: 128000 });

    const prompt = mockCallLlm.mock.calls[0]![0].messages[0]!.content;
    expect(prompt).not.toContain("[truncated:");
    expect(prompt).toContain('{"a":1}');
  });

  it("keeps one agent's data within 60% of the window at JSON token density", async () => {
    mockCallLlm.mockResolvedValue({ content: "ok", ok: true });
    const big = { rows: Array.from({ length: 2000 }, (_, i) => ({ i, symbol: "BTC", amount: i, price: 60000 + i })) };
    const results: SubTaskResult[] = [
      { id: "t1", skillName: "x", status: "completed", description: "d", data: big, text: "t" },
    ];

    await synthesizeResults(baseParams, dummyPlan, results, { contextSize: 8192 });

    const prompt = mockCallLlm.mock.calls[0]![0].messages[0]!.content;
    const dataStart = prompt.indexOf("Data: ");
    expect(prompt.length - dataStart).toBeLessThanOrEqual(8192 * 2.5 * 0.6 + 300);
  });

  it("surfaces the LLM error in the fallback text", async () => {
    mockCallLlm.mockResolvedValue({ content: "", ok: false, error: "LLM call failed (400): too long" });
    const results: SubTaskResult[] = [
      { id: "t1", skillName: "x", status: "completed", description: "d", data: {}, text: "Summary A" },
    ];
    const output = await synthesizeResults(baseParams, dummyPlan, results);
    expect(output.text).toContain("Summary A");
    expect(output.text).toContain("synthesis failed");
  });
});
