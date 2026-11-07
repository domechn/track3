import { expect, it } from "vitest";
import { splitDirectionLine } from "./direction-line";

it("splits a signed line exactly where it crosses zero", () => {
  const segments = splitDirectionLine([0, -20, -10, 10], (i) => i * 10, (value) => -value);
  expect(segments.map((segment) => segment.value)).toEqual([-20, -20, -10, 10]);
  expect(segments[2].end.x).toBe(25);
  expect(segments[3].start.x).toBe(25);
  expect(Math.abs(segments[2].end.y)).toBe(0);
  expect(Math.abs(segments[3].start.y)).toBe(0);
});
