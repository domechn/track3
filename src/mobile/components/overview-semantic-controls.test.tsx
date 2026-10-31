import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TotalValue from "@/mobile/components/total-value-and-change";
import Profit from "@/mobile/components/profit";
import LatestAssetsPercentage from "@/mobile/components/latest-assets-percentage";
import { ChartResizeContext } from "@/mobile/App";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { I18nProvider, localeLocalStorageKey } from "@/mobile/i18n";
import { Line } from "react-chartjs-2";

vi.mock("react-chartjs-2", async () => {
  const React = await import("react");
  return {
    Line: vi.fn(() => <div data-testid="line-chart" />),
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
  localStorage.removeItem(localeLocalStorageKey);
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

  it("lets a phone reader choose a chart range", async () => {
    const oldMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("pointer: coarse"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    try {
      renderWithProviders(<TotalValue currency={usdCurrency}
        dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
        quoteColor="green-up-red-down" />);
      const month = await screen.findByRole("radio", { name: "1M" });
      fireEvent.click(month);
      expect(month).toHaveAttribute("aria-checked", "true");
    } finally {
      window.matchMedia = oldMatchMedia;
    }
  });

  it("uses the shared phone chart font for Overview value ticks", async () => {
    const oldMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("pointer: coarse"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    try {
      renderWithProviders(<TotalValue currency={usdCurrency}
        dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
        quoteColor="green-up-red-down" />);
      await screen.findByTestId("line-chart");
      const chart = vi.mocked(Line).mock.calls.at(-1)?.[0];
      expect(chart?.options?.scales?.y?.ticks).toEqual(expect.objectContaining({
        font: expect.objectContaining({ family: expect.stringContaining("Public Sans") }),
      }));
    } finally {
      window.matchMedia = oldMatchMedia;
    }
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

    const btcLink = (await screen.findByText(/open btc details/i)).closest("a");
    expect(btcLink).toHaveAccessibleName(/open btc details/i);
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

    const btcLink = (await screen.findByText(/open btc details/i)).closest("a");
    expect(btcLink).toHaveAccessibleName(/open btc details/i);
    expect(btcLink).toHaveAttribute("href", "/coins/BTC?assetType=crypto");
  });

  it("shows allocation share and value together on phone asset rows", async () => {
    const oldMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("pointer: coarse"),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    try {
      renderWithProviders(<LatestAssetsPercentage currency={usdCurrency}
        dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }} />);
      const link = (await screen.findByText(/open btc details/i)).closest("a");
      expect(link).toHaveAccessibleName(/open btc details/i);
      expect(link).toHaveTextContent("55.0%");
      expect(link).toHaveTextContent("$825.00");
    } finally {
      window.matchMedia = oldMatchMedia;
    }
  });

  it("localizes profit copy and asset detail links with the Chinese provider", async () => {
    localStorage.setItem(localeLocalStorageKey, "zh");
    renderWithProviders(
      <I18nProvider>
        <div>
          <Profit
            currency={usdCurrency}
            dateRange={{
              start: new Date("2024-04-15"),
              end: new Date("2024-04-16"),
            }}
            quoteColor="green-up-red-down"
          />
          <LatestAssetsPercentage
            currency={usdCurrency}
            dateRange={{
              start: new Date("2024-04-15"),
              end: new Date("2024-04-16"),
            }}
          />
        </div>
      </I18nProvider>,
    );

    expect(
      await screen.findByText("共 10 个币种 | 上涨 5 | 下跌 5"),
    ).toBeInTheDocument();
    expect(screen.getByText("所选区间净盈亏")).toBeInTheDocument();
    const btcLabels = await screen.findAllByText(/打开 BTC 详情/);
    expect(btcLabels).toHaveLength(2);
    for (const label of btcLabels) {
      const link = label.closest("a");
      expect(link).toHaveAttribute("href");
      expect(link).toHaveAccessibleName(/打开 BTC 详情/);
    }
  });
});
