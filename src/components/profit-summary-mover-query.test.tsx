import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { calculateTotalProfit } from "@/middlelayers/charts";
import ProfitSummary from "./profit-summary";
import { SummaryFidelityYearContext } from "./summary-fidelity-range-context";

const profitMock = vi.hoisted(() => vi.fn().mockResolvedValue({
  total: 10, knownTotal: 10, unknownCoins: [], lastRecordDate: new Date(2024, 9, 31),
  coins: [{ symbol: "BTC", value: 10 }],
}));
vi.mock("@/middlelayers/charts", () => ({
  calculateTotalProfit: profitMock,
  queryLatestAssets: vi.fn().mockResolvedValue([{ symbol: "BTC", value: 100 }]),
}));
vi.mock("@/middlelayers/charts-attribution-data", () => ({
  queryAttribution: vi.fn().mockResolvedValue({ attribution: { totals: { flowEffect: 0 } } }),
}));
vi.mock("@/middlelayers/charts-profit", () => ({
  queryPreviousProfitSnapshotDate: vi.fn().mockResolvedValue(undefined),
  calculateTotalProfitBatch: vi.fn((ranges) => Promise.all(ranges.map(profitMock))),
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

it("keeps every year in the Summary scroll region as selection and range change", async () => {
  function YearSummary() {
    const [year, setYear] = useState(2026);
    const [start, setStart] = useState(2015);
    return <SummaryFidelityYearContext.Provider value={{ year, setYear, moverNames: [], setMoverNames: () => {} }}>
      <button onClick={() => setYear(2017)}>Select 2017</button>
      <button onClick={() => setStart(2024)}>Start at 2024</button>
      <ProfitSummary fidelity initialType="year"
        dateRange={{ start: new Date(start, 0, 1), end: new Date(2026, 9, 31) }}
        currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
        quoteColor="green-up-red-down" />
    </SummaryFidelityYearContext.Provider>;
  }
  const { container } = render(<YearSummary />);
  const years = () => [...container.querySelectorAll(".fidelity-year-head b")].map((node) => node.textContent);
  expect(years()).toEqual(Array.from({ length: 12 }, (_, index) => String(2026 - index)));
  expect(screen.getByRole("region", { name: "By year" })).toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "By year" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Select 2017" }));
  expect(container.querySelector(".fidelity-year-card.selected")).toHaveTextContent("2017");
  fireEvent.click(screen.getByRole("button", { name: "Start at 2024" }));
  await waitFor(() => expect(years()).toEqual(["2026", "2025", "2024"]));
  expect(container.querySelector(".fidelity-year-card.selected")).toHaveTextContent("2026");
});

it("shows the most recent year first in the desktop year view", () => {
  const { container } = render(<ProfitSummary
    dateRange={{ start: new Date(2015, 0, 1), end: new Date(2026, 9, 31) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down" />);
  fireEvent.click(screen.getByRole("radio", { name: "Y" }));
  expect(container.querySelector(".analyze-period-grid > div")).toHaveTextContent("2026");
});
