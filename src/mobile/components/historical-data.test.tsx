import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import HistoricalData from "@/mobile/components/historical-data";
import { DataChangedContext } from "@/contexts/data-changed";
import { queryHistoricalPage } from "@/middlelayers/charts";

vi.mock("@/components/motion", () => ({
  StaggerContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FadeUp: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@tauri-apps/api/path", () => ({ appCacheDir: vi.fn().mockResolvedValue("/tmp") }));
vi.mock("@/utils/app", () => ({ getImageApiPath: vi.fn().mockResolvedValue("/logo") }));
vi.mock("@/middlelayers/data", () => ({ downloadCoinLogos: vi.fn() }));
vi.mock("@/middlelayers/configuration", () => ({ addToBlacklist: vi.fn() }));
vi.mock("@/middlelayers/charts", () => ({
  queryHistoricalPage: vi.fn(),
  queryHistoricalDetail: vi.fn(),
  queryEditLog: vi.fn(async () => []),
  queryRestoreHistoricalData: vi.fn(),
  deleteHistoricalDataByUUID: vi.fn(),
  deleteHistoricalDataDetailById: vi.fn(),
  restoreHistoricalData: vi.fn(),
}));

const row = (id: string) => ({
  id, createdAt: "2026-10-31T09:41:00.000Z", total: 123, change: null, assetCount: 1, topAssets: [],
});
const props = {
  dateRange: { start: new Date("2026-01-01"), end: new Date("2026-12-31") },
  currency: { currency: "USD", symbol: "$", rate: 1, alias: "usd" },
  quoteColor: "green-up-red-down" as const,
};

beforeEach(() => {
  vi.mocked(queryHistoricalPage).mockReset();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
});

it("reloads the first page after external data changes while more rows are loaded", async () => {
  let updated = false;
  vi.mocked(queryHistoricalPage).mockImplementation(async (_range, _size, page) => ({
    totalCount: 100,
    latest: { id: updated ? "new" : "old", createdAt: row("old").createdAt, total: 123 },
    rows: page === 0 ? [row(updated ? "new" : "old")] : [row("second")],
  }));
  const view = render(<DataChangedContext.Provider value={0}><HistoricalData {...props} /></DataChangedContext.Provider>);
  await screen.findByText("1–1 of 100");
  fireEvent.click(screen.getByRole("button", { name: "Next 50" }));
  await screen.findByText("51–51 of 100");
  expect(screen.getAllByTestId("history-mobile-row")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Previous 50" }));
  await screen.findByText("1–1 of 100");
  fireEvent.click(screen.getByRole("button", { name: "Next 50" }));
  await screen.findByText("51–51 of 100");
  updated = true;
  view.rerender(<DataChangedContext.Provider value={1}><HistoricalData {...props} /></DataChangedContext.Provider>);
  await waitFor(() => expect(screen.getByText("1–1 of 100")).toBeInTheDocument());
  expect(queryHistoricalPage).toHaveBeenLastCalledWith(expect.anything(), 50, 0, "all");
  expect(screen.getAllByTestId("history-mobile-row")).toHaveLength(1);
});

it("keeps All time inside the app date range", async () => {
  vi.mocked(queryHistoricalPage).mockResolvedValue({
    totalCount: 1, latest: null, rows: [row("inside")],
  });
  render(<DataChangedContext.Provider value={0}><HistoricalData {...props} /></DataChangedContext.Provider>);
  await screen.findByText("1–1 of 1");
  expect(queryHistoricalPage).toHaveBeenCalledWith(props.dateRange, 50, 0, "all");
});
