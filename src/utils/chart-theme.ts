import { ChartArea } from "chart.js";

const fallbacks: Record<string, [string, string]> = {
  "accent-data": ["213 63% 43%", "213 63% 56%"],
  positive: ["158 60% 30%", "156 46% 57%"],
  negative: ["349 70% 40%", "349 81% 67%"],
  warning: ["37 79% 32%", "39 66% 55%"],
  "muted-foreground": ["240 4% 34%", "225 5% 72%"],
  faint: ["240 4% 38%", "225 4% 62%"],
  border: ["240 5% 84%", "240 3% 14%"],
  control: ["240 5% 64%", "240 3% 24%"],
  card: ["0 0% 100%", "252 12% 8%"],
  "chart-blue-soft": ["204 48% 43%", "204 48% 64%"],
  "chart-green-soft": ["165 30% 38%", "165 30% 60%"],
};

export function chartThemeColor(name: string, opacity?: number, theme?: "light" | "dark") {
  const activeTheme = typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light";
  const chosenTheme = theme ?? activeTheme;
  const fallback = fallbacks[name]?.[chosenTheme === "dark" ? 1 : 0] ?? fallbacks["accent-data"][1];
  const value = typeof document === "undefined" || (theme && theme !== activeTheme)
    ? "" : getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const channels = value || fallback;
  return opacity === undefined ? `hsl(${channels})` : `hsla(${channels.trim().split(/\s+/).join(", ")}, ${opacity})`;
}

export const chartTokenColor = chartThemeColor;

const series = ["accent-data", "negative", "positive", "warning", "muted-foreground", "chart-blue-soft", "chart-green-soft", "faint"];
export const chartColors = series.map((name) => ({
  get main() { return chartThemeColor(name); },
  get bg() { return chartThemeColor(name, 0.12); },
}));

export const glassScaleOptions = {
  grid: { color: () => chartThemeColor("border"), drawBorder: false },
  ticks: {
    color: () => chartThemeColor("faint"),
    font: { size: 12, family: '"Public Sans Variable", "Public Sans", system-ui, sans-serif' },
  },
};

export function createGradientFill(
  ctx: CanvasRenderingContext2D,
  chartArea: ChartArea,
  color: string,
  topOpacity = 0.12,
  bottomOpacity = 0.0
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  const fill = (opacity: number) => color.startsWith("hsl(")
    ? color.replace(/\)$/, ` / ${opacity})`)
    : color.replace(/rgba?\(([^)]+)\)/, (_, channels: string) => `rgba(${channels.split(",").slice(0, 3).join(",")},${opacity})`);
  gradient.addColorStop(0, fill(topOpacity));
  gradient.addColorStop(1, fill(bottomOpacity));
  return gradient;
}

export const glassTooltip = {
  get backgroundColor() { return chartThemeColor("card"); },
  get borderColor() { return chartThemeColor("control"); },
  borderWidth: 1,
  cornerRadius: 6,
  padding: 10,
  titleFont: { size: 12 },
  bodyFont: { size: 12 },
};
