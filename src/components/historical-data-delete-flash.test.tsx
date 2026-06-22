import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HistoricalData from "@/components/historical-data";
import { DataChangedContext } from "@/contexts/data-changed";

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
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appCacheDir: vi.fn().mockResolvedValue("/tmp/track3-cache"),
}));

vi.mock("@/utils/app", () => ({
  getImageApiPath: vi.fn().mockResolvedValue(""),
}));

vi.mock("@/middlelayers/data", () => ({
  downloadCoinLogos: vi.fn(),
}));

vi.mock("@/middlelayers/charts", () => ({
  deleteHistoricalDataByUUID: vi.fn(),
  deleteHistoricalDataDetailById: vi.fn(),
  queryHistoricalData: vi.fn(),
  queryRestoreHistoricalData: vi.fn(),
  restoreHistoricalData: vi.fn(),
}));

vi.mock("@/middlelayers/configuration", () => ({
  addToBlacklist: vi.fn(),
}));

import {
  queryHistoricalData,
  deleteHistoricalDataByUUID,
  queryRestoreHistoricalData,
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
  vi.mocked(queryRestoreHistoricalData).mockResolvedValue({
    assets: [],
    transactions: [],
  } as never);
});

describe("Historical-data — delete does not flash loading overlay", () => {
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
});
