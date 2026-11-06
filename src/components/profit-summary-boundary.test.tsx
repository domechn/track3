import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  expect(screen.getByRole("tooltip")).toHaveTextContent("No snapshot in this month");
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
  await waitFor(() => expect(screen.getByText("Oct").closest("button")).toHaveAttribute("aria-label", expect.stringContaining("No snapshot")));
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
  expect(feb).toHaveTextContent("+$4.2k");
  expect(screen.getByText("+$4.2k")).toHaveClass("text-positive");
  expect(feb.parentElement).toHaveAttribute("data-partial", "true");
  expect(screen.getByText("Jan").closest("button")).toHaveTextContent("—");
  fireEvent.click(screen.getByRole("button", { name: "Explain partial profit for Jan" }));
  expect(screen.getByRole("tooltip")).toHaveTextContent("These coins have withdrawals without matching deposits.");
  expect(screen.getByRole("tooltip")).toHaveTextContent("BTC, ETH");
  expect(screen.getByRole("tooltip")).toHaveTextContent("Pair the withdrawals in History");
  const febInfo = screen.getByRole("button", { name: "Explain partial profit for Feb" });
  fireEvent.click(febInfo);
  expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  expect(screen.getByRole("tooltip")).toHaveTextContent("BTC, ETH");
  expect(febInfo).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(feb);
  expect(screen.getByText(/Daily P(?:nL|&L) in Feb 2024/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Back|All months/ }));
  fireEvent.click(screen.getByRole("radio", { name: "Y" }));
  await waitFor(() => expect(screen.getByText("Partial 1")).toBeInTheDocument());
  expect(screen.getByText("2024").closest(".grid > div")).toHaveTextContent("+$4.2k");
  fireEvent.click(screen.getByRole("button", { name: "Explain partial profit for 2024" }));
  expect(screen.getByRole("tooltip")).toHaveTextContent("BTC, ETH");
});

it.each([
  ["desktop", DesktopSummary],
  ["mobile", MobileSummary],
])("%s previews eight partial coin names and expands the rest", async (_platform, Summary) => {
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: null,
    knownTotal: -25,
    unknownCoins: ["A", "B", "C", "D", "E", "F", "G", "H", "I"]
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
  expect(screen.getByText("Feb").closest("button")).toHaveTextContent("-$25");
  const info = screen.getByRole("button", { name: "Explain partial profit for Feb" });
  fireEvent.click(info);
  expect(screen.getByRole("tooltip")).toHaveTextContent("A, B, C, D, E, F, G, H and 1 more");
  expect(screen.queryByText("A, B, C, D, E, F, G, H, I")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show all" }));
  expect(screen.getByText("A, B, C, D, E, F, G, H, I")).toBeInTheDocument();
});

it.each([
  ["desktop", DesktopSummary],
  ["mobile", MobileSummary],
])("%s gives partial periods the same tone and surface as complete periods", async (_platform, Summary) => {
  vi.mocked(calculateTotalProfit).mockImplementation(async (range) => {
    const value = [4200, -25, 0][range.start.getMonth()] ?? 0;
    const partial = range.start.getFullYear() === 2024;
    return {
      total: partial ? null : value,
      knownTotal: value,
      unknownCoins: partial ? [{ symbol: "ETH", assetType: "crypto" }] : [],
      coins: [],
      lastRecordDate: new Date(range.start.getFullYear(), range.start.getMonth(), 15),
    };
  });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  for (const quoteColor of ["green-up-red-down", "red-up-green-down"] as const) {
    for (const [year, isPartial] of [[2024, true], [2023, false]] as const) {
      const view = render(<Summary
        dateRange={{ start: new Date(year, 0, 1), end: new Date(year, 2, 31, 23, 59, 59, 999) }}
        currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
        quoteColor={quoteColor}
      />);
      await waitFor(() => expect(screen.getByText("Periods 3")).toBeInTheDocument());
      for (const [label, amount, toneClass, surfaceClass] of [
        ["Jan", "+$4.2k", quoteColor === "green-up-red-down" ? "text-positive" : "text-negative",
          quoteColor === "green-up-red-down" ? "bg-positive/10" : "bg-negative/10"],
        ["Feb", "-$25", quoteColor === "green-up-red-down" ? "text-negative" : "text-positive",
          quoteColor === "green-up-red-down" ? "bg-negative/10" : "bg-positive/10"],
        ["Mar", _platform === "desktop" ? "+$0" : "$0", "text-muted-foreground", "bg-muted/40"],
      ]) {
        const card = screen.getByText(label).closest("[data-partial]")!;
        expect(card).toHaveAttribute("data-partial", isPartial ? "true" : "false");
        expect(card).toHaveClass(surfaceClass);
        expect(card.querySelector("button > div:nth-child(2)")).toHaveClass(toneClass);
        const badge = card.querySelector("button[aria-expanded]");
        if (isPartial) {
          expect(badge).toHaveTextContent("?");
          expect(badge).toHaveAttribute("aria-label", `Explain partial profit for ${label}`);
          expect(badge).toHaveClass("focus-visible:ring-2");
        } else expect(badge).toBeNull();
        expect(card).toHaveTextContent(amount);
        expect(card).not.toHaveTextContent(`~${amount}`);
      }
      if (isPartial) {
        const badge = screen.getByRole("button", { name: "Explain partial profit for Jan" });
        badge.focus();
        await user.keyboard("{Enter}");
        expect(badge).toHaveAttribute("aria-expanded", "true");
      }
      view.unmount();
    }
  }
});

it.each([
  ["desktop", DesktopSummary],
  ["mobile", MobileSummary],
])("%s gives partial years the same positive, negative, and zero tones as complete years", async (_platform, Summary) => {
  for (const quoteColor of ["green-up-red-down", "red-up-green-down"] as const) {
    for (const [value, toneClass, surfaceClass] of [
      [4200, quoteColor === "green-up-red-down" ? "text-positive" : "text-negative",
        quoteColor === "green-up-red-down" ? "bg-positive/10" : "bg-negative/10"],
      [-25, quoteColor === "green-up-red-down" ? "text-negative" : "text-positive",
        quoteColor === "green-up-red-down" ? "bg-negative/10" : "bg-positive/10"],
      [0, "text-muted-foreground", "bg-muted/40"],
    ] as const) {
      vi.mocked(calculateTotalProfit).mockImplementation(async (range) => ({
        total: range.start.getFullYear() === 2024 ? null : value,
        knownTotal: value,
        unknownCoins: range.start.getFullYear() === 2024 ? [{ symbol: "ETH", assetType: "crypto" }] : [],
        coins: [],
        lastRecordDate: new Date(range.start.getFullYear(), 5, 15),
      }));
      const view = render(<Summary
        dateRange={{ start: new Date(2023, 0, 1), end: new Date(2024, 11, 31, 23, 59, 59, 999) }}
        currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
        quoteColor={quoteColor}
      />);
      fireEvent.click(screen.getByRole("radio", { name: "Y" }));
      await waitFor(() => expect(screen.getByText("Partial 1")).toBeInTheDocument());
      for (const [year, partial] of [[2023, false], [2024, true]] as const) {
        const card = screen.getByText(String(year)).closest(".grid > div")!;
        expect(card).toHaveAttribute("data-partial", String(partial));
        expect(card).toHaveClass(surfaceClass);
        expect(card.querySelector("div:nth-child(2)")).toHaveClass(toneClass);
        if (partial) expect(card.querySelector("button[aria-expanded]")).toHaveTextContent("?");
        else expect(card.querySelector("button[aria-expanded]")).toBeNull();
        expect(card).not.toHaveTextContent("~");
      }
      view.unmount();
    }
  }
});

it.each([
  ["desktop", DesktopSummary],
  ["mobile", MobileSummary],
])("%s keeps an unknown total without excluded coins unmarked", async (_platform, Summary) => {
  vi.mocked(calculateTotalProfit).mockResolvedValue({
    total: null, knownTotal: 4200, unknownCoins: [], coins: [],
    lastRecordDate: new Date(2024, 1, 15),
  });
  render(<Summary
    dateRange={{ start: new Date(2024, 1, 1), end: new Date(2024, 1, 29, 23, 59, 59, 999) }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "USD" }}
    quoteColor="green-up-red-down"
  />);
  await waitFor(() => expect(screen.getByText("Periods 1")).toBeInTheDocument());
  const card = screen.getByText("Feb").closest("[data-partial]")!;
  expect(card).toHaveTextContent("—");
  expect(card).not.toHaveTextContent("$4.2k");
  expect(card).toHaveAttribute("data-partial", "false");
  expect(card.querySelector("button[aria-expanded]")).toBeNull();
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
