import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HistoricalData from "@/components/historical-data";

vi.mock("@/components/motion", () => ({
  StaggerContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  FadeUp: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appCacheDir: vi.fn().mockResolvedValue("/tmp/track3-cache"),
}));

vi.mock("@/utils/app", () => ({
  getImageApiPath: vi.fn().mockImplementation((_dir: string, symbol: string) =>
    Promise.resolve(`/logos/${symbol}.png`)
  ),
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

import { queryHistoricalData } from "@/middlelayers/charts";

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };
const dateRange = {
  start: new Date("2024-01-01T00:00:00.000Z"),
  end: new Date("2024-12-31T00:00:00.000Z"),
};

beforeEach(() => {
  vi.useRealTimers();
});

describe("Historical Data page", () => {
  it("shows a heading and keeps the loading status visible while records are unresolved", () => {
    vi.useFakeTimers();
    vi.mocked(queryHistoricalData).mockReturnValue(new Promise<never>(() => {}));

    render(
      <HistoricalData
        currency={usdCurrency}
        dateRange={dateRange}
        quoteColor="green-up-red-down"
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: /historical data/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/loading historical data/i);

    vi.advanceTimersByTime(9000);

    expect(screen.getByRole("status")).toHaveTextContent(/loading historical data/i);
    vi.useRealTimers();
  });

  it("labels pagination controls after records load", async () => {
    vi.mocked(queryHistoricalData).mockResolvedValue([
      {
        id: "snapshot-1",
        createdAt: "2024-04-16T12:00:00.000Z",
        total: 1200,
        assets: [
          {
            id: 1,
            uuid: "snapshot-1",
            createdAt: "2024-04-16T12:00:00.000Z",
            symbol: "BTC",
            amount: 1,
            value: 1200,
            price: 1200,
          },
        ],
        transactions: [],
      },
    ]);

    render(
      <HistoricalData
        currency={usdCurrency}
        dateRange={dateRange}
        quoteColor="green-up-red-down"
      />
    );

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /previous page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next page/i })).toBeInTheDocument();
  });
});
