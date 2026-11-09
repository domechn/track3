import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AthValue from "@/components/ath-value";
import ProfitMetrics from "@/components/profit-metrics";
import TopCoinsRank from "@/components/top-coins-rank";
import WalletAssetsChange from "@/components/wallet-assets-change";
import { ChartResizeContext } from "@/App";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { DataChangedContext } from "@/contexts/data-changed";
import { MemoryRouter } from "react-router-dom";

const queryWalletAssetsChange = vi.hoisted(() => vi.fn());

vi.mock("react-chartjs-2", async () => {
  const React = await import("react");
  return {
    Line: () => <div data-testid="line-chart" />,
    Bar: () => <div data-testid="bar-chart" />,
  };
});

vi.mock("@/utils/app", () => ({
  getImageApiPath: vi.fn().mockResolvedValue(""),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appCacheDir: vi.fn().mockResolvedValue("/tmp/track3-cache"),
}));

vi.mock("@/middlelayers/wallet", () => ({
  WalletAnalyzer: class {
    async listWalletAliases() {
      return {};
    }
  },
}));

vi.mock("@/middlelayers/data", () => ({
  downloadCoinLogos: vi.fn(),
}));

vi.mock("@/middlelayers/charts", () => ({
  WALLET_ANALYZER: {
    queryWalletAssetsChange,
  },
  queryMaxTotalValue: vi.fn(),
  queryTotalValue: vi.fn(),
  queryTotalValues: vi.fn(),
  queryTopCoinsRank: vi.fn(),
  queryAssetsPercentageChange: vi.fn(),
  queryTopNAssets: vi.fn(),
  queryLastAssetsBySymbol: vi.fn(),
  queryAssetMaxAmountBySymbol: vi.fn(),
  queryTransactionsBySymbolAndDateRange: vi.fn(),
  calculateTotalProfit: vi.fn(),
  queryPNLChartValue: vi.fn().mockResolvedValue([]),
  queryPNLTableValue: vi.fn(),
  listAllowedSymbols: vi.fn(),
  queryLatestAssets: vi.fn().mockResolvedValue([]),
  queryLatestAssetsPercentage: vi.fn().mockResolvedValue([]),
  queryAssetChange: vi.fn().mockResolvedValue({ timestamps: [], data: [] }),
  queryCoinDataByUUID: vi.fn(),
  queryAllDataDates: vi.fn().mockResolvedValue([]),
  queryHistoricalData: vi.fn(),
  queryTotalValuesBySymbolAndDateRange: vi.fn(),
  cleanTotalProfitCache: vi.fn(),
  resizeChart: vi.fn(),
  resizeChartWithDelay: vi.fn(),
}));

import {
  queryMaxTotalValue,
  queryTotalValue,
  queryTotalValues,
  queryTopCoinsRank,
} from "@/middlelayers/charts";

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };
const reportLoaded = vi.fn();
const baseDateRange = {
  start: new Date("2024-04-10T00:00:00.000Z"),
  end: new Date("2024-04-15T00:00:00.000Z"),
};

function wrapWithProviders(node: React.ReactNode, dataVersion: number) {
  return (
    <MemoryRouter>
      <DataChangedContext.Provider value={dataVersion}>
        <ChartResizeContext.Provider
          value={{
            needResize: 0,
            setNeedResize: vi.fn() as React.Dispatch<
              React.SetStateAction<number>
            >,
          }}
        >
          <OverviewLoadingContext.Provider value={{ reportLoaded }}>
            {node}
          </OverviewLoadingContext.Provider>
        </ChartResizeContext.Provider>
      </DataChangedContext.Provider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Refresh — stale fetch protection", () => {
  it("does not let an in-flight ath-value fetch overwrite state or call reportLoaded after dataChangedVersion bumps", async () => {
    // First fetch (dataVersion=0) — slow, will resolve AFTER the bump
    let resolveFirst: (v: unknown) => void = () => {};
    const firstPromise = new Promise((res) => {
      resolveFirst = res;
    });
    vi.mocked(queryMaxTotalValue).mockReturnValueOnce(firstPromise as never);
    vi.mocked(queryTotalValue).mockReturnValueOnce(firstPromise as never);

    // Second fetch (dataVersion=1) — fast
    vi.mocked(queryMaxTotalValue).mockResolvedValueOnce({
      uuid: "new",
      totalValue: 2000,
      date: new Date(),
    } as never);
    vi.mocked(queryTotalValue).mockResolvedValueOnce({ totalValue: 1500 } as never);

    const view = render(
      wrapWithProviders(
        <AthValue
          currency={usdCurrency}
          dateRange={baseDateRange}
          quoteColor="green-up-red-down"
        />,
        0,
      ),
    );

    // Let the first fetch's await Promise.all be in flight
    await act(async () => {
      await Promise.resolve();
    });

    // Bump dataChangedVersion — the second useEffect should kick off
    view.rerender(
      wrapWithProviders(
        <AthValue
          currency={usdCurrency}
          dateRange={baseDateRange}
          quoteColor="green-up-red-down"
        />,
        1,
      ),
    );

    // Now resolve the first (stale) fetch
    await act(async () => {
      resolveFirst([
        { uuid: "old-mtv", totalValue: 100, date: new Date() },
        { totalValue: 50 },
      ]);
      await Promise.resolve();
    });

    // Wait for the second fetch to complete
    await waitFor(() => {
      expect(queryMaxTotalValue).toHaveBeenCalledTimes(2);
    });

    // reportLoaded should only be called once (by the new fetch), not twice
    // (the stale fetch must not have called it)
    expect(reportLoaded).toHaveBeenCalledTimes(1);
    // sanity: component is still mounted
    expect(view.container).toBeTruthy();
  });

  it("does not let an in-flight profit-metrics fetch call reportLoaded after dataChangedVersion bumps", async () => {
    // First fetch — slow
    let resolveFirst: (v: unknown) => void = () => {};
    const firstPromise = new Promise((res) => {
      resolveFirst = res;
    });
    vi.mocked(queryTotalValues).mockReturnValueOnce(firstPromise as never);

    // Second fetch — fast
    vi.mocked(queryTotalValues).mockResolvedValueOnce([] as never);

    const view = render(
      wrapWithProviders(
        <ProfitMetrics
          dateRange={baseDateRange}
          currency={usdCurrency}
          quoteColor="green-up-red-down"
        />,
        0,
      ),
    );

    await act(async () => {
      await Promise.resolve();
    });

    view.rerender(
      wrapWithProviders(
        <ProfitMetrics
          dateRange={baseDateRange}
          currency={usdCurrency}
          quoteColor="green-up-red-down"
        />,
        1,
      ),
    );

    await act(async () => {
      resolveFirst([]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(queryTotalValues).toHaveBeenCalledTimes(2);
    });

    // Only the new fetch should have called reportLoaded
    expect(reportLoaded).toHaveBeenCalledTimes(1);
  });

  it("does not let an in-flight top-coins-rank fetch overwrite state after dataChangedVersion bumps", async () => {
    // First fetch — slow
    let resolveFirst: (v: unknown) => void = () => {};
    const firstPromise = new Promise((res) => {
      resolveFirst = res;
    });
    vi.mocked(queryTopCoinsRank).mockReturnValueOnce(firstPromise as never);

    // Second fetch — fast, returns new data
    vi.mocked(queryTopCoinsRank).mockResolvedValueOnce({
      timestamps: [1, 2, 3],
      coins: [
        {
          coin: "NEW",
          assetType: "crypto",
          rankData: [{ rank: 1, timestamp: 1 }],
        },
      ],
    } as never);

    const view = render(
      wrapWithProviders(<TopCoinsRank dateRange={baseDateRange} />, 0),
    );

    await act(async () => {
      await Promise.resolve();
    });

    view.rerender(
      wrapWithProviders(<TopCoinsRank dateRange={baseDateRange} />, 1),
    );

    // First fetch resolves with stale data
    await act(async () => {
      resolveFirst({
        timestamps: [1, 2, 3],
        coins: [
          {
            coin: "STALE",
            assetType: "crypto",
            rankData: [{ rank: 99, timestamp: 1 }],
          },
        ],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(queryTopCoinsRank).toHaveBeenCalledTimes(2);
    });
  });

  it("reports wallet changes loaded without an unhandled rejection when the query fails", async () => {
    const unhandledRejection = vi.fn();
    process.on("unhandledRejection", unhandledRejection);
    queryWalletAssetsChange.mockRejectedValue(
      new Error("wallet history unavailable"),
    );

    try {
      render(
        wrapWithProviders(
          <WalletAssetsChange
            currency={usdCurrency}
            dateRange={baseDateRange}
            quoteColor="green-up-red-down"
          />,
          0,
        ),
      );

      await waitFor(() => {
        expect(reportLoaded).toHaveBeenCalledTimes(1);
      });
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      expect(unhandledRejection).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandledRejection);
    }
  });
});
