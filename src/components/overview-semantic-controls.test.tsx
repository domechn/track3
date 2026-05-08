import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TotalValue from "@/components/total-value-and-change";
import Profit from "@/components/profit";
import LatestAssetsPercentage from "@/components/latest-assets-percentage";
import { ChartResizeContext } from "@/App";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

vi.mock("react-chartjs-2", async () => {
  const React = await import("react");
  return {
    Line: () => <div data-testid="line-chart" />,
    Bar: () => <div data-testid="bar-chart" />,
    Doughnut: React.forwardRef<HTMLDivElement>((_props, _ref) => (
      <div data-testid="doughnut-chart" />
    )),
  };
});

vi.mock("@tauri-apps/api/path", () => ({
  appCacheDir: vi.fn().mockResolvedValue("/tmp/track3-cache"),
}));

vi.mock("@/utils/app", () => ({
  getImageApiPath: vi
    .fn()
    .mockImplementation((_dir: string, symbol: string) =>
      Promise.resolve(`/logos/${symbol}.png`),
    ),
}));

vi.mock("@/middlelayers/data", () => ({
  downloadCoinLogos: vi.fn(),
}));

vi.mock("@/middlelayers/charts", () => ({
  queryTotalValue: vi.fn(),
  queryAssetChange: vi.fn(),
  queryLatestAssetsPercentage: vi.fn(),
  calculateTotalProfit: vi.fn(),
  resizeChart: vi.fn(),
  resizeChartWithDelay: vi.fn(),
}));

import {
  queryAssetChange,
  queryLatestAssetsPercentage,
  queryTotalValue,
  calculateTotalProfit,
} from "@/middlelayers/charts";

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };

function renderWithProviders(node: React.ReactNode) {
  return render(
    <MemoryRouter>
      <ChartResizeContext.Provider
        value={{
          needResize: 0,
          setNeedResize: vi.fn() as React.Dispatch<
            React.SetStateAction<number>
          >,
        }}
      >
        <OverviewLoadingContext.Provider value={{ reportLoaded: vi.fn() }}>
          {node}
        </OverviewLoadingContext.Provider>
      </ChartResizeContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(queryTotalValue).mockResolvedValue({ totalValue: 1250 });
  vi.mocked(queryAssetChange).mockResolvedValue({
    timestamps: [1713158400, 1713244800],
    data: [
      { usdValue: 1000, btcPrice: 50000 },
      { usdValue: 1250, btcPrice: 62500 },
    ],
  });
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: 140,
    percentage: 14,
    coins: [
      {
        symbol: "DOGE",
        assetType: "crypto",
        value: -60,
        percentage: -6,
        buyAmount: 1,
        sellAmount: 1,
        costAvgPrice: 1,
        sellAvgPrice: 1,
      },
      {
        symbol: "SOL",
        assetType: "crypto",
        value: -40,
        percentage: -4,
        buyAmount: 1,
        sellAmount: 1,
        costAvgPrice: 1,
        sellAvgPrice: 1,
      },
      {
        symbol: "XRP",
        assetType: "crypto",
        value: -30,
        percentage: -3,
        buyAmount: 1,
        sellAmount: 1,
        costAvgPrice: 1,
        sellAvgPrice: 1,
      },
      {
        symbol: "ADA",
        assetType: "crypto",
        value: -20,
        percentage: -2,
        buyAmount: 1,
        sellAmount: 1,
        costAvgPrice: 1,
        sellAvgPrice: 1,
      },
      {
        symbol: "LTC",
        assetType: "crypto",
        value: -10,
        percentage: -1,
        buyAmount: 1,
        sellAmount: 1,
        costAvgPrice: 1,
        sellAvgPrice: 1,
      },
      {
        symbol: "ETH",
        assetType: "crypto",
        value: 10,
        percentage: 1,
        buyAmount: 1,
        sellAmount: 1,
        costAvgPrice: 1,
        sellAvgPrice: 1,
      },
      {
        symbol: "SUI",
        assetType: "crypto",
        value: 20,
        percentage: 2,
        buyAmount: 1,
        sellAmount: 1,
        costAvgPrice: 1,
        sellAvgPrice: 1,
      },
      {
        symbol: "BNB",
        assetType: "crypto",
        value: 30,
        percentage: 3,
        buyAmount: 1,
        sellAmount: 1,
        costAvgPrice: 1,
        sellAvgPrice: 1,
      },
      {
        symbol: "TON",
        assetType: "crypto",
        value: 40,
        percentage: 4,
        buyAmount: 1,
        sellAmount: 1,
        costAvgPrice: 1,
        sellAvgPrice: 1,
      },
      {
        symbol: "BTC",
        assetType: "crypto",
        value: 80,
        percentage: 8,
        buyAmount: 1,
        sellAmount: 1,
        costAvgPrice: 1,
        sellAvgPrice: 1,
      },
    ],
  });
  vi.mocked(queryLatestAssetsPercentage).mockResolvedValue([
    {
      coin: "BTC",
      assetType: "crypto",
      amount: 0.5,
      percentage: 55,
      value: 825,
      chartColor: "#f59e0b",
    },
    {
      coin: "ETH",
      assetType: "crypto",
      amount: 2,
      percentage: 45,
      value: 675,
      chartColor: "#3b82f6",
    },
  ]);
});

describe("Overview semantic controls", () => {
  it("renders labeled buttons for total value chart controls", async () => {
    renderWithProviders(
      <TotalValue
        currency={usdCurrency}
        dateRange={{
          start: new Date("2024-04-15"),
          end: new Date("2024-04-16"),
        }}
        quoteColor="green-up-red-down"
      />,
    );

    expect(
      await screen.findByRole("button", { name: /show percentage change/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /switch total value base currency/i }),
    ).toBeInTheDocument();
  });

  it("renders profit coin entries as detail links", async () => {
    renderWithProviders(
      <Profit
        currency={usdCurrency}
        dateRange={{
          start: new Date("2024-04-15"),
          end: new Date("2024-04-16"),
        }}
        quoteColor="green-up-red-down"
      />,
    );

    const btcLink = await screen.findByRole("link", {
      name: /open btc details/i,
    });
    expect(btcLink).toHaveAttribute("href", "/coins/BTC?assetType=crypto");
  });

  it("renders latest asset entries as detail links", async () => {
    renderWithProviders(
      <LatestAssetsPercentage
        currency={usdCurrency}
        dateRange={{
          start: new Date("2024-04-15"),
          end: new Date("2024-04-16"),
        }}
      />,
    );

    const btcLink = await screen.findByRole("link", {
      name: /open btc details/i,
    });
    expect(btcLink).toHaveAttribute("href", "/coins/BTC?assetType=crypto");
  });
});
