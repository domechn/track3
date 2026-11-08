import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { calculateTotalProfit, queryPNLChartValue } from "@/middlelayers/charts";
import SummaryProfitLoss from "./summary-profit-loss";

vi.mock("@/middlelayers/charts", () => ({
  calculateTotalProfit: vi.fn(),
  queryPNLChartValue: vi.fn().mockResolvedValue([]),
  queryLatestAssets: vi.fn().mockResolvedValue([]),
  queryTotalValue: vi.fn().mockResolvedValue({ totalValue: 0 }),
}));
vi.mock("@/middlelayers/datafetch/coins/stable", () => ({
  StableCoinsQuery: class {
    listAllStableCoins() { return Promise.resolve([]); }
  },
}));

beforeEach(() => vi.clearAllMocks());

it.each([
  [26_010.84, "+$26,010.84", "+$26,010.84", false],
  [999_999_999.99, "+$1B", "+$999,999,999.99", true],
  [-999_999_999.99, "−$1B", "−$999,999,999.99", true],
])("keeps the full Summary P&L total available when its cell is narrow", async (total, display, full, longAmount) => {
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total, percentage: 0, coins: [], knownTotal: total, unknownCoins: [],
  } as never);
  render(<SummaryProfitLoss
    dateRange={{ start: new Date("2026-10-01T00:00:00Z"), end: new Date("2026-10-31T23:59:59Z") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  const value = (await screen.findByText(display)).closest("strong")!;
  expect(value.classList.contains("fidelity-long-money")).toBe(longAmount);
  expect(value).toHaveAttribute("title", full);
});

it("colours cumulative P&L above and below zero with gain and loss tokens", async () => {
  vi.mocked(queryPNLChartValue).mockResolvedValue([
    { timestamp: Date.parse("2026-08-15"), totalValue: 100 },
    { timestamp: Date.parse("2026-09-15"), totalValue: 90 },
    { timestamp: Date.parse("2026-10-15"), totalValue: 120 },
  ]);
  vi.mocked(calculateTotalProfit).mockImplementation(async (range) => {
    const month = range.end.toISOString().slice(0, 7);
    const total = month === "2026-08" ? -20 : month === "2026-09" ? -10 : 10;
    return { total, percentage: 0, coins: [], knownTotal: total, unknownCoins: [] } as never;
  });
  render(<SummaryProfitLoss
    dateRange={{ start: new Date("2026-08-01T00:00:00Z"), end: new Date("2026-10-31T23:59:59Z") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  const chart = await screen.findByRole("group", { name: /Cumulative net P&L/ });
  const segments = [...chart.querySelectorAll("[data-direction]")];
  expect(segments.map((segment) => segment.getAttribute("data-direction"))).toEqual(["loss", "loss", "loss", "gain"]);
  expect(segments.slice(0, 3).every((segment) => segment.getAttribute("stroke") === "hsl(var(--loss))")).toBe(true);
  expect(segments[3]).toHaveAttribute("stroke", "hsl(var(--gain))");
  expect(chart.querySelector("[data-direction-end]")).toHaveAttribute("fill", "hsl(var(--gain))");
  expect(chart.querySelector("[data-direction-end]")).toHaveTextContent("+$10");
});

it("shows the selected range and the earlier snapshot for a one point chart", async () => {
  vi.mocked(queryPNLChartValue).mockResolvedValue([{ timestamp: Date.parse("2026-10-09T12:00:00Z"), totalValue: 120 }]);
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: -11_791, percentage: -10, coins: [], knownTotal: -11_791, unknownCoins: [],
  } as never);
  render(<SummaryProfitLoss
    dateRange={{ start: new Date("2026-10-09T12:00:00Z"), end: new Date("2026-10-09T12:00:00Z") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down" oneSnapshot={false}
    baseline={new Date("2026-10-05T12:00:00Z")} rangeLabel="1D" snapshotCount={1}
  />);
  expect(await screen.findByText("Net P&L (1D)")).toBeVisible();
  expect(screen.getByText("−$11,791.00")).toBeVisible();
  expect(screen.getByText("−$11,791", { selector: "[data-direction-end]" })).toBeVisible();
  expect(screen.getByText("since 5 Oct 2026")).toBeVisible();
});

it.each(["7D", "30D", "90D", "1Y", "All", "5 Apr - 9 Apr"])("labels the net P&L for %s", async (rangeLabel) => {
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: 100, percentage: 5, coins: [], knownTotal: 100, unknownCoins: [],
  } as never);
  render(<SummaryProfitLoss
    dateRange={{ start: at(5), end: at(9) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down" baseline={at(1)} rangeLabel={rangeLabel} snapshotCount={2}
  />);
  expect(await screen.findByText(rangeLabel === "All" ? "Net P&L (all time)" : `Net P&L (${rangeLabel})`)).toBeVisible();
});

function at(day: number) {
  return new Date(`2026-04-${String(day).padStart(2, "0")}T12:00:00Z`);
}

it("shows explained dashes only with one database snapshot", async () => {
  vi.mocked(queryPNLChartValue).mockResolvedValue([{ timestamp: at(9).getTime(), totalValue: 100 }]);
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: 0, percentage: 0, coins: [], knownTotal: 0, unknownCoins: [],
  } as never);
  render(<SummaryProfitLoss dateRange={{ start: at(9), end: at(9) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down" oneSnapshot snapshotCount={1} />);
  const kpis = (await screen.findByText("Net P&L (all time)")).closest(".fidelity-kpis")!;
  expect(kpis.querySelectorAll("strong")[0]).toHaveTextContent("–");
  expect(kpis.querySelectorAll("strong")[1]).toHaveTextContent("–");
  expect(kpis.querySelectorAll("strong")[2]).toHaveTextContent("–");
  expect(screen.getAllByText("Needs a second snapshot").length).toBeGreaterThan(0);
});

it("reports zero snapshots when the database is empty", async () => {
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: 0, percentage: 0, coins: [], knownTotal: 0, unknownCoins: [],
  } as never);
  render(<SummaryProfitLoss dateRange={{ start: at(9), end: at(9) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down" oneSnapshot snapshotCount={0} />);
  expect(await screen.findByText("Positions")).toBeVisible();
  expect(screen.getByText("in 0 snapshots")).toBeVisible();
});

it("explains n/a when a selected range has no earlier baseline", async () => {
  vi.mocked(queryPNLChartValue).mockResolvedValue([{ timestamp: at(1).getTime(), totalValue: 100 }]);
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: 0, percentage: 0, coins: [], knownTotal: 0, unknownCoins: [],
  } as never);
  render(<SummaryProfitLoss dateRange={{ start: at(1), end: at(1) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down" rangeLabel="1D" snapshotCount={1} />);
  expect(await screen.findByText("Net P&L (1D)")).toBeVisible();
  const metrics = document.querySelectorAll(".fidelity-summary-pnl-kpis > div");
  for (const index of [0, 1, 2]) {
    expect(metrics[index].querySelector("strong")).toHaveTextContent("n/a");
    expect(metrics[index]).toHaveTextContent("No snapshot before 1D to use as a baseline.");
  }
});

it("explains an unavailable percentage when net P&L is known", async () => {
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: 50, percentage: null, coins: [], knownTotal: 50, unknownCoins: [],
  } as never);
  render(<SummaryProfitLoss dateRange={{ start: at(5), end: at(9) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down" baseline={at(1)} rangeLabel="7D" snapshotCount={2} />);
  const percent = (await screen.findByText("P&L %")).closest("div")!;
  expect(percent.querySelector("strong")).toHaveTextContent("n/a");
  expect(percent.querySelector("strong")).toHaveAttribute("title", "Invested capital for 7D is unavailable.");
  expect(percent).toHaveTextContent("Invested capital for 7D is unavailable.");
});

it("keeps the positions movement breakdown beside the snapshot note", async () => {
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: 50, percentage: 5, knownTotal: 50, unknownCoins: [],
    coins: [
      { symbol: "BTC", assetType: "crypto", value: 20 },
      { symbol: "ETH", assetType: "crypto", value: -10 },
    ],
  } as never);
  render(<SummaryProfitLoss dateRange={{ start: at(5), end: at(9) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down" baseline={at(1)} rangeLabel="7D" snapshotCount={2} />);
  const positions = (await screen.findByText("Positions")).closest("div")!;
  expect(positions).toHaveTextContent("1 up · 1 down · 0 flat");
  expect(positions).toHaveTextContent("2 in range");
});

it("reveals exact cumulative P&L at each Summary point on hover", async () => {
  vi.mocked(queryPNLChartValue).mockResolvedValue([
    { timestamp: Date.parse("2026-08-15"), totalValue: 100 },
    { timestamp: Date.parse("2026-09-15"), totalValue: 90 },
    { timestamp: Date.parse("2026-10-15"), totalValue: 120 },
  ]);
  vi.mocked(calculateTotalProfit).mockImplementation(async (range) => ({
    total: range.end.toISOString().startsWith("2026-10") ? 12_345.67 : 100,
    percentage: 0, coins: [], knownTotal: 100, unknownCoins: [],
  } as never));
  render(<SummaryProfitLoss
    dateRange={{ start: new Date("2026-08-01T00:00:00Z"), end: new Date("2026-10-31T23:59:59Z") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  const mark = (await screen.findByRole("group", { name: /Cumulative net P&L/ })).querySelectorAll("circle")[3];
  fireEvent.pointerEnter(mark, { pointerType: "mouse" });
  expect(screen.getByRole("tooltip")).toHaveTextContent("+$12,345.67");
  expect(screen.getByRole("tooltip")).toHaveTextContent("15 Oct");
});
