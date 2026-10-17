import { describe, expect, it } from "vitest";
import { scoreGoldenCase, compareBaseline } from "./scoring";

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
});
