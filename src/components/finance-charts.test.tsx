import { render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { CostCharts, FinanceChartSkeleton, GoalChart, RebalanceCharts } from "./finance-charts";
import type { CostBasisReport } from "@/middlelayers/cost-basis-report";
import type { RebalanceResult } from "@/middlelayers/rebalance";
import type { AlertRule } from "@/middlelayers/alerts";

vi.mock("react-chartjs-2", () => ({
  Bar: vi.fn(() => <div />),
  Line: vi.fn(() => <div />),
  Doughnut: vi.fn(() => <div />),
}));

beforeEach(() => vi.clearAllMocks());

it("shows zero cost basis gains with a neutral value and no plus sign", () => {
  const report: CostBasisReport = {
    method: "FIFO", totals: { proceeds: 0, costBasis: 0, gainLoss: 0, shortTerm: 0, longTerm: 0 },
    assets: [], disposals: [], openLots: [], unrealized: [], warnings: [],
  };
  const { getByText } = render(<CostCharts report={report} quoteColor="green-up-red-down" />);
  const gain = getByText("Gain/loss").parentElement?.querySelector(".tabular-nums");
  expect(gain).toHaveTextContent("0 USD");
  expect(gain).not.toHaveTextContent("+0");
  expect(gain).not.toHaveStyle({ color: "#10b981" });
});

it("shows a compact loading placeholder with an accessible status", () => {
  const { getByRole, container } = render(<FinanceChartSkeleton />);
  expect(getByRole("status")).toHaveTextContent("Loading");
  expect(container.querySelectorAll("[aria-hidden='true']")).toHaveLength(2);
});

it("maps calculator gains and composition to charts without Cartesian axes on the donut", () => {
  const report: CostBasisReport = {
    method: "FIFO",
    totals: { proceeds: 370, costBasis: 300, gainLoss: 70, shortTerm: -30, longTerm: 100 },
    assets: [
      { assetType: "crypto", symbol: "BTC", proceeds: 300, costBasis: 200, gainLoss: 100 },
      { assetType: "crypto", symbol: "ETH", proceeds: 70, costBasis: 100, gainLoss: -30 },
    ],
    disposals: [], openLots: [], warnings: [],
    unrealized: [{ id: "lot", assetType: "crypto", symbol: "BTC", acquiredAt: "2025-01-01",
      amount: 1, costBasis: 80, marketValue: 100, gainLoss: 20 }],
  };
  const { rerender, getByText } = render(<CostCharts report={report} quoteColor="green-up-red-down" />);
  const gains = vi.mocked(Bar).mock.calls[0][0];
  expect(gains.data.labels).toEqual(["BTC", "ETH"]);
  expect(gains.data.datasets[0].data).toEqual([100, -30]);
  const composition = vi.mocked(Doughnut).mock.calls[0][0];
  expect(composition.data.datasets[0].data).toEqual([80]);
  expect(composition.options?.scales).toBeUndefined();
  expect(getByText("BTC")).toBeVisible();
  report.disposals.push({
    eventId: "sale", lotId: "lot", assetType: "crypto", symbol: "BTC",
    acquiredAt: "2025-01-01", disposedAt: "2026-01-01", amount: 1,
    proceeds: 300, costBasis: 200, gainLoss: 100, term: "long", method: "FIFO",
  });
  rerender(<CostCharts report={report} quoteColor="red-up-green-down" />);
  const line = vi.mocked(Line).mock.calls.at(-1)?.[0];
  expect(line?.data.datasets[0].borderColor).toBe("#f43f5e");
  expect(line?.data.datasets[0].backgroundColor).toBe("#f43f5e20");
});

it("maps deviations from the calculator and includes the configured tolerance", () => {
  const result = {
    rows: [
      { kind: "asset", symbol: "BTC", currentPercent: 60, targetPercent: 40, deviationPercent: 20, tradeValue: -20 },
      { kind: "asset", symbol: "ETH", currentPercent: 40, targetPercent: 60, deviationPercent: -20, tradeValue: 20 },
    ],
  } as RebalanceResult;
  render(<RebalanceCharts result={result} tolerancePercent={3} quoteColor="green-up-red-down" />);
  const deviations = vi.mocked(Bar).mock.calls[1][0];
  expect(deviations.data.labels).toEqual(["BTC", "ETH"]);
  expect(deviations.data.datasets[0].data).toEqual([20, -20]);
  expect(deviations["aria-label"]).toContain("3%");
  expect(deviations.plugins?.[0]?.id).toBe("tolerance-band");
});

it("maps portfolio values and a total value goal to separate line datasets", () => {
  const rule = { id: 1, kind: "total_value_target", comparator: "gte", threshold: 150 } as AlertRule;
  render(<GoalChart rules={[rule]} snapshots={[]} portfolioValues={[
    { date: "2025-01-01", value: 100 }, { date: "2025-01-02", value: 120 },
  ]} />);
  const chart = vi.mocked(Line).mock.calls[0][0];
  expect(chart.data.labels).toEqual(["2025-01-01", "2025-01-02"]);
  expect(chart.data.datasets.map((series) => series.data)).toEqual([[100, 120], [150, 150]]);
});
