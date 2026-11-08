import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import SummaryFidelity from "./summary-fidelity";
import { queryTotalValues, queryHistoricalData, calculateTotalProfit } from "@/middlelayers/charts";
import { queryAttribution } from "@/middlelayers/charts-attribution-data";
import { queryPreviousProfitSnapshotDate } from "@/middlelayers/charts-profit";

vi.mock("@/middlelayers/charts", () => ({
  queryTotalValues: vi.fn(), queryHistoricalData: vi.fn(), calculateTotalProfit: vi.fn(),
}));
vi.mock("@/middlelayers/charts-attribution-data", () => ({ queryAttribution: vi.fn() }));
vi.mock("@/middlelayers/charts-profit", () => ({ queryPreviousProfitSnapshotDate: vi.fn() }));
vi.mock("@/middlelayers/datafetch/coins/stable", () => ({
  StableCoinsQuery: class { async listAllStableCoins() { return []; } },
}));

const currency = { currency: "USD", symbol: "$", rate: 1, alias: "USD" };
const range = { start: new Date("2026-10-01T00:00:00Z"), end: new Date("2026-11-08T23:59:59Z") };
const profit = {
  total: 1234.56, knownTotal: 1234.56, percentage: 1, unknownCoins: [],
  coins: [{ assetType: "crypto", symbol: "BTC", value: 1234.56 }],
  lastRecordDate: new Date("2026-11-08T12:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(queryTotalValues).mockResolvedValue([
    { timestamp: new Date("2026-11-07T12:00:00Z").getTime(), totalValue: 10000 },
    { timestamp: new Date("2026-11-08T12:00:00Z").getTime(), totalValue: 11234.56 },
  ] as never);
  vi.mocked(queryHistoricalData).mockResolvedValue([{ assets: [
    { assetType: "crypto", symbol: "BTC", value: 11234.56, wallet: "wallet" },
  ] }] as never);
  vi.mocked(calculateTotalProfit).mockImplementation(async ({ end }) =>
    (end.getMonth() === 9 ? { ...profit, total: null, knownTotal: null, coins: [], lastRecordDate: undefined } : profit) as never);
  vi.mocked(queryAttribution).mockResolvedValue({ attribution: {
    entries: [], totals: { priceEffect: 0, flowEffect: 0, residual: 0, totalChange: 0 },
    startValue: 10000, endValue: 11234.56,
  }, aliases: {} } as never);
  vi.mocked(queryPreviousProfitSnapshotDate).mockResolvedValue(undefined);
});

it("keeps cents in the phone Top coins tooltip", async () => {
  const { container } = render(<SummaryFidelity currency={currency} dateRange={range} quoteColor="green-up-red-down" />);
  await screen.findByRole("table", { name: "Top profit and loss coins" });
  fireEvent.pointerEnter(container.querySelector(".summary-top-track")!, { pointerType: "mouse" });
  expect(screen.getByRole("tooltip")).toHaveTextContent("+$1,234.56");
});

it("keeps the first available month in the Tab order after a month without data", async () => {
  const { container } = render(<SummaryFidelity currency={currency} dateRange={range} quoteColor="green-up-red-down" />);
  await screen.findByRole("table", { name: "Top profit and loss coins" });
  const grid = container.querySelector(".fd-month-grid")!;
  const marks = grid.querySelectorAll<HTMLElement>("[data-chart-mark]");
  expect(marks).toHaveLength(1);
  expect(marks[0]).toHaveAttribute("tabindex", "0");
});

it("shows one shared tooltip on a phone Summary line point", async () => {
  const { container } = render(<SummaryFidelity currency={currency} dateRange={range} quoteColor="green-up-red-down" />);
  await screen.findByRole("table", { name: "Top profit and loss coins" });
  const chart = container.querySelector(".fd-summary-chart")!;
  fireEvent.pointerMove(chart, { clientX: 100 });
  fireEvent.pointerEnter(chart.querySelector("[data-chart-mark]")!, { pointerType: "mouse" });
  expect(screen.getByRole("tooltip")).toBeInTheDocument();
  expect(chart.querySelector(".fd-chart-chip")).not.toBeInTheDocument();
});

it("shows the selected Summary line value when a month card is clicked", async () => {
  const { container } = render(<SummaryFidelity currency={currency} dateRange={range} quoteColor="green-up-red-down" />);
  await screen.findByRole("table", { name: "Top profit and loss coins" });
  container.querySelector<SVGSVGElement>(".fd-summary-chart")!.scrollIntoView = vi.fn();
  const month = container.querySelector<HTMLButtonElement>(".fd-month-main:not(:disabled)")!;
  fireEvent.pointerDown(month, { pointerType: "touch" });
  fireEvent.click(month);
  await waitFor(() => expect(screen.getAllByRole("tooltip")).toHaveLength(1));
  expect(screen.getByRole("tooltip")).toHaveTextContent(/Nov 2026.*\$1,234\.56/);
  expect(screen.getByRole("tooltip")).toHaveTextContent(/Monthly.*\$1,234\.56/);
});
