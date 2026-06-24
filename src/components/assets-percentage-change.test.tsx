import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AssetsPercentageChange from "@/components/assets-percentage-change";
import { ChartResizeContext } from "@/App";
import { DataChangedContext } from "@/contexts/data-changed";
import {
  queryAssetsPercentageChange,
  queryTopNAssets,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import type { AssetReference, AssetsPercentageChangeData } from "@/middlelayers/types";
import type { AssetType } from "@/middlelayers/datafetch/types";

vi.mock("@/middlelayers/charts", () => ({
  queryAssetsPercentageChange: vi.fn(),
  queryTopNAssets: vi.fn(),
  resizeChart: vi.fn(),
  resizeChartWithDelay: vi.fn(),
}));

const barPropsStore = vi.hoisted(() => ({ current: [] as any[] }));

vi.mock("react-chartjs-2", () => {
  return {
    Bar: (props: any) => {
      barPropsStore.current.push(props);
      return <div data-testid="bar-chart" />;
    },
  };
});

vi.mock("@/utils/hook", () => ({
  useWindowSize: () => ({ width: 1280, height: 800 }),
}));

const dateRange = {
  start: new Date("2024-04-15"),
  end: new Date("2024-04-18"),
};

const crypto = "crypto" as const satisfies AssetType;
const topN: AssetReference[] = [
  { symbol: "BTC", assetType: crypto },
  { symbol: "ETH", assetType: crypto },
  { symbol: "SOL", assetType: crypto },
  { symbol: "BNB", assetType: crypto },
  { symbol: "USDC", assetType: crypto },
  { symbol: "ARB", assetType: crypto },
];

const SAMPLE: AssetsPercentageChangeData = [
  {
    timestamp: dateRange.start.getTime(),
    percentages: [
      { symbol: "BTC", assetType: crypto, percentage: 38 },
      { symbol: "ETH", assetType: "crypto", percentage: 25 },
      { symbol: "SOL", assetType: "crypto", percentage: 8 },
      { symbol: "BNB", assetType: "crypto", percentage: 12 },
      { symbol: "USDC", assetType: "crypto", percentage: 10 },
      { symbol: "ARB", assetType: "crypto", percentage: 4 },
      { symbol: "DOGE", assetType: "crypto", percentage: 3 },
    ],
  },
  {
    timestamp: dateRange.end.getTime(),
    percentages: [
      { symbol: "BTC", assetType: "crypto", percentage: 42 },
      { symbol: "ETH", assetType: "crypto", percentage: 18 },
      { symbol: "SOL", assetType: "crypto", percentage: 14 },
      { symbol: "BNB", assetType: "crypto", percentage: 8 },
      { symbol: "USDC", assetType: "crypto", percentage: 6 },
      { symbol: "ARB", assetType: "crypto", percentage: 9 },
      { symbol: "DOGE", assetType: "crypto", percentage: 3 },
    ],
  },
];

function renderComponent() {
  return render(
    <DataChangedContext.Provider value={0}>
      <ChartResizeContext.Provider
        value={{
          needResize: 0,
          setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>>,
        }}
      >
        <AssetsPercentageChange dateRange={dateRange} />
      </ChartResizeContext.Provider>
    </DataChangedContext.Provider>,
  );
}

beforeEach(() => {
  vi.mocked(queryTopNAssets).mockReset();
  vi.mocked(queryAssetsPercentageChange).mockReset();
  vi.mocked(resizeChart).mockReset();
  vi.mocked(resizeChartWithDelay).mockReset();
  barPropsStore.current = [];
  vi.mocked(queryTopNAssets).mockResolvedValue(topN);
  vi.mocked(queryAssetsPercentageChange).mockResolvedValue(SAMPLE);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AssetsPercentageChange (stacked bar)", () => {
  it("renders the card with a bar chart and a legend", async () => {
    renderComponent();
    expect(await screen.findByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByTestId("assets-percentage-legend")).toBeInTheDocument();
  });

  it("configures the chart as a stacked bar with an honest (non-reversed) Y axis", async () => {
    renderComponent();
    await waitFor(() => {
      expect(barPropsStore.current.length).toBeGreaterThan(0);
    });
    const props = barPropsStore.current[0];
    expect(props.options.scales.y.stacked).toBe(true);
    // Chart.js's default for "reverse" is false; we removed the previous
    // `reverse: true` hack, so the property should not be truthy here.
    expect(props.options.scales.y.reverse).toBeFalsy();
    expect(props.options.scales.y.min).toBe(0);
    expect(props.options.scales.y.max).toBe(100);
    // The 100-value-percent-100 display trick must be gone.
    const yTickCallback = props.options.scales.y.ticks.callback;
    expect(yTickCallback(50)).toBe("50%");
    expect(props.options.scales.x.stacked).toBe(true);
    // Regression guard: the area-chart affordances must not be reintroduced.
    expect(props.plugins ?? []).toHaveLength(0);
    for (const ds of props.data.datasets) {
      expect(ds.tension).toBeUndefined();
      expect(ds.fill).toBeUndefined();
      expect(ds.pointRadius).toBeUndefined();
    }
  });

  it("renders one legend row per top-N asset plus an Other bucket, ordered by current share desc", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId("assets-percentage-legend")).toBeInTheDocument();
    });
    const rows = screen.getAllByTestId("assets-percentage-legend-item");
    const labels = rows.map((r) => r.getAttribute("data-asset"));
    // Current shares from SAMPLE's last row: BTC 42, ETH 18, SOL 14, ARB 9, BNB 8, USDC 6, then "Others" (= DOGE) 3.
    // "Others" is the i18n'd `common.others` key. In default test locale (en), it renders as "Others".
    expect(labels).toEqual([
      "BTC",
      "ETH",
      "SOL",
      "ARB",
      "BNB",
      "USDC",
      "Others",
    ]);
  });

  it("does not crash when the time series is empty", async () => {
    vi.mocked(queryAssetsPercentageChange).mockResolvedValue([]);
    renderComponent();
    // The card renders the title and legend region even with no data.
    await waitFor(() => {
      expect(screen.getByTestId("assets-percentage-legend")).toBeInTheDocument();
    });
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });
});
