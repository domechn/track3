import { expect, it } from "vitest";
import { indexForPnlPixel, pnlAxisBounds } from "@/mobile/components/pnl-chart";

it("maps touch positions through the chart scale instead of the outer element width", () => {
  const xScale = { getValueForPixel: (pixel: number) => (pixel - 45) / 30 };
  expect(indexForPnlPixel(xScale, 15, 4)).toBe(0);
  expect(indexForPnlPixel(xScale, 45, 4)).toBe(0);
  expect(indexForPnlPixel(xScale, 105, 4)).toBe(2);
  expect(indexForPnlPixel(xScale, 190, 4)).toBe(3);
});

it("places positive P&L tick marks on even intervals", () => {
  expect(pnlAxisBounds([1890, 2100, 2710])).toEqual({ min: 0, max: 3000, stepSize: 1000 });
});
