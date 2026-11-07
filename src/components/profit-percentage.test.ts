import { describe, expect, it } from "vitest";
import { boundedPercentText, formatListProfitPercent, marketProfitPercentage } from "./profit-percentage";

describe("profit percentage", () => {
  it("includes an unrecorded quantity addition in the market return base", () => {
    expect(marketProfitPercentage(-109_628, 6_328)).toBeCloseTo(-94.5427576);
    expect(marketProfitPercentage(-75, 25)).toBe(-75);
  });

  it("does not divide by a missing or nonpositive base", () => {
    expect(marketProfitPercentage(-1, undefined)).toBeNull();
    expect(marketProfitPercentage(null, 10)).toBeNull();
    expect(marketProfitPercentage(1, 0)).toBeNull();
  });

  it("bounds visible large percentages and preserves the exact value", () => {
    expect(formatListProfitPercent(-1840.4)).toEqual({ text: "<-999%", exact: "−1,840.4%" });
    expect(formatListProfitPercent(1000000)).toEqual({ text: ">999%", exact: "+1,000,000.0%" });
    expect(formatListProfitPercent(-75)).toEqual({ text: "−75.0%", exact: "−75.0%" });
    expect(formatListProfitPercent(undefined)).toEqual({ text: "∞", exact: "∞" });
    expect(formatListProfitPercent(null)).toEqual({ text: "–", exact: "–" });
  });

  it("bounds comparison percentages while retaining their existing precision", () => {
    expect(boundedPercentText(3611.22, "+3611.22%")).toEqual({ text: ">999%", exact: "+3611.22%" });
    expect(boundedPercentText(-6.92, "−6.92%")).toEqual({ text: "−6.92%", exact: "−6.92%" });
  });
});
