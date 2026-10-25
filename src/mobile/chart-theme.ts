import { ChartArea } from "chart.js";

export const phoneChartFontFamily = '-apple-system, "SF Pro Text", "SF Pro Display", system-ui, sans-serif';

export const chartColors = [
  { main: "rgba(99,102,241,1)", bg: "rgba(99,102,241,0.15)" },
  { main: "rgba(56,189,248,1)", bg: "rgba(56,189,248,0.15)" },
  { main: "rgba(16,185,129,1)", bg: "rgba(16,185,129,0.15)" },
  { main: "rgba(244,63,94,1)", bg: "rgba(244,63,94,0.15)" },
  { main: "rgba(168,85,247,1)", bg: "rgba(168,85,247,0.15)" },
  { main: "rgba(20,184,166,1)", bg: "rgba(20,184,166,0.15)" },
  { main: "rgba(217,70,239,1)", bg: "rgba(217,70,239,0.15)" },
  { main: "rgba(148,163,184,1)", bg: "rgba(148,163,184,0.15)" },
];

const mobileChartColors = [
  { main: "rgba(49,92,190,1)", bg: "rgba(49,92,190,0.10)" },
  { main: "rgba(95,140,206,1)", bg: "rgba(95,140,206,0.10)" },
  { main: "rgba(121,170,165,1)", bg: "rgba(121,170,165,0.10)" },
  { main: "rgba(179,154,196,1)", bg: "rgba(179,154,196,0.10)" },
  { main: "rgba(196,170,137,1)", bg: "rgba(196,170,137,0.10)" },
  { main: "rgba(191,132,145,1)", bg: "rgba(191,132,145,0.10)" },
];

export const darkChartColors = [
  { main: "rgba(109,151,250,1)", bg: "rgba(109,151,250,0.10)" },
  { main: "rgba(133,173,224,1)", bg: "rgba(133,173,224,0.10)" },
  { main: "rgba(121,182,172,1)", bg: "rgba(121,182,172,0.10)" },
  { main: "rgba(185,163,203,1)", bg: "rgba(185,163,203,0.10)" },
  { main: "rgba(189,168,135,1)", bg: "rgba(189,168,135,0.10)" },
  { main: "rgba(210,149,162,1)", bg: "rgba(210,149,162,0.10)" },
];

export function getChartPalette(isMobile: boolean, theme: "light" | "dark") {
  if (!isMobile) return chartColors;
  return theme === "dark" ? darkChartColors : mobileChartColors;
}

const tickColor = () => document.documentElement.classList.contains("dark") ? "#aeaeb2" : "#636366";
export const glassScaleOptions = {
  grid: {
    color: "rgba(120,120,128,0.14)",
    drawBorder: false,
  },
  ticks: {
    color: tickColor,
    font: { size: 12 },
  },
};

// Gradient fill helper for line chart areas
export function createGradientFill(
  ctx: CanvasRenderingContext2D,
  chartArea: ChartArea,
  rgbaColor: string,
  topOpacity = 0.12,
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

export const glassTooltip = {
  backgroundColor: "rgba(28,28,30,0.94)",
  borderWidth: 0,
  cornerRadius: 12,
  padding: 12,
  titleFont: { size: 12 },
  bodyFont: { size: 13 },
};
