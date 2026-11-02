import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DesktopSummary from "./profit-summary";
import MobileSummary from "@/mobile/components/profit-summary";
import { calculateTotalProfit } from "@/middlelayers/charts";
import { queryPreviousProfitSnapshotDate } from "@/middlelayers/charts-profit";

vi.mock("@/middlelayers/charts", () => ({
  calculateTotalProfit: vi.fn().mockResolvedValue({ total: 0 }),
}));
vi.mock("@/middlelayers/charts-profit", () => ({
  queryPreviousProfitSnapshotDate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/components/pnl-chart", () => ({ default: () => null }));
vi.mock("@/mobile/components/pnl-chart", () => ({ default: () => null }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 31, 12) });
  vi.mocked(calculateTotalProfit).mockReset().mockResolvedValue({ total: 0, knownTotal: 0, unknownCoins: [], coins: [] });
  vi.mocked(queryPreviousProfitSnapshotDate).mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

it.each([
  ["desktop", DesktopSummary],
  ["mobile", MobileSummary],
])("%s includes the final millisecond of January in month and year requests", async (_platform, Summary) => {
  const currentYear = new Date().getFullYear();
  render(<Summary
    dateRange={{ start: new Date(currentYear, 0, 1), end: new Date(currentYear, 0, 31, 23, 59, 59, 999) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  const janEnd = new Date(currentYear, 1, 1).getTime() - 1;
  await waitFor(() => expect(vi.mocked(calculateTotalProfit).mock.calls.some(
    ([range]) => range.start.getTime() === new Date(currentYear, 0, 1).getTime()
      && range.end.getTime() === janEnd,
  )).toBe(true));
  fireEvent.click(screen.getByRole("radio", { name: "Y" }));
  const yearEnd = new Date(currentYear + 1, 0, 1).getTime() - 1;
  await waitFor(() => expect(vi.mocked(calculateTotalProfit).mock.calls.some(
    ([range]) => range.start.getTime() === new Date(currentYear, 0, 1).getTime()
      && range.end.getTime() === yearEnd,
  )).toBe(true));
});

it.each([
  ["desktop", DesktopSummary],
  ["mobile", MobileSummary],
])("%s marks sparse months and explains a long baseline gap", async (_platform, Summary) => {
  const year = new Date().getFullYear();
  vi.mocked(calculateTotalProfit).mockImplementation(async (range) => {
    const month = range.start.getMonth();
    const hasData = [0, 3, 9].includes(month);
    return {
      total: hasData ? ({ 0: -1100, 3: 4200, 9: -81900 } as Record<number, number>)[month] : 0,
      knownTotal: hasData ? ({ 0: -1100, 3: 4200, 9: -81900 } as Record<number, number>)[month] : 0,
      unknownCoins: [],
      coins: [],
      lastRecordDate: hasData ? new Date(year, month, 4, 12) : undefined,
    };
  });
  vi.mocked(queryPreviousProfitSnapshotDate).mockImplementation(async (start) =>
    start.getMonth() === 9 ? new Date(year, 3, 4, 12) : undefined);
  render(<Summary
    dateRange={{ start: new Date(year, 0, 1), end: new Date(year, 9, 31, 23, 59, 59, 999) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);

  await waitFor(() => expect(screen.getByText("Periods 3 of 10")).toBeInTheDocument());
  expect(screen.getByText("Up 1")).toBeInTheDocument();
  expect(screen.getByText("Down 2")).toBeInTheDocument();
  expect(screen.getByText("Oct").closest("button")).toHaveTextContent("since 4 Apr");
  const feb = screen.getByText("Feb").closest("button")!;
  expect(feb).toHaveTextContent("—");
  expect(feb).toHaveAttribute("aria-label", expect.stringContaining("No snapshot in this month"));
  fireEvent.click(feb);
  expect(feb).toHaveTextContent("No snapshot in this month");
});

it.each([
  ["desktop", DesktopSummary],
  ["mobile", MobileSummary],
])("%s explains only loaded months without snapshots", async (_platform, Summary) => {
  let finishLoad!: (value: Awaited<ReturnType<typeof calculateTotalProfit>>) => void;
  vi.mocked(calculateTotalProfit).mockImplementation(() =>
    new Promise((resolve) => { finishLoad = resolve; }));
  render(<Summary
    dateRange={{ start: new Date(2026, 9, 1), end: new Date(2026, 9, 31, 23, 59, 59, 999) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);

  const jan = screen.getByText("Jan").closest("button")!;
  const oct = screen.getByText("Oct").closest("button")!;
  expect(jan).not.toHaveAttribute("aria-label", expect.stringContaining("No snapshot"));
  expect(oct).not.toHaveAttribute("aria-label", expect.stringContaining("No snapshot"));
  await waitFor(() => expect(calculateTotalProfit).toHaveBeenCalled());
  finishLoad({ total: 0, knownTotal: null, unknownCoins: [], coins: [] });
  await waitFor(() => expect(oct).toHaveAttribute("aria-label", expect.stringContaining("No snapshot")));
  expect(jan).not.toHaveAttribute("aria-label", expect.stringContaining("No snapshot"));
  expect(jan).toBeDisabled();
  expect(jan).not.toHaveTextContent("No snapshot in this month");
  expect(screen.getByText("Periods 0 of 1")).toBeInTheDocument();
});

it.each([
  ["desktop", DesktopSummary],
  ["mobile", MobileSummary],
])("%s marks partial months and years, explains excluded coins, and keeps month detail available", async (_platform, Summary) => {
  vi.mocked(calculateTotalProfit).mockImplementation(async (range) => ({
    total: null,
    knownTotal: range.start.getMonth() === 1 || range.end.getMonth() === 11 ? 4200 : null,
    unknownCoins: [{ symbol: "BTC", assetType: "crypto" }, { symbol: "ETH", assetType: "crypto" }],
    coins: [],
    lastRecordDate: new Date(2024, range.start.getMonth(), 15),
  }));
  render(<Summary
    dateRange={{ start: new Date(2024, 0, 1), end: new Date(2024, 2, 31, 23, 59, 59, 999) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  await waitFor(() => expect(screen.getByText("Partial 3")).toBeInTheDocument());
  expect(screen.getByText("Periods 3")).toBeInTheDocument();
  expect(screen.getByText("Up 1")).toBeInTheDocument();
  const feb = screen.getByText("Feb").closest("button")!;
  expect(feb).toHaveTextContent("~+$4.2k");
  expect(screen.getByText("~+$4.2k")).toHaveClass("text-muted-foreground");
  expect(screen.getByText("Jan").closest("button")).toHaveTextContent("—");
  fireEvent.click(screen.getByRole("button", { name: "Explain partial profit for Jan" }));
  expect(screen.getByText("Jan").closest("button")!.parentElement).toHaveTextContent(
    /2 coins \(BTC, ETH\) have withdrawals without a matching deposit/,
  );
  const febInfo = screen.getByRole("button", { name: "Explain partial profit for Feb" });
  fireEvent.click(febInfo);
  expect(feb.parentElement).toHaveTextContent(/2 coins \(BTC, ETH\) have withdrawals without a matching deposit/);
  fireEvent.click(feb);
  expect(screen.getByText(/Daily P(?:nL|&L) in Feb 2024/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Back|All months/ }));
  fireEvent.click(screen.getByRole("radio", { name: "Y" }));
  await waitFor(() => expect(screen.getByText("Partial 1")).toBeInTheDocument());
  expect(screen.getByText("2024").closest(".grid > div")).toHaveTextContent("~+$4.2k");
  fireEvent.click(screen.getByRole("button", { name: "Explain partial profit for 2024" }));
  expect(screen.getByText("2024").closest(".grid > div")).toHaveTextContent(/2 coins \(BTC, ETH\) have withdrawals without a matching deposit/);
});

it.each([
  ["desktop", DesktopSummary],
  ["mobile", MobileSummary],
])("%s limits a partial explanation to five coin names", async (_platform, Summary) => {
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: null,
    knownTotal: -25,
    unknownCoins: ["A", "B", "C", "D", "E", "F", "G"]
      .map((symbol) => ({ symbol, assetType: "crypto" })),
    coins: [],
    lastRecordDate: new Date(2024, 1, 15),
  });
  render(<Summary
    dateRange={{ start: new Date(2024, 1, 1), end: new Date(2024, 1, 29, 23, 59, 59, 999) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  await waitFor(() => expect(screen.getByText("Down 1")).toBeInTheDocument());
  expect(screen.getByText("Feb").closest("button")).toHaveTextContent("~-$25");
  const info = screen.getByRole("button", { name: "Explain partial profit for Feb" });
  fireEvent.click(info);
  expect(info.parentElement).toHaveTextContent("A, B, C, D, E +2 more");
  expect(info.parentElement).not.toHaveTextContent("F, G");
});

it.each([
  ["desktop", DesktopSummary, "Asia/Shanghai"],
  ["mobile", MobileSummary, "Asia/Shanghai"],
  ["desktop", DesktopSummary, "Etc/GMT+8"],
  ["mobile", MobileSummary, "Etc/GMT+8"],
])("%s requests complete local months in %s", async (_platform, Summary, tz) => {
  const priorTZ = process.env.TZ;
  process.env.TZ = tz;
  try {
    render(<Summary
      dateRange={{ start: new Date(2024, 0, 1), end: new Date(2024, 1, 29, 23, 59, 59, 999) }}
      currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
      quoteColor="green-up-red-down"
    />);
    await waitFor(() => expect(vi.mocked(calculateTotalProfit).mock.calls.some(([range]) =>
      range.start.getTime() === new Date(2024, 1, 1).getTime()
      && range.end.getTime() === new Date(2024, 2, 1).getTime() - 1)).toBe(true));
  } finally {
    if (priorTZ === undefined) delete process.env.TZ;
    else process.env.TZ = priorTZ;
  }
});
