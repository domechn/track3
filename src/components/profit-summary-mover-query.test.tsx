import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { calculateTotalProfit } from "@/middlelayers/charts";
import ProfitSummary from "./profit-summary";
import { SummaryFidelityYearContext } from "./summary-fidelity-range-context";

vi.mock("@/middlelayers/charts", () => ({
  calculateTotalProfit: vi.fn().mockResolvedValue({
    total: 10, knownTotal: 10, unknownCoins: [], lastRecordDate: new Date(2024, 9, 31),
    coins: [{ symbol: "BTC", value: 10 }],
  }),
  queryLatestAssets: vi.fn().mockResolvedValue([{ symbol: "BTC", value: 100 }]),
}));
vi.mock("@/middlelayers/charts-attribution-data", () => ({
  queryAttribution: vi.fn().mockResolvedValue({ attribution: { totals: { flowEffect: 0 } } }),
}));
vi.mock("@/middlelayers/charts-profit", () => ({
  queryPreviousProfitSnapshotDate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/components/pnl-chart", () => ({ default: () => null }));

it("shares the full-range mover query between month and year hints", async () => {
  const dateRange = { start: new Date(2024, 0, 1), end: new Date(2024, 9, 31, 23, 59, 59, 999) };
  const common = { fidelity: true, dateRange, currency: { currency: "USD", symbol: "$", rate: 1, alias: "USD" },
    quoteColor: "green-up-red-down" as const };
  function Pair() {
    const [moverNames, setMoverNames] = useState<string[]>([]);
    return <SummaryFidelityYearContext.Provider value={{ year: 2024, setYear: () => {}, moverNames, setMoverNames }}>
      <ProfitSummary {...common} />
      <ProfitSummary {...common} initialType="year" />
    </SummaryFidelityYearContext.Provider>;
  }
  render(<Pair />);

  await waitFor(() => expect(vi.mocked(calculateTotalProfit).mock.calls.filter(([range]) =>
    range.start.getTime() === dateRange.start.getTime() && range.end.getTime() === dateRange.end.getTime())).toHaveLength(1));
  fireEvent.click(screen.getAllByRole("button", { name: "How P&L % is calculated" })[1]);
  await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("BTC"));
});
