import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSkillRegistry,
  getSkill,
  listSkills,
  registerSkill,
  runSkill,
  toOpenAITools,
} from "./tools";
import type { Skill } from "./skills/types";

const noopSkill: Skill = {
  name: "noop",
  description: "Returns a static payload.",
  parameters: { type: "object", properties: {} },
  async run() {
    return { data: { ok: true } };
  },
};

const failingSkill: Skill = {
  name: "fail",
  description: "Throws on run.",
  parameters: { type: "object", properties: {} },
  async run() {
    throw new Error("boom");
  },
};

beforeEach(() => {
  clearSkillRegistry();
});

describe("tools registry", () => {
  it("registers and retrieves skills", () => {
    registerSkill(noopSkill);
    expect(getSkill("noop")).toBe(noopSkill);
    expect(listSkills().map((s) => s.name)).toEqual(["noop"]);
  });

  it("toOpenAITools emits the OpenAI function schema", () => {
    registerSkill(noopSkill);
    const tools = toOpenAITools();
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      name: "noop",
      description: "Returns a static payload.",
    });
    expect(tools[0]?.parameters).toEqual(noopSkill.parameters);
  });

  it("runSkill dispatches to the matching skill", async () => {
    registerSkill(noopSkill);
    const result = await runSkill("noop", {}, {
      baseCurrency: { currency: "USD", rate: 1, alias: "USD", symbol: "$" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.data).toEqual({ ok: true });
    }
  });

  it("runSkill returns an error envelope for unknown skills", async () => {
    const result = await runSkill("missing", {}, {
      baseCurrency: { currency: "USD", rate: 1, alias: "USD", symbol: "$" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("missing");
    }
  });

  it("runSkill returns an error envelope when the skill throws", async () => {
    registerSkill(failingSkill);
    const result = await runSkill("fail", {}, {
      baseCurrency: { currency: "USD", rate: 1, alias: "USD", symbol: "$" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("boom");
    }
  });

  it("rejects malformed arguments before invoking a skill", async () => {
    let calls = 0;
    registerSkill({
      name: "required_symbol",
      description: "Lookup",
      parameters: {
        type: "object",
        properties: { symbol: { type: "string" }, kind: { type: "string", enum: ["crypto", "stock"] } },
        required: ["symbol"],
      },
      async run() {
        calls++;
        return { data: {} };
      },
    });
    const ctx = { baseCurrency: { currency: "USD", rate: 1, alias: "USD", symbol: "$" } };
    expect((await runSkill("required_symbol", { __raw: "{oops" }, ctx)).ok).toBe(false);
    expect((await runSkill("required_symbol", { symbol: 1 }, ctx)).ok).toBe(false);
    expect((await runSkill("required_symbol", { symbol: "BTC", kind: "bond" }, ctx)).ok).toBe(false);
    expect(calls).toBe(0);
    expect((await runSkill("required_symbol", { symbol: "BTC" }, ctx)).ok).toBe(true);
  });

  it("treats optional null as absent and ignores unknown model keys", async () => {
    let received: Record<string, unknown> | undefined;
    registerSkill({
      name: "lookup", description: "Lookup",
      parameters: { type: "object", properties: { symbol: { type: "string" }, to: { type: "string" } }, required: ["symbol"] },
      async run(args) { received = args; return { data: {} }; },
    });
    const result = await runSkill("lookup", { symbol: "BTC", to: null, extra: "ignored" }, {
      baseCurrency: { currency: "USD", rate: 1, alias: "USD", symbol: "$" },
    });
    expect(result.ok).toBe(true);
    expect(received).toEqual({ symbol: "BTC" });
  });

  it("accepts finite numeric strings for number arguments and passes numbers to skills", async () => {
    registerSkill({
      name: "numeric_limit", description: "Limit results",
      parameters: { type: "object", properties: { limit: { type: "number" }, maxPoints: { type: "number" } } },
      async run(args) { return { data: args }; },
    });
    const ctx = { baseCurrency: { currency: "USD", rate: 1, alias: "USD", symbol: "$" } };
    const result = await runSkill("numeric_limit", { limit: "20", maxPoints: "30" }, ctx);
    expect(result).toEqual({ ok: true, result: { data: { limit: 20, maxPoints: 30 } } });
    expect((await runSkill("numeric_limit", { limit: "not a number" }, ctx)).ok).toBe(false);
    expect((await runSkill("numeric_limit", { limit: " " }, ctx)).ok).toBe(false);
  });

  it("reports invalid JSON tool arguments clearly", async () => {
    registerSkill(noopSkill);
    const result = await runSkill("noop", { __raw: "{oops" }, {
      baseCurrency: { currency: "USD", rate: 1, alias: "USD", symbol: "$" },
    });
    expect(result).toMatchObject({ ok: false, error: "Invalid arguments for noop: invalid JSON" });
  });

  it("does not print model supplied arguments or results to developer logs", async () => {
    registerSkill({
      name: "lookup",
      description: "Lookup a symbol",
      parameters: { type: "object", properties: { symbol: { type: "string" } } },
      async run() { return { data: {}, text: "private result" }; },
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runSkill("lookup", { symbol: "private argument" }, {
        baseCurrency: { currency: "USD", rate: 1, alias: "USD", symbol: "$" },
      });
      const output = JSON.stringify(log.mock.calls);
      expect(output).not.toContain("private argument");
      expect(output).not.toContain("private result");
    } finally {
      log.mockRestore();
    }
  });

  it("does not print sensitive tool errors to developer logs", async () => {
    registerSkill({
      name: "fails",
      description: "Fails",
      parameters: { type: "object", properties: {} },
      async run() { throw new Error("secret from local data"); },
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await runSkill("fails", {}, {
        baseCurrency: { currency: "USD", rate: 1, alias: "USD", symbol: "$" },
      });
      expect(errorLog.mock.calls.flat().map(String).join(" ")).not.toContain("secret from local data");
    } finally {
      errorLog.mockRestore();
    }
  });
});
