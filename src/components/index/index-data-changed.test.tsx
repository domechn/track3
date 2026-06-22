import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./index";
import { ChartResizeContext } from "@/App";
import { APP_SOFT_REFRESH_EVENT } from "@/utils/hook";
import { useDataChangedVersion } from "@/contexts/data-changed";

let lastDataChangedVersion = 0;
let lastDateRange: { start: Date; end: Date } | undefined;

vi.mock("../settings", () => ({
  default: () => <div>settings</div>,
}));

vi.mock("../refresh-data", () => {
  // Surface an event payload through the click handler so the test can
  // confirm a refresh click also bumps the data version.
  return {
    default: ({
      afterRefresh,
    }: {
      afterRefresh?: (success: boolean) => unknown;
    }) => (
      <button
        type="button"
        data-testid="trigger-refresh"
        onClick={() => afterRefresh?.(true)}
      >
        refresh
      </button>
    ),
  };
});

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

vi.mock("../summary", () => ({
  default: ({ dateRange }: { dateRange: { start: Date; end: Date } }) => {
    lastDateRange = dateRange;
    const v = realUseDataChangedVersion();
    lastDataChangedVersion = v;
    return (
      <div data-testid="summary-range">
        {dateRange.start.toISOString()}|{dateRange.end.toISOString()}
      </div>
    );
  },
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

vi.mock("@/middlelayers/charts", () => ({
  getAvailableDates: vi.fn(),
  queryLastRefreshAt: vi.fn(),
  getDataFingerprint: vi.fn().mockResolvedValue(""),
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
  getLocalStorageCacheInstance: vi
    .fn()
    .mockReturnValue({ clearCache: vi.fn() }),
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
import { useDataChangedVersion as realUseDataChangedVersion } from "@/contexts/data-changed";

beforeEach(() => {
  lastDataChangedVersion = 0;
  lastDateRange = undefined;
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

function renderApp() {
  return render(
    <ChartResizeContext.Provider
      value={{
        needResize: 0,
        setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>>,
      }}
    >
      <App />
    </ChartResizeContext.Provider>,
  );
}

describe("App data-changed version bumps on refresh and soft refresh", () => {
  it("bumps the data-changed version when the refresh button succeeds", async () => {
    const view = renderApp();

    // Wait for the route to mount and the summary mock to observe the
    // initial data-changed version. Nothing triggers onDataChanged on
    // mount, so it should still be the default 0.
    await waitFor(() => {
      expect(view.getByTestId("summary-range")).toBeTruthy();
    });
    expect(lastDataChangedVersion).toBe(0);

    fireEvent.click(view.getByTestId("trigger-refresh"));

    await waitFor(() => {
      expect(lastDataChangedVersion).toBeGreaterThan(0);
    });
  });

  it("bumps the data-changed version when the soft refresh event fires", async () => {
    const view = renderApp();

    await waitFor(() => {
      expect(view.getByTestId("summary-range")).toBeTruthy();
    });
    expect(lastDataChangedVersion).toBe(0);

    window.dispatchEvent(new Event(APP_SOFT_REFRESH_EVENT));

    await waitFor(() => {
      expect(lastDataChangedVersion).toBeGreaterThan(0);
    });
  });
});
