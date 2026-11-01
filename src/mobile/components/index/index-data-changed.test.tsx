import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/mobile/components/index";
import { ChartResizeContext } from "@/mobile/App";
import { APP_SOFT_REFRESH_EVENT } from "@/utils/hook";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { countUnreadAlerts, processAlerts } from "@/middlelayers/alerts";

let lastDataChangedVersion = 0;
let lastDateRange: { start: Date; end: Date } | undefined;

const cacheMocks = vi.hoisted(() => ({
  clearLocalStorageCache: vi.fn(),
  clearMemoryCache: vi.fn(),
  invalidateCacheGroups: vi.fn(),
}));
const syncMocks = vi.hoisted(() => ({
  listeners: new Set<() => void>(),
  trigger: vi.fn(),
  snapshot: { mode: "disabled", sync: { phase: "idle", report: undefined as
    undefined | { pulled: number; pushed: number; tombstonesApplied: number; configChanges: number;
      conflicts: string[]; errors: string[]; pulledFrom?: string[] } } },
}));
const syncToast = vi.hoisted(() => vi.fn());
const refreshMounts = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/middlelayers/sync/runtime", () => ({
  syncRuntime: {
    initialize: vi.fn(async () => {}),
    stop: vi.fn(),
    trigger: syncMocks.trigger,
    status: () => syncMocks.snapshot,
    subscribe: (listener: () => void) => {
      syncMocks.listeners.add(listener);
      return () => syncMocks.listeners.delete(listener);
    },
    getSettings: () => ({ deviceNames: { "device-one": "Laptop" } }),
  },
}));
vi.mock("@/mobile/components/ui/use-toast", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/mobile/components/ui/use-toast")>(),
  toast: syncToast,
}));

vi.mock("@/mobile/components/settings", () => ({
  default: () => <div>settings</div>,
}));

vi.mock("@/mobile/components/refresh-data", async () => {
  const { useEffect } = await import("react");
  // Surface an event payload through the click handler so the test can
  // confirm a refresh click also bumps the data version.
  return {
    default: ({
      afterRefresh,
    }: {
      afterRefresh?: (success: boolean) => unknown;
    }) => (
      <>
      <button
        type="button"
        data-testid="trigger-refresh"
        onClick={() => afterRefresh?.(true)}
      >
        refresh
      </button>
      <RefreshMountProbe />
      </>
    ),
  };
  function RefreshMountProbe() {
    useEffect(() => { refreshMounts.count += 1; }, []);
    return null;
  }
});

vi.mock("@/mobile/components/historical-data", () => ({
  default: ({
    afterDataChanged,
    dateRange,
  }: {
    afterDataChanged?: (action: "delete") => void;
    dateRange: { start: Date; end: Date };
  }) => (
    <button
      data-testid="trigger-history-delete"
      data-range={`${dateRange.start.toISOString()}|${dateRange.end.toISOString()}`}
      onClick={() => afterDataChanged?.("delete")}
    >
      history
    </button>
  ),
}));
vi.mock("@/mobile/components/overview", () => ({
  default: () => <div>overview</div>,
}));
vi.mock("@/mobile/components/comparison", () => ({
  default: () => <div>comparison</div>,
}));
vi.mock("@/mobile/components/wallet-analytics", () => ({
  default: () => <div>wallets</div>,
}));
vi.mock("@/mobile/components/coin-analytics", () => ({
  default: ({ onDataChanged }: { onDataChanged?: () => void }) => {
    const version = realUseDataChangedVersion();
    return (
      <button
        type="button"
        data-testid="trigger-coin-data-changed"
        data-version={version}
        onClick={onDataChanged}
      >
        coin analytics
      </button>
    );
  },
}));
vi.mock("@/mobile/components/date-picker", () => ({
  default: () => <div>date picker</div>,
}));
vi.mock("@/components/realtime-total-value", () => ({
  default: () => null,
}));
vi.mock("@/components/sidebar", () => ({
  default: () => null,
}));
vi.mock("@/components/motion", () => ({
  AnimatedPage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/mobile/components/summary", () => ({
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

vi.mock("@/mobile/components/configuration", () => ({
  default: () => <div>configuration</div>,
}));
vi.mock("@/mobile/components/data-management", () => ({
  default: () => <div>data management</div>,
}));
vi.mock("@/mobile/components/system-info", () => ({
  default: () => <div>system info</div>,
}));

vi.mock("@/middlelayers/charts", () => ({
  getAvailableDates: vi.fn(),
  queryLastRefreshAt: vi.fn(),
  getDataFingerprint: vi.fn().mockResolvedValue(""),
}));

vi.mock("@/middlelayers/configuration", () => ({
  getConfiguration: vi.fn().mockResolvedValue(undefined),
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
vi.mock("@/middlelayers/alerts", () => ({
  processAlerts: vi.fn(),
  countUnreadAlerts: vi.fn().mockResolvedValue(0),
  ALERTS_CHANGED_EVENT: "track3-alerts-changed",
}));

vi.mock("@/middlelayers/datafetch/utils/cache", () => ({
  invalidateCacheGroups: cacheMocks.invalidateCacheGroups,
  getLocalStorageCacheInstance: vi.fn().mockReturnValue({
    clearCache: cacheMocks.clearLocalStorageCache,
  }),
  getMemoryCacheInstance: vi.fn().mockReturnValue({
    clearCache: cacheMocks.clearMemoryCache,
  }),
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
  vi.mocked(countUnreadAlerts).mockResolvedValue(0);
  vi.stubGlobal("scrollTo", vi.fn());
  vi.mocked(processAlerts).mockReset();
  vi.mocked(processAlerts).mockResolvedValue([]);
  lastDataChangedVersion = 0;
  lastDateRange = undefined;
  syncMocks.trigger.mockClear();
  syncMocks.snapshot = { mode: "disabled", sync: { phase: "idle", report: undefined } };
  syncToast.mockClear();
  refreshMounts.count = 0;
  window.location.hash = "#/summary";
  cacheMocks.clearLocalStorageCache.mockReset();
  cacheMocks.clearMemoryCache.mockReset();
  cacheMocks.invalidateCacheGroups.mockReset();
  cacheMocks.invalidateCacheGroups.mockImplementation(() => {
    try {
      cacheMocks.clearLocalStorageCache();
    } catch {
      console.warn("local storage cache cleanup failed");
    }
    try {
      cacheMocks.clearMemoryCache();
    } catch {
      console.warn("memory cache cleanup failed");
    }
  });

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
  it("keeps the refresh runner mounted while moving from Overview to Wallets and back", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    window.location.hash = "#/overview";
    try {
      const view = renderApp();
      await view.findByText("overview");
      await waitFor(() => expect(refreshMounts.count).toBe(1));
      window.location.hash = "#/wallets";
      await view.findByText("wallets");
      expect(refreshMounts.count).toBe(1);
      expect(view.getByTestId("trigger-refresh")).not.toBeVisible();
      window.location.hash = "#/overview";
      await view.findByText("overview");
      expect(refreshMounts.count).toBe(1);
      expect(view.getByTestId("trigger-refresh")).toBeVisible();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("renders mobile tabs and routes to the More hub", async () => {
    const view = renderApp();
    await view.findByTestId("summary-range");
    const nav = view.container.querySelector(".mobile-tab-bar");
    expect(nav).not.toBeNull();
    expect(nav!.querySelectorAll("a")).toHaveLength(4);
    expect(view.container.querySelector('.mobile-analytics-hub a[href="#/cost-basis"]')).toBeInTheDocument();
    fireEvent.click(nav!.querySelector('a[href="#/more"]')!);
    await waitFor(() => expect(view.container.querySelector(".mobile-more-hub")).toBeInTheDocument());
    expect(view.container.querySelector('.mobile-more-hub a[href="#/cost-basis"]')).not.toBeInTheDocument();
  });

  it("shows the unread count on the Goals row in More", async () => {
    vi.mocked(countUnreadAlerts).mockResolvedValue(3);
    vi.mocked(countUnreadAlerts).mockClear();
    window.location.hash = "#/more";
    const view = renderApp();
    const goals = view.container.querySelector('.mobile-more-hub a[href="#/goals"]');
    await waitFor(() => expect(goals).toHaveTextContent("3"));
    expect(goals).toHaveTextContent("Goals & Alerts");
    expect(countUnreadAlerts).toHaveBeenCalledTimes(1);
  });

  it("finishes boot while startup alert evaluation is pending", async () => {
    vi.mocked(processAlerts).mockImplementation(() => new Promise(() => {}));
    const view = renderApp();
    await waitFor(() => expect(view.container.querySelector("[aria-busy]")).toHaveAttribute("aria-busy", "false"));
    expect(processAlerts).toHaveBeenCalledTimes(1);
  });

  it("forwards successful refreshes and window focus to the sync scheduler", async () => {
    const view = renderApp();
    await view.findByTestId("summary-range");
    fireEvent.click(view.getByTestId("trigger-refresh"));
    window.dispatchEvent(new Event("focus"));
    expect(syncMocks.trigger).toHaveBeenCalledWith("refresh");
    expect(syncMocks.trigger).toHaveBeenCalledWith("focus");
  });

  it("toasts pulled snapshots from the source device once per report", async () => {
    renderApp();
    const report = { pulled: 2, pushed: 0, tombstonesApplied: 0, configChanges: 0,
      conflicts: [], errors: [], pulledFrom: ["device-one", "device-one"] };
    act(() => {
      syncMocks.snapshot = { mode: "ready", sync: { phase: "idle", report } };
      for (const listener of syncMocks.listeners) listener();
      for (const listener of syncMocks.listeners) listener();
    });
    expect(syncToast).toHaveBeenCalledTimes(1);
    expect(syncToast).toHaveBeenCalledWith({ description: "2 new snapshots from Laptop" });
  });
  it("does not call pulled edits new snapshots", async () => {
    renderApp();
    act(() => {
      syncMocks.snapshot = { mode: "ready", sync: { phase: "idle", report: {
        pulled: 1, pushed: 0, tombstonesApplied: 0, configChanges: 0,
        conflicts: [], errors: [],
      } } };
      for (const listener of syncMocks.listeners) listener();
    });
    expect(syncToast).not.toHaveBeenCalled();
  });
  it("keeps the selected History range when a local delete updates app metadata", async () => {
    window.location.hash = "#/history";
    const view = renderApp();
    const history = await view.findByTestId("trigger-history-delete");
    const initialQueryCount = vi.mocked(getInitialQueryDateRange).mock.calls.length;
    const originalRange = history.getAttribute("data-range");

    vi.mocked(getInitialQueryDateRange).mockResolvedValue({
      dr: {
        from: new Date("2024-04-01T00:00:00.000Z"),
        to: new Date("2024-04-02T00:00:00.000Z"),
      },
      size: 1,
    });
    fireEvent.click(history);

    await waitFor(() => expect(vi.mocked(getInitialQueryDateRange).mock.calls.length).toBeGreaterThan(initialQueryCount));
    expect(view.getByTestId("trigger-history-delete")).toHaveAttribute("data-range", originalRange);
  });

  it("keeps History mounted when deleting its last snapshot", async () => {
    window.location.hash = "#/history";
    const view = renderApp();
    const history = await view.findByTestId("trigger-history-delete");
    const initialQueryCount = vi.mocked(queryLastRefreshAt).mock.calls.length;

    vi.mocked(queryLastRefreshAt).mockResolvedValueOnce(undefined);
    vi.mocked(getAvailableDates).mockResolvedValueOnce([]);
    fireEvent.click(history);

    await waitFor(() => expect(vi.mocked(queryLastRefreshAt).mock.calls.length).toBeGreaterThan(initialQueryCount));
    expect(view.getByTestId("trigger-history-delete")).toBe(history);
  });

  it("shows the no-data panel after leaving and returning to empty History", async () => {
    window.location.hash = "#/history";
    const view = renderApp();
    const history = await view.findByTestId("trigger-history-delete");

    const initialQueryCount = vi.mocked(queryLastRefreshAt).mock.calls.length;
    vi.mocked(queryLastRefreshAt).mockResolvedValueOnce(undefined);
    vi.mocked(getAvailableDates).mockResolvedValueOnce([]);
    fireEvent.click(history);
    await waitFor(() => expect(vi.mocked(queryLastRefreshAt).mock.calls.length).toBeGreaterThan(initialQueryCount));
    expect(view.getByTestId("trigger-history-delete")).toBe(history);

    window.location.hash = "#/settings";
    await view.findByText("settings");
    window.location.hash = "#/history";

    expect(await view.findByText("There is not enough data")).toBeInTheDocument();
    expect(view.queryByTestId("trigger-history-delete")).not.toBeInTheDocument();
  });

  it("bumps the data-changed version when the refresh button succeeds", async () => {
    const view = renderApp();

    // Wait for the route to mount and the summary mock to observe the
    // initial data-changed version. Nothing triggers onDataChanged on
    // mount, so it should still be the default 0.
    await view.findByTestId("summary-range");
    expect(lastDataChangedVersion).toBe(0);

    fireEvent.click(view.getByTestId("trigger-refresh"));

    await waitFor(() => {
      expect(lastDataChangedVersion).toBeGreaterThan(0);
    });
  });

  it("bumps the data-changed version when the soft refresh event fires", async () => {
    const view = renderApp();

    await view.findByTestId("summary-range");
    expect(lastDataChangedVersion).toBe(0);

    window.dispatchEvent(new Event(APP_SOFT_REFRESH_EVENT));

    await waitFor(() => {
      expect(lastDataChangedVersion).toBeGreaterThan(0);
    });
  });

  it("passes the data-changed callback to the coin analytics route", async () => {
    window.location.hash = "#/coins/BTC";
    const view = renderApp();

    const trigger = await view.findByTestId("trigger-coin-data-changed");
    expect(trigger).toHaveAttribute("data-version", "0");

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(
        Number(
          view
            .getByTestId("trigger-coin-data-changed")
            .getAttribute("data-version"),
        ),
      ).toBe(1);
    });
    expect(cacheMocks.invalidateCacheGroups).toHaveBeenCalledTimes(1);
    expect(cacheMocks.invalidateCacheGroups).toHaveBeenCalledWith({
      localStorage: ["total-profit"],
      memory: ["realtime-asset-values"],
    });
  });

  it("handles rejected reload and forced backup promises without an unhandled rejection", async () => {
    window.location.hash = "#/coins/BTC";
    const unhandledRejection = vi.fn();
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    process.on("unhandledRejection", unhandledRejection);

    try {
      const view = renderApp();
      const trigger = await view.findByTestId("trigger-coin-data-changed");

      vi.mocked(getAvailableDates).mockRejectedValueOnce(
        new Error("sensitive reload details"),
      );
      vi.mocked(autoBackupHistoricalData).mockRejectedValueOnce(
        new Error("sensitive backup details"),
      );
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(consoleWarn).toHaveBeenCalledWith("data reload failed");
        expect(consoleWarn).toHaveBeenCalledWith("forced auto backup failed");
      });
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain(
        "sensitive reload details",
      );
      expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain(
        "sensitive backup details",
      );
      expect(
        Number(
          view
            .getByTestId("trigger-coin-data-changed")
            .getAttribute("data-version"),
        ),
      ).toBeGreaterThan(0);
    } finally {
      process.off("unhandledRejection", unhandledRejection);
      consoleWarn.mockRestore();
    }
  });

  it("contains cache cleanup failures while reload and backup continue independently", async () => {
    window.location.hash = "#/coins/BTC";
    const unhandledRejection = vi.fn();
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    process.on("unhandledRejection", unhandledRejection);

    try {
      const view = renderApp();
      const trigger = await view.findByTestId("trigger-coin-data-changed");
      await waitFor(() => {
        expect(getAvailableDates).toHaveBeenCalled();
      });

      vi.mocked(getAvailableDates).mockClear();
      vi.mocked(autoBackupHistoricalData).mockClear();
      cacheMocks.clearLocalStorageCache.mockImplementationOnce(() => {
        throw new Error("sensitive localStorage details");
      });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(consoleWarn).toHaveBeenCalledWith(
          "local storage cache cleanup failed",
        );
        expect(getAvailableDates).toHaveBeenCalledTimes(1);
        expect(autoBackupHistoricalData).toHaveBeenCalledWith(true);
      });
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      expect(cacheMocks.clearMemoryCache).toHaveBeenCalledTimes(1);
      expect(
        vi
          .mocked(autoBackupHistoricalData)
          .mock.calls.filter(([forced]) => forced === true),
      ).toHaveLength(1);
      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain(
        "sensitive localStorage details",
      );
    } finally {
      process.off("unhandledRejection", unhandledRejection);
      consoleWarn.mockRestore();
    }
  });
});
