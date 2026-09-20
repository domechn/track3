import { describe, expect, it, vi, beforeEach } from "vitest";
import { refineOutput, shouldOptimize } from "./optimizer";
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

const dummyResults: SubTaskResult[] = [
  {
    id: "t1",
    skillName: "portfolio_summary",
    status: "completed",
    description: "test",
    data: { totalValue: 10000 },
    text: "Portfolio total: $10,000",
  },
];

beforeEach(() => {
  mockCallLlm.mockReset();
});

describe("orchestrator.optimizer", () => {
  it("returns the draft unchanged when maxRounds is 0", async () => {
    const result = await refineOutput(
      baseParams,
      { query: "test", tasks: [], requiresRefinement: true, maxOptimizerRounds: 1 },
      "Original draft answer.",
      dummyResults,
      0,
    );

    expect(result.text).toBe("Original draft answer.");
    expect(result.rounds).toBe(0);
  });

  it("improves the draft when the LLM returns a better version", async () => {
    mockCallLlm.mockResolvedValue({
      content: "Improved answer with more detail.",
      ok: true,
    });

    const result = await refineOutput(
      baseParams,
      { query: "test", tasks: [], requiresRefinement: true, maxOptimizerRounds: 1 },
      "Basic answer.",
      dummyResults,
      1,
    );

    expect(result.text).toBe("Improved answer with more detail.");
    expect(result.rounds).toBe(1);
  });

  it("keeps the current version when the LLM returns a truncated response", async () => {
    mockCallLlm.mockResolvedValue({
      content: "Short.",
      ok: true,
    });

    const result = await refineOutput(
      baseParams,
      { query: "test", tasks: [], requiresRefinement: true, maxOptimizerRounds: 1 },
      "This is a much longer draft answer that should be kept.",
      dummyResults,
      1,
    );

    // "Short." is less than 30% of the original, so it should be kept
    expect(result.text).toBe("This is a much longer draft answer that should be kept.");
    expect(result.rounds).toBe(0);
  });

  it("stops after the configured maxRounds", async () => {
    mockCallLlm.mockResolvedValue({
      content: "Round 2 improved version. With more detail added here.",
      ok: true,
    });

    const result = await refineOutput(
      baseParams,
      { query: "test", tasks: [], requiresRefinement: true, maxOptimizerRounds: 1 },
      "Initial draft.",
      dummyResults,
      1,
    );

    expect(result.rounds).toBe(1);
    expect(mockCallLlm).toHaveBeenCalledTimes(1);
  });
});

describe("orchestrator.shouldOptimize", () => {
  it("returns false when requiresRefinement is false", () => {
    expect(
      shouldOptimize({
        query: "test",
        tasks: [{ id: "t1", skillName: "a", args: {}, description: "", dependsOn: [] }],
        requiresRefinement: false,
        maxOptimizerRounds: 1,
      }),
    ).toBe(false);
  });

  it("returns false when there are fewer than 2 tasks", () => {
    expect(
      shouldOptimize({
        query: "test",
        tasks: [{ id: "t1", skillName: "a", args: {}, description: "", dependsOn: [] }],
        requiresRefinement: true,
        maxOptimizerRounds: 1,
      }),
    ).toBe(false);
  });

  it("returns true for multi-task refinement requests", () => {
    expect(
      shouldOptimize({
        query: "test",
        tasks: [
          { id: "t1", skillName: "a", args: {}, description: "", dependsOn: [] },
          { id: "t2", skillName: "b", args: {}, description: "", dependsOn: [] },
        ],
        requiresRefinement: true,
        maxOptimizerRounds: 1,
      }),
    ).toBe(true);
  });

  it("gives the reviewer the conversation, the language rule, and budgeted data", async () => {
    mockCallLlm.mockResolvedValue({ content: "Improved draft answer text.", ok: true });
    const big = { rows: Array.from({ length: 300 }, (_, i) => ({ i, symbol: "BTC", amount: i })) };

    await refineOutput(
      baseParams,
      { query: "ok", tasks: [], requiresRefinement: true, maxOptimizerRounds: 1 },
      "Draft answer that is long enough to be accepted.",
      [{ id: "t1", skillName: "transaction_list", status: "completed", description: "d", data: big, text: "t" }],
      1,
      { historySnapshot: "user: 买入均价是多少", contextSize: 1024 },
    );

    const prompt = mockCallLlm.mock.calls[0]![0].messages[0]!.content;
    expect(prompt).toContain("买入均价是多少");
    expect(prompt).toContain("[truncated:");
    expect(prompt).toContain("language the user writes in");
    expect(prompt).not.toContain(JSON.stringify(big));
  });
});
