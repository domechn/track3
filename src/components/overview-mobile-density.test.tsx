import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PNL from "@/components/pnl";
import LatestAssetsPercentage from "@/components/latest-assets-percentage";
import { ChartResizeContext } from "@/App";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };

vi.mock("@/components/pnl-chart", () => ({
  default: () => <div data-testid="pnl-chart" />,
}));

vi.mock("react-chartjs-2", async () => {
  const React = await import("react");
  return {
    Doughnut: React.forwardRef<HTMLDivElement>((_props, _ref) => (
      <div data-testid="doughnut-chart" />
    )),
  };
});

vi.mock("@tauri-apps/api/path", () => ({
  appCacheDir: vi.fn().mockResolvedValue("/tmp/track3-cache"),
}));

vi.mock("@/utils/app", () => ({
  getImageApiPath: vi.fn().mockImplementation((_dir: string, symbol: string) =>
    Promise.resolve(`/logos/${symbol}.png`)
  ),
}));

vi.mock("@/middlelayers/data", () => ({
  downloadCoinLogos: vi.fn(),
}));

vi.mock("@/middlelayers/charts", () => ({
  queryPNLTableValue: vi.fn(),
  queryLatestAssetsPercentage: vi.fn(),
  resizeChart: vi.fn(),
  resizeChartWithDelay: vi.fn(),
}));

import {
  queryLatestAssetsPercentage,
  queryPNLTableValue,
} from "@/middlelayers/charts";

function renderWithProviders(node: React.ReactNode) {
  return render(
    <MemoryRouter>
      <ChartResizeContext.Provider
        value={{ needResize: 0, setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>> }}
      >
        <OverviewLoadingContext.Provider value={{ reportLoaded: vi.fn() }}>
          {node}
        </OverviewLoadingContext.Provider>
      </ChartResizeContext.Provider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(queryPNLTableValue).mockResolvedValue({
    latestTotalValue: 1000,
    todayPNL: { value: 25, timestamp: 1713158400 },
    sevenTPnl: { value: 80, timestamp: 1712640000 },
    thirtyPNL: { value: -40, timestamp: 1710566400 },
  });
  vi.mocked(queryLatestAssetsPercentage).mockResolvedValue([
    { coin: "BTC", amount: 0.5, percentage: 55, value: 825, chartColor: "#f59e0b" },
    { coin: "ETH", amount: 2, percentage: 45, value: 675, chartColor: "#3b82f6" },
  ]);
});

describe("Overview mobile density", () => {
  it("uses a stacked-first responsive grid for the pnl summary metrics", async () => {
    renderWithProviders(
      <PNL
        currency={usdCurrency}
        dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
        quoteColor="green-up-red-down"
      />
    );

    const summaryGrid = (await screen.findByText("Last PNL")).parentElement?.parentElement;

    expect(summaryGrid).not.toBeNull();
    expect(summaryGrid).toHaveClass("grid-cols-1");
    expect(summaryGrid).toHaveClass("sm:grid-cols-3");
  });

  it("labels pagination buttons and gives them touch-friendly sizing", async () => {
    renderWithProviders(
      <LatestAssetsPercentage
        currency={usdCurrency}
        dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
      />
    );

    const previousButton = await screen.findByRole("button", {
      name: /previous token holdings page/i,
    });
    const nextButton = screen.getByRole("button", {
      name: /next token holdings page/i,
    });

    expect(previousButton).toHaveClass("h-11");
    expect(nextButton).toHaveClass("h-11");
  });
});
