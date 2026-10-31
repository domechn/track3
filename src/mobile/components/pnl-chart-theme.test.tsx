import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import PNLChart from "@/mobile/components/pnl-chart";
import { ThemeProvider, useTheme } from "@/mobile/components/common/theme";
import { queryPNLChartValue } from "@/middlelayers/charts";
import { ChartResizeContext } from "@/mobile/App";

vi.mock("@/middlelayers/charts", () => ({
  queryPNLChartValue: vi.fn(),
  resizeChart: vi.fn(),
  resizeChartWithDelay: vi.fn(),
}));

const barProps = vi.hoisted(() => ({ current: null as null | {
  data: { datasets: { backgroundColor: string }[] };
  options: { plugins: { tooltip: { enabled: boolean } }; scales: { x: { ticks: { display?: boolean } }; y: { min?: number; max?: number; ticks: { stepSize?: number; maxTicksLimit?: number } } } };
} }));
vi.mock("react-chartjs-2", async () => {
  const { forwardRef } = await import("react");
  return { Bar: forwardRef<HTMLCanvasElement, NonNullable<typeof barProps.current>>((props, _ref) => {
    barProps.current = props;
    return <canvas />;
  }) };
});

function ThemeToggle() {
  const { setTheme } = useTheme();
  return <button onClick={() => setTheme("dark")}>Dark</button>;
}

const chart = <PNLChart currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
  dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
  quoteColor="green-up-red-down" />;
const renderChart = () => render(<ThemeProvider defaultTheme="light"><ChartResizeContext.Provider
  value={{ needResize: 0, setNeedResize: vi.fn() }}>
  <ThemeToggle />{chart}
</ChartResizeContext.Provider></ThemeProvider>);

beforeEach(() => {
  localStorage.clear();
  barProps.current = null;
  vi.mocked(queryPNLChartValue).mockResolvedValue([
    { timestamp: 1713139200000, totalValue: 1000 },
    { timestamp: 1713225600000, totalValue: 1100 },
  ]);
});

it("updates phone P&L bar colors when the theme changes", async () => {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({ matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
  renderChart();
  await waitFor(() => expect(barProps.current?.data.datasets[0].backgroundColor).toBe("hsl(158 60% 30%)"));
  fireEvent.click(document.querySelector("button")!);
  await waitFor(() => expect(barProps.current?.data.datasets[0].backgroundColor).toBe("hsl(156 46% 57%)"));
});

it("keeps the desktop P&L bar colors on a theme change", async () => {
  vi.spyOn(window, "matchMedia").mockImplementation(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
  renderChart();
  await waitFor(() => expect(barProps.current?.data.datasets[0].backgroundColor).toBe("hsla(158, 60%, 30%, 0.8)"));
  fireEvent.click(document.querySelector("button")!);
  await waitFor(() => expect(barProps.current?.data.datasets[0].backgroundColor).toBe("hsla(156, 46%, 57%, 0.8)"));
});

it("places phone P&L dates below the plot so bars can use its full width", async () => {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({ matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
  renderChart();
  await waitFor(() => expect(barProps.current?.data.datasets[0].backgroundColor).toBe("hsl(158 60% 30%)"));
  expect(barProps.current?.options.scales.x.ticks.display).toBe(false);
  expect(screen.getByText(/Apr 15/)).toBeInTheDocument();
  expect(screen.getByText(/Apr 16/)).toBeInTheDocument();
});

it("keeps phone P&L scale close to the actual loss and gain", async () => {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({ matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
  vi.mocked(queryPNLChartValue).mockResolvedValue([
    { timestamp: 1713139200000, totalValue: 10000 },
    { timestamp: 1713225600000, totalValue: 4500 },
    { timestamp: 1713312000000, totalValue: 11600 },
  ]);
  renderChart();
  await waitFor(() => expect(barProps.current?.options.scales.y.min).toBe(-8000));
  expect(barProps.current?.options.scales.y.max).toBe(8000);
  expect(barProps.current?.options.scales.y.ticks.stepSize).toBe(4000);
  expect(barProps.current?.options.scales.y.ticks.maxTicksLimit).toBe(6);
});

it("uses only the readable scrub chip on phones and keeps the desktop tooltip", () => {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({ matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
  renderChart();
  expect(barProps.current?.options.plugins.tooltip.enabled).toBe(false);
});
