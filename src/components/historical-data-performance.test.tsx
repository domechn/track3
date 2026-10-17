import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import HistoricalData from "./historical-data";
import { DataChangedContext } from "@/contexts/data-changed";
import { hourlyHistory } from "@/test/history-fixtures";

vi.mock("./motion", () => ({
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
  queryRestoreHistoricalData: vi.fn(),
  deleteHistoricalDataByUUID: vi.fn(),
  deleteHistoricalDataDetailById: vi.fn(),
  restoreHistoricalData: vi.fn(),
}));

import { queryHistoricalDetail, queryHistoricalPage } from "@/middlelayers/charts";

it("renders one SQL page and windows a 200-asset detail table", async () => {
  const snapshot = hourlyHistory(1, 200).next().value!;
  vi.mocked(queryHistoricalPage).mockResolvedValue({
    totalCount: 26280,
    latest: { id: "snapshot-0", createdAt: snapshot.createdAt, total: 20100 },
    rows: Array.from({ length: 20 }, (_, i) => ({
      id: `snapshot-${i}`,
      createdAt: snapshot.createdAt,
      total: 20100,
      change: 1,
      assetCount: 200,
      topAssets: [],
    })),
  });
  vi.mocked(queryHistoricalDetail).mockResolvedValue({
    id: "snapshot-0",
    createdAt: snapshot.createdAt,
    total: 20100,
    transactions: [],
    assets: snapshot.assets.map((asset, i) => ({
      ...asset, id: i, uuid: "snapshot-0", createdAt: snapshot.createdAt,
      assetType: "crypto", wallet: "wallet",
    })),
  });

  render(<HistoricalData
    dateRange={{ start: new Date("2022-01-01"), end: new Date("2025-01-01") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
    quoteColor="green-up-red-down"
  />);
  await screen.findAllByText("snapshot");
  expect(queryHistoricalPage).toHaveBeenCalledTimes(1);
  expect(queryHistoricalDetail).not.toHaveBeenCalled();
  expect(screen.getAllByTestId("history-snapshot-row")).toHaveLength(20);
  expect(document.querySelectorAll("[role=option]").length).toBeLessThan(100);
  fireEvent.change(screen.getByRole("spinbutton", { name: /select page/i }), { target: { value: "2" } });
  fireEvent.keyDown(screen.getByRole("spinbutton", { name: /select page/i }), { key: "Enter" });
  await waitFor(() => expect(queryHistoricalPage).toHaveBeenCalledWith(expect.anything(), 20, 1));
  fireEvent.click(screen.getAllByText("snapshot")[0]);
  const dialog = await screen.findByRole("dialog", { name: /historical data detail/i });
  await waitFor(() => expect(within(dialog).getAllByTestId("history-detail-row").length).toBeGreaterThan(0));
  expect(within(dialog).getByRole("region", { name: "Assets" })).toHaveAttribute("tabindex", "0");
  expect(queryHistoricalDetail).toHaveBeenCalledTimes(1);
  expect(within(dialog).getByRole("table")).toHaveAttribute("aria-rowcount", "200");
  fireEvent.click(within(dialog).getByRole("button", { name: /show more/i }));
  await waitFor(() => expect(within(dialog).getByRole("table")).toHaveAttribute("aria-rowcount", "200"));
  expect(within(dialog).getAllByTestId("history-detail-row").length).toBeLessThan(50);
});

it("refreshes an open detail dialog after an external data change", async () => {
  vi.mocked(queryHistoricalPage).mockReset();
  vi.mocked(queryHistoricalDetail).mockReset();
  const snapshot = hourlyHistory(1, 1).next().value!;
  const page = {
    totalCount: 1,
    latest: { id: "snapshot-0", createdAt: snapshot.createdAt, total: 10 },
    rows: [{
      id: "snapshot-0", createdAt: snapshot.createdAt, total: 10,
      change: null, assetCount: 1, topAssets: [],
    }],
  };
  let finishPage!: () => void;
  vi.mocked(queryHistoricalPage)
    .mockResolvedValueOnce({ ...page, rows: [...page.rows] })
    .mockReturnValueOnce(new Promise((resolve) => {
      finishPage = () => resolve({ ...page, rows: [...page.rows] });
    }));
  vi.mocked(queryHistoricalDetail)
    .mockResolvedValueOnce({
      id: "snapshot-0", createdAt: snapshot.createdAt, total: 10, transactions: [],
      assets: [{
        id: 1, uuid: "snapshot-0", createdAt: snapshot.createdAt,
        symbol: "BTC", assetType: "crypto", amount: 1, value: 10, price: 10,
      }],
    })
    .mockResolvedValue({
      id: "snapshot-0", createdAt: snapshot.createdAt, total: 20, transactions: [],
      assets: [{
        id: 2, uuid: "snapshot-0", createdAt: snapshot.createdAt,
        symbol: "ETH", assetType: "crypto", amount: 1, value: 20, price: 20,
      }],
    });
  const props = {
    dateRange: { start: new Date("2022-01-01"), end: new Date("2025-01-01") },
    currency: { currency: "USD", symbol: "$", rate: 1, alias: "usd" },
    quoteColor: "green-up-red-down" as const,
  };
  const view = render(
    <DataChangedContext.Provider value={0}><HistoricalData {...props} /></DataChangedContext.Provider>,
  );
  fireEvent.click((await screen.findAllByText("snapshot"))[0]);
  const dialog = await screen.findByRole("dialog", { name: /historical data detail/i });
  expect(await within(dialog).findByText("BTC")).toBeInTheDocument();
  view.rerender(
    <DataChangedContext.Provider value={1}><HistoricalData {...props} /></DataChangedContext.Provider>,
  );
  expect(await within(dialog).findByText("ETH")).toBeInTheDocument();
  finishPage();
  await waitFor(() => expect(queryHistoricalPage).toHaveBeenCalledTimes(2));
  expect(queryHistoricalDetail).toHaveBeenCalledTimes(2);
});

it("keeps an open snapshot detail when new history pushes it off the current page", async () => {
  vi.mocked(queryHistoricalPage).mockResolvedValueOnce({
    totalCount: 1, latest: { id: "old", createdAt: "2024-01-01T00:00:00.000Z", total: 10 },
    rows: [{ id: "old", createdAt: "2024-01-01T00:00:00.000Z", total: 10, change: null, assetCount: 1, topAssets: [] }],
  }).mockResolvedValue({
    totalCount: 2, latest: { id: "new", createdAt: "2024-01-02T00:00:00.000Z", total: 20 },
    rows: [{ id: "new", createdAt: "2024-01-02T00:00:00.000Z", total: 20, change: null, assetCount: 1, topAssets: [] }],
  });
  vi.mocked(queryHistoricalDetail).mockResolvedValue({
    id: "old", createdAt: "2024-01-01T00:00:00.000Z", total: 10, transactions: [],
    assets: [{ id: 1, uuid: "old", createdAt: "2024-01-01T00:00:00.000Z",
      symbol: "BTC", assetType: "crypto", amount: 1, value: 10, price: 10 }],
  });
  const props = {
    dateRange: { start: new Date("2022-01-01"), end: new Date("2025-01-01") },
    currency: { currency: "USD", symbol: "$", rate: 1, alias: "usd" },
    quoteColor: "green-up-red-down" as const,
  };
  const view = render(<DataChangedContext.Provider value={0}><HistoricalData {...props} /></DataChangedContext.Provider>);
  fireEvent.click(await screen.findByText("old"));
  expect(await screen.findByRole("dialog", { name: /historical data detail/i })).toBeVisible();
  view.rerender(<DataChangedContext.Provider value={1}><HistoricalData {...props} /></DataChangedContext.Provider>);
  await screen.findByText("new");
  expect(screen.getByRole("dialog", { name: /historical data detail/i })).toBeVisible();
});

it("shows a loading status while a snapshot detail query is pending", async () => {
  const snapshot = hourlyHistory(1, 1).next().value!;
  vi.mocked(queryHistoricalPage).mockResolvedValue({
    totalCount: 1,
    latest: { id: "snapshot-0", createdAt: snapshot.createdAt, total: 10 },
    rows: [{ id: "snapshot-0", createdAt: snapshot.createdAt, total: 10,
      change: null, assetCount: 1, topAssets: [] }],
  });
  vi.mocked(queryHistoricalDetail).mockReturnValue(new Promise(() => {}));
  render(<HistoricalData
    dateRange={{ start: new Date("2022-01-01"), end: new Date("2025-01-01") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
    quoteColor="green-up-red-down"
  />);
  fireEvent.click((await screen.findAllByText("snapshot"))[0]);
  const dialog = await screen.findByRole("dialog", { name: /historical data detail/i });
  expect(within(dialog).getByRole("status")).toHaveTextContent("Loading");
  expect(within(dialog).queryByText("No assets matched current filter")).not.toBeInTheDocument();
});

it("shows a localized detail error when the snapshot query fails", async () => {
  const snapshot = hourlyHistory(1, 1).next().value!;
  vi.mocked(queryHistoricalPage).mockResolvedValue({
    totalCount: 1,
    latest: { id: "snapshot-0", createdAt: snapshot.createdAt, total: 10 },
    rows: [{ id: "snapshot-0", createdAt: snapshot.createdAt, total: 10,
      change: null, assetCount: 1, topAssets: [] }],
  });
  vi.mocked(queryHistoricalDetail).mockRejectedValue(new Error("db unavailable"));
  render(<HistoricalData
    dateRange={{ start: new Date("2022-01-01"), end: new Date("2025-01-01") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
    quoteColor="green-up-red-down"
  />);
  fireEvent.click((await screen.findAllByText("snapshot"))[0]);
  const dialog = await screen.findByRole("dialog", { name: /historical data detail/i });
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Could not load snapshot details");
});

it("shows a loading status while a different SQL page is pending", async () => {
  const snapshot = hourlyHistory(1, 1).next().value!;
  let finish!: (page: { totalCount: number; latest: { id: string; createdAt: string; total: number }; rows: {
    id: string; createdAt: string; total: number; change: null;
    assetCount: number; topAssets: [];
  }[] }) => void;
  vi.mocked(queryHistoricalPage)
    .mockResolvedValueOnce({
      totalCount: 21,
      latest: { id: "snapshot-0", createdAt: snapshot.createdAt, total: 10 },
      rows: Array.from({ length: 20 }, (_, i) => ({
        id: `snapshot-${i}`, createdAt: snapshot.createdAt, total: 10,
        change: null, assetCount: 1, topAssets: [],
      })),
    })
    .mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  render(<HistoricalData
    dateRange={{ start: new Date("2022-01-01"), end: new Date("2025-01-01") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
    quoteColor="green-up-red-down"
  />);
  await screen.findAllByText("snapshot");
  fireEvent.click(screen.getByRole("button", { name: /next page/i }));
  expect(screen.getByRole("status")).toHaveTextContent("Loading historical data");
  finish({
    totalCount: 21,
    latest: { id: "snapshot-0", createdAt: snapshot.createdAt, total: 10 },
    rows: [{ id: "next-page", createdAt: snapshot.createdAt, total: 10,
      change: null, assetCount: 1, topAssets: [] }],
  });
  expect(await screen.findByText("next-pag")).toBeInTheDocument();
});

it("uses measured detail row heights when positioning the scroll window", async () => {
  vi.mocked(queryHistoricalPage).mockResolvedValue({
    totalCount: 1, latest: { id: "snapshot-0", createdAt: "2024-01-01T00:00:00.000Z", total: 2000 },
    rows: [{ id: "snapshot-0", createdAt: "2024-01-01T00:00:00.000Z", total: 2000,
      change: null, assetCount: 200, topAssets: [] }],
  });
  vi.mocked(queryHistoricalDetail).mockResolvedValue({
    id: "snapshot-0", createdAt: "2024-01-01T00:00:00.000Z", total: 2000, transactions: [],
    assets: Array.from({ length: 200 }, (_, i) => ({
      id: i + 1, uuid: "snapshot-0", createdAt: "2024-01-01T00:00:00.000Z",
      symbol: `ASSET${i}`, assetType: "crypto" as const, amount: 1, value: 10, price: 10,
    })),
  });
  vi.stubGlobal("ResizeObserver", class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      if (target.getAttribute("data-asset-id") !== "1") return;
      queueMicrotask(() => this.callback([{
        target, contentRect: { height: 84 },
      } as ResizeObserverEntry], this as unknown as ResizeObserver));
    }
    disconnect() {}
    unobserve() {}
  });
  try {
    render(<HistoricalData
      dateRange={{ start: new Date("2022-01-01"), end: new Date("2025-01-01") }}
      currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
      quoteColor="green-up-red-down"
    />);
    fireEvent.click(await screen.findByText("snapshot"));
    const dialog = await screen.findByRole("dialog", { name: /historical data detail/i });
    await within(dialog).findAllByTestId("history-detail-row");
    const region = within(dialog).getByRole("region", { name: "Assets" });
    Object.defineProperty(region, "scrollTop", { configurable: true, value: 1000 });
    fireEvent.scroll(region);
    await waitFor(() => {
      const table = within(dialog).getByRole("table");
      const first = within(dialog).getAllByTestId("history-detail-row")[0];
      const start = Number(first.getAttribute("aria-rowindex")) - 2;
      const spacer = table.querySelector<HTMLTableCellElement>('tr[aria-hidden="true"] td');
      expect(start).toBeGreaterThan(0);
      expect(spacer?.style.height).toBe(`${start * 42 + 42}px`);
    });
  } finally { vi.unstubAllGlobals(); }
});

it("updates the visible snapshot total after deleting one detail asset", async () => {
  vi.mocked(queryHistoricalPage).mockResolvedValue({
    totalCount: 1, latest: { id: "snapshot-0", createdAt: "2024-01-01T00:00:00.000Z", total: 30 },
    rows: [{ id: "snapshot-0", createdAt: "2024-01-01T00:00:00.000Z", total: 30,
      change: null, assetCount: 2, topAssets: [] }],
  });
  vi.mocked(queryHistoricalDetail).mockResolvedValue({
    id: "snapshot-0", createdAt: "2024-01-01T00:00:00.000Z", total: 30, transactions: [],
    assets: [
      { id: 1, uuid: "snapshot-0", createdAt: "2024-01-01T00:00:00.000Z",
        symbol: "BTC", assetType: "crypto", amount: 1, value: 20, price: 20 },
      { id: 2, uuid: "snapshot-0", createdAt: "2024-01-01T00:00:00.000Z",
        symbol: "ETH", assetType: "crypto", amount: 1, value: 10, price: 10 },
    ],
  });
  render(<HistoricalData
    dateRange={{ start: new Date("2022-01-01"), end: new Date("2025-01-01") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
    quoteColor="green-up-red-down"
  />);
  fireEvent.click(await screen.findByText("snapshot"));
  const dialog = await screen.findByRole("dialog", { name: /historical data detail/i });
  const eth = within(dialog).getByText("ETH").closest("tr")!;
  fireEvent.click(within(eth).getByRole("button", { name: "Delete" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
  const row = screen.getByTestId("history-snapshot-row");
  await waitFor(() => expect(row).toHaveTextContent("$20.00"));
  expect(row).toHaveTextContent("1 assets");
});
