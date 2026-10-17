import React, { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HistoricalData from "@/components/historical-data";
import { DataChangedContext } from "@/contexts/data-changed";
import { Toast, ToastProvider, ToastViewport } from "@/components/ui/toast";

const toastMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/motion", () => ({
  StaggerContainer: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  FadeUp: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appCacheDir: vi.fn().mockResolvedValue("/tmp/track3-cache"),
}));

vi.mock("@/utils/app", () => ({
  getImageApiPath: vi.fn().mockResolvedValue("/logos/BTC.png"),
}));

vi.mock("@/middlelayers/data", () => ({
  downloadCoinLogos: vi.fn(),
}));

vi.mock("@/middlelayers/charts", async () => ({
  ...(await import("@/test/mock-historical-queries")).mockHistoricalQueries(),
  deleteHistoricalDataByUUID: vi.fn(),
  deleteHistoricalDataDetailById: vi.fn(),
  queryRestoreHistoricalData: vi.fn(),
  restoreHistoricalData: vi.fn(),
}));

vi.mock("@/middlelayers/configuration", () => ({
  addToBlacklist: vi.fn(),
}));

import {
  queryHistoricalData,
  queryHistoricalDetail,
  deleteHistoricalDataByUUID,
  deleteHistoricalDataDetailById,
  queryRestoreHistoricalData,
  restoreHistoricalData,
} from "@/middlelayers/charts";

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };
const dateRange = {
  start: new Date("2024-01-01T00:00:00.000Z"),
  end: new Date("2024-12-31T00:00:00.000Z"),
};

const sampleRows = [
  {
    id: "snapshot-1",
    createdAt: "2024-04-16T12:00:00.000Z",
    total: 1200,
    assets: [],
    transactions: [],
  },
  {
    id: "snapshot-2",
    createdAt: "2024-04-15T12:00:00.000Z",
    total: 800,
    assets: [],
    transactions: [],
  },
];

// Stateful harness: bumps dataChangedVersion when the inner HistoricalData
// calls afterDataChanged, the same way the production app does. This is
// what triggers the [rangeKey, dataChangedVersion] effect under test.
function VersionHarness({
  onAfterDataChanged,
  ...rest
}: Omit<React.ComponentProps<typeof HistoricalData>, "afterDataChanged"> & {
  onAfterDataChanged?: (
    action: string,
    uuid?: string,
    id?: number,
  ) => void;
}) {
  const [version, setVersion] = useState(0);
  return (
    <DataChangedContext.Provider value={version}>
      <HistoricalData
        {...rest}
        afterDataChanged={(action, uuid, id) => {
          onAfterDataChanged?.(action, uuid, id);
          setVersion((v) => v + 1);
        }}
      />
    </DataChangedContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Slow down the background re-fetch so the loading overlay, if the bug
  // is present, stays visible long enough to be observed.
  vi.mocked(queryHistoricalData).mockImplementation(
    () =>
      new Promise((resolve) =>
        setTimeout(() => resolve(sampleRows as never), 80),
      ),
  );
  vi.mocked(deleteHistoricalDataByUUID).mockResolvedValue(undefined as never);
  vi.mocked(deleteHistoricalDataDetailById).mockResolvedValue(undefined as never);
  vi.mocked(queryRestoreHistoricalData).mockResolvedValue({
    assets: [],
    transactions: [],
  } as never);
  vi.mocked(restoreHistoricalData).mockResolvedValue(undefined as never);
});

describe("Historical-data — delete does not flash loading overlay", () => {
  it("removes a snapshot immediately and restores it if deletion fails", async () => {
    let rejectDelete!: (error: Error) => void;
    vi.mocked(deleteHistoricalDataByUUID).mockImplementation(
      () => new Promise((_, reject) => { rejectDelete = reject; }),
    );
    render(
      <VersionHarness
        currency={usdCurrency}
        dateRange={dateRange}
        quoteColor="green-up-red-down"
      />,
    );
    await screen.findAllByText("snapshot");
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(await screen.findByRole("button", { name: /confirm/i }));
    expect(screen.getAllByText("snapshot")).toHaveLength(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    const latest = screen.getByText("Latest Snapshot").closest("[class*='rounded']");
    expect(latest).toHaveTextContent("$800");

    await waitFor(() => expect(deleteHistoricalDataByUUID).toHaveBeenCalledWith("snapshot-1"));
    rejectDelete(new Error("disk failed"));
    await waitFor(() => expect(screen.getAllByText("snapshot")).toHaveLength(2));
    expect(latest).toHaveTextContent("$1,200");
    expect(toastMock.mock.lastCall?.[0]).toMatchObject({
      description: "disk failed",
      variant: "destructive",
    });
  });

  it("keeps the snapshot detail closed when clicking the delete dialog backdrop", async () => {
    render(
      <VersionHarness
        currency={usdCurrency}
        dateRange={dateRange}
        quoteColor="green-up-red-down"
      />,
    );
    await screen.findAllByText("snapshot");

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    const backdrop = document.querySelector("div.fixed.inset-0:not([role])");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(screen.queryByRole("dialog", { name: /historical data detail/i })).not.toBeInTheDocument();
  });

  it("keeps the snapshot detail closed when confirming or canceling its delete dialog", async () => {
    render(
      <VersionHarness
        currency={usdCurrency}
        dateRange={dateRange}
        quoteColor="green-up-red-down"
      />,
    );
    await screen.findAllByText("snapshot");

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(await screen.findByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog", { name: /historical data detail/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(await screen.findByRole("button", { name: /confirm/i }));
    expect(screen.queryByRole("dialog", { name: /historical data detail/i })).not.toBeInTheDocument();
  });

  it("keeps the detail dialog open and its list visible after deleting an asset and refreshing", async () => {
    const onAfterDataChanged = vi.fn();
    const rows = [{
      ...sampleRows[0],
      assets: [{
        id: 7,
        uuid: "snapshot-1",
        createdAt: sampleRows[0].createdAt,
        assetType: "crypto",
        symbol: "BTC",
        amount: 1,
        value: 1000,
        price: 1000,
      }, {
        id: 8, uuid: "snapshot-1", createdAt: sampleRows[0].createdAt,
        assetType: "crypto", symbol: "ETH", amount: 1, value: 200, price: 200,
      }],
    }, sampleRows[1]];
    const refreshedRows = [{ ...rows[0], assets: [rows[0].assets[1]] }, rows[1]];
    vi.mocked(queryHistoricalDetail)
      .mockResolvedValueOnce(rows[0] as never)
      .mockImplementationOnce(() => new Promise((resolve) =>
        setTimeout(() => resolve(refreshedRows[0] as never), 80)));
    vi.mocked(queryHistoricalData).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(
        (vi.mocked(deleteHistoricalDataDetailById).mock.calls.length ? refreshedRows : rows) as never,
      ), 80)),
    );
    render(
      <VersionHarness
        onAfterDataChanged={onAfterDataChanged}
        currency={usdCurrency}
        dateRange={dateRange}
        quoteColor="green-up-red-down"
      />,
    );
    fireEvent.click((await screen.findAllByText("snapshot"))[0]);
    const detailDialog = await screen.findByRole("dialog", { name: /historical data detail/i });
    expect(within(detailDialog).getByText("BTC")).toBeInTheDocument();
    fireEvent.click(within(within(detailDialog).getByText("BTC").closest("tr")!).getByRole("button", { name: /delete/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(onAfterDataChanged).toHaveBeenCalledWith("delete", undefined, 7));
    expect(within(detailDialog).queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await waitFor(() => expect(deleteHistoricalDataDetailById).toHaveBeenCalledWith(7));
    await waitFor(() => expect(queryHistoricalData).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(queryHistoricalDetail).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /historical data detail/i })).toBeInTheDocument();
    expect(within(screen.getByRole("dialog", { name: /historical data detail/i })).queryByText("BTC")).not.toBeInTheDocument();
  });

  it("updates the latest card as soon as the newest snapshot is deleted", async () => {
    render(
      <VersionHarness
        currency={usdCurrency}
        dateRange={dateRange}
        quoteColor="green-up-red-down"
      />,
    );
    await screen.findAllByText("snapshot");
    fireEvent.click(screen.getAllByRole("button", { name: /delete/i })[0]);
    fireEvent.click(await screen.findByRole("button", { name: /confirm/i }));
    await waitFor(() => expect(deleteHistoricalDataByUUID).toHaveBeenCalledWith("snapshot-1"));
    const latest = screen.getByText("Latest Snapshot").closest("[class*='rounded']") ?? screen.getByText("Latest Snapshot").parentElement?.parentElement;
    expect(latest).toHaveTextContent("$800");
  });

  it("closes the detail dialog when an external refresh removes its snapshot", async () => {
    vi.mocked(queryHistoricalData).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(
        (vi.mocked(queryHistoricalData).mock.calls.length === 1 ? sampleRows : [sampleRows[0]]) as never,
      ), 80)),
    );
    const history = (
      <HistoricalData
        currency={usdCurrency}
        dateRange={dateRange}
        quoteColor="green-up-red-down"
      />
    );
    const view = render(
      <DataChangedContext.Provider value={0}>{history}</DataChangedContext.Provider>,
    );
    fireEvent.click((await screen.findAllByText("snapshot"))[1]);
    expect(screen.getByRole("dialog", { name: /historical data detail/i })).toBeInTheDocument();

    view.rerender(
      <DataChangedContext.Provider value={1}>{history}</DataChangedContext.Provider>,
    );
    await waitFor(() => expect(screen.getAllByText("snapshot")).toHaveLength(1));

    expect(screen.queryByRole("dialog", { name: /historical data detail/i })).not.toBeInTheDocument();
  });

  it("restores a deleted asset from the undo toast without a loading flash", async () => {
    const asset = {
      id: 7,
      uuid: "snapshot-1",
      createdAt: sampleRows[0].createdAt,
      assetType: "crypto",
      symbol: "BTC",
      amount: 1,
      value: 1200,
      price: 1200,
    };
    const rows = [{ ...sampleRows[0], assets: [asset] }, sampleRows[1]];
    let deleted = false;
    vi.mocked(queryHistoricalData).mockImplementation(
      () => new Promise((resolve) => setTimeout(
        () => resolve((deleted ? [{ ...rows[0], assets: [] }, rows[1]] : rows) as never),
        80,
      )),
    );
    vi.mocked(queryRestoreHistoricalData).mockResolvedValue({ assets: [asset], transactions: [] } as never);
    vi.mocked(deleteHistoricalDataDetailById).mockImplementation(async () => { deleted = true; });
    vi.mocked(restoreHistoricalData).mockImplementation(async () => { deleted = false; });

    render(
      <VersionHarness
        currency={usdCurrency}
        dateRange={dateRange}
        quoteColor="green-up-red-down"
      />,
    );
    fireEvent.click((await screen.findAllByText("snapshot"))[0]);
    const detailDialog = await screen.findByRole("dialog", { name: /historical data detail/i });
    fireEvent.click(within(detailDialog).getByRole("button", { name: /delete/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(within(detailDialog).queryByText("BTC")).not.toBeInTheDocument());
    fireEvent.click(within(detailDialog).getByRole("button", { name: /close/i }));

    const undoAction = toastMock.mock.lastCall?.[0].action;
    const toastView = render(
      <ToastProvider>
        <Toast defaultOpen>{undoAction}</Toast>
        <ToastViewport />
      </ToastProvider>,
    );
    fireEvent.click(toastView.getByRole("button", { name: /undo/i }));

    await waitFor(() => expect(restoreHistoricalData).toHaveBeenCalled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await waitFor(() => expect(queryHistoricalData).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByText("1 assets")).toBeInTheDocument());
  });

  it("restores the list row after undoing deletion of its last asset without a reload callback", async () => {
    const asset = {
      id: 7, uuid: "snapshot-1", createdAt: sampleRows[0].createdAt,
      assetType: "crypto", symbol: "BTC", amount: 1, value: 1200, price: 1200,
    };
    vi.mocked(queryHistoricalData).mockResolvedValue([
      { ...sampleRows[0], assets: [asset] }, sampleRows[1],
    ] as never);
    vi.mocked(queryHistoricalDetail)
      .mockResolvedValueOnce({ ...sampleRows[0], assets: [asset] } as never)
      .mockResolvedValueOnce({ ...sampleRows[0], assets: [] } as never);
    vi.mocked(queryRestoreHistoricalData).mockResolvedValue({ assets: [asset], transactions: [] } as never);

    render(<HistoricalData currency={usdCurrency} dateRange={dateRange} quoteColor="green-up-red-down" />);
    fireEvent.click((await screen.findAllByText("snapshot"))[0]);
    const dialog = await screen.findByRole("dialog", { name: /historical data detail/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /delete/i }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(screen.getAllByTestId("history-snapshot-row")).toHaveLength(1));

    const undoAction = toastMock.mock.lastCall?.[0].action;
    const toastView = render(<ToastProvider><Toast defaultOpen>{undoAction}</Toast><ToastViewport /></ToastProvider>);
    fireEvent.click(toastView.getByRole("button", { name: /undo/i }));
    await waitFor(() => expect(restoreHistoricalData).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getAllByTestId("history-snapshot-row")).toHaveLength(2));
    expect(screen.getAllByTestId("history-snapshot-row")[0]).toHaveTextContent("$1,200.00");
  });

  it("keeps the other wallet's value when deleting a grouped detail asset", async () => {
    const grouped = {
      id: 7, uuid: "snapshot-1", createdAt: sampleRows[0].createdAt,
      assetType: "crypto", symbol: "BTC", amount: 3, value: 30, price: 10,
    };
    const remaining = { ...grouped, id: 8, amount: 2, value: 20 };
    const rawDeleted = { ...grouped, amount: 1, value: 10 };
    vi.mocked(queryHistoricalData).mockResolvedValue([
      { ...sampleRows[0], total: 30, assets: [grouped] }, sampleRows[1],
    ] as never);
    vi.mocked(queryHistoricalDetail)
      .mockResolvedValueOnce({ ...sampleRows[0], total: 30, assets: [grouped] } as never)
      .mockResolvedValueOnce({ ...sampleRows[0], total: 20, assets: [remaining] } as never);
    vi.mocked(queryRestoreHistoricalData).mockResolvedValue({
      assets: [rawDeleted], transactions: [],
    } as never);

    render(<HistoricalData currency={usdCurrency} dateRange={dateRange} quoteColor="green-up-red-down" />);
    fireEvent.click((await screen.findAllByText("snapshot"))[0]);
    const dialog = await screen.findByRole("dialog", { name: /historical data detail/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /delete/i }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(deleteHistoricalDataDetailById).toHaveBeenCalledWith(7));
    await waitFor(() => expect(screen.getAllByTestId("history-snapshot-row")[0]).toHaveTextContent("$20.00"));
    expect(screen.getByRole("dialog", { name: /historical data detail/i })).toHaveTextContent("BTC");
  });

  it("keeps the current table page and row mounted after a local asset delete", async () => {
    const asset = {
      id: 20,
      uuid: "rec-0020",
      createdAt: sampleRows[0].createdAt,
      assetType: "crypto",
      symbol: "BTC",
      amount: 1,
      value: 1000,
      price: 1000,
    };
    const retained = {
      id: 21, uuid: "rec-0020", createdAt: sampleRows[0].createdAt,
      assetType: "crypto", symbol: "ETH", amount: 1, value: 200, price: 200,
    };
    const rows = Array.from({ length: 21 }, (_, idx) => ({
      id: `rec-${String(idx).padStart(4, "0")}`,
      createdAt: sampleRows[0].createdAt,
      total: 1200,
      assets: idx === 20 ? [asset, retained] : [],
      transactions: [],
    }));
    vi.mocked(queryHistoricalData).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(
        (vi.mocked(deleteHistoricalDataDetailById).mock.calls.length
          ? [...rows.slice(0, 20), { ...rows[20], assets: [retained] }]
          : rows) as never,
      ), 80)),
    );
    render(
      <VersionHarness
        currency={usdCurrency}
        dateRange={dateRange}
        quoteColor="green-up-red-down"
      />,
    );
    await screen.findByText("rec-0000");
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    const row = (await screen.findByText("rec-0020")).closest("tr");
    fireEvent.click(screen.getByText("rec-0020"));
    const detailDialog = await screen.findByRole("dialog", { name: /historical data detail/i });
    fireEvent.click(within(within(detailDialog).getByText("BTC").closest("tr")!).getByRole("button", { name: /delete/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(queryHistoricalData).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.getByText("rec-0020").closest("tr")).toBe(row);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not insert an undone snapshot into a different page before reload", async () => {
    const rows = Array.from({ length: 22 }, (_, index) => ({
      id: `rec-${String(index).padStart(4, "0")}`,
      createdAt: sampleRows[0].createdAt,
      total: 100 + index,
      assets: [],
      transactions: [],
    }));
    let deleted = false;
    vi.mocked(queryHistoricalData).mockImplementation(
      () => new Promise((resolve) => setTimeout(
        () => resolve((deleted ? rows.slice(1) : rows) as never), 80,
      )),
    );
    vi.mocked(deleteHistoricalDataByUUID).mockImplementation(async () => { deleted = true; });
    vi.mocked(restoreHistoricalData).mockImplementation(async () => { deleted = false; });
    const onAfterDataChanged = vi.fn();
    render(<VersionHarness onAfterDataChanged={onAfterDataChanged} currency={usdCurrency} dateRange={dateRange} quoteColor="green-up-red-down" />);
    const first = await screen.findByText("rec-0000");
    fireEvent.click(within(first.closest("tr")!).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(deleteHistoricalDataByUUID).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    await screen.findByText("rec-0021");
    const undoAction = toastMock.mock.lastCall?.[0].action;
    const toastView = render(<ToastProvider><Toast defaultOpen>{undoAction}</Toast><ToastViewport /></ToastProvider>);
    fireEvent.click(toastView.getByRole("button", { name: /undo/i }));
    await waitFor(() => expect(restoreHistoricalData).toHaveBeenCalledOnce());
    expect(screen.queryByText("rec-0000")).not.toBeInTheDocument();
    await waitFor(() => expect(onAfterDataChanged).toHaveBeenCalledWith("undoDeletion", "rec-0000", undefined));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not show the page loading overlay after a record delete bumps dataChangedVersion", async () => {
    const onAfterDataChanged = vi.fn();
    render(
      <VersionHarness
        onAfterDataChanged={onAfterDataChanged}
        currency={usdCurrency}
        dateRange={dateRange}
        quoteColor="green-up-red-down"
      />,
    );

    // Wait for the initial load to finish — the loading overlay is gone.
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    // Open the per-row delete confirmation dialog, then confirm.
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(await screen.findByRole("button", { name: /confirm/i }));

    // afterDataChanged was called with the right signature.
    await waitFor(() => {
      expect(onAfterDataChanged).toHaveBeenCalledWith(
        "delete",
        "snapshot-1",
        undefined,
      );
    });

    // The page loading overlay must NOT flash on screen. The local list
    // already reflects the deletion; the bumped dataChangedVersion is
    // expected to refresh in the background without showing the overlay.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps the loading overlay hidden when deleting the only row on the last page", async () => {
    const asset = {
      id: 20,
      uuid: "rec-0020",
      createdAt: sampleRows[0].createdAt,
      assetType: "crypto",
      symbol: "BTC",
      amount: 1,
      value: 1200,
      price: 1200,
    };
    const rows = Array.from({ length: 21 }, (_, index) => ({
      id: `rec-${String(index).padStart(4, "0")}`,
      createdAt: sampleRows[0].createdAt,
      total: 1200,
      assets: index === 20 ? [asset] : [],
      transactions: [],
    }));
    let deleted = false;
    vi.mocked(queryHistoricalData).mockImplementation(
      () => new Promise((resolve) => setTimeout(
        () => resolve((deleted ? rows.slice(0, 20) : rows) as never), 80,
      )),
    );
    vi.mocked(deleteHistoricalDataDetailById).mockImplementation(async () => { deleted = true; });
    render(
      <VersionHarness
        currency={usdCurrency}
        dateRange={dateRange}
        quoteColor="green-up-red-down"
      />,
    );
    await screen.findByText("rec-0000");
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    await screen.findByText("rec-0020");
    fireEvent.click(screen.getByText("rec-0020"));
    const dialog = await screen.findByRole("dialog", { name: /historical data detail/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /delete/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(queryHistoricalData).toHaveBeenCalledTimes(4));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(await screen.findByText("rec-0000")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
