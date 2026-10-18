import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RefreshData from "@/components/refresh-data";
import { refreshAllData } from "@/middlelayers/charts";
import { updateAllCurrencyRates } from "@/middlelayers/configuration";
import { getMemoryCacheInstance } from "@/middlelayers/datafetch/utils/cache";
import { I18nProvider, localeLocalStorageKey } from "@/i18n";
import { FullRefreshRequiredError } from "@/middlelayers/refresh-error";
import { processAlerts } from "@/middlelayers/alerts";
import { deliverAlerts } from "@/middlelayers/alert-notifications";
import { cancelInsightRefresh, refreshInsights } from "@/middlelayers/insights-service";
import axe from "axe-core";

// Hoist mock fn references so they're available inside vi.mock factories
const mockSetButtonLoading = vi.hoisted(() => vi.fn());
const mockSetProgress = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());

vi.mock("@/components/index/index", async () => {
  const { createContext } = await import("react");
  return {
    RefreshButtonLoadingContext: createContext({
      buttonLoading: false,
      setButtonLoading: mockSetButtonLoading,
      progress: 0,
      setProgress: mockSetProgress,
    }),
  };
});

vi.mock("@/middlelayers/charts", () => ({
  refreshAllData: vi.fn(),
}));

vi.mock("@/middlelayers/configuration", () => ({
  updateAllCurrencyRates: vi.fn(),
}));

vi.mock("@/middlelayers/datafetch/utils/cache", () => ({
  getMemoryCacheInstance: vi.fn(),
}));

vi.mock("@/utils/app", () => ({
  trackEventWithClientID: vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));
vi.mock("@/middlelayers/alerts", () => ({
  ALERT_SOURCE_STATUS_STORAGE_KEY: "track3-refresh-source-statuses",
  processAlerts: vi.fn(),
}));
vi.mock("@/middlelayers/alert-notifications", () => ({ deliverAlerts: vi.fn() }));
vi.mock("@/middlelayers/insights-service", () => ({
  cancelInsightRefresh: vi.fn(),
  refreshInsights: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.mocked(updateAllCurrencyRates).mockResolvedValue(undefined as never);
  vi.mocked(refreshAllData).mockResolvedValue({
    failedSources: [],
    requiresDataSourceAction: false,
    usedLastKnownData: false,
  } as never);
  vi.mocked(getMemoryCacheInstance).mockReturnValue({
    clearCache: vi.fn(),
  } as never);
  vi.mocked(processAlerts).mockResolvedValue([]);
  vi.mocked(deliverAlerts).mockResolvedValue();
  vi.mocked(refreshInsights).mockResolvedValue(true);
});

describe("RefreshData — currency rates refresh ordering", () => {
  it("announces an active refresh to assistive technology", () => {
    render(<RefreshData loading={true} />);
    expect(screen.getByRole("status")).toHaveTextContent("Refreshing portfolio");
  });

  it("starts insights after refresh without waiting for insight generation", async () => {
    let finish: () => void = () => {};
    vi.mocked(refreshInsights).mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve(true); }));
    const afterRefresh = vi.fn();
    const user = userEvent.setup();
    render(<RefreshData loading={false} afterRefresh={afterRefresh} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(refreshInsights).toHaveBeenCalledOnce());
    expect(cancelInsightRefresh).toHaveBeenCalledOnce();
    expect(afterRefresh).toHaveBeenCalledWith(true);
    finish();
  });
  it("evaluates alerts after a persisted refresh using source freshness", async () => {
    const statuses = [{ sourceId: "btc:0", label: "BTC wallet 1", status: "stale" as const }];
    vi.mocked(refreshAllData).mockResolvedValue({
      failedSources: [], requiresDataSourceAction: false, usedLastKnownData: true,
      persisted: true, sourceResults: [], sourceStatuses: statuses,
    });
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(processAlerts).toHaveBeenCalledWith([], statuses));
    await waitFor(() => expect(deliverAlerts).toHaveBeenCalledTimes(1));
  });

  it("finishes the refresh before a slow alert evaluation completes", async () => {
    let finishAlerts: (value: []) => void = () => {};
    vi.mocked(processAlerts).mockImplementationOnce(() => new Promise((resolve) => { finishAlerts = resolve; }));
    const afterRefresh = vi.fn();
    const user = userEvent.setup();
    render(<RefreshData loading={false} afterRefresh={afterRefresh} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(processAlerts).toHaveBeenCalledOnce());
    expect(mockSetButtonLoading).toHaveBeenLastCalledWith(false);
    expect(afterRefresh).toHaveBeenCalledWith(true);
    finishAlerts([]);
  });

  it("does not evaluate alerts when no snapshot was persisted", async () => {
    vi.mocked(refreshAllData).mockResolvedValue({
      failedSources: [], requiresDataSourceAction: true, usedLastKnownData: false, persisted: false,
    });
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(refreshAllData).toHaveBeenCalledOnce());
    expect(processAlerts).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      description: "All sources failed. The saved snapshot is unchanged.",
    }));
  });
  it("calls updateAllCurrencyRates before refreshAllData on button click", async () => {
    const callOrder: string[] = [];
    vi.mocked(updateAllCurrencyRates).mockImplementation(async () => {
      callOrder.push("updateAllCurrencyRates");
      return undefined as never;
    });
    vi.mocked(refreshAllData).mockImplementation(async () => {
      callOrder.push("refreshAllData");
      return {
        failedSources: [],
        requiresDataSourceAction: false,
        usedLastKnownData: false,
      } as never;
    });

    const user = userEvent.setup();
    render(<RefreshData loading={false} />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(callOrder).toEqual(["updateAllCurrencyRates", "refreshAllData"]);
    });
  });

  it("still calls refreshAllData when updateAllCurrencyRates rejects", async () => {
    vi.mocked(updateAllCurrencyRates).mockRejectedValue(
      new Error("network error"),
    );

    const user = userEvent.setup();
    render(<RefreshData loading={false} />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(refreshAllData).toHaveBeenCalledTimes(1);
    });
  });

  it("invokes afterRefresh(true) when the full refresh sequence succeeds", async () => {
    const afterRefresh = vi.fn();
    const user = userEvent.setup();
    render(<RefreshData loading={false} afterRefresh={afterRefresh} />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(afterRefresh).toHaveBeenCalledWith(true);
    });
  });

  const failedSource = {
    sourceId: "btc:0", label: "BTC wallet 1", walletIdentities: ["wallet-a"],
    status: "stale" as const, coins: [], category: "network" as const,
  };
  const partialResult = {
    failedSources: [{ sourceId: "btc:0", analyzerName: "BTC wallet 1", walletIdentities: ["wallet-a"], error: "network", category: "network" }],
    sourceResults: [failedSource],
    sourceStatuses: [{ sourceId: "btc:0", label: "BTC wallet 1", status: "stale", category: "network" }],
    requiresDataSourceAction: false, usedLastKnownData: true, persisted: true,
    snapshotId: "previous",
    snapshotKey: "snapshot-key",
  };

  it("shows a stale source and its reason after saving a partial refresh", async () => {
    vi.mocked(refreshAllData).mockResolvedValue(partialResult as never);
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alertdialog", { name: "Source status" })).toBeTruthy();
    expect(screen.getByText("BTC wallet 1")).toBeTruthy();
    expect(screen.getByText(/Network or timeout/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry BTC wallet 1" })).toBeTruthy();
  });

  it("retries one failed source and updates its status", async () => {
    vi.mocked(refreshAllData)
      .mockResolvedValueOnce(partialResult as never)
      .mockResolvedValueOnce({ ...partialResult, failedSources: [], sourceStatuses: [{ sourceId: "btc:0", label: "BTC wallet 1", status: "ok" }], persisted: true, usedLastKnownData: false } as never);
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await user.click(await screen.findByRole("button", { name: "Retry BTC wallet 1" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Source status" }));
    expect(screen.getByText("OK")).toBeTruthy();
    expect(refreshAllData).toHaveBeenLastCalledWith(
      expect.any(Function),
      {
        retrySourceId: "btc:0",
        previousSourceResults: [failedSource],
        previousSourceStatuses: partialResult.sourceStatuses,
        previousSnapshotId: "previous",
        previousSnapshotKey: "snapshot-key",
      },
      expect.any(Object), expect.any(Function),
    );
  });

  it("keeps a failed status visible when a single-source retry fails", async () => {
    vi.mocked(refreshAllData)
      .mockResolvedValueOnce(partialResult as never)
      .mockResolvedValueOnce({ ...partialResult, persisted: false } as never);
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await user.click(await screen.findByRole("button", { name: "Retry BTC wallet 1" }));
    await waitFor(() => expect(refreshAllData).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Retry BTC wallet 1" })).toBeTruthy();
  });

  it("names only the retried source when its retry fails", async () => {
    const sourceStatuses = [
      { sourceId: "btc:0", label: "Cold vault", status: "stale" as const, category: "network" as const },
      { sourceId: "cex:0", label: "Main", kind: "exchange" as const, provider: "OKX", hint: "#1", status: "failed" as const, category: "network" as const },
    ];
    const result = {
      ...partialResult,
      sourceStatuses,
      sourceResults: [
        { ...failedSource, label: "Cold vault" },
        { sourceId: "cex:0", label: "Main", walletIdentities: ["exchange-a"], status: "stale", coins: [] },
      ],
      persisted: false,
    };
    vi.mocked(refreshAllData).mockResolvedValueOnce(result as never).mockResolvedValueOnce(result as never);
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await user.click(await screen.findByRole("button", { name: "Retry Cold vault" }));
    await waitFor(() => expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({
      description: "Source retry failed: Cold vault. The saved snapshot is unchanged.",
    })));
  });

  it("warns that totals are incomplete when every source has no history", async () => {
    vi.mocked(refreshAllData).mockResolvedValue({
      ...partialResult, usedLastKnownData: false,
      sourceStatuses: [{ sourceId: "btc:0", label: "BTC wallet 1", status: "failed", category: "network" }],
      persisted: false, requiresDataSourceAction: true,
    } as never);
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText(/Failed sources \(1 of 1\): BTC wallet 1/)).toBeTruthy();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      description: "All sources failed: BTC wallet 1. The saved snapshot is unchanged.",
    }));
  });

  it("keeps the status dialog closed after an all-successful refresh", async () => {
    vi.mocked(refreshAllData).mockResolvedValue({
      failedSources: [], requiresDataSourceAction: false, usedLastKnownData: false,
      sourceStatuses: [{ sourceId: "btc:0", label: "BTC wallet 1", status: "ok" }],
      persisted: true,
    } as never);
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("button", { name: "Source status" })).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("shows the safe missing configuration guidance", async () => {
    vi.mocked(refreshAllData).mockRejectedValue(new Error("no configuration found,\n please add configuration first"));
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      description: "No configuration found. Add a data source in Settings first.",
    })));
  });

  it("does not render an upstream error containing a secret", async () => {
    vi.mocked(refreshAllData).mockResolvedValue({
      ...partialResult,
      failedSources: [{ ...partialResult.failedSources[0], error: "401 secret-token" }],
      sourceStatuses: [{ sourceId: "btc:0", label: "BTC wallet 1", status: "stale", category: "auth" }],
    } as never);
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await screen.findByText(/Authentication or invalid key/);
    expect(document.body.textContent).not.toContain("secret-token");
  });

  it("translates wallet source labels in Chinese", async () => {
    localStorage.setItem(localeLocalStorageKey, "zh");
    vi.mocked(refreshAllData).mockResolvedValue(partialResult as never);
    const user = userEvent.setup();
    render(<I18nProvider><RefreshData loading={false} /></I18nProvider>);

    await user.click(screen.getByRole("button", { name: "刷新" }));
    expect(await screen.findByText("BTC 钱包 1")).toBeTruthy();
  });

  it("shows a wallet alias in the status dialog and retry button", async () => {
    vi.mocked(refreshAllData).mockResolvedValue({
      ...partialResult,
      sourceStatuses: [{ sourceId: "btc:0", label: "Cold vault", status: "stale", category: "network" }],
    } as never);
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("Cold vault")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry Cold vault" })).toBeTruthy();
    expect(localStorage.getItem("track3-refresh-source-statuses")).toContain("Cold vault");
  });

  it("distinguishes four Main sources, sorts failures first, and retries all failed", async () => {
    const localLastSuccess = new Date(2026, 9, 17, 12, 30).toISOString();
    const sourceStatuses = [
      { sourceId: "cex:0", label: "Main", kind: "exchange", provider: "Binance", hint: "ab12…9xyz", status: "ok" },
      { sourceId: "cex:1", label: "Main", kind: "exchange", provider: "OKX", hint: "#1", status: "failed", category: "network" },
      { sourceId: "btc:0", label: "Main", kind: "wallet", provider: "BTC", hint: "bc1q12…abcd", status: "stale", category: "auth", lastSuccessAt: localLastSuccess },
      { sourceId: "cex:2", label: "Main", kind: "exchange", provider: "Binance", hint: "#2", status: "failed", category: "network" },
    ] as const;
    vi.mocked(refreshAllData).mockResolvedValue({
      ...partialResult, sourceStatuses, sourceResults: sourceStatuses.map((source) => ({
        sourceId: source.sourceId, label: source.label, kind: source.kind, provider: source.provider,
        hint: source.hint, walletIdentities: [source.sourceId], status: source.status === "ok" ? "ok" : "stale", coins: [],
      })),
    } as never);
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Source status" });
    expect(dialog).toHaveTextContent("Failed sources (2 of 4)");
    const rows = Array.from(dialog.querySelectorAll("[data-source-status-row]"));
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "Main (OKX · #1)", "Main (Binance · #2)", "Main (BTC · bc1q12…abcd)", "Main (Binance · ab12…9xyz)",
    ]);
    expect(dialog).toHaveTextContent("Binance · API key ab12…9xyz");
    expect(localStorage.getItem("track3-refresh-source-statuses")).toContain("ab12…9xyz");
    expect(localStorage.getItem("track3-refresh-source-statuses")).not.toContain("API key");
    expect(localStorage.getItem("track3-refresh-source-statuses")).not.toContain("ab12-secret-9xyz");
    expect(screen.getByRole("button", { name: "Retry Main (OKX · #1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Main (OKX · #1)" })).toHaveTextContent(/^Retry$/);
    expect(screen.getByRole("button", { name: "Retry all failed" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Last data 2026-10-17 12:30");
    expect((await axe.run(dialog, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Retry all failed" }));
    await waitFor(() => expect(refreshAllData).toHaveBeenCalledTimes(2));
    expect(vi.mocked(refreshAllData).mock.calls[1][1]).toEqual({
      previousSourceStatuses: sourceStatuses,
    });
  });

  it("shows partial endpoints and a retry beside failed and current sources", async () => {
    vi.mocked(refreshAllData).mockResolvedValue({
      ...partialResult, failedSources: [], usedLastKnownData: false,
      sourceResults: [
        { sourceId: "cex:0", label: "Gate.io", walletIdentities: ["gate-key"], status: "partial",
          partial: { category: "network", endpoints: ["Earn", "Staking"], lowerThanPrevious: true }, coins: [] },
      ],
      sourceStatuses: [
        { sourceId: "cex:0", label: "Gate.io", kind: "exchange", provider: "Gate",
          status: "partial", partial: { category: "network", endpoints: ["Earn", "Staking"], lowerThanPrevious: true } },
        { sourceId: "cex:1", label: "Coinbase", kind: "exchange", provider: "Coinbase", status: "failed", category: "auth" },
        { sourceId: "btc:0", label: "BTC wallet 1", status: "ok" },
      ],
    } as never);
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Source status" });
    expect(dialog).toHaveTextContent("1 failed, 1 partial");
    const partialRow = screen.getByRole("group", { name: "Gate.io (Gate)" });
    expect(partialRow).toHaveTextContent("Partial");
    expect(partialRow).toHaveTextContent("Earn and Staking could not be read this time");
    expect(partialRow).toHaveTextContent("totals may be lower than usual");
    expect(screen.getByRole("button", { name: "Retry Gate.io (Gate)" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Coinbase");
    expect(dialog).toHaveTextContent("OK");
    expect(JSON.parse(localStorage.getItem("track3-refresh-source-statuses") ?? "[]")[0].status).toBe("partial");
  });

  it("shows a quiet warning and one toast for a partial-only refresh without opening the dialog", async () => {
    vi.mocked(refreshAllData).mockResolvedValue({
      ...partialResult, failedSources: [], usedLastKnownData: false,
      sourceStatuses: [{ sourceId: "cex:0", label: "Coinbase", status: "partial",
        partial: { category: "auth", endpoints: ["Some assets", "Portfolio FUTURES"] } }],
    } as never);
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    const indicator = await screen.findByRole("button", { name: "Source status" });
    expect(indicator).toHaveClass("text-amber-900");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast.mock.calls[0][0].description).toContain("Partial sources: Coinbase");
    await user.click(indicator);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Some assets and Some products could not be read this time");
    expect(dialog).not.toHaveTextContent("refresh.endpoint.");
  });

  it("translates API key and safe error details for Chinese source rows", async () => {
    localStorage.setItem(localeLocalStorageKey, "zh");
    localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([
      { sourceId: "cex:0", label: "Main", kind: "exchange", provider: "Binance",
        hint: "ab12…9xyz", status: "failed", detail: "Source timed out" },
      { sourceId: "cex:1", label: "Second", kind: "exchange", provider: "OKX",
        hint: "#1", status: "failed", detail: "Unsupported exchange" },
      { sourceId: "btc:0", label: "Wallet", kind: "wallet", provider: "BTC",
        hint: "#1", status: "stale", detail: "Invalid source holdings" },
    ]));
    const user = userEvent.setup();
    render(<I18nProvider><RefreshData loading={false} /></I18nProvider>);
    await user.click(screen.getByRole("button", { name: "数据源状态" }));
    const dialog = screen.getByRole("alertdialog", { name: "数据源状态" });
    expect(dialog).toHaveTextContent("Binance · API 密钥 ab12…9xyz");
    expect(dialog).toHaveTextContent("数据源超时");
    expect(dialog).toHaveTextContent("不支持的交易所");
    expect(dialog).toHaveTextContent("数据源持仓无效");
    expect(dialog).not.toHaveTextContent("API key");
    expect(dialog.querySelectorAll("[data-source-status-row] svg").length).toBeGreaterThanOrEqual(6);
  });

  it("carries the last successful time into a full refresh that fails without saved holdings", async () => {
    localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([
      { sourceId: "cex:0", label: "Main", kind: "exchange", provider: "Binance", hint: "#1",
        status: "ok", lastSuccessAt: "2026-10-17T12:30:00Z" },
    ]));
    vi.mocked(refreshAllData).mockResolvedValue({
      ...partialResult, sourceStatuses: [
        { sourceId: "cex:0", label: "Main", kind: "exchange", provider: "Binance", hint: "#1", status: "failed",
          lastSuccessAt: "2026-10-17T12:30:00Z" },
      ],
    } as never);
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(vi.mocked(refreshAllData).mock.calls[0][1]).toEqual({
      previousSourceStatuses: [{
        sourceId: "cex:0", label: "Main", kind: "exchange", provider: "Binance", hint: "#1",
        status: "ok", lastSuccessAt: "2026-10-17T12:30:00Z",
      }],
    });
  });

  it("ignores malformed saved source statuses", () => {
    localStorage.setItem("track3-refresh-source-statuses", "[null]");
    render(<RefreshData loading={false} />);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Source status" })).toBeNull();
  });

  it("restores a failed source indicator from saved statuses", () => {
    localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([
      { sourceId: "btc:0", label: "Private wallet", status: "failed", category: "network" },
    ]));
    render(<RefreshData loading={false} />);
    expect(screen.getByRole("button", { name: "Source status" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Source status" }));
    expect(screen.getByText("Private wallet")).toBeInTheDocument();
  });

  it("offers a full retry of failed sources after restarting", async () => {
    const statuses = [{ sourceId: "btc:0", label: "Private wallet", status: "failed" as const, category: "network" as const }];
    localStorage.setItem("track3-refresh-source-statuses", JSON.stringify(statuses));
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Source status" }));
    await user.click(screen.getByRole("button", { name: "Retry all failed" }));
    await waitFor(() => expect(refreshAllData).toHaveBeenCalledWith(
      expect.any(Function), { previousSourceStatuses: statuses }, expect.any(Object), expect.any(Function),
    ));
  });

  it("redacts credential-like text from persisted source labels", async () => {
    vi.mocked(refreshAllData).mockResolvedValue({
      ...partialResult,
      sourceStatuses: [{ sourceId: "btc:0", label: "Wallet sk-abcdefghijklmnop1234567890", status: "stale", category: "network" }],
    } as never);
    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(localStorage.getItem("track3-refresh-source-statuses")).not.toContain("sk-abcdefghijklmnop1234567890");
  });

  it("cleans a credential in an older saved source label on load", () => {
    localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([
      { sourceId: "btc:0", label: "Wallet sk-abcdefghijklmnop1234567890", status: "stale", category: "network", error: "upstream detail" },
    ]));
    render(<RefreshData loading={false} />);
    expect(screen.getByRole("button", { name: "Source status" })).toBeInTheDocument();
    expect(localStorage.getItem("track3-refresh-source-statuses")).not.toContain("sk-abcdefghijklmnop1234567890");
    expect(localStorage.getItem("track3-refresh-source-statuses")).not.toContain("upstream detail");
  });

  it("passes automatic retries into one refresh operation call", async () => {
    vi.useFakeTimers();
    try {
      let persistenceAttempts = 0;
      vi.mocked(refreshAllData).mockImplementation(
        async (_addProgress, _options, _operation, retry) => {
          await retry!(async () => {
            persistenceAttempts += 1;
            if (persistenceAttempts === 1) {
              throw new Error("temporary failure");
            }
          });
          return {
            failedSources: [],
            requiresDataSourceAction: false,
            usedLastKnownData: false,
          } as never;
        },
      );

      render(<RefreshData loading={false} />);

      act(() => {
        screen.getByRole("button", { name: "Refresh" }).click();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(refreshAllData).toHaveBeenCalledTimes(1);
      expect(persistenceAttempts).toBe(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(refreshAllData).toHaveBeenCalledTimes(1);
      expect(persistenceAttempts).toBe(2);
      expect(refreshAllData).toHaveBeenCalledWith(
        expect.any(Function),
        {},
        {
          operationUuid: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
          ),
        },
        expect.any(Function),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry when the source requires a full refresh", async () => {
    vi.useFakeTimers();
    try {
    let attempts = 0;
    vi.mocked(refreshAllData).mockImplementation(async (_progress, _options, _operation, retry) => {
      await retry!(async () => {
        attempts += 1;
        throw new FullRefreshRequiredError("Source no longer exists. Run a full refresh.");
      });
      throw new Error("unreachable");
    });
    render(<RefreshData loading={false} />);
    act(() => { screen.getByRole("button", { name: "Refresh" }).click(); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(9_000); });
    expect(attempts).toBe(1);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      description: "Portfolio changed. Run a full refresh before retrying this source.",
    }));
    } finally { vi.useRealTimers(); }
  });

  it("forwards refresh progress as absolute values across query retries", async () => {
    vi.mocked(refreshAllData).mockImplementation(async (setProgress) => {
      setProgress(75);
      setProgress(0);
      setProgress(90);
      setProgress(100);
      return {
        failedSources: [],
        requiresDataSourceAction: false,
        usedLastKnownData: false,
      } as never;
    });

    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(refreshAllData).toHaveBeenCalledOnce();
      expect(mockSetProgress).toHaveBeenCalledTimes(6);
    });
    expect(mockSetProgress.mock.calls.map(([value]) => value)).toEqual([
      0,
      75,
      0,
      90,
      100,
      0,
    ]);
  });
});
