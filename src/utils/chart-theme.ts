import { ChartArea } from "chart.js";

// Curated glassmorphism color palette
export const chartColors = [
  { main: "rgba(99,102,241,1)", bg: "rgba(99,102,241,0.15)" },     // indigo
  { main: "rgba(168,85,247,1)", bg: "rgba(168,85,247,0.15)" },     // purple
  { main: "rgba(59,130,246,1)", bg: "rgba(59,130,246,0.15)" },     // blue
  { main: "rgba(14,165,233,1)", bg: "rgba(14,165,233,0.15)" },     // sky
  { main: "rgba(236,72,153,1)", bg: "rgba(236,72,153,0.15)" },     // pink
  { main: "rgba(245,158,11,1)", bg: "rgba(245,158,11,0.15)" },     // amber
  { main: "rgba(16,185,129,1)", bg: "rgba(16,185,129,0.15)" },     // emerald
  { main: "rgba(244,63,94,1)", bg: "rgba(244,63,94,0.15)" },       // rose
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
