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
  expect(screen.getByText("Unrecorded changes: −$120.00")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Explain partial profit/ })).toBeInTheDocument();
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
  expect(screen.queryByText(/Unrecorded changes/)).not.toBeInTheDocument();
});
