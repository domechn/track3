import { describe, expect, it } from "vitest";
import { computeInsights, type InsightSnapshot } from "./insights";

const at = "2024-02-01T12:00:00.000Z";
const snapshot = (uuid: string, date: string, values: Record<string, number>): InsightSnapshot => ({
  uuid,
  at: date,
  assets: Object.entries(values).map(([symbol, value]) => ({
    assetType: "crypto", symbol, value, amount: value, price: 1,
  })),
});

describe("computeInsights", () => {
  it("reports hand-checked movers and concentration without small holdings noise", () => {
    const latest = snapshot("latest", at, { BTC: 700, ETH: 200, USDC: 100, DUST: 0 });
    const history = [
      snapshot("day", "2024-01-31T12:00:00.000Z", { BTC: 500, ETH: 250, USDC: 100 }),
      snapshot("week", "2024-01-25T12:00:00.000Z", { BTC: 600, ETH: 100, USDC: 100 }),
      snapshot("month", "2024-01-02T12:00:00.000Z", { BTC: 400, ETH: 200, USDC: 100 }),
    ];
    const result = computeInsights({ snapshots: [latest, ...history], stablecoinSymbols: ["USDC"] });
    const day = result.find((insight) => insight.id === "mover:value:24h");
    expect(day?.data).toMatchObject({ symbol: "BTC", changeValue: 200, changePercent: 40 });
    expect(result.find((insight) => insight.id === "mover:percent:7d")?.data).toMatchObject({ symbol: "ETH", changeValue: 100, changePercent: 100 });
    expect(result.find((insight) => insight.id === "mover:value:30d")?.data).toMatchObject({ symbol: "BTC", changeValue: 300, changePercent: 75 });
    expect(result.find((insight) => insight.id === "concentration")?.data).toMatchObject({
      top1Percent: 70, top3Percent: 100, hhi: 0.54, stablecoinPercent: 10,
    });
    expect(result.some((insight) => insight.id.includes("DUST"))).toBe(false);
  });

  it("recognizes common stablecoins when no custom list is configured", () => {
    const result = computeInsights({ snapshots: [snapshot("latest", at, { BTC: 400, USDC: 600 })],
      stablecoinSymbols: [] });
    expect(result.find((item) => item.id === "stablecoins")?.data).toMatchObject({ stablecoinPercent: 60 });
  });

  it("detects a statistically unusual daily change from a trailing baseline", () => {
    const daily = Array.from({ length: 31 }, (_, index) => {
      const date = new Date(Date.parse(at) - (31 - index) * 86400000).toISOString();
      return snapshot(`day-${index}`, date, { BTC: 100 + index * 10 + (index % 2 ? 1 : -1) });
    });
    const result = computeInsights({ snapshots: [snapshot("latest", at, { BTC: 500 }), ...daily.reverse()] });
    expect(result.find((insight) => insight.id === "unusual:crypto:BTC")?.data).toMatchObject({ symbol: "BTC" });
    expect(Number(result.find((insight) => insight.id === "unusual:crypto:BTC")?.data.zScore)).toBeGreaterThan(3);
  });

  it("reports entries, exits, stale sources, goal status, recent alerts, and rebalance drift", () => {
    const latest = snapshot("latest", at, { BTC: 800, SOL: 200 });
    const prior = snapshot("day", "2024-01-31T12:00:00.000Z", { BTC: 500, ETH: 300 });
    const result = computeInsights({
      snapshots: [latest, prior],
      alertRules: [{
        id: 7, kind: "total_value_target", assetType: null, symbol: null, comparator: "gte",
        threshold: 900, window: null, enabled: true, cooldownSeconds: 0, lastTriggeredAt: null,
        lastValue: null, armed: true,
      }],
      alertHistory: [{ id: 11, ruleId: 7, kind: "total_value_target", title: "private title", message: "private message",
        value: 1000, triggeredAt: at, acknowledgedAt: null }],
      rebalanceProfile: { targets: [
        { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
        { kind: "asset", assetType: "crypto", symbol: "SOL", percent: 50 },
      ], tolerancePercent: 5 },
    });
    expect(result.find((item) => item.id === "new:crypto:SOL")?.messageKey).toBe("insights.newAsset");
    expect(result.find((item) => item.id === "exited:crypto:ETH")?.messageKey).toBe("insights.exitedAsset");
    const stale = computeInsights({
      snapshots: [latest, prior],
      sourceStatuses: [{ sourceId: "wallet:0", label: "private alias", status: "stale" }],
    });
    expect(stale.find((item) => item.id === "stale")?.data).toMatchObject({ count: 1 });
    expect(result.find((item) => item.id === "goal:7")?.data).toMatchObject({ value: 1000, threshold: 900 });
    expect(result.find((item) => item.id === "alert:11")?.severity).toBe("warning");
    expect(result.find((item) => item.id === "drift")?.data).toMatchObject({ symbol: "BTC", deviationPercent: 30 });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("detects a new holding on the next same-day refresh", () => {
    const latest = snapshot("latest", at, { BTC: 900, SOL: 100 });
    const prior = snapshot("prior", "2024-02-01T11:00:00.000Z", { BTC: 1000 });
    const result = computeInsights({ snapshots: [latest, prior] });
    expect(result.find((item) => item.id === "new:crypto:SOL")?.data).toMatchObject({ symbol: "SOL", value: 100 });
  });

  it("suppresses unchanged insights but emits a materially changed one", () => {
    const snapshots = [snapshot("a", at, { BTC: 800, ETH: 200 })];
    const initial = computeInsights({ snapshots });
    expect(computeInsights({ snapshots, previous: initial })).toEqual([]);
    const changed = computeInsights({ snapshots: [snapshot("b", at, { BTC: 900, ETH: 100 })], previous: initial });
    expect(changed.some((item) => item.id === "concentration")).toBe(true);
  });

  it("shows a stale-source insight again when the stale count changes", () => {
    const snapshots = [snapshot("a", at, { BTC: 100 })];
    const one = computeInsights({ snapshots,
      sourceStatuses: [{ sourceId: "one", label: "one", status: "stale" }] });
    const changed = computeInsights({ snapshots, previous: one,
      sourceStatuses: [
        { sourceId: "one", label: "one", status: "stale" },
        { sourceId: "two", label: "two", status: "failed" },
      ] });
    expect(changed.find((item) => item.id === "stale")?.data.count).toBe(2);
  });

  it("names unavailable sources in the insight without exposing identifiers", () => {
    const result = computeInsights({ snapshots: [snapshot("a", at, { BTC: 100 })], sourceStatuses: [
      { sourceId: "cex:0", label: "Main", kind: "exchange", provider: "Binance", hint: "ab12…9xyz", status: "failed" },
      { sourceId: "cex:1", label: "Main", kind: "exchange", provider: "OKX", hint: "bc1q12…abcd", status: "stale" },
    ] });
    expect(result.find((item) => item.id === "stale")?.data).toEqual({
      count: 2, sources: "Main (Binance), Main (OKX)",
    });
  });

  it("describes partial sources by alias and provider without calling their data stale", () => {
    const result = computeInsights({ snapshots: [snapshot("a", at, { BTC: 100 })], sourceStatuses: [
      { sourceId: "cex:0", label: "Main", kind: "exchange", provider: "Gate",
        hint: "ab12…9xyz", status: "partial", partial: { category: "network", endpoints: ["Earn"] } },
    ] });
    expect(result.find((item) => item.id === "stale")).toBeUndefined();
    expect(result.find((item) => item.id === "partial")).toMatchObject({
      messageKey: "insights.partial", data: { count: 1, sources: "Main (Gate)" },
    });
  });

  it("updates the unavailable-source insight when the failed account changes", () => {
    const snapshots = [snapshot("a", at, { BTC: 100 })];
    const first = computeInsights({ snapshots, sourceStatuses: [
      { sourceId: "cex:0", label: "Main", kind: "exchange", provider: "Binance", status: "failed" },
    ] });
    const next = computeInsights({ snapshots, previous: first, sourceStatuses: [
      { sourceId: "cex:1", label: "Main", kind: "exchange", provider: "OKX", status: "failed" },
    ] });
    expect(next.find((item) => item.id === "stale")?.data.sources).toBe("Main (OKX)");
  });

  it("distinguishes crypto and stock holdings with the same symbol in movers and unusual changes", () => {
    const assets = (crypto: number, stock: number) => [
      { assetType: "crypto" as const, symbol: "ABC", value: crypto, amount: crypto, price: 1 },
      { assetType: "stock" as const, symbol: "ABC", value: stock, amount: stock, price: 1 },
    ];
    const history = Array.from({ length: 30 }, (_, index) => ({
      uuid: `old-${index}`,
      at: new Date(Date.parse(at) - (index + 1) * 86400000).toISOString(),
      assets: assets(1000 + index * 2 + index % 2, 100 + index + index % 2),
    }));
    const result = computeInsights({ snapshots: [{ uuid: "latest", at, assets: assets(1300, 200) }, ...history] });
    expect(result.find((item) => item.id === "mover:value:24h")?.data).toMatchObject({ changeValue: 300 });
    expect(result.find((item) => item.id === "mover:percent:24h")?.data).toMatchObject({ changeValue: 100 });
    expect(result.map((item) => item.id)).toContain("unusual:crypto:ABC");
    expect(result.map((item) => item.id)).toContain("unusual:stock:ABC");
  });

  it("uses local calendar days for the unusual-move baseline", () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      const current = snapshot("latest", "2024-02-01T00:30:00.000Z", { BTC: 300 });
      const sameLocalDay = snapshot("same-local-day", "2024-01-31T23:30:00.000Z", { BTC: 300 });
      const daily = Array.from({ length: 20 }, (_, index) =>
        snapshot(`day-${index}`, new Date(Date.parse(current.at) - (index + 1) * 86400000).toISOString(),
          { BTC: 100 + index * 2 + (index % 2) }));
      const result = computeInsights({ snapshots: [current, sameLocalDay, ...daily] });
      expect(result.map((item) => item.id)).toContain("unusual:crypto:BTC");
    } finally {
      process.env.TZ = originalTimezone;
    }
  });
});
