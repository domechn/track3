import { beforeEach, describe, expect, it } from "vitest";
import { clearSkillRegistry, registerSkill } from "./tools";
import { buildSystemPrompt } from "./prompt";
import type { Skill } from "./skills/types";

const dummySkill: Skill = {
  name: "dummy",
  description: "A dummy skill for testing the prompt builder.",
  parameters: { type: "object", properties: { x: { type: "number" } } },
  async run() {
    return { data: {} };
  },
};

beforeEach(() => {
  clearSkillRegistry();
});

describe("buildSystemPrompt", () => {
  it("mentions the base currency", () => {
    const prompt = buildSystemPrompt({
      currency: "EUR",
      rate: 0.92,
      alias: "EUR",
      symbol: "€",
    });
    expect(prompt).toContain("EUR");
    expect(prompt).toContain("0.92");
  });

  it("lists every registered skill with its name and description", () => {
    registerSkill(dummySkill);
    const prompt = buildSystemPrompt({
      currency: "USD",
      rate: 1,
      alias: "USD",
      symbol: "$",
    });
    expect(prompt).toContain("dummy");
    expect(prompt).toContain("A dummy skill for testing");
    expect(prompt).toContain("args:");
  });
});
