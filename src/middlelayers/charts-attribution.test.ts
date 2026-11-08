import { describe, expect, it } from "vitest";
import { attributeSnapshots, groupAttribution } from "./charts-attribution";
import { calculateSnapshotProfit } from "./charts-interval-profit";
import type { AssetModel, HistoricalData, TransactionModel } from "./types";

const at = (day: number) => `2024-04-0${day}T00:00:00.000Z`;
function asset(day: number, wallet: string, symbol: string, amount: number, value: number, assetType: "crypto" | "stock" = "crypto"): AssetModel {
  return { id: day, uuid: `u${day}`, createdAt: at(day), wallet, symbol, assetType, amount, value, price: amount ? value / amount : 0 };
}
function txn(day: number, wallet: string, symbol: string, amount: number, txnType: TransactionModel["txnType"], assetType: "crypto" | "stock" = "crypto"): TransactionModel {
  return { id: day, assetID: day, uuid: `u${day}`, wallet, symbol, assetType, amount, price: 0, txnType, txnCreatedAt: at(day), createdAt: at(day), updatedAt: at(day) };
}
function snapshot(day: number, assets: AssetModel[], transactions: TransactionModel[] = []): HistoricalData {
  return { id: `u${day}`, createdAt: at(day), assets, transactions, total: assets.reduce((sum, a) => sum + a.value, 0) };
}

// These fixtures keep their stored transaction prices, including zero, as execution prices.
describe("attribution from consecutive snapshots", () => {
  it("includes a first-snapshot buy priced below the opening quote in known P&L", () => {
    const history = [
      snapshot(1, [asset(1, "w", "BTC", 1, 100)], [{ ...txn(1, "w", "BTC", 1, "buy"), price: 50 }]),
      snapshot(2, [asset(2, "w", "BTC", 1, 120)]),
    ];
    const profit = calculateSnapshotProfit(history, { start: new Date(at(1)), end: new Date(at(2)) });
    const attribution = attributeSnapshots(history);
    expect(profit.knownTotal).toBe(70);
    expect(attribution.totals).toEqual({
      priceEffect: 70, flowEffect: 0, residual: -50, totalChange: 20,
    });
  });

  it("matches interval P&L for a round-trip trade between two empty snapshots", () => {
    const history = [
      snapshot(1, []),
      snapshot(2, [], [
        { ...txn(2, "w", "BTC", 1, "buy"), id: 201, price: 100 },
        { ...txn(2, "w", "BTC", 1, "sell"), id: 202, price: 130 },
      ]),
    ];
    const profit = calculateSnapshotProfit(history, {
      start: new Date(at(2)), end: new Date(at(2)),
    });
    const attribution = attributeSnapshots(history);
    expect(attribution.totals.priceEffect).toBe(profit.knownTotal);
    expect(attribution.totals.priceEffect).toBe(30);
  });
  it("keeps attribution totals equal to P&L when an unrecorded change has a different wallet quote", () => {
    const history = [
      snapshot(1, [asset(1, "a", "BTC", 1, 100), asset(1, "b", "BTC", 1, 200)]),
      snapshot(2, [asset(2, "a", "BTC", 2, 300), asset(2, "b", "BTC", 1, 200)]),
    ];
    const profit = calculateSnapshotProfit(history, {
      start: new Date(at(2)), end: new Date(at(2)),
    });
    const attribution = attributeSnapshots(history);
    expect(attribution.totals.priceEffect).toBeCloseTo(profit.knownTotal!);
    expect(attribution.totals.priceEffect).toBeCloseTo(100 / 3);
  });
  it("shares a coin-level correction across wallets with market activity", () => {
    const result = attributeSnapshots([
      snapshot(1, [asset(1, "a", "BTC", 1, 100), asset(1, "b", "BTC", 1, 200)]),
      snapshot(2, [asset(2, "a", "BTC", 2, 300), asset(2, "b", "BTC", 3, 375)]),
    ]);
    const wallets = Object.fromEntries(result.entries.map((entry) => [entry.wallet, entry.priceEffect]));
    expect(wallets.a).toBeGreaterThan(45);
    expect(wallets.a).toBeLessThan(50);
    expect(wallets.b).toBeGreaterThan(-80);
    expect(wallets.b).toBeLessThan(-75);
    expect(result.totals.priceEffect).toBeCloseTo(-30);
  });
  it("prices the recorded buy at execution price so market P&L matches the interval calculator", () => {
    const buy = { ...txn(2, "w", "BTC", 1, "buy"), price: 130 };
    const result = attributeSnapshots([
      snapshot(1, [asset(1, "w", "BTC", 1, 100)]),
      snapshot(2, [asset(2, "w", "BTC", 2, 300)], [buy]),
    ]);
    expect(result.totals).toEqual({ priceEffect: 70, flowEffect: 130, residual: 0, totalChange: 200 });
  });

  it("recognizes a withdrawal paired outside the selected range", () => {
    const outgoing = { ...txn(2, "w1", "BTC", 1, "withdraw"), price: 120, id: 301 };
    const incoming = { ...txn(3, "w2", "BTC", 1, "deposit"), price: 130, id: 302 };
    const result = attributeSnapshots([
      snapshot(1, [asset(1, "w1", "BTC", 1, 100)]),
      snapshot(2, [asset(2, "w1", "BTC", 0, 0)], [outgoing]),
    ], [], [outgoing, incoming]);
    expect(result.totals.priceEffect).toBe(20);
  });

  it("values a transaction-backed deposit at its stored zero execution price", () => {
    const result = attributeSnapshots([
      snapshot(1, [asset(1, "exchange", "BTC", 2, 200)]),
      snapshot(2, [asset(2, "exchange", "BTC", 3, 360)], [txn(2, "exchange", "BTC", 1, "deposit")]),
    ]);
    expect(result.totals).toEqual({ priceEffect: 160, flowEffect: 0, residual: 0, totalChange: 160 });
    expect(result.entries[0]).toMatchObject({ symbol: "BTC", wallet: "exchange", priceEffect: 160, flowEffect: 0, residual: 0 });
    expect(result.startValue).toBe(200);
    expect(result.endValue).toBe(360);
  });

  it("uses transaction signs for sales and leaves unmatched snapshot quantity in residual", () => {
    const result = attributeSnapshots([
      snapshot(1, [asset(1, "w", "BTC", 3, 300)]),
      snapshot(2, [asset(2, "w", "BTC", 1, 120)], [txn(2, "w", "BTC", 1, "sell")]),
    ]);
    expect(result.totals).toEqual({ priceEffect: -60, flowEffect: 0, residual: -120, totalChange: -180 });
  });

  it("attributes new assets and full disposals at the available price", () => {
    const result = attributeSnapshots([
      snapshot(1, [asset(1, "w", "OLD", 2, 100)]),
      snapshot(2, [asset(2, "w", "NEW", 3, 90)], [txn(2, "w", "OLD", 2, "withdraw"), txn(2, "w", "NEW", 3, "buy")]),
    ]);
    expect(result.totals).toEqual({ priceEffect: 90, flowEffect: 0, residual: -100, totalChange: -10 });
  });

  it("captures stablecoin depegs and excludes blacklisted symbols case insensitively", () => {
    const result = attributeSnapshots([
      snapshot(1, [asset(1, "w", "USDT", 100, 100), asset(1, "w", "BAD", 1, 10)]),
      snapshot(2, [asset(2, "w", "USDT", 100, 98), asset(2, "w", "BAD", 1, 20)]),
    ], ["bad"]);
    expect(result.totals.priceEffect).toBeCloseTo(-2);
    expect(result.totals.residual).toBeCloseTo(0);
    expect(result.totals.totalChange).toBe(-2);
    expect(result.entries.map((entry) => entry.symbol)).toEqual(["USDT"]);
  });

  it("sums interval effects and preserves the value-change invariant by every grouping", () => {
    const result = attributeSnapshots([
      snapshot(1, [asset(1, "ex", "ABC", 1, 100), asset(1, "chain", "ABC", 1, 100), asset(1, "broker", "ABC", 1, 50, "stock")]),
      snapshot(2, [asset(2, "ex", "ABC", 2, 240), asset(2, "chain", "ABC", 1, 90), asset(2, "broker", "ABC", 1, 60, "stock")], [txn(2, "ex", "ABC", 1, "buy")]),
      snapshot(3, [asset(3, "ex", "ABC", 2, 220), asset(3, "chain", "ABC", 1, 95), asset(3, "broker", "ABC", 1, 55, "stock")]),
    ]);
    expect(result.totals).toEqual({ priceEffect: 120, flowEffect: 0, residual: 0, totalChange: 120 });
    expect(result.totals.totalChange).toBeCloseTo(result.endValue - result.startValue);
    const aliases = { ex: { alias: "Main", type: "Binance" }, chain: { alias: "Main", type: "ERC20" }, broker: { alias: "Stocks", type: "IBKR" } };
    for (const dimension of ["coin", "source", "wallet", "assetType"] as const) {
      const groups = groupAttribution(result.entries, dimension, aliases);
      expect(groups.reduce((sum, group) => sum + group.totalChange, 0)).toBeCloseTo(120);
      expect(groups.reduce((sum, group) => sum + group.priceEffect + group.flowEffect + group.residual, 0)).toBeCloseTo(120);
    }
    expect(groupAttribution(result.entries, "coin", aliases).map((group) => group.label).sort()).toEqual(["ABC", "ABC · stock"]);
    expect(groupAttribution(result.entries, "source", aliases).map((group) => group.label).sort()).toEqual(["Binance", "ERC20", "IBKR"]);
    expect(groupAttribution(result.entries, "wallet", aliases).map((group) => group.label).sort()).toEqual(["Main (Binance)", "Main (ERC20)", "Stocks (IBKR)"]);
  });

  it("has no change when fewer than two snapshots exist", () => {
    expect(attributeSnapshots([snapshot(1, [asset(1, "w", "BTC", 1, 100)])]).entries).toEqual([]);
  });

  it("does not expose a wallet hash when its alias is unavailable", () => {
    const hash = "0123456789abcdef0123456789abcdef";
    const groups = groupAttribution([
      { symbol: "BTC", assetType: "crypto", wallet: hash, priceEffect: 10, flowEffect: 0, residual: 0, totalChange: 10 },
    ], "wallet");
    expect(groups[0].label).toBe("unknown");
  });

  it("leaves a sign-mismatched transaction quantity unexplained", () => {
    const result = attributeSnapshots([
      snapshot(1, [asset(1, "w", "BTC", 1, 100)]),
      snapshot(2, [asset(2, "w", "BTC", 2, 240)], [txn(2, "w", "BTC", 1, "sell")]),
    ]);
    expect(result.totals).toEqual({ priceEffect: -100, flowEffect: 0, residual: 240, totalChange: 140 });
  });

  it("attributes the rise from a zero starting value to market effect", () => {
    const result = attributeSnapshots([
      snapshot(1, [asset(1, "w", "BTC", 1, 0)]),
      snapshot(2, [asset(2, "w", "BTC", 1, 100)]),
    ]);
    expect(result.totals).toEqual({ priceEffect: 100, flowEffect: 0, residual: 0, totalChange: 100 });
  });

  it("matches transaction and asset symbols regardless of case", () => {
    const result = attributeSnapshots([
      snapshot(1, [asset(1, "w", "btc", 1, 100)]),
      snapshot(2, [asset(2, "w", "BtC", 2, 240)], [txn(2, "w", "BTC", 1, "buy")]),
    ]);
    expect(result.totals).toEqual({ priceEffect: 140, flowEffect: 0, residual: 0, totalChange: 140 });
  });

  it("uses the selected stock label in coin groups", () => {
    const groups = groupAttribution([
      { symbol: "ABC", assetType: "stock", wallet: "w", priceEffect: 10, flowEffect: 0, residual: 0, totalChange: 10 },
    ], "coin", {}, "股票");
    expect(groups[0].label).toBe("ABC · 股票");
  });
});
