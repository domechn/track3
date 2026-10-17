import { describe, expect, it } from "vitest";
import { attributeSnapshots, groupAttribution } from "./charts-attribution";
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

// A zero price effect or a missing transaction check would fail these hand calculations.
describe("attribution from consecutive snapshots", () => {
  it("separates a price rise and a transaction-backed deposit", () => {
    const result = attributeSnapshots([
      snapshot(1, [asset(1, "exchange", "BTC", 2, 200)]),
      snapshot(2, [asset(2, "exchange", "BTC", 3, 360)], [txn(2, "exchange", "BTC", 1, "deposit")]),
    ]);
    expect(result.totals).toEqual({ priceEffect: 40, flowEffect: 120, residual: 0, totalChange: 160 });
    expect(result.entries[0]).toMatchObject({ symbol: "BTC", wallet: "exchange", priceEffect: 40, flowEffect: 120, residual: 0 });
    expect(result.startValue).toBe(200);
    expect(result.endValue).toBe(360);
  });

  it("uses transaction signs for sales and leaves unmatched snapshot quantity in residual", () => {
    const result = attributeSnapshots([
      snapshot(1, [asset(1, "w", "BTC", 3, 300)]),
      snapshot(2, [asset(2, "w", "BTC", 1, 120)], [txn(2, "w", "BTC", 1, "sell")]),
    ]);
    expect(result.totals).toEqual({ priceEffect: 60, flowEffect: -120, residual: -120, totalChange: -180 });
  });

  it("attributes new assets and full disposals at the available price", () => {
    const result = attributeSnapshots([
      snapshot(1, [asset(1, "w", "OLD", 2, 100)]),
      snapshot(2, [asset(2, "w", "NEW", 3, 90)], [txn(2, "w", "OLD", 2, "withdraw"), txn(2, "w", "NEW", 3, "buy")]),
    ]);
    expect(result.totals).toEqual({ priceEffect: 0, flowEffect: -10, residual: 0, totalChange: -10 });
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
    expect(result.totals).toEqual({ priceEffect: 0, flowEffect: 120, residual: 0, totalChange: 120 });
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
    expect(result.totals).toEqual({ priceEffect: 20, flowEffect: 0, residual: 120, totalChange: 140 });
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
    expect(result.totals).toEqual({ priceEffect: 20, flowEffect: 120, residual: 0, totalChange: 140 });
  });

  it("uses the selected stock label in coin groups", () => {
    const groups = groupAttribution([
      { symbol: "ABC", assetType: "stock", wallet: "w", priceEffect: 10, flowEffect: 0, residual: 0, totalChange: 10 },
    ], "coin", {}, "股票");
    expect(groups[0].label).toBe("ABC · 股票");
  });
});
