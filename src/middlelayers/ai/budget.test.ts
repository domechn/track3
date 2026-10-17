import { describe, expect, it } from "vitest";
import { estimateTokens, trimProviderMessages, serializeBudgeted } from "./budget";
import type { ProviderMessage } from "./types";

describe("AI context budget", () => {
  it("estimates CJK prose more densely than Latin prose and JSON more densely than prose", () => {
    expect(estimateTokens("投资组合今日上涨")).toBeGreaterThan(estimateTokens("portfolio grew"));
    expect(estimateTokens('{"items":[{"value":123},{"value":456}]}', "json"))
      .toBeGreaterThan(estimateTokens('{"items":[{"value":123},{"value":456}]}', "prose"));
  });

  it("keeps the system prompt and complete tool call/result pairs while trimming", () => {
    const messages: ProviderMessage[] = [
      { role: "system", content: "instructions" },
      { role: "user", content: "old" },
      { role: "assistant", content: null, tool_calls: [{ id: "a", type: "function", function: { name: "x", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "a", content: "result" },
      { role: "user", content: "new" },
    ];
    expect(trimProviderMessages(messages, 20).map((m) => m.role)).toEqual(["system", "user"]);
    expect(trimProviderMessages(messages, 100).map((m) => m.role)).toEqual(messages.map((m) => m.role));
  });

  it("keeps totals and both ends of large arrays with a truncation marker", () => {
    const result = serializeBudgeted({ total: 100, rows: Array.from({ length: 100 }, (_, id) => ({ id, note: "abcdefghij" })) }, 110);
    expect(result).toContain("[truncated:");
    expect(result).toContain("narrow the query (date range, limit)");
    expect(result).toContain('"total":100');
    expect(result).toContain('"id":0');
    expect(result).toContain('"id":99');
    expect(estimateTokens(result, "json")).toBeLessThanOrEqual(130);
  });

  it("honors a tiny result budget while still marking omitted data", () => {
    const result = serializeBudgeted({ rows: Array.from({ length: 100 }, (_, i) => ({ id: i, text: "资".repeat(100) })) }, 12);
    expect(result).toContain("[truncated:");
    expect(estimateTokens(result, "json")).toBeLessThanOrEqual(12);
  });

  it("keeps totals near the end of a wide object when the fallback truncates", () => {
    const result = serializeBudgeted({ prices: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`asset${i}`, "x".repeat(80)])), totalUsd: 12345 }, 90);
    expect(result).toContain('"totalUsd":12345');
    expect(result).toContain("[truncated:");
  });

  it("keeps a total in the middle of a wide object under a tight budget", () => {
    const prices = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`asset${i}`, "x".repeat(80)]));
    const result = serializeBudgeted({ ...Object.fromEntries(Object.entries(prices).slice(0, 50)), totalUsd: 12345,
      ...Object.fromEntries(Object.entries(prices).slice(50)) }, 70);
    expect(result).toContain('"totalUsd":12345');
    expect(result).toContain("[truncated:");
  });
});
