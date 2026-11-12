import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { calculateTotalProfit, queryPNLChartValue, queryTotalValue } from "@/middlelayers/charts";
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
    const total = month === "2026-08" ? -20 : month === "2026-09" ? 10 : 20;
    return { total, percentage: 0, coins: [], knownTotal: total, unknownCoins: [] } as never;
  });
  render(<SummaryProfitLoss
    dateRange={{ start: new Date("2026-08-01T00:00:00Z"), end: new Date("2026-10-31T23:59:59Z") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  const chart = await screen.findByRole("img", { name: /Cumulative net P&L/ });
  const segments = [...chart.querySelectorAll("[data-direction]")];
  expect(segments.map((segment) => segment.getAttribute("data-direction"))).toEqual(["loss", "loss", "loss", "gain"]);
  expect(segments.slice(0, 3).every((segment) => segment.getAttribute("stroke") === "hsl(var(--loss))")).toBe(true);
  expect(segments[3]).toHaveAttribute("stroke", "hsl(var(--gain))");
  expect(chart.querySelector("[data-direction-end]")).toHaveAttribute("fill", "hsl(var(--gain))");
  expect(chart.querySelector("[data-direction-end]")).toHaveTextContent("+$10");
});

it("keeps short-range dates distinct and a wide JPY end label inside the chart", async () => {
  vi.mocked(queryPNLChartValue).mockResolvedValue([
    { timestamp: Date.parse("2026-11-05T12:00:00Z"), totalValue: 100 },
    { timestamp: Date.parse("2026-11-17T12:00:00Z"), totalValue: 120 },
  ]);
  vi.mocked(calculateTotalProfit).mockImplementation(async (range) => {
    const total = range.end.getUTCDate() === 5 ? 10 : 2_247_561;
    return { total, knownTotal: total, percentage: 0, coins: [], unknownCoins: [] } as never;
  });
  render(<SummaryProfitLoss
    dateRange={{ start: new Date("2026-11-01T00:00:00Z"), end: new Date("2026-11-30T23:59:59Z") }}
    baseline={new Date("2026-11-01T00:00:00Z")}
    currency={{ currency: "JPY", symbol: "¥", rate: 1, alias: "JPY" }}
    quoteColor="green-up-red-down"
  />);
  const chart = await screen.findByRole("img", { name: /Cumulative net P&L/ });
  const labels = [...chart.querySelectorAll("[data-date-tick]")].map((node) => node.textContent);
  expect(labels).toContain("1 Nov");
  expect(labels).toContain("17 Nov");
  expect(new Set(labels).size).toBe(labels.length);
  const end = chart.querySelector("[data-direction-end]")!;
  expect(end).toHaveAttribute("text-anchor", "end");
  expect(Number(end.getAttribute("x"))).toBeLessThanOrEqual(933);
  expect(Number(end.getAttribute("y"))).toBeLessThan(Number(chart.querySelector("[data-point]:last-of-type")?.getAttribute("cy")));
  expect([...chart.querySelectorAll("g text")].find((node) => node.textContent?.includes("Best month")))
    .toHaveAttribute("text-anchor", "end");
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
  const positions = (await screen.findByText("Positions")).closest("div")!;
  expect(positions.querySelector("small")).toHaveAttribute("title", "in 0 snapshots");
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

it("keeps the positions movement breakdown and puts snapshot detail in its title", async () => {
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
  expect(positions.querySelector("small")).toHaveAttribute("title", "since 1 Apr 2026 · 2 in range");
});

it("adds disjoint interval profits into each cumulative chart point", async () => {
  vi.mocked(queryPNLChartValue).mockResolvedValue([
    { timestamp: Date.parse("2026-08-15"), totalValue: 100 },
    { timestamp: Date.parse("2026-09-15"), totalValue: 110 },
    { timestamp: Date.parse("2026-10-15"), totalValue: 120 },
  ]);
  vi.mocked(calculateTotalProfit).mockImplementation(async (range) => {
    const month = range.end.toISOString().slice(0, 7);
    const total = month === "2026-08" ? 5 : month === "2026-09" ? 10 : -3;
    return { total, knownTotal: total, percentage: 0, coins: [], unknownCoins: [] } as never;
  });
  render(<SummaryProfitLoss
    dateRange={{ start: new Date("2026-08-01T00:00:00Z"), end: new Date("2026-10-31T23:59:59Z") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  const chart = await screen.findByRole("img", { name: /Cumulative net P&L/ });
  expect([...chart.querySelectorAll("[data-point]")].map((point) => point.getAttribute("aria-label")))
    .toEqual(["1 Aug 2026: $0.00", "15 Aug 2026: +$5.00", "15 Sept 2026: +$15.00", "15 Oct 2026: +$12.00"]);
});

it("shows known Summary P&L and unrecorded change separately", async () => {
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: null, knownTotal: 30, unrecordedChange: -120, percentage: null,
    coins: [], unknownCoins: [{ symbol: "BTC", assetType: "crypto", intervals: ["2024-03-15T00:00:00.000Z"], months: 1 }],
  } as never);
  render(<SummaryProfitLoss
    dateRange={{ start: new Date("2024-01-01T00:00:00Z"), end: new Date("2024-12-31T23:59:59Z") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  expect(await screen.findByText("+$30.00")).toBeInTheDocument();
  expect(screen.getByText("+$30.00")).toHaveAttribute("title", "+$30.00\nPartial 1: BTC\nUnrecorded changes: −$120.00");
});

it("masks break-even when only a partial P&L is known", async () => {
  vi.mocked(queryTotalValue).mockResolvedValue({ totalValue: 240 } as never);
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: null, knownTotal: 30, percentage: null, coins: [],
    unknownCoins: [{ symbol: "BTC", assetType: "crypto", intervals: ["2024-03-15T00:00:00.000Z"], months: 1 }],
  } as never);
  render(<SummaryProfitLoss
    dateRange={{ start: at(5), end: at(9) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  const breakEven = (await screen.findByText("Breakeven")).closest("div")!;
  expect(breakEven.querySelector("strong")).toHaveTextContent("n/a");
});

it("shows recorded opening capital beside P&L percent when a later quantity change is unrecorded", async () => {
  vi.mocked(queryTotalValue).mockResolvedValue({ totalValue: 240 } as never);
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: 20, knownTotal: 20, percentage: 20, unrecordedChange: 120,
    coins: [{ realSpentValue: 100 }], unknownCoins: [],
  } as never);
  render(<SummaryProfitLoss
    dateRange={{ start: new Date("2024-01-01T00:00:00Z"), end: new Date("2024-02-29T23:59:59Z") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  expect(await screen.findByText("+20.00%")).toBeInTheDocument();
  expect(screen.getByText("on $100 invested")).toBeInTheDocument();
  expect(screen.getByText("$220")).toBeInTheDocument();
});

it("renders one chart point when the opening date is also the first snapshot", async () => {
  vi.mocked(queryPNLChartValue).mockResolvedValue([
    { timestamp: Date.parse("2026-08-15"), totalValue: 100 },
    { timestamp: Date.parse("2026-09-15"), totalValue: 110 },
    { timestamp: Date.parse("2026-10-15"), totalValue: 120 },
  ]);
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: 10, knownTotal: 10, percentage: 10, coins: [], unknownCoins: [],
  } as never);
  const { container } = render(<SummaryProfitLoss
    dateRange={{ start: new Date("2026-08-15"), end: new Date("2026-10-30") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  await screen.findByRole("img", { name: /Cumulative net P&L/ });
  expect(container.querySelectorAll("[data-point]")).toHaveLength(3);
});

it("hides unrecorded changes below half a cent in display currency", async () => {
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: 10, knownTotal: 10, percentage: 10, unrecordedChange: 0.004,
    coins: [], unknownCoins: [],
  } as never);
  render(<SummaryProfitLoss
    dateRange={{ start: new Date("2026-08-15"), end: new Date("2026-09-30") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  await screen.findByText("+$10.00");
  expect(screen.getByText("+$10.00")).toHaveAttribute("title", "+$10.00");
});
