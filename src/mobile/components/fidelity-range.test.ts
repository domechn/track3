import { describe, expect, it } from "vitest";
import { rangeLabel } from "./fidelity-range";

describe("rangeLabel", () => {
  it("matches a saved preset using elapsed calendar days", () => {
    expect(rangeLabel({ start: new Date("2026-10-24"), end: new Date("2026-10-31") })).toBe("7D");
  });

  it("keeps arbitrary selections custom and full history as All", () => {
    expect(rangeLabel({ start: new Date("2026-10-23"), end: new Date("2026-10-31") })).toBe("Custom");
    expect(rangeLabel({ start: new Date(0), end: new Date("2026-10-31") })).toBe("All");
  });
});
