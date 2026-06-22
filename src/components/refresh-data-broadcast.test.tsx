import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PNL from "@/components/pnl";
import TotalValue from "@/components/total-value-and-change";
import LatestAssetsPercentage from "@/components/latest-assets-percentage";
import { ChartResizeContext } from "@/App";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { DataChangedContext } from "@/contexts/data-changed";

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

vi.mock("@/middlelayers/charts", () => ({
  queryPNLTableValue: vi.fn(),
  queryPNLChartValue: vi.fn().mockResolvedValue([]),
  queryTotalValue: vi.fn(),
  queryAssetChange: vi.fn(),
  queryLatestAssetsPercentage: vi.fn(),
  resizeChart: vi.fn(),
  resizeChartWithDelay: vi.fn(),
}));

import {
  queryAssetChange,
  queryLatestAssetsPercentage,
  queryPNLTableValue,
  queryTotalValue,
} from "@/middlelayers/charts";

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };
const reportLoaded = vi.fn();
const baseDateRange = {
  start: new Date("2024-04-10T00:00:00.000Z"),
  end: new Date("2024-04-15T00:00:00.000Z"),
};

function renderWithDataVersion(
  node: React.ReactNode,
  dataVersion: number,
  setDataVersion: (updater: (v: number) => number) => void,
) {
  return render(
    <DataChangedContext.Provider value={dataVersion}>
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
    </DataChangedContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  reportLoaded.mockClear();

  vi.mocked(queryPNLTableValue).mockResolvedValue({
    latestTotalValue: 1000,
    todayPNL: { value: 0, timestamp: 0 },
    sevenTPnl: { value: 0, timestamp: 0 },
    thirtyPNL: { value: 0, timestamp: 0 },
  });
  vi.mocked(queryTotalValue).mockResolvedValue({ totalValue: 1000 });
  vi.mocked(queryAssetChange).mockResolvedValue({
    timestamps: [],
    data: [],
  });
  vi.mocked(queryLatestAssetsPercentage).mockResolvedValue([]);
});

describe("DataChangedContext re-fetches on version bump", () => {
  it("re-runs the PNL table query when the data version bumps without changing the date range", async () => {
    const view = renderWithDataVersion(
      <PNL
        currency={usdCurrency}
        dateRange={baseDateRange}
        quoteColor="green-up-red-down"
      />,
      0,
      () => 1,
    );

    await waitFor(() => {
      expect(queryPNLTableValue).toHaveBeenCalledTimes(1);
    });

    // Bump the data version (simulating a successful refresh). The date
    // range is identical, so without the data-version dependency the
    // query would NOT re-run and the page would show stale data.
    view.rerender(
      <DataChangedContext.Provider value={1}>
        <ChartResizeContext.Provider
          value={{
            needResize: 0,
            setNeedResize: vi.fn() as React.Dispatch<
              React.SetStateAction<number>
            >,
          }}
        >
          <OverviewLoadingContext.Provider value={{ reportLoaded }}>
            <PNL
              currency={usdCurrency}
              dateRange={baseDateRange}
              quoteColor="green-up-red-down"
            />
          </OverviewLoadingContext.Provider>
        </ChartResizeContext.Provider>
      </DataChangedContext.Provider>,
    );

    await waitFor(() => {
      expect(queryPNLTableValue).toHaveBeenCalledTimes(2);
    });
  });

  it("re-runs the total value queries when the data version bumps", async () => {
    const view = renderWithDataVersion(
      <TotalValue
        currency={usdCurrency}
        dateRange={baseDateRange}
        quoteColor="green-up-red-down"
      />,
      0,
      () => 1,
    );

    await waitFor(() => {
      expect(queryTotalValue).toHaveBeenCalledTimes(1);
      expect(queryAssetChange).toHaveBeenCalledTimes(1);
    });

    view.rerender(
      <DataChangedContext.Provider value={1}>
        <ChartResizeContext.Provider
          value={{
            needResize: 0,
            setNeedResize: vi.fn() as React.Dispatch<
              React.SetStateAction<number>
            >,
          }}
        >
          <OverviewLoadingContext.Provider value={{ reportLoaded }}>
            <TotalValue
              currency={usdCurrency}
              dateRange={baseDateRange}
              quoteColor="green-up-red-down"
            />
          </OverviewLoadingContext.Provider>
        </ChartResizeContext.Provider>
      </DataChangedContext.Provider>,
    );

    await waitFor(() => {
      expect(queryTotalValue).toHaveBeenCalledTimes(2);
      expect(queryAssetChange).toHaveBeenCalledTimes(2);
    });
  });

  it("re-runs the latest assets percentage query when the data version bumps", async () => {
    const view = renderWithDataVersion(
      <LatestAssetsPercentage currency={usdCurrency} dateRange={baseDateRange} />,
      0,
      () => 1,
    );

    await waitFor(() => {
      expect(queryLatestAssetsPercentage).toHaveBeenCalledTimes(1);
    });

    view.rerender(
      <DataChangedContext.Provider value={1}>
        <ChartResizeContext.Provider
          value={{
            needResize: 0,
            setNeedResize: vi.fn() as React.Dispatch<
              React.SetStateAction<number>
            >,
          }}
        >
          <OverviewLoadingContext.Provider value={{ reportLoaded }}>
            <LatestAssetsPercentage
              currency={usdCurrency}
              dateRange={baseDateRange}
            />
          </OverviewLoadingContext.Provider>
        </ChartResizeContext.Provider>
      </DataChangedContext.Provider>,
    );

    await waitFor(() => {
      expect(queryLatestAssetsPercentage).toHaveBeenCalledTimes(2);
    });
  });
});
