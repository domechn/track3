import { expect, it } from "vitest";
import { chartColors, getChartPalette } from "./chart-theme";

it("preserves the colorful desktop chart palette", () => {
  expect(chartColors).toHaveLength(8);
  expect(getChartPalette(false, "light")).toBe(chartColors);
  expect(chartColors[5].main).not.toBe("rgba(142,148,168,1)");
});

it("uses distinct, muted asset and other colors on phones", () => {
  const palette = getChartPalette(true, "light");
  expect(palette).toHaveLength(6);
  expect(palette[5].main).not.toBe("rgba(148,163,184,0.5)");
  expect(getChartPalette(true, "dark")[0].main).not.toBe(palette[0].main);
});
