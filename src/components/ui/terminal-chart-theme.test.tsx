import { afterEach, expect, it } from "vitest";
import { chartColors, createGradientFill, glassTooltip } from "@/utils/chart-theme";
import { color, getHoverColor } from "chart.js/helpers";

afterEach(() => {
  document.documentElement.style.removeProperty("--accent-data");
  document.documentElement.style.removeProperty("--card");
});

it("reads chart and tooltip colours from the active theme tokens", () => {
  document.documentElement.style.setProperty("--accent-data", "213 63% 56%");
  document.documentElement.style.setProperty("--card", "252 12% 8%");
  expect(chartColors[0].main).toBe("hsl(213 63% 56%)");
  expect(glassTooltip.backgroundColor).toBe("hsl(252 12% 8%)");
  document.documentElement.style.setProperty("--accent-data", "213 63% 43%");
  expect(chartColors[0].main).toBe("hsl(213 63% 43%)");
});

it("provides parseable translucent colours for chart hover", () => {
  document.documentElement.style.setProperty("--accent-data", "213 63% 43%");
  const fill = chartColors[0].bg;
  expect(color(fill).valid).toBe(true);
  expect(color(getHoverColor(fill)).valid).toBe(true);
});

it("fades a semantic trend fill to the requested bottom opacity", () => {
  const stops: Array<[number, string]> = [];
  const gradient = { addColorStop: (offset: number, value: string) => stops.push([offset, value]) };
  const context = { createLinearGradient: () => gradient } as unknown as CanvasRenderingContext2D;
  createGradientFill(context, { top: 0, bottom: 100, left: 0, right: 100, height: 100, width: 100 }, "hsl(213 63% 43%)", 0.3, 0.05);
  expect(stops).toEqual([
    [0, "hsl(213 63% 43% / 0.3)"],
    [1, "hsl(213 63% 43% / 0.05)"],
  ]);
});
