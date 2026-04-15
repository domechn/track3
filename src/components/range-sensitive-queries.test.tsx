import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TotalValue from "@/components/total-value-and-change";
import LatestAssetsPercentage from "@/components/latest-assets-percentage";
import AthValue from "@/components/ath-value";
import CoinAnalysis from "@/components/coin-analytics";
import { ChartResizeContext } from "@/App";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

vi.mock("react-chartjs-2", async () => {
  const React = await import("react");
  return {
    Line: () => <div data-testid="line-chart" />,
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

vi.mock("@/middlelayers/wallet", () => ({
  WalletAnalyzer: class {
    async listWalletAliases() {
      return {};
    }
  },
}));

vi.mock("@/components/motion", () => ({
  StaggerContainer: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  FadeUp: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock("@/components/coins-amount-and-value-change", () => ({
  default: () => <div>coin amount chart</div>,
}));

vi.mock("@/components/wallet-assets-percentage", () => ({
  default: () => <div>wallet assets percentage</div>,
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/middlelayers/charts", () => ({
  queryTotalValue: vi.fn(),
  queryAssetChange: vi.fn(),
  queryLatestAssetsPercentage: vi.fn(),
  resizeChart: vi.fn(),
  resizeChartWithDelay: vi.fn(),
  queryTransactionsBySymbolAndDateRange: vi.fn(),
  calculateTotalProfit: vi.fn(),
  queryLastAssetsBySymbol: vi.fn(),
  queryAssetMaxAmountBySymbol: vi.fn(),
  listAllowedSymbols: vi.fn(),
  updateTransactionPrice: vi.fn(),
  updateTransactionTxnType: vi.fn(),
  queryMaxTotalValue: vi.fn(),
}));

import {
  calculateTotalProfit,
  listAllowedSymbols,
  queryAssetChange,
  queryAssetMaxAmountBySymbol,
  queryLastAssetsBySymbol,
  queryLatestAssetsPercentage,
  queryMaxTotalValue,
  queryTotalValue,
  queryTransactionsBySymbolAndDateRange,
} from "@/middlelayers/charts";

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };
const reportLoaded = vi.fn();
const rangeA = {
  start: new Date("2024-04-10T00:00:00.000Z"),
  end: new Date("2024-04-11T00:00:00.000Z"),
};
const rangeB = {
  start: new Date("2024-04-12T00:00:00.000Z"),
  end: new Date("2024-04-13T00:00:00.000Z"),
};

function renderWithOverviewProviders(node: React.ReactNode) {
  return render(
    <MemoryRouter>
      <ChartResizeContext.Provider
        value={{
          needResize: 0,
          setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>>,
        }}
      >
        <OverviewLoadingContext.Provider value={{ reportLoaded }}>
          {node}
        </OverviewLoadingContext.Provider>
      </ChartResizeContext.Provider>
    </MemoryRouter>
  );
}

function renderCoinAnalysis(dateRange: { start: Date; end: Date }) {
  return render(
    <MemoryRouter initialEntries={["/coins/BTC"]}>
      <OverviewLoadingContext.Provider value={{ reportLoaded }}>
        <Routes>
          <Route
            path="/coins/:symbol"
            element={<CoinAnalysis currency={usdCurrency} dateRange={dateRange} />}
          />
        </Routes>
      </OverviewLoadingContext.Provider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  reportLoaded.mockClear();

  vi.mocked(queryTotalValue).mockImplementation(async (dateRange) => ({
    totalValue: dateRange?.end.getTime() === rangeA.end.getTime() ? 1100 : 2200,
  }));
  vi.mocked(queryAssetChange).mockImplementation(async (dateRange) => ({
    timestamps: [dateRange.start.getTime(), dateRange.end.getTime()],
    data: [
      { usdValue: 900, btcPrice: 50000 },
      {
        usdValue: dateRange.end.getTime() === rangeA.end.getTime() ? 1100 : 2200,
        btcPrice: 55000,
      },
    ],
  }));
  vi.mocked(queryLatestAssetsPercentage).mockImplementation(async (dateRange) =>
    dateRange?.end.getTime() === rangeA.end.getTime()
      ? [{ coin: "BTC", amount: 1, value: 1100, percentage: 100, chartColor: "#f59e0b" }]
      : [{ coin: "ETH", amount: 2, value: 2200, percentage: 100, chartColor: "#3b82f6" }]
  );
  vi.mocked(queryMaxTotalValue).mockResolvedValue({
    uuid: "record-1",
    totalValue: 2500,
    date: new Date("2024-04-13T00:00:00.000Z"),
  });
  vi.mocked(listAllowedSymbols).mockResolvedValue(["BTC"]);
  vi.mocked(queryTransactionsBySymbolAndDateRange).mockResolvedValue([]);
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: 100,
    percentage: 10,
    coins: [
      {
        symbol: "BTC",
        value: 100,
        percentage: 10,
        buyAmount: 1,
        sellAmount: 0,
        costAvgPrice: 1000,
        sellAvgPrice: 0,
      },
    ],
  });
  vi.mocked(queryLastAssetsBySymbol).mockResolvedValue({
    symbol: "BTC",
    amount: 1,
    value: 1100,
    price: 1100,
  });
  vi.mocked(queryAssetMaxAmountBySymbol).mockResolvedValue(2);
});

describe("Range-sensitive component queries", () => {
  it("passes the selected range to total value queries when the overview range changes", async () => {
    const view = renderWithOverviewProviders(
      <TotalValue
        currency={usdCurrency}
        dateRange={rangeA}
        quoteColor="green-up-red-down"
      />
    );

    await waitFor(() => {
      expect(queryTotalValue).toHaveBeenCalledWith(rangeA);
      expect(queryAssetChange).toHaveBeenCalledWith(rangeA);
    });

    view.rerender(
      <MemoryRouter>
        <ChartResizeContext.Provider
          value={{
            needResize: 0,
            setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>>,
          }}
        >
          <OverviewLoadingContext.Provider value={{ reportLoaded }}>
            <TotalValue
              currency={usdCurrency}
              dateRange={rangeB}
              quoteColor="green-up-red-down"
            />
          </OverviewLoadingContext.Provider>
        </ChartResizeContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(queryTotalValue).toHaveBeenLastCalledWith(rangeB);
      expect(queryAssetChange).toHaveBeenLastCalledWith(rangeB);
    });
  });

  it("passes the selected range to token holding queries", async () => {
    const view = renderWithOverviewProviders(
      <LatestAssetsPercentage currency={usdCurrency} dateRange={rangeA} />
    );

    await waitFor(() => {
      expect(queryLatestAssetsPercentage).toHaveBeenCalledWith(rangeA);
    });

    view.rerender(
      <MemoryRouter>
        <ChartResizeContext.Provider
          value={{
            needResize: 0,
            setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>>,
          }}
        >
          <OverviewLoadingContext.Provider value={{ reportLoaded }}>
            <LatestAssetsPercentage currency={usdCurrency} dateRange={rangeB} />
          </OverviewLoadingContext.Provider>
        </ChartResizeContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(queryLatestAssetsPercentage).toHaveBeenLastCalledWith(rangeB);
    });
  });

  it("passes the selected range to ATH current total value queries", async () => {
    const view = renderWithOverviewProviders(
      <AthValue
        currency={usdCurrency}
        dateRange={rangeA}
        quoteColor="green-up-red-down"
      />
    );

    await waitFor(() => {
      expect(queryMaxTotalValue).toHaveBeenCalledWith(rangeA);
      expect(queryTotalValue).toHaveBeenCalledWith(rangeA);
    });

    view.rerender(
      <MemoryRouter>
        <ChartResizeContext.Provider
          value={{
            needResize: 0,
            setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>>,
          }}
        >
          <OverviewLoadingContext.Provider value={{ reportLoaded }}>
            <AthValue
              currency={usdCurrency}
              dateRange={rangeB}
              quoteColor="green-up-red-down"
            />
          </OverviewLoadingContext.Provider>
        </ChartResizeContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(queryMaxTotalValue).toHaveBeenLastCalledWith(rangeB);
      expect(queryTotalValue).toHaveBeenLastCalledWith(rangeB);
    });
  });

  it("passes the selected range to positions and profit queries in coin analytics", async () => {
    const view = renderCoinAnalysis(rangeA);

    await waitFor(() => {
      expect(queryTransactionsBySymbolAndDateRange).toHaveBeenCalledWith("BTC", rangeA);
      expect(calculateTotalProfit).toHaveBeenCalledWith(rangeA, "BTC");
      expect(queryLastAssetsBySymbol).toHaveBeenCalledWith("BTC", rangeA);
      expect(queryAssetMaxAmountBySymbol).toHaveBeenCalledWith("BTC", rangeA);
    });

    view.rerender(
      <MemoryRouter initialEntries={["/coins/BTC"]}>
        <OverviewLoadingContext.Provider value={{ reportLoaded }}>
          <Routes>
            <Route
              path="/coins/:symbol"
              element={<CoinAnalysis currency={usdCurrency} dateRange={rangeB} />}
            />
          </Routes>
        </OverviewLoadingContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(queryTransactionsBySymbolAndDateRange).toHaveBeenLastCalledWith(
        "BTC",
        rangeB
      );
      expect(calculateTotalProfit).toHaveBeenLastCalledWith(rangeB, "BTC");
      expect(queryLastAssetsBySymbol).toHaveBeenLastCalledWith("BTC", rangeB);
      expect(queryAssetMaxAmountBySymbol).toHaveBeenLastCalledWith("BTC", rangeB);
    });
  });
});
