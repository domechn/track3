import { expect, it } from "vitest";
import { hasPartialGap } from "./chart-gap";

it("marks only chart segments that cross a skipped partial snapshot", () => {
  expect(hasPartialGap(10, 30, [20])).toBe(true);
  expect(hasPartialGap(30, 40, [20])).toBe(false);
  expect(hasPartialGap(10, 20, [20])).toBe(false);
});
