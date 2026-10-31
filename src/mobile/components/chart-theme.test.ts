import { expect, it } from "vitest";
import { getChartPalette } from "../chart-theme";

it("uses the current light and dark semantic chart tokens", () => {
  expect(getChartPalette(true, "light")[0].main).toBe("hsl(213 63% 43%)");
  expect(getChartPalette(true, "dark")[0].main).toBe("hsl(213 63% 56%)");
});
