import { beforeEach, describe, expect, it } from "vitest";
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
});
