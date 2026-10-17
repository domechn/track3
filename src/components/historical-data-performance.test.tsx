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
