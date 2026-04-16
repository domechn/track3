import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./index";
import { ChartResizeContext } from "@/App";

const summarySpy = vi.fn();

vi.mock("../settings", () => ({
  default: () => <div>settings</div>,
}));

vi.mock("../refresh-data", () => ({
  default: () => null,
}));

vi.mock("../historical-data", () => ({
  default: () => <div>history</div>,
}));

vi.mock("../overview", () => ({
  default: () => <div>overview</div>,
}));

vi.mock("../comparison", () => ({
  default: () => <div>comparison</div>,
}));

vi.mock("../page-wrapper", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../wallet-analytics", () => ({
  default: () => <div>wallets</div>,
}));

vi.mock("../coin-analytics", () => ({
  default: () => <div>coin analytics</div>,
}));

vi.mock("../date-picker", () => ({
  default: () => <div>date picker</div>,
}));

vi.mock("../realtime-total-value", () => ({
  default: () => null,
}));

vi.mock("../sidebar", () => ({
  default: () => null,
}));

vi.mock("../motion", () => ({
  AnimatedPage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/configuration", () => ({
  default: () => <div>configuration</div>,
}));

vi.mock("@/components/data-management", () => ({
  default: () => <div>data management</div>,
}));

vi.mock("@/components/system-info", () => ({
  default: () => <div>system info</div>,
}));

vi.mock("../summary", () => ({
  default: ({ dateRange }: { dateRange: { start: Date; end: Date } }) => {
    summarySpy(dateRange);
    return (
      <div data-testid="summary-range">
        {dateRange.start.toISOString()}|{dateRange.end.toISOString()}
      </div>
    );
  },
}));

vi.mock("@/middlelayers/charts", () => ({
  getAvailableDates: vi.fn(),
  queryLastRefreshAt: vi.fn(),
}));

vi.mock("@/middlelayers/configuration", () => ({
  queryPreferCurrency: vi.fn(),
  getLicenseIfIsPro: vi.fn(),
  getInitialQueryDateRange: vi.fn(),
  getQuoteColor: vi.fn(),
  getDefaultCurrencyRate: vi.fn(),
}));

vi.mock("@/middlelayers/data", () => ({
  autoBackupHistoricalData: vi.fn(),
  autoImportHistoricalData: vi.fn(),
}));

vi.mock("@/middlelayers/datafetch/utils/cache", () => ({
  getLocalStorageCacheInstance: vi.fn().mockReturnValue({ clearCache: vi.fn() }),
  getMemoryCacheInstance: vi.fn().mockReturnValue({ clearCache: vi.fn() }),
}));

import { getAvailableDates, queryLastRefreshAt } from "@/middlelayers/charts";
import {
  getDefaultCurrencyRate,
  getInitialQueryDateRange,
  getLicenseIfIsPro,
  getQuoteColor,
  queryPreferCurrency,
} from "@/middlelayers/configuration";
import {
  autoBackupHistoricalData,
  autoImportHistoricalData,
} from "@/middlelayers/data";

beforeEach(() => {
  summarySpy.mockClear();
  window.location.hash = "#/summary";

  vi.mocked(queryLastRefreshAt).mockResolvedValue("2024-04-13T00:00:00.000Z");
  vi.mocked(getAvailableDates).mockResolvedValue([
    new Date("2024-04-01T00:00:00.000Z"),
    new Date("2024-04-02T00:00:00.000Z"),
    new Date("2024-04-03T00:00:00.000Z"),
    new Date("2024-04-04T00:00:00.000Z"),
  ]);
  vi.mocked(getInitialQueryDateRange).mockResolvedValue({
    dr: {
      from: new Date("2024-04-02T00:00:00.000Z"),
      to: new Date("2024-04-03T00:00:00.000Z"),
    },
    size: 1,
  });
  vi.mocked(queryPreferCurrency).mockResolvedValue({
    currency: "USD",
    symbol: "$",
    rate: 1,
    alias: "usd",
  });
  vi.mocked(getDefaultCurrencyRate).mockResolvedValue({
    currency: "USD",
    symbol: "$",
    rate: 1,
    alias: "usd",
  });
  vi.mocked(getLicenseIfIsPro).mockResolvedValue(undefined);
  vi.mocked(getQuoteColor).mockResolvedValue("green-up-red-down");
  vi.mocked(autoBackupHistoricalData).mockResolvedValue(false);
  vi.mocked(autoImportHistoricalData).mockResolvedValue(false);
});

describe("Summary route date range", () => {
  it("shows an app loading overlay while startup data is still being prepared", async () => {
    vi.mocked(queryPreferCurrency).mockImplementation(
      () => new Promise(() => {})
    );

    render(
      <ChartResizeContext.Provider
        value={{
          needResize: 0,
          setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>>,
        }}
      >
        <App />
      </ChartResizeContext.Provider>
    );

    expect(screen.getByRole("status")).toHaveTextContent(/loading portfolio data/i);
    expect(screen.getByRole("status")).toHaveTextContent(/preparing your latest balances/i);
  });

  it("passes the full available range to the summary page instead of the selected date range", async () => {
    render(
      <ChartResizeContext.Provider
        value={{
          needResize: 0,
          setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>>,
        }}
      >
        <App />
      </ChartResizeContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("summary-range")).toHaveTextContent(
        "2024-04-01T00:00:00.000Z|2024-04-04T00:00:00.000Z"
      );
    });
  });
});
