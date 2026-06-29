import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSkillRegistry,
  getSkill,
  listSkills,
  registerSkill,
  runSkill,
} from "../tools";
import skill from "./current-context";

vi.mock("@/utils/app", () => ({
  getVersion: vi.fn(),
}));

import { getVersion } from "@/utils/app";
const mockedGetVersion = vi.mocked(getVersion);

const baseCurrency = {
  currency: "USD",
  rate: 1,
  alias: "USD",
  symbol: "$",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetVersion.mockResolvedValue("0.7.1");
  clearSkillRegistry();
  registerSkill(skill);
});

describe("current_context skill", () => {
  it("is registered after the side-effect import", () => {
    // registerSkill runs in beforeEach, so the skill is available
    expect(listSkills().map((s) => s.name)).toContain("current_context");
  });

  it("returns current date, time, timezone, and app version", async () => {
    // Save real time for comparison
    const before = Date.now();
    const result = await runSkill("current_context", {}, { baseCurrency });
    const after = Date.now();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const data = result.result.data as Record<string, unknown>;
    expect(data.iso).toBeTypeOf("string");
    expect(data.date).toBeTypeOf("string");
    expect(data.time).toBeTypeOf("string");
    expect(data.timezone).toBeTypeOf("string");
    expect(data.unixTimestampMs).toBeTypeOf("number");
    expect(data.appVersion).toBe("0.7.1");
    expect(mockedGetVersion).toHaveBeenCalledOnce();

    // Verify the timestamp is roughly now
    expect(data.unixTimestampMs as number).toBeGreaterThanOrEqual(before);
    expect(data.unixTimestampMs as number).toBeLessThanOrEqual(after);

    // iso should be a valid ISO string
    expect(() => new Date(data.iso as string)).not.toThrow();
    expect(Number.isNaN(new Date(data.iso as string).getTime())).toBe(false);
  });

  it("returns the system timezone", async () => {
    const expectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const result = await runSkill("current_context", {}, { baseCurrency });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const data = result.result.data as Record<string, unknown>;
    expect(data.timezone).toBe(expectedTz);
  });

  it("returns a non-empty text summary", async () => {
    const result = await runSkill("current_context", {}, { baseCurrency });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.result.text).toBeTypeOf("string");
    expect(result.result.text?.length).toBeGreaterThan(0);
    expect(result.result.text).toContain("Current time:");
  });

  it("accepts empty args without error", async () => {
    const result = await runSkill("current_context", {}, { baseCurrency });
    expect(result.ok).toBe(true);
  });
});
