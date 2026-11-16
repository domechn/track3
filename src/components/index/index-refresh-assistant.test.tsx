import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./index";
import { ChartResizeContext } from "@/App";
import { writeStoredStatuses } from "@/middlelayers/ui-state/source-status-store";
import { refreshRetryScheduler } from "@/middlelayers/refresh-retry-scheduler";

const syncSnapshot = vi.hoisted(() => ({ mode: "disabled", sync: { phase: "idle", report: undefined } }));
vi.mock("@/middlelayers/sync/runtime", () => ({
  syncRuntime: {
    initialize: vi.fn(async () => {}),
    stop: vi.fn(),
    trigger: vi.fn(),
    status: () => syncSnapshot,
    subscribe: () => () => {},
    getSettings: () => ({ deviceNames: {} }),
  },
}));
vi.mock("../settings", () => ({ default: () => <div>settings</div> }));
vi.mock("../historical-data", () => ({ default: () => <div>history</div> }));
vi.mock("../overview", () => ({ default: () => <div>overview</div> }));
vi.mock("../comparison", () => ({ default: () => <div>comparison</div> }));
vi.mock("../rebalance", () => ({ default: () => <div>rebalance</div> }));
vi.mock("../goals-alerts", () => ({ default: () => <div>goals</div> }));
vi.mock("../goals-desktop", () => ({ GoalsKinds: () => <div>rule kinds</div> }));
vi.mock("../wallet-analytics", () => ({ default: () => <div>wallets</div> }));
vi.mock("../coin-analytics", () => ({ default: () => <div>coin analytics</div> }));
vi.mock("../summary", () => ({ default: () => <div>summary page</div> }));
vi.mock("../date-picker", () => ({ default: () => <div>date picker</div> }));
vi.mock("../sidebar", () => ({ default: () => <div>sidebar</div> }));
vi.mock("../motion", () => ({
  AnimatedPage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/configuration", () => ({ default: () => <div>configuration</div> }));
vi.mock("@/components/data-management", () => ({ default: () => <div>data management</div> }));
vi.mock("@/components/system-info", () => ({ default: () => <div>system info</div> }));
vi.mock("@/components/assistant/chat-page", () => ({ default: () => <div>assistant page</div> }));

vi.mock("@/middlelayers/charts", () => ({
  getAvailableDates: vi.fn(),
  queryLastRefreshAt: vi.fn(),
  getDataFingerprint: vi.fn().mockResolvedValue(""),
  refreshAllData: vi.fn(),
}));
vi.mock("@/middlelayers/configuration", () => ({
  queryPreferCurrency: vi.fn(),
  getLicenseIfIsPro: vi.fn(),
  getInitialQueryDateRange: vi.fn(),
  getQuoteColor: vi.fn(),
  getDefaultCurrencyRate: vi.fn(),
  getConfiguration: vi.fn(),
  updateAllCurrencyRates: vi.fn(),
}));
vi.mock("@/middlelayers/data", () => ({
  autoBackupHistoricalData: vi.fn(),
  autoImportHistoricalData: vi.fn(),
  listPortfolioSources: vi.fn(() => []),
}));
vi.mock("@/middlelayers/license", () => ({
  isProVersion: vi.fn(async () => ({ isPro: false })),
  invalidateUsageCache: vi.fn(),
  LicenseCenter: { getInstance: () => ({ getUsage: vi.fn() }) },
}));
vi.mock("@/middlelayers/alerts", async (original) => ({
  ...await original<typeof import("@/middlelayers/alerts")>(),
  processAlerts: vi.fn().mockResolvedValue([]),
  countUnreadAlerts: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/middlelayers/alert-notifications", () => ({ deliverAlerts: vi.fn(async () => {}), formatAlert: vi.fn() }));
vi.mock("@/middlelayers/insights-service", () => ({
  cancelInsightRefresh: vi.fn(),
  refreshInsights: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/middlelayers/ui-state/telemetry", () => ({ trackRefreshEvent: vi.fn() }));
vi.mock("@/middlelayers/datafetch/utils/cache", () => ({
  invalidateCacheGroups: vi.fn(),
  getLocalStorageCacheInstance: vi.fn().mockReturnValue({ clearCache: vi.fn() }),
  getMemoryCacheInstance: vi.fn().mockReturnValue({ clearCache: vi.fn() }),
}));

import { getAvailableDates, queryLastRefreshAt, refreshAllData } from "@/middlelayers/charts";
import {
  getConfiguration,
  getDefaultCurrencyRate,
  getInitialQueryDateRange,
  getLicenseIfIsPro,
  getQuoteColor,
  queryPreferCurrency,
  updateAllCurrencyRates,
} from "@/middlelayers/configuration";
import { autoBackupHistoricalData, autoImportHistoricalData } from "@/middlelayers/data";

const usd = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };
const partialResult = {
  failedSources: [{ sourceId: "btc:0", analyzerName: "BTC wallet 1", walletIdentities: ["wallet-a"], error: "network", category: "network" }],
  sourceResults: [{ sourceId: "btc:0", label: "BTC wallet 1", walletIdentities: ["wallet-a"], status: "stale", coins: [], category: "network" }],
  sourceStatuses: [{ sourceId: "btc:0", label: "BTC wallet 1", status: "stale", category: "network" }],
  requiresDataSourceAction: false, usedLastKnownData: true, persisted: true,
  snapshotId: "previous", snapshotKey: "snapshot-key",
};
let finishRefresh: (result: typeof partialResult) => void;
let reportProgress: (percent: number) => void;

beforeEach(() => {
  writeStoredStatuses([]);
  refreshRetryScheduler.manualStart();
  window.location.hash = "#/summary";
  vi.mocked(refreshAllData).mockReset();
  vi.mocked(refreshAllData).mockImplementation((progress) => {
    reportProgress = progress as (percent: number) => void;
    return new Promise((resolve) => { finishRefresh = resolve as never; });
  });
  vi.mocked(getConfiguration).mockResolvedValue(undefined);
  vi.mocked(updateAllCurrencyRates).mockResolvedValue(undefined as never);
  vi.mocked(queryLastRefreshAt).mockResolvedValue("2024-04-13T00:00:00.000Z");
  vi.mocked(getAvailableDates).mockResolvedValue([new Date("2024-04-01T00:00:00.000Z"), new Date("2024-04-02T00:00:00.000Z")]);
  vi.mocked(getInitialQueryDateRange).mockResolvedValue({
    dr: { from: new Date("2024-04-01T00:00:00.000Z"), to: new Date("2024-04-02T00:00:00.000Z") }, size: 1,
  });
  vi.mocked(queryPreferCurrency).mockResolvedValue(usd);
  vi.mocked(getDefaultCurrencyRate).mockResolvedValue(usd);
  vi.mocked(getLicenseIfIsPro).mockResolvedValue(undefined);
  vi.mocked(getQuoteColor).mockResolvedValue("green-up-red-down");
  vi.mocked(autoBackupHistoricalData).mockResolvedValue(false);
  vi.mocked(autoImportHistoricalData).mockResolvedValue(false);
});

function renderApp() {
  return render(
    <ChartResizeContext.Provider value={{ needResize: 0, setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>> }}>
      <App />
    </ChartResizeContext.Provider>,
  );
}

async function openRoute(hash: string, text: string) {
  window.location.hash = hash;
  fireEvent(window, new HashChangeEvent("hashchange"));
  await screen.findByText(text);
}

async function startRefresh() {
  renderApp();
  await screen.findByText("summary page");
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await waitFor(() => expect(refreshAllData).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled());
}

async function expectFinishedRefresh() {
  // A status dialog that opened by itself hides the top bar from the accessibility tree.
  await waitFor(() => expect(screen.getByRole("button", { name: "Refresh", hidden: true })).toBeEnabled());
  expect(screen.queryByRole("progressbar", { hidden: true })).toBeNull();
  if (!screen.queryByRole("alertdialog")) fireEvent.click(screen.getByRole("button", { name: "Source status" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Source status" });
  expect(within(dialog).getByText("BTC wallet 1")).toBeVisible();
  expect(within(dialog).getByRole("button", { name: "Retry BTC wallet 1" })).toBeVisible();
  expect(refreshAllData).toHaveBeenCalledTimes(1);
}

describe("desktop refresh state in the app shell", () => {
  it("shows progress and the new source statuses for a refresh that starts and ends on one page", async () => {
    await startRefresh();
    act(() => reportProgress(40));
    expect(screen.getByRole("progressbar")).toBeVisible();
    await act(async () => { finishRefresh(partialResult); });
    await expectFinishedRefresh();
  });

  it("keeps a running refresh when the top bar leaves for the Assistant page and returns", async () => {
    await startRefresh();
    act(() => reportProgress(40));
    await openRoute("#/assistant", "assistant page");
    expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
    await openRoute("#/summary", "summary page");
    const refresh = screen.getByRole("button", { name: "Refresh" });
    expect(refresh).toBeDisabled();
    expect(screen.getByRole("progressbar")).toBeVisible();
    fireEvent.click(refresh);
    await act(async () => { await Promise.resolve(); });
    expect(refreshAllData).toHaveBeenCalledTimes(1);
    await act(async () => { finishRefresh(partialResult); });
    await expectFinishedRefresh();
  });

  it("adopts the result of a refresh that ends while the Assistant page is open", async () => {
    await startRefresh();
    await openRoute("#/assistant", "assistant page");
    await act(async () => { finishRefresh(partialResult); });
    await openRoute("#/summary", "summary page");
    await expectFinishedRefresh();
  });
});
