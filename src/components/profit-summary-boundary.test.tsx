import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import DesktopSummary from "./profit-summary";
import MobileSummary from "@/mobile/components/profit-summary";
import { calculateTotalProfit } from "@/middlelayers/charts";

vi.mock("@/middlelayers/charts", () => ({
  calculateTotalProfit: vi.fn().mockResolvedValue({ total: 0 }),
}));
vi.mock("@/components/pnl-chart", () => ({ default: () => null }));
vi.mock("@/mobile/components/pnl-chart", () => ({ default: () => null }));

beforeEach(() => vi.mocked(calculateTotalProfit).mockClear());

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
