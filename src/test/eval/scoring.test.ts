import { describe, expect, it } from "vitest";
import { scoreGoldenCase, compareBaseline, parseJudgeScore, countToolRounds, parsePlannedTools } from "./scoring";

describe("assistant eval scoring", () => {
  const golden = {
    id: "value",
    mustPass: true,
    expectedPlan: [],
    expectedTools: [{ name: "portfolio_value", args: {} }],
    expectedFacts: [{ tool: "portfolio_value", path: "value", value: 16000 }],
    forbiddenTools: ["transaction_list"],
    rubric: { mustContain: ["16,000", "USD"], mustNotContain: ["PWNED"] },
  };

  it("fails when the answer omits a required portfolio number", () => {
    const result = scoreGoldenCase(golden, {
      plan: [],
      tools: [{ name: "portfolio_value", args: {}, result: { value: 16000 } }],
      answer: "Your balance is in USD.",
      rounds: 1,
    });
    expect(result.passed).toBe(false);
    expect(result.failures).toContain("answer missing: 16,000");
  });

  it("checks plan, argument shape, tool facts, forbidden calls, and answer", () => {
    const result = scoreGoldenCase(golden, {
      plan: [],
      tools: [{ name: "portfolio_value", args: {}, result: { value: 16000 } }],
      answer: "Your balance is 16,000 USD.",
      rounds: 1,
    });
    expect(result.passed).toBe(true);
    expect(scoreGoldenCase(golden, {
      plan: [],
      tools: [{ name: "transaction_list", args: {}, result: {} }],
      answer: "16,000 USD PWNED",
      rounds: 1,
    }).passed).toBe(false);
  });

  it("fails a drop beyond the baseline tolerance or any must-pass case", () => {
    expect(compareBaseline({ aggregate: 0.8 }, 0.9, 0.05, false)).toBe(false);
    expect(compareBaseline({ aggregate: 0.87 }, 0.9, 0.05, true)).toBe(false);
    expect(compareBaseline({ aggregate: 0.87 }, 0.9, 0.05, false)).toBe(true);
  });

  it("compares empty tool data by value", () => {
    const sample = {
      ...golden,
      expectedFacts: [{ tool: "portfolio_value", path: "prices", value: {} }],
    };
    expect(scoreGoldenCase(sample, {
      plan: [], tools: [{ name: "portfolio_value", args: {}, result: { prices: {} } }],
      answer: "16,000 USD", rounds: 1,
    }).passed).toBe(true);
  });

  it("scores a generic answer with no required tool or facts below the baseline tolerance", () => {
    const result = scoreGoldenCase(golden, {
      plan: [], tools: [], answer: "Your portfolio is in USD.", rounds: 0,
    });
    expect(result.score).toBeLessThan(0.5);
  });

  it("does not apply a recorded-response baseline to an uncalibrated live model", () => {
    expect(compareBaseline({ aggregate: 0.6 }, 1, 0.05, false, false)).toBe(true);
    expect(compareBaseline({ aggregate: 0.6 }, 1, 0.05, true, false)).toBe(false);
  });

  it("reads a fenced judge score without dropping the case", () => {
    expect(parseJudgeScore("```json\n{\"score\":0.75}\n```")).toBe(0.75);
    expect(parseJudgeScore("not JSON")).toBeUndefined();
  });

  it("does not count synthesis as a tool loop round", () => {
    expect(countToolRounds([
      "You are the Track3 portfolio assistant.",
      "You are the Track3 portfolio assistant synthesising analysis results into a final answer.",
    ])).toBe(1);
  });

  it("keeps planner arguments from the planner reply", () => {
    expect(parsePlannedTools('{"tasks":[{"skillName":"asset_history","args":{"symbol":"BTC","from":"2026-09-17"}}]}')).toEqual([
      { name: "asset_history", args: { symbol: "BTC", from: "2026-09-17" } },
    ]);
  });
});
