import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TotalValue from "@/components/total-value-and-change";
import Profit from "@/components/profit";
import LatestAssetsPercentage from "@/components/latest-assets-percentage";
import { ChartResizeContext } from "@/App";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { I18nProvider, localeLocalStorageKey } from "@/i18n";
import { LinearScale, type Chart as ChartJS, type Plugin } from "chart.js";

const chartData = vi.hoisted(() => ({
  datasets: [] as { label: string; data: number[] }[],
  yScale: {} as { min?: number; max?: number; ticks?: { includeBounds?: boolean; precision?: number; maxTicksLimit?: number } },
  xScale: {} as { ticks?: { callback: (value: number, index: number) => string } },
  firstPlugin: undefined as Plugin<"line"> | undefined,
}));
vi.mock("react-chartjs-2", async () => {
  const React = await import("react");
  return {
    Line: ({ data, options, plugins }: { data: { datasets: { label: string; data: number[] }[] };
      plugins?: Plugin<"line">[];
      options: { scales?: { x?: { ticks: { callback: (value: number, index: number) => string } };
        y?: { min?: number; max?: number; ticks?: { includeBounds?: boolean; precision?: number; maxTicksLimit?: number } } } } }) => {
      chartData.datasets = data.datasets;
      chartData.yScale = options.scales?.y ?? {};
      chartData.xScale = options.scales?.x ?? {};
      chartData.firstPlugin ??= plugins?.[0];
      return <div data-testid="line-chart" />;
    },
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
  chartData.firstPlugin = undefined;
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
    knownTotal: 140, unknownCoins: [],
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
  it("fits 80 date labels to the overview plot width", async () => {
    const start = Date.parse("2026-08-01T12:00:00Z");
    vi.mocked(queryAssetChange).mockResolvedValue({
      timestamps: Array.from({ length: 80 }, (_, index) => start + index * 86400000),
      data: Array.from({ length: 80 }, (_, index) => ({ usdValue: 1000 + index })),
    });
    renderWithProviders(<TotalValue currency={usdCurrency}
      dateRange={{ start: new Date(start), end: new Date(start + 79 * 86400000) }}
      quoteColor="green-up-red-down" metrics={<div>Metrics</div>} />);
    await screen.findByText("$1,250.00");
    const visible = Array.from({ length: 80 }, (_, index) => ({
      index, label: chartData.xScale.ticks!.callback(index, index),
    })).filter(({ label }) => label);
    expect(visible[0].index).toBe(0);
    expect(visible.at(-1)?.index).toBe(79);
    for (let i = 1; i < visible.length; i++) {
      const width = Math.max(visible[i - 1].label.length, visible[i].label.length) * 7 + 12;
      expect((visible[i].index - visible[i - 1].index) / 79 * 450).toBeGreaterThanOrEqual(width + 16);
    }
  });

  it("places overview metrics ahead of the total value trend", async () => {
    renderWithProviders(<TotalValue currency={usdCurrency}
      dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
      quoteColor="green-up-red-down" metrics={<div data-testid="overview-metrics">Latest change</div>} />);
    const metrics = await screen.findByTestId("overview-metrics");
    const chart = screen.getByTestId("line-chart");
    expect(metrics.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("labels the all time high from snapshot totals", async () => {
    renderWithProviders(<TotalValue currency={usdCurrency}
      dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
      quoteColor="green-up-red-down" ath={{ timestamp: Date.parse("2024-04-15"), value: 1300, distanceFromAth: -50 / 1300 * 100 }} />);
    expect(await screen.findByText("All-time high")).toBeInTheDocument();
    expect(screen.getByText("$1,300.00")).toBeInTheDocument();
    expect(screen.getByText(/3.85% below/i)).toBeInTheDocument();
  });

  it("draws the all time high reference and annotates the best change day", async () => {
    renderWithProviders(<TotalValue currency={usdCurrency}
      dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
      quoteColor="green-up-red-down"
      ath={{ timestamp: Date.parse("2024-04-15"), value: 1300 }}
      bestDay={{ timestamp: Date.parse("2024-04-16"), value: 250 }} />);
    await screen.findByTestId("line-chart");
    expect(chartData.datasets).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "All-time high", data: [1300, 1300] }),
    ]));
    expect(screen.getByText(/best day/i)).toHaveTextContent("250");
  });

  it("fits the overview value axis to a small portfolio", async () => {
    renderWithProviders(<TotalValue currency={usdCurrency}
      dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
      quoteColor="green-up-red-down" metrics={<div>Metrics</div>} />);
    await screen.findByText("$1,250.00");
    expect(chartData.yScale.min).toBeGreaterThan(0);
    expect(chartData.yScale.max).toBeLessThan(2_000);
  });

  it("keeps y-axis ticks round when best-day headroom has an exact fractional max", async () => {
    vi.mocked(queryAssetChange).mockResolvedValue({
      timestamps: [1713158400, 1713244800],
      data: [{ usdValue: 9_012_345 }, { usdValue: 9_983_217.37 }],
    });
    renderWithProviders(<TotalValue currency={usdCurrency}
      dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
      quoteColor="green-up-red-down" metrics={<div>Metrics</div>}
      bestDay={{ timestamp: Date.parse("2024-04-16"), value: 970_872.37 }} />);
    await screen.findByTestId("line-chart");
    const scale = new LinearScale({ id: "y", type: "linear", ctx: null!, chart: null! });
    Object.assign(scale, {
      options: { ...chartData.yScale, bounds: "ticks" },
      min: chartData.yScale.min,
      max: chartData.yScale.max,
      computeTickLimit: () => 5,
      _maxDigits: () => 10,
    });
    const ticks = scale.buildTicks().map(({ value }) => value);
    expect(ticks).toEqual([8_500_000, 9_000_000, 9_500_000, 10_000_000]);
  });

  it("keeps the bounds as ticks when no best-day headroom is added", async () => {
    vi.mocked(queryAssetChange).mockResolvedValue({
      timestamps: [1713158400, 1713244800],
      data: [{ usdValue: 1137 }, { usdValue: 2582 }],
    });
    renderWithProviders(<TotalValue currency={usdCurrency}
      dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
      quoteColor="green-up-red-down" metrics={<div>Metrics</div>} />);
    await waitFor(() => expect(chartData.datasets[0]?.data).toEqual([1137, 2582]));
    const scale = new LinearScale({ id: "y", type: "linear", ctx: null!, chart: null! });
    Object.assign(scale, {
      options: { ...chartData.yScale, bounds: "ticks" },
      min: chartData.yScale.min,
      max: chartData.yScale.max,
      computeTickLimit: () => 5,
      _maxDigits: () => 10,
    });
    const ticks = scale.buildTicks().map(({ value }) => value);
    expect(ticks).toEqual([500, 1000, 2000, 3000]);
  });

  it("hides the y tick under the end tag when chart data arrives after the first plugin render", async () => {
    let finishLoad!: (value: Awaited<ReturnType<typeof queryAssetChange>>) => void;
    vi.mocked(queryAssetChange).mockReturnValue(new Promise((resolve) => { finishLoad = resolve; }));
    renderWithProviders(<TotalValue currency={usdCurrency}
      dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
      quoteColor="green-up-red-down" metrics={<div>Metrics</div>} />);
    const plugin = chartData.firstPlugin;
    expect(plugin).toBeDefined();
    finishLoad({
      timestamps: [1713158400, 1713244800],
      data: [{ usdValue: 1000 }, { usdValue: 1250 }],
    });
    await waitFor(() => expect(chartData.datasets[0]?.data).toEqual([1000, 1250]));
    const wrapper = screen.getByTestId("line-chart").parentElement!;
    const tag = wrapper.querySelector<HTMLElement>(".t3-chart-end-value")!;
    Object.defineProperty(tag, "offsetHeight", { configurable: true, value: 16 });
    const canvas = document.createElement("canvas");
    wrapper.appendChild(canvas);
    const ticks = [{ value: 1000, label: "1K" }, { value: 1250, label: "1.25K" }];
    const chart = {
      canvas,
      data: { datasets: [{ data: [1000, 1250] }] },
      scales: {
        x: { left: 0, right: 300 },
        y: { ticks, getPixelForValue: (value: number) => value === 1250 ? 100 : 20 },
      },
    } as unknown as ChartJS<"line">;
    plugin!.afterLayout?.(chart, {}, { mode: "default" });
    expect(ticks.map(({ label }) => label)).toEqual(["1K", ""]);
  });

  it("positions the best-day note when chart data arrives after the first plugin render", async () => {
    let finishLoad!: (value: Awaited<ReturnType<typeof queryAssetChange>>) => void;
    vi.mocked(queryAssetChange).mockReturnValue(new Promise((resolve) => { finishLoad = resolve; }));
    renderWithProviders(<TotalValue currency={usdCurrency}
      dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
      quoteColor="green-up-red-down" metrics={<div>Metrics</div>}
      bestDay={{ timestamp: Date.parse("2024-04-16"), value: 250 }} />);
    const plugin = chartData.firstPlugin;
    finishLoad({
      timestamps: [Date.parse("2024-04-15"), Date.parse("2024-04-16")],
      data: [{ usdValue: 1000 }, { usdValue: 1250 }],
    });
    await waitFor(() => expect(chartData.datasets[0]?.data).toEqual([1000, 1250]));
    const wrapper = screen.getByTestId("line-chart").parentElement!;
    const note = wrapper.querySelector<HTMLElement>(".t3-chart-best-day")!;
    Object.defineProperty(note, "scrollWidth", { configurable: true, value: 100 });
    Object.defineProperty(note, "offsetHeight", { configurable: true, value: 16 });
    const canvas = document.createElement("canvas");
    wrapper.appendChild(canvas);
    const points = [{ x: 50, y: 100 }, { x: 250, y: 80 }];
    const chart = {
      canvas,
      data: { datasets: [{ data: [1000, 1250] }] },
      chartArea: { left: 0, right: 300, top: 0, bottom: 200 },
      scales: {
        x: { getPixelForValue: (index: number) => points[index].x },
        y: { getPixelForValue: (value: number) => value === 1250 ? 80 : 100 },
      },
      getDatasetMeta: () => ({ data: points }),
      ctx: {
        save: () => {}, restore: () => {}, setLineDash: () => {},
        beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
      },
    } as unknown as ChartJS<"line">;
    plugin!.afterDatasetsDraw?.(chart, {}, { mode: "default" }, false);
    expect(note.style.left).toBe("144px");
  });

  it("uses Chinese dates throughout the Overview value chart", async () => {
    const language = vi.spyOn(window.navigator, "language", "get").mockReturnValue("zh-CN");
    const day = Date.parse("2026-10-31T09:41:00Z");
    vi.mocked(queryAssetChange).mockResolvedValue({
      timestamps: [day - 86400000, day],
      data: [{ usdValue: 1000 }, { usdValue: 1250 }],
    });
    renderWithProviders(<I18nProvider><TotalValue currency={usdCurrency}
      dateRange={{ start: new Date(day - 86400000), end: new Date(day) }}
      quoteColor="green-up-red-down" metrics={<div>Metrics</div>}
      ath={{ timestamp: day, value: 1250 }} /></I18nProvider>);
    expect(await screen.findByText(/最近快照 10月31日/)).toBeInTheDocument();
    expect(screen.getByText(/于 10月31日 达到/)).toBeInTheDocument();
    language.mockRestore();
  });

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
    expect(
      await screen.findAllByRole("link", { name: /打开 BTC 详情/ }),
    ).toHaveLength(2);
  });
  it("places a loss sign before the currency in a chart contribution annotation", async () => {
    renderWithProviders(<TotalValue currency={usdCurrency}
      dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
      quoteColor="green-up-red-down" metrics={<div>Metrics</div>}
      bestDay={{ timestamp: Date.parse("2024-04-16"), value: 250 }}
      bestDayContribution={{ symbol: "ETH", value: -25 }} />);
    const annotation = await screen.findByText(/best day \(ETH/);
    expect(annotation).toHaveTextContent("(ETH −$25)");
  });
});
