import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { calculateTotalProfit } from "@/middlelayers/charts";
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
  [26_010.84, "+$26,010.84", false],
  [999_999_999.99, "+$999,999,999.99", true],
])("marks only genuinely long Summary P&L totals to wrap", async (total, label, wraps) => {
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total, percentage: 0, coins: [], knownTotal: total, unknownCoins: [],
  } as never);
  render(<SummaryProfitLoss
    dateRange={{ start: new Date("2026-10-01T00:00:00Z"), end: new Date("2026-10-31T23:59:59Z") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  const value = await screen.findByText(label);
  expect(value.classList.contains("fidelity-long-money")).toBe(wraps);
});
