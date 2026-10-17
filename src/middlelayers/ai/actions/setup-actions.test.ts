import { beforeEach, expect, it, vi } from "vitest";
import { executePreparedAction, prepareAction, COST_BASIS_SETTINGS_KEY, REBALANCE_OPTIONS_KEY, ASSISTANT_APP_ACTION_EVENT } from "./index";
import { getCostBasisMethod, saveCostBasisMethod } from "@/middlelayers/configuration";
import { listAlertRules, saveAlertRule, listAlertHistory, acknowledgeAllAlerts, clearAlertHistory } from "@/middlelayers/alerts";
import { getRebalanceProfile, saveRebalanceProfile, deleteRebalanceProfile, loadRebalanceHoldings } from "@/middlelayers/rebalance";
import { loadCostBasisReport, exportCostBasisReport } from "@/middlelayers/cost-basis-data";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

vi.mock("@/middlelayers/configuration", async (original) => ({
  ...await original<typeof import("@/middlelayers/configuration")>(),
  getCostBasisMethod: vi.fn(), saveCostBasisMethod: vi.fn(),
  queryPreferCurrency: vi.fn().mockResolvedValue({ currency: "USD", rate: 1, alias: "USD", symbol: "$" }),
}));
vi.mock("@/middlelayers/alerts", async (original) => ({
  ...await original<typeof import("@/middlelayers/alerts")>(),
  listAlertRules: vi.fn(), saveAlertRule: vi.fn(), listAlertHistory: vi.fn(), acknowledgeAllAlerts: vi.fn(), clearAlertHistory: vi.fn(),
}));
vi.mock("@/middlelayers/rebalance", async (original) => ({
  ...await original<typeof import("@/middlelayers/rebalance")>(),
  getRebalanceProfile: vi.fn(), saveRebalanceProfile: vi.fn(), deleteRebalanceProfile: vi.fn(), loadRebalanceHoldings: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeTextFile: vi.fn() }));
vi.mock("@/middlelayers/cost-basis-data", async (original) => ({
  ...await original<typeof import("@/middlelayers/cost-basis-data")>(),
  loadCostBasisReport: vi.fn(), exportCostBasisReport: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem(COST_BASIS_SETTINGS_KEY);
  localStorage.removeItem(REBALANCE_OPTIONS_KEY);
  sessionStorage.removeItem(REBALANCE_OPTIONS_KEY);
  vi.mocked(getCostBasisMethod).mockResolvedValue("FIFO");
  vi.mocked(getRebalanceProfile).mockResolvedValue(undefined);
  vi.mocked(listAlertRules).mockResolvedValue([]);
  vi.mocked(listAlertHistory).mockResolvedValue([]);
});

it("applies confirmed cost basis settings and signals the page to reload", async () => {
  const changed = vi.fn();
  window.addEventListener(ASSISTANT_APP_ACTION_EVENT, changed);
  const action = await prepareAction("set_cost_basis_settings", { method: "AVERAGE", holdingPeriodDays: 400, from: "2025-01-01", to: "2025-12-31" }, "call-1");
  expect(action.preview.before).toContain("FIFO");
  expect(action.preview.after).toContain("AVERAGE");
  await executePreparedAction(action);
  expect(saveCostBasisMethod).toHaveBeenCalledWith("AVERAGE");
  expect(JSON.parse(localStorage.getItem(COST_BASIS_SETTINGS_KEY) ?? "{}")).toEqual({
    holdingPeriodDays: 400, from: "2025-01-01", to: "2025-12-31",
  });
  expect(changed).toHaveBeenCalledOnce();
  window.removeEventListener(ASSISTANT_APP_ACTION_EVENT, changed);
});

it("keeps an edited disabled alert disabled when enabled is omitted", async () => {
  vi.mocked(listAlertRules).mockResolvedValue([{
    id: 7, kind: "period_pnl", assetType: null, symbol: null, comparator: "lte", threshold: -5,
    window: "7d", enabled: false, cooldownSeconds: 3600, lastTriggeredAt: null, lastValue: null, armed: true,
  }]);
  const action = await prepareAction("edit_alert", {
    id: 7, kind: "period_pnl", comparator: "lte", threshold: -10, window: "7d", cooldownSeconds: 3600,
  }, "call-2");
  await executePreparedAction(action);
  expect(saveAlertRule).toHaveBeenCalledWith(expect.objectContaining({ id: 7, threshold: -10, enabled: false }));
});
it("merges a partial asset alert edit before validation and preview", async () => {
  vi.mocked(listAlertRules).mockResolvedValue([{
    id: 7, kind: "asset_price_move", assetType: "crypto", symbol: "BTC", comparator: "lte", threshold: -5,
    window: "7d", enabled: true, cooldownSeconds: 3600, lastTriggeredAt: null, lastValue: null, armed: true,
  }]);
  const action = await prepareAction("edit_alert", { id: 7, threshold: -10 }, "call-partial");
  expect(action.preview.after).toContain('"threshold":-10');
  await executePreparedAction(action);
  expect(saveAlertRule).toHaveBeenCalledWith(expect.objectContaining({
    kind: "asset_price_move", symbol: "BTC", window: "7d", threshold: -10,
  }));
});
it("accepts an unchanged any-coin symbol after merging the stored alert kind", async () => {
  vi.mocked(listAlertRules).mockResolvedValue([{
    id: 7, kind: "allocation_deviation", assetType: "crypto", symbol: "*", comparator: "gte", threshold: 5,
    window: null, enabled: true, cooldownSeconds: 3600, lastTriggeredAt: null, lastValue: null, armed: true,
  }]);
  const action = await prepareAction("edit_alert", { id: 7, symbol: "*" }, "call-any");
  expect(JSON.parse(action.preview.after)).toMatchObject({ kind: "allocation_deviation", symbol: "*" });
});
it("previews a new alert as individual fields", async () => {
  const action = await prepareAction("create_alert", {
    kind: "asset_price_target", assetType: "crypto", symbol: "BTC", comparator: "gte", threshold: 100000,
  }, "call-create");
  expect(action.preview.before).toBe("{}");
});
it("drops obsolete asset and window fields when an alert kind changes", async () => {
  vi.mocked(listAlertRules).mockResolvedValue([{
    id: 7, kind: "asset_price_move", assetType: "crypto", symbol: "BTC", comparator: "lte", threshold: -5,
    window: "7d", enabled: true, cooldownSeconds: 3600, lastTriggeredAt: null, lastValue: null, armed: true,
  }]);
  const action = await prepareAction("edit_alert", {
    id: 7, kind: "total_value_target", comparator: "gte", threshold: 1000,
  }, "call-kind");
  await executePreparedAction(action);
  expect(saveAlertRule).toHaveBeenCalledWith(expect.objectContaining({
    kind: "total_value_target", symbol: null, assetType: null, window: null,
  }));
});

it("saves an equal-weight preset and a buys-only cash option", async () => {
  vi.mocked(loadRebalanceHoldings).mockResolvedValue({ holdings: [
    { assetType: "crypto", symbol: "BTC", amount: 1, value: 80, price: 80 },
    { assetType: "crypto", symbol: "ETH", amount: 1, value: 20, price: 20 },
  ], stablecoinSymbols: [] });
  await executePreparedAction(await prepareAction("apply_rebalance_preset", { preset: "equal_weight" }, "call-3"));
  expect(saveRebalanceProfile).toHaveBeenCalledWith({ targets: [
    { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
    { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
  ], tolerancePercent: 0 });
  await executePreparedAction(await prepareAction("set_rebalance_options", { mode: "buys", injectedCash: 1000 }, "call-4"));
  expect(JSON.parse(sessionStorage.getItem(REBALANCE_OPTIONS_KEY) ?? "{}")).toEqual({ mode: "buys", injectedCash: 1000 });
  expect(localStorage.getItem(REBALANCE_OPTIONS_KEY)).toBeNull();
});
it("deletes rebalance targets only after confirmation", async () => {
  const action = await prepareAction("delete_rebalance_targets", {}, "call-delete");
  expect(deleteRebalanceProfile).not.toHaveBeenCalled();
  await executePreparedAction(action);
  expect(deleteRebalanceProfile).toHaveBeenCalledOnce();
});
it("exports rebalance suggestions using the session's cash option", async () => {
  vi.mocked(getRebalanceProfile).mockResolvedValue({
    targets: [{ kind: "asset", assetType: "crypto", symbol: "BTC", percent: 100 }], tolerancePercent: 0,
  });
  vi.mocked(loadRebalanceHoldings).mockResolvedValue({
    holdings: [{ assetType: "crypto", symbol: "BTC", amount: 1, price: 100, value: 100 }], stablecoinSymbols: [],
  });
  sessionStorage.setItem(REBALANCE_OPTIONS_KEY, JSON.stringify({ mode: "buys", injectedCash: 1000 }));
  vi.mocked(save).mockResolvedValue("/tmp/rebalance.csv");
  const action = await prepareAction("export_rebalance", {}, "call-export");
  expect(writeTextFile).not.toHaveBeenCalled();
  await executePreparedAction(action);
  expect(writeTextFile).toHaveBeenCalledWith("/tmp/rebalance.csv", expect.stringContaining('"BTC","100.00","100.00","0.00","Buy","1000.00"'));
});
it("clears alert history only after confirmation", async () => {
  const action = await prepareAction("clear_alert_history", {}, "call-clear");
  expect(clearAlertHistory).not.toHaveBeenCalled();
  await executePreparedAction(action);
  expect(clearAlertHistory).toHaveBeenCalledOnce();
});

it("acknowledges alert history only after confirmation", async () => {
  vi.mocked(listAlertHistory).mockResolvedValue([{
    id: 1, ruleId: 7, kind: "period_pnl", title: "Loss", message: "Loss", value: -10,
    triggeredAt: "2025-01-01", acknowledgedAt: null,
  }]);
  const action = await prepareAction("acknowledge_all_alerts", {}, "call-5");
  expect(action.preview.after).toBe("assistant.action.preview.acknowledgedAll:1");
  expect(action.preview.after).not.toContain("alerts acknowledged");
  expect(acknowledgeAllAlerts).not.toHaveBeenCalled();
  await executePreparedAction(action);
  expect(acknowledgeAllAlerts).toHaveBeenCalledOnce();
});

it("exports realized gains for the current cost basis filters", async () => {
  localStorage.setItem(COST_BASIS_SETTINGS_KEY, JSON.stringify({ from: "2025-01-01", to: "2025-12-31", holdingPeriodDays: 400 }));
  vi.mocked(loadCostBasisReport).mockResolvedValue({} as never);
  vi.mocked(exportCostBasisReport).mockResolvedValue(true);
  await executePreparedAction(await prepareAction("export_report", { report: "realized_gains", format: "csv" }, "call-6"));
  expect(loadCostBasisReport).toHaveBeenCalledWith({
    method: "FIFO", from: "2025-01-01", to: "2025-12-31", holdingPeriodDays: 400,
  });
});
