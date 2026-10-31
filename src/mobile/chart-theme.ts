import {
  chartColors, glassScaleOptions, glassTooltip, createGradientFill, chartThemeColor,
} from "@/utils/chart-theme";

export const phoneChartFontFamily = '"Public Sans Variable", "Public Sans", system-ui, sans-serif';
export { chartColors, glassScaleOptions, glassTooltip, createGradientFill };

function themePalette(theme: "light" | "dark") {
  const names = ["accent-data", "negative", "positive", "warning", "chart-blue-soft", "chart-green-soft"];
  return names.map((name) => ({
    get main() { return chartThemeColor(name, undefined, theme); },
    get bg() { return chartThemeColor(name, 0.12, theme); },
  }));
}

const mobileChartColors = themePalette("light");
export const darkChartColors = themePalette("dark");

export function getChartPalette(isMobile: boolean, theme: "light" | "dark") {
  if (!isMobile) return chartColors;
  return theme === "dark" ? darkChartColors : mobileChartColors;
}
