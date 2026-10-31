import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ProfitSummary from "@/mobile/components/profit-summary";
import { calculateTotalProfit } from "@/middlelayers/charts";
import { queryPreviousProfitSnapshotDate } from "@/middlelayers/charts-profit";

vi.mock("@/middlelayers/charts", () => ({
  calculateTotalProfit: vi.fn().mockResolvedValue({ total: 0 }),
}));
vi.mock("@/middlelayers/charts-profit", () => ({
  queryPreviousProfitSnapshotDate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/mobile/components/pnl-chart", () => ({
  default: ({ dateRange }: { dateRange: { start: Date; end: Date } }) =>
    <div data-testid="month-pnl-start">{dateRange.start.toISOString()}</div>,
}));
afterEach(() => vi.restoreAllMocks());

it("selects the latest year within a historical date range", () => {
  render(<ProfitSummary
    dateRange={{ start: new Date(2023, 0, 1), end: new Date(2024, 3, 16) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);

  expect(screen.getByRole("combobox", { name: "Select Year 2024" })).toHaveTextContent("2024");
  expect(screen.getByText("Apr")).toBeInTheDocument();
});

it("uses a dash for a month with no snapshot", async () => {
  render(<ProfitSummary
    dateRange={{ start: new Date(2023, 0, 1), end: new Date(2024, 3, 16) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  expect(screen.getByText("Apr").closest("button")).toHaveTextContent("—");
  expect(screen.getByText("Flat 0")).toBeInTheDocument();
  expect(screen.getByText("Periods 0 of 4")).toBeInTheDocument();
});

it("keeps an unknown yearly profit as a dash", async () => {
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: null, percentage: null, coins: [], lastRecordDate: new Date(2024, 3, 16),
  });
  render(<ProfitSummary
    dateRange={{ start: new Date(2024, 0, 1), end: new Date(2024, 3, 16) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  fireEvent.click(screen.getByRole("radio", { name: "Y" }));
  await waitFor(() => expect(screen.getByText("2024").closest(".profit-period-grid > div"))
    .toHaveTextContent("—"));
  expect(screen.getByText("Flat 0")).toBeInTheDocument();
});

it("shows a dash for a year without a snapshot", async () => {
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: 0, coins: [], lastRecordDate: undefined,
  });
  render(<ProfitSummary
    dateRange={{ start: new Date(2024, 0, 1), end: new Date(2024, 3, 16) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  fireEvent.click(screen.getByRole("radio", { name: "Y" }));
  await waitFor(() => expect(screen.getByText("2024").closest(".profit-period-grid > div"))
    .toHaveTextContent("—"));
  expect(screen.getByText("Periods 0 of 1")).toBeInTheDocument();
});

it("lets the phone narrow a month's P&L chart to seven days", async () => {
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: 0, coins: [], lastRecordDate: new Date(2024, 3, 16),
  });
  vi.mocked(queryPreviousProfitSnapshotDate).mockResolvedValue(undefined);
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  render(<ProfitSummary
    dateRange={{ start: new Date(2024, 3, 1), end: new Date(2024, 3, 16) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  await waitFor(() => expect(screen.getByText("Apr").closest("button")).not.toHaveTextContent("—"));
  fireEvent.click(screen.getByText("Apr").closest("button")!);
  expect(screen.getByRole("radio", { name: "7D" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "7D" }));
  expect(new Date(screen.getByTestId("month-pnl-start").textContent!).getDate()).toBe(10);
});
