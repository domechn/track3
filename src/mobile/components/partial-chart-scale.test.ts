import { expect, test } from "vitest";
import { chartTicks } from "./partial-chart-scale";

test("partial chart uses the design's 700K–780K scale for the sample series", () => {
  expect(chartTicks([724000, 762276])).toEqual([700000, 720000, 740000, 760000, 780000]);
});

test("partial chart scales to smaller real portfolios", () => {
  expect(chartTicks([900, 1100])).toEqual([800, 900, 1000, 1100, 1200]);
});
