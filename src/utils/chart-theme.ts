import { ChartArea } from "chart.js";

// Ordered for hue spread so the first 6+1 slots used by the stacked-bar
// and donut charts read as distinct. The first slot also serves as the
// "primary" brand color used by Total Value and the inline sparkline.
export const chartColors = [
  { main: "rgba(99,102,241,1)", bg: "rgba(99,102,241,0.15)" },     // indigo (primary)
  { main: "rgba(56,189,248,1)", bg: "rgba(56,189,248,0.15)" },     // sky
  { main: "rgba(16,185,129,1)", bg: "rgba(16,185,129,0.15)" },     // emerald
  { main: "rgba(244,63,94,1)", bg: "rgba(244,63,94,0.15)" },       // rose
  { main: "rgba(168,85,247,1)", bg: "rgba(168,85,247,0.15)" },     // violet
  { main: "rgba(20,184,166,1)", bg: "rgba(20,184,166,0.15)" },     // teal
  { main: "rgba(217,70,239,1)", bg: "rgba(217,70,239,0.15)" },     // fuchsia
  { main: "rgba(148,163,184,1)", bg: "rgba(148,163,184,0.15)" },   // slate  (neutral / "Other")
];

// Shared scale options for glassmorphism charts
export const glassScaleOptions = {
  grid: {
    color: "rgba(148,163,184,0.08)",
    drawBorder: false,
  },
  ticks: {
    color: "rgba(148,163,184,0.5)",
    font: { size: 11 },
  },
};

// Gradient fill helper for line chart areas
export function createGradientFill(
  ctx: CanvasRenderingContext2D,
  chartArea: ChartArea,
  rgbaColor: string,
  topOpacity = 0.35,
  bottomOpacity = 0.0
): CanvasGradient {
  const gradient = ctx.createLinearGradient(
    0,
    chartArea.top,
    0,
    chartArea.bottom
  );
  // Extract r,g,b from rgba string
  const match = rgbaColor.match(/[\d.]+/g);
  if (match) {
    const [r, g, b] = match;
    gradient.addColorStop(0, `rgba(${r},${g},${b},${topOpacity})`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},${bottomOpacity})`);
  }
  return gradient;
}

// Glass-style tooltip config
export const glassTooltip = {
  backgroundColor: "rgba(15,23,42,0.85)",
  borderColor: "rgba(148,163,184,0.2)",
  borderWidth: 1,
  cornerRadius: 8,
  padding: 10,
  titleFont: { size: 12 },
  bodyFont: { size: 12 },
};
