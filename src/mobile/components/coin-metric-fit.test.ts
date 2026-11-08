import { describe, expect, it } from "vitest";
import { fittingDateTickIndices, needsMetricStack } from "./coin-metric-fit";

const box = (left: number, right: number, top: number) => ({ left, right, top });

describe("coin metric fit", () => {
  it("keeps ordinary values in their existing rows", () => {
    expect(needsMetricStack(box(0, 324, 0), [
      { strong: box(0, 65, 20), small: box(0, 70, 44) },
      { strong: box(110, 185, 20), small: box(110, 198, 44) },
      { strong: box(220, 295, 20), small: box(220, 307, 44) },
    ])).toBe(false);
  });

  it("stacks when a secondary amount reaches the neighboring amount", () => {
    expect(needsMetricStack(box(0, 324, 0), [
      { strong: box(0, 65, 20), small: box(0, 70, 44) },
      { strong: box(110, 185, 20), small: box(110, 220, 44) },
      { strong: box(230, 295, 20), small: box(230, 344, 44) },
    ])).toBe(true);
  });

  it("does not compare amounts on separate rows", () => {
    expect(needsMetricStack(box(0, 324, 0), [
      { strong: box(0, 200, 20) },
      { strong: box(0, 200, 70) },
    ])).toBe(false);
  });

  it("stacks when text crosses its own column edge without reaching the next value", () => {
    expect(needsMetricStack(box(0, 324, 0), [
      { strong: box(0, 65, 20), contentRight: 99 },
      { strong: box(110, 205, 20), contentRight: 200 },
      { strong: box(240, 295, 20), contentRight: 315 },
    ])).toBe(true);
  });
});

describe("coin chart dates", () => {
  it("keeps four separated labels in an ordinary chart", () => {
    expect(fittingDateTickIndices([
      { index: 0, left: 50, right: 85 },
      { index: 10, left: 100, right: 140 },
      { index: 20, left: 155, right: 195 },
      { index: 30, left: 210, right: 250 },
    ])).toEqual([0, 10, 20, 30]);
  });

  it("keeps the endpoints and drops dates that would touch", () => {
    expect(fittingDateTickIndices([
      { index: 0, left: 76, right: 118 },
      { index: 10, left: 104, right: 146 },
      { index: 20, left: 145, right: 187 },
      { index: 30, left: 162, right: 204 },
    ])).toEqual([0, 30]);
  });
});
