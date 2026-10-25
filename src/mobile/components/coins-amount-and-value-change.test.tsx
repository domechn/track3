import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import CoinsChart from "@/mobile/components/coins-amount-and-value-change";
import { ChartResizeContext } from "@/mobile/App";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

vi.mock("@/middlelayers/charts", () => ({
  queryCoinsAmountChange: vi.fn(),
  resizeChart: vi.fn(),
  resizeChartWithDelay: vi.fn(),
}));
vi.mock("react-chartjs-2", () => ({
  Line: ({ data, options }: { data: { labels: string[]; datasets: { data: number[] }[] };
    options: { scales: { x: { ticks: { maxRotation: number; maxTicksLimit: number } }; y2: { display: boolean } } } }) =>
    <div data-testid="coin-line" data-values={JSON.stringify(data.datasets.map((ds) => ds.data))}
      data-labels={JSON.stringify(data.labels)} data-axis={JSON.stringify({
        maxRotation: options.scales.x.ticks.maxRotation,
        maxTicksLimit: options.scales.x.ticks.maxTicksLimit,
        secondAxis: options.scales.y2.display,
      })} />,
}));
vi.mock("@/utils/hook", () => ({ useWindowSize: () => ({ width: 1200, height: 800 }) }));

import { queryCoinsAmountChange } from "@/middlelayers/charts";

beforeEach(() => vi.clearAllMocks());

it("plots bounded aligned coin value and amount points with both extremes", async () => {
  const values = Array.from({ length: 2000 }, (_, i) => i + 100);
  const amounts = Array.from({ length: 2000 }, () => 1);
  values[550] = 10000;
  amounts[1200] = 100;
  vi.mocked(queryCoinsAmountChange).mockResolvedValue({
    coin: "BTC",
    timestamps: values.map((_, i) => Date.UTC(2022, 0, 1) + i * 3_600_000),
    values,
    amounts,
  });
  render(<ChartResizeContext.Provider value={{ needResize: 0, setNeedResize: vi.fn() }}>
    <OverviewLoadingContext.Provider value={{ reportLoaded: vi.fn() }}>
      <CoinsChart
        currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
        dateRange={{ start: new Date("2022-01-01"), end: new Date("2023-01-01") }}
        symbol="BTC"
      />
    </OverviewLoadingContext.Provider>
  </ChartResizeContext.Provider>);
  await waitFor(() => {
    const plotted = JSON.parse(screen.getByTestId("coin-line").getAttribute("data-values") ?? "[]");
    expect(plotted[0].length).toBeLessThan(500);
    expect(plotted[0].length).toBe(plotted[1].length);
    expect(plotted[0]).toContain(10000);
    expect(plotted[1]).toContain(100);
  });
});

it("keeps a newer coin range when an older query resolves later", async () => {
  type Series = NonNullable<Awaited<ReturnType<typeof queryCoinsAmountChange>>>;
  let finishA!: (value: Series) => void;
  let finishB!: (value: Series) => void;
  const rangeA = { start: new Date("2022-01-01"), end: new Date("2022-02-01") };
  const rangeB = { start: new Date("2022-01-01"), end: new Date("2022-03-01") };
  vi.mocked(queryCoinsAmountChange).mockImplementation((_symbol, range) =>
    new Promise((resolve) => {
      if (range.end.getTime() === rangeA.end.getTime()) finishA = resolve;
      else finishB = resolve;
    }),
  );
  const renderChart = (dateRange: typeof rangeA) =>
    <ChartResizeContext.Provider value={{ needResize: 0, setNeedResize: vi.fn() }}>
      <OverviewLoadingContext.Provider value={{ reportLoaded: vi.fn() }}>
        <CoinsChart currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
          dateRange={dateRange} symbol="BTC" />
      </OverviewLoadingContext.Provider>
    </ChartResizeContext.Provider>;
  const view = render(renderChart(rangeA));
  await waitFor(() => expect(queryCoinsAmountChange).toHaveBeenCalledTimes(1));
  view.rerender(renderChart(rangeB));
  await waitFor(() => expect(queryCoinsAmountChange).toHaveBeenCalledTimes(2));
  await act(async () => finishB({
    coin: "BTC", timestamps: [1], values: [200], amounts: [2],
  }));
  expect(screen.getByTestId("coin-line")).toHaveAttribute("data-values", "[[200],[2]]");
  await act(async () => finishA({
    coin: "BTC", timestamps: [1], values: [100], amounts: [1],
  }));
  expect(screen.getByTestId("coin-line")).toHaveAttribute("data-values", "[[200],[2]]");
});

it("uses short horizontal dates and one value axis on a phone", async () => {
  const previousMatchMedia = window.matchMedia;
  window.matchMedia = (query: string) => ({
    matches: query.includes("min-width: 0px"), media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  });
  try {
    vi.mocked(queryCoinsAmountChange).mockResolvedValue({
      coin: "BTC", timestamps: [Date.UTC(2026, 7, 24), Date.UTC(2026, 9, 18)],
      values: [100, 120], amounts: [2, 3],
    });
    render(<ChartResizeContext.Provider value={{ needResize: 0, setNeedResize: vi.fn() }}>
      <OverviewLoadingContext.Provider value={{ reportLoaded: vi.fn() }}>
        <CoinsChart currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
          dateRange={{ start: new Date("2026-08-01"), end: new Date("2026-10-31") }} symbol="BTC" />
      </OverviewLoadingContext.Provider>
    </ChartResizeContext.Provider>);
    await waitFor(() => expect(screen.getByTestId("coin-line")).toHaveAttribute("data-values", "[[100,120]]"));
    expect(screen.getByTestId("coin-line")).toHaveAttribute("data-labels", '["Aug 24","Oct 18"]');
    expect(screen.getByTestId("coin-line")).toHaveAttribute("data-axis",
      '{"maxRotation":0,"maxTicksLimit":4,"secondAxis":false}');
  } finally {
    window.matchMedia = previousMatchMedia;
  }
});
