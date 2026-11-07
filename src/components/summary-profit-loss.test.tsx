import { render, screen } from "@testing-library/react";
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
  const chart = await screen.findByRole("img", { name: /Cumulative net P&L/ });
  const segments = [...chart.querySelectorAll("[data-direction]")];
  expect(segments.map((segment) => segment.getAttribute("data-direction"))).toEqual(["loss", "loss", "loss", "gain"]);
  expect(segments.slice(0, 3).every((segment) => segment.getAttribute("stroke") === "hsl(var(--loss))")).toBe(true);
  expect(segments[3]).toHaveAttribute("stroke", "hsl(var(--gain))");
  expect(chart.querySelector("[data-direction-end]")).toHaveAttribute("fill", "hsl(var(--gain))");
});
