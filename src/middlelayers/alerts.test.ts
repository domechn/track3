import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  evaluate,
  measureRule,
  saveAlertRule,
  listAlertRules,
  recordAlerts,
  loadAlertEvaluationData,
  processAlerts,
  type AlertRule,
  type AlertSnapshot,
} from "./alerts";
import { executeWrite, executeWriteWork, getDatabase } from "./database";
import { calculateTotalProfit } from "./charts-profit";
import { getBlacklistCoins, getStableCoins } from "./configuration";

vi.mock("./database", () => ({
  executeWrite: vi.fn(),
  executeWriteWork: vi.fn(),
  getDatabase: vi.fn(),
}));
vi.mock("./charts-profit", () => ({ calculateTotalProfit: vi.fn() }));
vi.mock("./configuration", async (importOriginal) => ({
  ...await importOriginal<typeof import("./configuration")>(),
  getBlacklistCoins: vi.fn(), getStableCoins: vi.fn(),
}));

const now = new Date("2026-10-17T12:00:00.000Z");
const latest: AlertSnapshot = {
  at: now.toISOString(),
  assets: [
    { assetType: "crypto", symbol: "BTC", value: 600, price: 60, wallet: "wallet-a" },
    { assetType: "crypto", symbol: "ETH", value: 400, price: 20, wallet: "wallet-b" },
  ],
};
const rule = (changes: Partial<AlertRule> = {}): AlertRule => ({
  id: 1, kind: "total_value_target", comparator: "gte", threshold: 1000,
  enabled: true, cooldownSeconds: 3600, lastTriggeredAt: null, lastValue: null,
  armed: true, window: null, assetType: null, symbol: null, ...changes,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBlacklistCoins).mockResolvedValue([]);
  vi.mocked(getStableCoins).mockResolvedValue([]);
});

describe("alert evaluation", () => {
  it("triggers an absolute BTC price target from the latest price", () => {
    const target = rule({ kind: "asset_price_target", symbol: "BTC", assetType: "crypto", threshold: 60 });
    expect(evaluate([target], [latest], {}, undefined, now)).toMatchObject([
      { ruleId: 1, value: 60, title: "BTC price target reached" },
    ]);
  });
  it("measures the largest crypto allocation deviation for an any-coin rule", () => {
    const targets = { targets: [
      { kind: "asset" as const, assetType: "crypto" as const, symbol: "BTC", percent: 50 },
      { kind: "asset" as const, assetType: "crypto" as const, symbol: "ETH", percent: 50 },
    ], tolerancePercent: 0 };
    const anyCoin = rule({ kind: "allocation_deviation", assetType: "crypto", symbol: "*", threshold: 5 });
    expect(measureRule(anyCoin, [latest], {}, targets).value).toBe(10);
  });
  it("triggers a total value goal at the exact threshold", () => {
    expect(evaluate([rule()], [latest], {}, undefined, now)).toMatchObject([
      { ruleId: 1, value: 1000, title: "Portfolio goal reached" },
    ]);
  });

  it("requires a reset beyond the hysteresis band before rearming", () => {
    const disarmed = rule({ armed: false, lastTriggeredAt: "2026-10-17T09:00:00.000Z" });
    expect(evaluate([disarmed], [latest], {}, undefined, now)).toEqual([]);
    expect(measureRule(disarmed, [latest], {}, undefined).rearmed).toBe(false);
    const reset = { ...latest, assets: [{ ...latest.assets[0], value: 580 }, latest.assets[1]] };
    expect(measureRule(disarmed, [reset], {}, undefined).rearmed).toBe(true);
  });

  it("honors cooldown even after rearming", () => {
    expect(evaluate([rule({ lastTriggeredAt: "2026-10-17T11:30:00.000Z" })], [latest], {}, undefined, now)).toEqual([]);
  });

  it("measures asset value and price move from hand-computed fixtures", () => {
    const prices = { "24h": { "crypto:BTC": 50 } };
    expect(evaluate([rule({ kind: "asset_value_target", symbol: "BTC", assetType: "crypto", threshold: 600 })], [latest], prices, undefined, now)[0].value).toBe(600);
    expect(evaluate([rule({ kind: "asset_price_move", symbol: "BTC", assetType: "crypto", window: "24h", threshold: 20 })], [latest], prices, undefined, now)[0].value).toBe(20);
  });

  it("accepts signed loss and downward price thresholds", () => {
    const prices = { "24h": { "crypto:BTC": 75 } };
    expect(evaluate([rule({ kind: "asset_price_move", symbol: "BTC", assetType: "crypto", window: "24h", comparator: "lte", threshold: -20 })], [latest], prices, undefined, now)[0].value).toBe(-20);
    expect(evaluate([rule({ kind: "period_pnl", window: "7d", comparator: "lte", threshold: -40 })], [{ ...latest, pnl: { "7d": -42 } }], {}, undefined, now)[0].value).toBe(-42);
  });
  it("measures a seven-day portfolio drop as a percentage of the earlier value", () => {
    const drop = rule({ kind: "portfolio_value_change", window: "7d", comparator: "lte", threshold: -10 });
    expect(evaluate([drop], [{ ...latest, portfolioChange: { "7d": -10 } }], {}, undefined, now)[0].value).toBe(-10);
    expect(evaluate([drop], [{ ...latest, portfolioChange: { "7d": -1 } }], {}, undefined, now)).toEqual([]);
  });

  it("uses rebalance targets for allocation deviation and a real PnL input", () => {
    const targets = { targets: [
      { kind: "asset" as const, assetType: "crypto" as const, symbol: "BTC", percent: 50 },
      { kind: "asset" as const, assetType: "crypto" as const, symbol: "ETH", percent: 50 },
    ], tolerancePercent: 5 };
    expect(evaluate([rule({ kind: "allocation_deviation", symbol: "BTC", assetType: "crypto", threshold: 10 })], [latest], {}, targets, now)[0].value).toBe(10);
    expect(evaluate([rule({ kind: "period_pnl", window: "7d", threshold: 42 })], [{ ...latest, pnl: { "7d": 42 } }], {}, undefined, now)[0].value).toBe(42);
  });

  it("leaves allocation deviation unavailable when the asset has no target or holding", () => {
    const targets = { targets: [
      { kind: "asset" as const, assetType: "crypto" as const, symbol: "ETH", percent: 100 },
    ], tolerancePercent: 5 };
    const doge = rule({ kind: "allocation_deviation", assetType: "crypto", symbol: "DOGE", comparator: "lte", threshold: 0 });
    expect(measureRule(doge, [latest], {}, targets).status).toBe("unavailable");
    expect(evaluate([doge], [latest], {}, targets, now)).toEqual([]);
  });

  it("marks stale source inputs and suppresses price and percentage alerts", () => {
    const stale = { ...latest, staleAssetKeys: ["crypto:BTC"], hasStaleSources: true };
    const priceRule = rule({ kind: "asset_price_move", symbol: "BTC", assetType: "crypto", window: "24h", threshold: 20 });
    expect(measureRule(priceRule, [stale], { "24h": { "crypto:BTC": 50 } }, undefined).status).toBe("data-stale");
    expect(evaluate([priceRule], [stale], { "24h": { "crypto:BTC": 50 } }, undefined, now)).toEqual([]);
    expect(measureRule(rule({ kind: "period_pnl", window: "7d" }), [stale], {}, undefined).status).toBe("data-stale");
    expect(measureRule(rule({ kind: "asset_value_target", symbol: "*", assetType: "crypto" }), [stale], {}, undefined).status).toBe("data-stale");
  });
});

describe("alert storage", () => {
  it("excludes blacklisted holdings from allocation measurements", async () => {
    vi.mocked(getBlacklistCoins).mockResolvedValue(["btc"]);
    vi.mocked(getDatabase).mockResolvedValue({
      select: async (sql: string, values?: unknown[]) => sql.includes("FROM assets_v2") && !values?.length
        ? [
          { assetType: "crypto", symbol: "BTC", wallet: "a", value: 60, amount: 1, price: 60, at: now.toISOString() },
          { assetType: "crypto", symbol: "ETH", wallet: "b", value: 40, amount: 1, price: 40, at: now.toISOString() },
        ] : [],
    } as never);
    const data = await loadAlertEvaluationData(undefined, [], now);
    const targets = { targets: [
      { kind: "asset" as const, assetType: "crypto" as const, symbol: "BTC", percent: 50 },
      { kind: "asset" as const, assetType: "crypto" as const, symbol: "ETH", percent: 50 },
    ], tolerancePercent: 0 };
    expect(data.snapshots[0].assets.map((asset) => asset.symbol)).toEqual(["ETH"]);
    expect(data.excludedSymbols).toEqual(["btc"]);
    expect(measureRule(rule({ kind: "allocation_deviation", assetType: "crypto", symbol: "ETH" }), data.snapshots, {}, targets).value).toBe(50);
  });

  it("uses configured stablecoins for allocation measurements", async () => {
    vi.mocked(getStableCoins).mockResolvedValue(["XYZ"]);
    vi.mocked(getDatabase).mockResolvedValue({
      select: async (sql: string, values?: unknown[]) => sql.includes("FROM assets_v2") && !values?.length
        ? [
          { assetType: "crypto", symbol: "BTC", wallet: "a", value: 60, amount: 1, price: 60, at: now.toISOString() },
          { assetType: "crypto", symbol: "XYZ", wallet: "b", value: 40, amount: 40, price: 1, at: now.toISOString() },
        ] : [],
    } as never);
    const data = await loadAlertEvaluationData(undefined, [], now);
    const targets = { targets: [
      { kind: "asset" as const, assetType: "crypto" as const, symbol: "BTC", percent: 50 },
      { kind: "cash" as const, percent: 50 },
    ], tolerancePercent: 0 };
    expect(measureRule(rule({ kind: "allocation_deviation", assetType: "crypto", symbol: "XYZ" }), data.snapshots, {}, targets).value).toBe(0);
  });

  it("loads P&L for a displayed rule with available period records", async () => {
    vi.mocked(getDatabase).mockResolvedValue({
      select: async (sql: string, values?: unknown[]) => sql.includes("FROM assets_v2") && !values?.length
        ? [{ assetType: "crypto", symbol: "BTC", wallet: "a", value: 60, amount: 1, price: 60, at: now.toISOString() }]
        : [],
    } as never);
    vi.mocked(calculateTotalProfit).mockResolvedValue({ total: 12, lastRecordDate: now } as never);
    const data = await loadAlertEvaluationData(undefined, [], now, ["7d"]);
    expect(measureRule(rule({ kind: "period_pnl", window: "7d" }), data.snapshots, {}, undefined).value).toBe(12);
  });
  it("derives portfolio percentage change from matching historical and current snapshots", async () => {
    vi.mocked(getDatabase).mockResolvedValue({
      select: async (sql: string, values?: unknown[]) => sql.includes("FROM assets_v2")
        ? [{ assetType: "crypto", symbol: "BTC", wallet: "a", value: values?.length ? 1000 : 900,
          amount: 1, price: values?.length ? 1000 : 900,
          at: values?.length ? "2026-10-10T12:00:00.000Z" : now.toISOString() }]
        : [],
    } as never);
    const data = await loadAlertEvaluationData(undefined, [], now);
    expect(measureRule(rule({
      kind: "portfolio_value_change", window: "7d", comparator: "lte", threshold: -10,
    }), data.snapshots, {}, undefined).value).toBe(-10);
  });
  it("treats unmapped stale sources conservatively after refresh", async () => {
    vi.mocked(getDatabase).mockResolvedValue({
      select: async (sql: string) => sql.includes("FROM assets_v2")
        ? [{ assetType: "crypto", symbol: "BTC", wallet: "wallet-a", value: 600, amount: 10, price: 60, at: now.toISOString() }]
        : [],
    } as never);
    const data = await loadAlertEvaluationData([], [{ sourceId: "btc:0", label: "BTC", status: "stale" }]);
    expect(data.snapshots[0].staleAssetKeys).toContain("crypto:BTC");
  });

  it("allows portfolio alerts when a source has fresh partial holdings", async () => {
    vi.mocked(getDatabase).mockResolvedValue({
      select: async (sql: string) => sql.includes("FROM assets_v2")
        ? [{ assetType: "crypto", symbol: "BTC", wallet: "wallet-a", value: 600, amount: 10, price: 60, at: now.toISOString() }]
        : [],
    } as never);
    const data = await loadAlertEvaluationData(
      [{ sourceId: "cex:0", label: "Gate", walletIdentities: ["wallet-a"], status: "partial", coins: [],
        partial: { category: "network", endpoints: ["Earn"] } }],
      [{ sourceId: "cex:0", label: "Gate", status: "partial", partial: { category: "network", endpoints: ["Earn"] } }],
      now,
    );
    expect(data.snapshots[0].hasStaleSources).toBe(false);
    expect(evaluate([rule({ threshold: 600 })], data.snapshots, {}, undefined, now)).toHaveLength(1);
  });

  it("marks an old startup snapshot as stale before evaluating goals", async () => {
    vi.mocked(getDatabase).mockResolvedValue({
      select: async (sql: string) => sql.includes("FROM assets_v2")
        ? [{ assetType: "crypto", symbol: "BTC", wallet: "wallet-a", value: 600, amount: 10, price: 60, at: "2026-10-14T12:00:00.000Z" }]
        : [],
    } as never);
    const data = await loadAlertEvaluationData(undefined, [], now);
    expect(data.snapshots[0].hasStaleSources).toBe(true);
  });

  it("does not call a year-old price snapshot a 24-hour move", async () => {
    vi.mocked(getDatabase).mockResolvedValue({
      select: async (sql: string, values?: unknown[]) => sql.includes("FROM assets_v2")
        ? [{
          assetType: "crypto", symbol: "BTC", wallet: "wallet-a", value: 600,
          amount: 10, price: 60,
          at: !values?.length ? now.toISOString() : "2025-10-17T12:00:00.000Z",
        }]
        : [],
    } as never);
    const data = await loadAlertEvaluationData(undefined, [], now);
    expect(data.prices["24h"]).toBeUndefined();
  });

  it("does not trigger a P&L rule when the period has no records", async () => {
    const db = {
      select: async (sql: string, values?: unknown[]) => sql.includes("FROM alert_rules")
        ? [{
          id: 1, kind: "period_pnl", comparator: "lte", threshold: 0, window: "7d",
          asset_type: null, symbol: null, enabled: 1, cooldown_seconds: 0,
          last_triggered_at: null, last_value: null, armed: 1,
        }]
        : sql.includes("FROM assets_v2") && !values?.length
          ? [{ assetType: "crypto", symbol: "BTC", wallet: "wallet-a", value: 600, amount: 10, price: 60, at: now.toISOString() }]
          : [],
      execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
    };
    vi.mocked(getDatabase).mockResolvedValue(db as never);
    vi.mocked(executeWriteWork).mockImplementation(async (work) => work(db as never));
    vi.mocked(calculateTotalProfit).mockResolvedValue({ total: 0, coins: [], percentage: undefined } as never);
    expect(await processAlerts(undefined, [], now)).toEqual([]);
  });

  it("uses the latest committed snapshot even when its timestamp is ahead of the system clock", async () => {
    vi.mocked(getDatabase).mockResolvedValue({
      select: async (sql: string, values?: unknown[]) => sql.includes("FROM assets_v2") && !values?.length
        ? [{ assetType: "crypto", symbol: "BTC", wallet: "wallet-a", value: 600, amount: 10, price: 60, at: "2026-10-17T12:00:01.000Z" }]
        : [],
    } as never);
    const data = await loadAlertEvaluationData(undefined, [], now);
    expect(data.snapshots[0].assets[0].symbol).toBe("BTC");
  });

  it("validates and canonicalizes a saved asset rule", async () => {
    vi.mocked(executeWrite).mockResolvedValue({ rowsAffected: 1 });
    await saveAlertRule(rule({ id: 0, kind: "asset_price_move", assetType: "crypto", symbol: " btc ", window: "24h", threshold: 5 }));
    expect(vi.mocked(executeWrite).mock.calls[0][1]).toContain("BTC");
    await expect(saveAlertRule(rule({ threshold: Number.NaN }))).rejects.toThrow();
  });

  it("allows loss thresholds but rejects negative portfolio value goals", async () => {
    vi.mocked(executeWrite).mockResolvedValue({ rowsAffected: 1 });
    await saveAlertRule(rule({ kind: "period_pnl", comparator: "lte", threshold: -100, window: "7d" }));
    await expect(saveAlertRule(rule({ threshold: -100 }))).rejects.toThrow("Invalid threshold");
  });

  it("reads persisted booleans and records an alert once through the write queue", async () => {
    vi.mocked(getDatabase).mockResolvedValue({ select: async () => [{
      id: 1, kind: "total_value_target", comparator: "gte", threshold: 1000,
      enabled: 1, cooldown_seconds: 3600, last_triggered_at: null, last_value: null,
      armed: 1, window: null, asset_type: null, symbol: null,
    }] } as never);
    expect((await listAlertRules())[0].armed).toBe(true);
    vi.mocked(executeWriteWork).mockImplementation(async (work) => work({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
      select: vi.fn().mockResolvedValue([]),
    } as never));
    await recordAlerts(evaluate([rule()], [latest], {}, undefined, now));
    expect(executeWriteWork).toHaveBeenCalledTimes(1);
  });
});
