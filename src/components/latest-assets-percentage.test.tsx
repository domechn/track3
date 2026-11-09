import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ChartResizeContext } from "@/App";
import LatestAssetsPercentage from "@/components/latest-assets-percentage";
import { queryLatestAssetsPercentage } from "@/middlelayers/charts";
import { MemoryRouter } from "react-router-dom";

const mockDoughnut = vi.hoisted(() => vi.fn());
vi.mock("react-chartjs-2", async () => {
  const { forwardRef } = await import("react");
  return { Doughnut: forwardRef((props, _ref) => { mockDoughnut(props); return <div />; }) };
});
vi.mock("@/middlelayers/charts", () => ({
  queryLatestAssetsPercentage: vi.fn().mockResolvedValue([]),
  resizeChart: vi.fn(),
  resizeChartWithDelay: vi.fn(),
}));
vi.mock("@/middlelayers/data", () => ({ downloadCoinLogos: vi.fn() }));
vi.mock("@/utils/app", () => ({ getImageApiPath: vi.fn().mockResolvedValue("/cache/logo.png") }));
vi.mock("@tauri-apps/api/path", () => ({ appCacheDir: vi.fn().mockResolvedValue("/cache") }));

it("uses readable semantic text for the doughnut legend in dark mode", () => {
  document.documentElement.classList.add("dark");
  try {
    render(
      <ChartResizeContext.Provider value={{ needResize: 0, setNeedResize: vi.fn() }}>
        <LatestAssetsPercentage
          currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
          dateRange={{ start: new Date("2024-01-01"), end: new Date("2024-01-02") }}
        />
      </ChartResizeContext.Provider>,
    );
    expect(mockDoughnut.mock.calls[0][0].options.plugins.legend.labels.color).toBe("hsl(225 5% 72%)");
  } finally {
    document.documentElement.classList.remove("dark");
  }
});

it("shows all holdings as values and amounts in the overview table", async () => {
  vi.mocked(queryLatestAssetsPercentage).mockReset().mockResolvedValue([
    { coin: "BTC", assetType: "crypto", amount: 2, value: 120, percentage: 60, chartColor: "#000" },
    { coin: "ETH", assetType: "crypto", amount: 4, value: 80, percentage: 40, chartColor: "#000" },
  ]);
  render(<MemoryRouter><ChartResizeContext.Provider value={{ needResize: 0, setNeedResize: vi.fn() }}>
    <LatestAssetsPercentage currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
      dateRange={{ start: new Date("2024-01-01"), end: new Date("2024-01-02") }} holdings />
  </ChartResizeContext.Provider></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole("link", { name: /btc/i })).toHaveTextContent("$120.00"));
  expect(screen.getByRole("link", { name: /eth/i })).toHaveTextContent("$80.00");
  expect(screen.queryByRole("img", { name: /asset allocation chart/i })).not.toBeInTheDocument();
});
