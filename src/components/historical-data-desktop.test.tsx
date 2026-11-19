import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import HistoricalDataDesktop from "./historical-data-desktop";
import { Toaster } from "./ui/toaster";
import {
  deleteHistoricalDataByUUID, queryEditLog, queryHistoricalDetail, queryHistoricalPage,
  queryRestoreHistoricalData, restoreHistoricalData,
} from "@/middlelayers/charts";

vi.mock("@/middlelayers/charts", () => ({
  deleteHistoricalDataByUUID: vi.fn(),
  deleteHistoricalDataDetailById: vi.fn(),
  queryEditLog: vi.fn(),
  queryHistoricalDetail: vi.fn(),
  queryHistoricalPage: vi.fn(),
  queryRestoreHistoricalData: vi.fn(),
  restoreHistoricalData: vi.fn(),
}));
vi.mock("@/middlelayers/entities/assets", () => ({
  ASSET_HANDLER: { listAssetsByUUIDs: vi.fn(async () => []) },
}));
vi.mock("@/middlelayers/datafetch/coins/stable", () => ({
  StableCoinsQuery: class { listAllStableCoins() { return Promise.resolve([]); } },
}));
vi.mock("@/middlelayers/sync/delete-hook", () => ({
  recordSnapshotDeleted: vi.fn(async () => {}),
  recordSnapshotUndone: vi.fn(async () => {}),
}));
vi.mock("@/middlelayers/sync/runtime", () => ({
  syncRuntime: { trigger: vi.fn() },
}));
vi.mock("./sync-status-indicator", () => ({ default: () => null }));

const createdAt = "2026-10-31T09:41:00.000Z";
const olderAt = "2026-10-30T09:41:00.000Z";
const rows = [
  { id: "new", createdAt, total: 200, change: 100, assetCount: 1, topAssets: [] },
  { id: "old", createdAt: olderAt, total: 100, change: null, assetCount: 1, topAssets: [], missingCount: 1, sourcesTotal: 2 },
];
const currency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(queryHistoricalPage).mockImplementation(async (_dates, size, page, filter) => {
    const filtered = filter === "partial" ? rows.slice(1) : filter === "edited" ? [] : rows;
    return { rows: filtered.slice(page * size, (page + 1) * size), totalCount: filtered.length,
      latest: { id: "new", createdAt, total: 200 } };
  });
  vi.mocked(queryHistoricalDetail).mockImplementation(async (id) => ({
    id, createdAt: id === "new" ? createdAt : olderAt, total: id === "new" ? 200 : 100,
    assets: [{ id: id === "new" ? 1 : 2, uuid: id, createdAt: id === "new" ? createdAt : olderAt,
      assetType: "stock", symbol: "AAPL", amount: 1, value: id === "new" ? 200 : 100, price: id === "new" ? 200 : 100 }],
    transactions: [],
  }));
  vi.mocked(queryEditLog).mockResolvedValue([]);
  vi.mocked(queryRestoreHistoricalData).mockResolvedValue({} as never);
  vi.mocked(deleteHistoricalDataByUUID).mockResolvedValue(undefined);
  vi.mocked(restoreHistoricalData).mockResolvedValue(undefined);
});

it("filters the desktop snapshot table by issue status and restores all rows", async () => {
  render(<MemoryRouter><HistoricalDataDesktop currency={currency} quoteColor="green-up-red-down" /></MemoryRouter>);
  await waitFor(() => expect(screen.getAllByTestId("history-snapshot-row")).toHaveLength(2));
  fireEvent.click(screen.getByRole("button", { name: "With issues 1" }));
  await waitFor(() => expect(screen.getAllByTestId("history-snapshot-row")).toHaveLength(1));
  expect(screen.getByTestId("history-snapshot-row")).toHaveTextContent("30 Oct");
  fireEvent.click(screen.getByRole("button", { name: "All" }));
  await waitFor(() => expect(screen.getAllByTestId("history-snapshot-row")).toHaveLength(2));
});

it("removes a desktop snapshot immediately and restores it through Undo", async () => {
  const afterDataChanged = vi.fn();
  render(<MemoryRouter><HistoricalDataDesktop currency={currency} quoteColor="green-up-red-down"
    afterDataChanged={afterDataChanged} /><Toaster /></MemoryRouter>);
  await waitFor(() => expect(screen.getAllByTestId("history-snapshot-row")).toHaveLength(2));
  const detail = screen.getByTestId("history-desktop-detail");
  fireEvent.click(within(detail).getByRole("button", { name: /^Delete$/ }));
  fireEvent.click(within(screen.getByRole("alertdialog", { name: "Delete this snapshot?" }))
    .getByRole("button", { name: "Delete snapshot" }));
  await waitFor(() => expect(screen.getAllByTestId("history-snapshot-row")).toHaveLength(1));
  expect(screen.getByTestId("history-snapshot-row")).toHaveTextContent("30 Oct");
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(screen.getAllByTestId("history-snapshot-row")).toHaveLength(2));
  await waitFor(() => expect(detail).toHaveTextContent("$200.00"));
});

it("uses the red-up physical tone for a positive edit-log delta", async () => {
  vi.mocked(queryEditLog).mockResolvedValue([{
    id: 1, edited_at: createdAt, origin: "local", target: "asset", action: "restore",
    asset_type: "stock", symbol: "AAPL", old_value: null, new_value: '{"value":25}',
  }]);
  render(<MemoryRouter><HistoricalDataDesktop currency={currency} quoteColor="red-up-green-down" /></MemoryRouter>);
  const log = await screen.findByRole("region", { name: "Edits" });
  expect(within(log).getByText("+$25.00")).toHaveClass("neg");
});

it("mutes a zero edit-log delta", async () => {
  vi.mocked(queryEditLog).mockResolvedValue([{
    id: 1, edited_at: createdAt, origin: "local", target: "asset", action: "price",
    asset_type: "stock", symbol: "AAPL", old_value: "10", new_value: "11",
  }]);
  render(<MemoryRouter><HistoricalDataDesktop currency={currency} quoteColor="red-up-green-down" /></MemoryRouter>);
  const log = await screen.findByRole("region", { name: "Edits" });
  expect(within(log).getByText("$0.00")).toHaveClass("zero");
});

it("shows IBKR USD cash and reveals saved small coins on request", async () => {
  vi.mocked(queryHistoricalDetail).mockResolvedValue({
    id: "new", createdAt, total: 60000.4, transactions: [],
    assets: [
      { id: 10, uuid: "new", createdAt, assetType: "stock", wallet: "6b09e3e969b8cf3b2f1a99bdc1ed510c",
        symbol: "USD", amount: 60000, price: 1, value: 60000 },
      { id: 11, uuid: "new", createdAt, assetType: "crypto", wallet: "wallet",
        symbol: "DUST", amount: 2, price: 0.2, value: 0.4 },
    ],
  });
  render(<MemoryRouter><HistoricalDataDesktop currency={currency} quoteColor="green-up-red-down" /></MemoryRouter>);
  await waitFor(() => expect(screen.getAllByTestId("history-detail-row")).toHaveLength(1));
  expect(screen.getByTestId("history-detail-row")).toHaveTextContent("USD");
  expect(screen.getByTestId("history-detail-row")).toHaveTextContent("$60,000.00");
  expect(screen.getByTestId("small-holdings-toggle")).toHaveTextContent("Show 1 small holdings");
  fireEvent.click(screen.getByTestId("small-holdings-toggle"));
  expect(screen.getAllByTestId("history-detail-row")).toHaveLength(2);
  expect(screen.getByTestId("history-desktop-detail")).toHaveTextContent("$60,000.40");
});
