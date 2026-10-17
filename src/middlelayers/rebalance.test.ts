import { describe, expect, it } from "vitest";
import {
  calculateRebalance,
  normalizeTargets,
  suggestionsToCsv,
  validateProfile,
  type RebalanceHolding,
  type RebalanceTarget,
} from "./rebalance";
import en from "@/i18n/locales/en.json";

const holdings: RebalanceHolding[] = [
  { symbol: "BTC", assetType: "crypto", amount: 2, value: 60, price: 30 },
  { symbol: "ETH", assetType: "crypto", amount: 1, value: 20, price: 20 },
];
const half: RebalanceTarget[] = [
  { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
  { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
];

describe("rebalance calculator", () => {
  it("matches a target with draft whitespace to its existing holding", () => {
    const result = calculateRebalance([
      { symbol: "BTC", assetType: "crypto", amount: 1, value: 60, price: 60 },
      { symbol: "ETH", assetType: "crypto", amount: 1, value: 40, price: 40 },
    ], [
      { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
      { kind: "asset", assetType: "crypto", symbol: "ETH ", percent: 50 },
    ]);
    expect(result.rows.map((row) => [row.symbol, row.tradeValue])).toEqual([
      ["BTC", -10], ["ETH", 10],
    ]);
  });
  it("funds hand-computed full rebalance trades and accounts for injected cash exactly", () => {
    const result = calculateRebalance(holdings, half, { mode: "full", injectedCash: 20 });
    expect(result.rows.filter((row) => row.kind === "asset").map((row) => ({
      symbol: row.symbol,
      currentPercent: row.currentPercent,
      targetPercent: row.targetPercent,
      deviationPercent: row.deviationPercent,
      tradeValue: row.tradeValue,
      tradeQuantity: row.tradeQuantity,
    }))).toEqual([
      { symbol: "BTC", currentPercent: 75, targetPercent: 50, deviationPercent: 25, tradeValue: -10, tradeQuantity: -0.33333333 },
      { symbol: "ETH", currentPercent: 25, targetPercent: 50, deviationPercent: -25, tradeValue: 30, tradeQuantity: 1.5 },
    ]);
    expect(result.rows.reduce((sum, row) => sum + row.tradeValue, 0)).toBe(20);
  });

  it("spends only available injected cash in buys-only mode", () => {
    const result = calculateRebalance(holdings, half, { mode: "buys", injectedCash: 20 });
    expect(result.rows.map((row) => [row.symbol, row.tradeValue])).toEqual([
      ["BTC", 0], ["ETH", 20],
    ]);
  });

  it("invests new cash when the existing holdings are already on target", () => {
    const result = calculateRebalance([
      { symbol: "BTC", assetType: "crypto", amount: 1, value: 50, price: 50 },
      { symbol: "ETH", assetType: "crypto", amount: 1, value: 50, price: 50 },
    ], half, { mode: "buys", injectedCash: 20 });
    expect(result.rows.map((row) => [row.symbol, row.tradeValue])).toEqual([
      ["BTC", 10], ["ETH", 10],
    ]);
  });

  it("leaves deviations within tolerance and trades below the minimum untouched", () => {
    const near = [
      { symbol: "BTC", assetType: "crypto" as const, amount: 1, value: 54, price: 54 },
      { symbol: "ETH", assetType: "crypto" as const, amount: 1, value: 46, price: 46 },
    ];
    expect(calculateRebalance(near, half, { tolerancePercent: 5 }).rows.every((r) => r.tradeValue === 0)).toBe(true);
    expect(calculateRebalance(near, half, { minimumTradeValue: 5 }).rows.every((r) => r.tradeValue === 0)).toBe(true);
  });

  it("reserves unspent cash while preserving the cash flow identity", () => {
    const result = calculateRebalance(holdings, half, {
      mode: "full", injectedCash: 20, minimumTradeValue: 25,
    });
    expect(result.rows.map((row) => [row.symbol, row.tradeValue])).toEqual([
      ["BTC", 0], ["ETH", 0], ["CASH", 20],
    ]);
    expect(result.rows.reduce((sum, row) => sum + row.tradeValue, 0)).toBe(20);
  });

  it("splits type targets among held assets and gives explicit coin targets priority", () => {
    const result = calculateRebalance([
      ...holdings,
      { symbol: "AAPL", assetType: "stock", amount: 1, value: 20, price: 20 },
    ], [
      { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
      { kind: "type", assetType: "crypto", percent: 30 },
      { kind: "type", assetType: "stock", percent: 20 },
    ]);
    expect(result.rows.map((row) => [row.symbol, row.targetPercent, row.tradeValue])).toEqual([
      ["BTC", 50, -10], ["ETH", 30, 10], ["AAPL", 20, 0],
    ]);
  });

  it("treats stablecoins as cash when a cash bucket is targeted", () => {
    const result = calculateRebalance([
      { symbol: "BTC", assetType: "crypto", amount: 2, value: 60, price: 30 },
      { symbol: "USDC", assetType: "crypto", amount: 40, value: 40, price: 1 },
    ], [
      { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
      { kind: "cash", percent: 50 },
    ]);
    expect(result.rows.map((row) => [row.symbol, row.targetPercent, row.tradeValue])).toEqual([
      ["BTC", 50, -10], ["USDC", 40, 0], ["CASH", 10, 10],
    ]);
  });

  it("sells only the stablecoin surplus to fund a full cash-bucket rebalance", () => {
    const result = calculateRebalance([
      { symbol: "USDT", assetType: "crypto", amount: 80, value: 80, price: 1 },
      { symbol: "BTC", assetType: "crypto", amount: 1, value: 20, price: 20 },
    ], [
      { kind: "cash", percent: 50 },
      { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
    ], { mode: "full" });
    expect(result.rows.map((row) => [row.symbol, row.tradeValue, row.tradeQuantity])).toEqual([
      ["USDT", -30, -30],
      ["BTC", 30, 1.5],
    ]);
  });

  it("keeps an unpriced target from causing sales of other assets", () => {
    const result = calculateRebalance([
      { symbol: "XYZ", assetType: "crypto", amount: 5, value: 0, price: 0 },
      { symbol: "BTC", assetType: "crypto", amount: 1, value: 100, price: 100 },
    ], [
      { kind: "asset", assetType: "crypto", symbol: "XYZ", percent: 50 },
      { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
    ], { mode: "full", injectedCash: 10 });
    expect(result.rows.map((row) => [row.symbol, row.tradeValue, row.note])).toEqual([
      ["XYZ", 0, "missing-price"],
      ["BTC", 0, undefined],
      ["CASH", 10, "cash-reserve"],
    ]);
    expect(result.warnings).toEqual([{ kind: "missing-price-target" }]);
    expect(result.rows[0].tradeQuantity).toBeNull();
  });

  it("keeps a missing-price note when the holding is below the ignore threshold", () => {
    const result = calculateRebalance([
      { symbol: "XYZ", assetType: "crypto", amount: 1000, value: 0, price: 0 },
      { symbol: "BTC", assetType: "crypto", amount: 1, value: 100, price: 100 },
    ], [
      { kind: "asset", assetType: "crypto", symbol: "XYZ", percent: 50 },
      { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
    ], { ignoreBelowValue: 10 });
    expect(result.rows[0]).toMatchObject({ symbol: "XYZ", tradeValue: 0, note: "missing-price" });
  });

  it("buys an unheld explicit target despite the ignore threshold", () => {
    const withThreshold = calculateRebalance([
      { symbol: "BTC", assetType: "crypto", amount: 1, value: 100, price: 100 },
    ], half, { ignoreBelowValue: 10 });
    expect(withThreshold.rows.map((row) => [row.symbol, row.tradeValue])).toEqual([
      ["BTC", -50], ["ETH", 50],
    ]);
  });

  it("suggests a base-currency buy for an unheld target without inventing a quantity", () => {
    const result = calculateRebalance(
      [{ symbol: "BTC", assetType: "crypto", amount: 1, value: 100, price: 100 }],
      [
        { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
        { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
      ],
    );
    expect(result.rows.map((row) => [row.symbol, row.tradeValue, row.tradeQuantity])).toEqual([
      ["BTC", -50, -0.5],
      ["ETH", 50, null],
    ]);
    expect(result.rows.reduce((sum, row) => sum + row.tradeValue, 0)).toBe(0);
  });

  it("identifies a type target without holdings while preserving the cash flow identity", () => {
    const result = calculateRebalance(
      [{ symbol: "BTC", assetType: "crypto", amount: 1, value: 100, price: 100 }],
      [
        { kind: "type", assetType: "crypto", percent: 50 },
        { kind: "type", assetType: "stock", percent: 50 },
      ],
    );
    expect(result.warnings).toEqual([{ kind: "empty-type", assetType: "stock" }]);
    expect(result.rows.map((row) => [row.symbol, row.tradeValue])).toEqual([
      ["BTC", -50], ["CASH", 50],
    ]);
  });

  it("uses new cash before considering stablecoin sales within a cash target", () => {
    const result = calculateRebalance([
      { symbol: "USDT", assetType: "crypto", amount: 50, value: 50, price: 1 },
      { symbol: "BTC", assetType: "crypto", amount: 1, value: 50, price: 50 },
    ], [
      { kind: "cash", percent: 50 },
      { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
    ], { injectedCash: 100 });
    expect(result.rows.map((row) => [row.symbol, row.tradeValue])).toEqual([
      ["USDT", 0], ["BTC", 50], ["CASH", 50],
    ]);
  });

  it("normalizes weights to exactly 100 and rejects invalid saved profiles", () => {
    expect(normalizeTargets([
      { ...half[0], percent: 1 },
      { ...half[1], percent: 2 },
    ]).map((t) => t.percent)).toEqual([33.33, 66.67]);
    expect(() => validateProfile({ targets: [{ ...half[0], percent: 90 }], tolerancePercent: 5 })).toThrow(/100/);
    expect(() => validateProfile({ targets: half, tolerancePercent: -1 })).toThrow(/tolerance/);
    expect(() => validateProfile({ targets: [{ kind: "alien", percent: 100 } as never], tolerancePercent: 0 })).toThrow(/kind/);
  });

  it("keeps an equal-weight preset equal within one hundredth of a percent", () => {
    const draft: RebalanceTarget[] = ["A", "B", "C", "D", "E", "F"].map((symbol) => ({
      kind: "asset", assetType: "crypto", symbol, percent: 1,
    }));
    expect(normalizeTargets(draft).map((target) => target.percent)).toEqual([
      16.67, 16.67, 16.67, 16.67, 16.66, 16.66,
    ]);
  });

  it("exports localized trade values and protects spreadsheet cells", () => {
    const result = calculateRebalance([
      { symbol: "=BTC", assetType: "crypto", amount: 1, value: 60, price: 60 },
      { symbol: "ETH", assetType: "crypto", amount: 1, value: 40, price: 40 },
    ], [
      { kind: "asset", assetType: "crypto", symbol: "=BTC", percent: 50 },
      { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
    ]);
    const csv = suggestionsToCsv(result, "USD", (key) => (en as Record<string, string>)[key] ?? key);
    expect(csv).toContain('"\'=BTC","60.00","50.00","10.00","Sell","-10.00"');
    expect(csv).toContain('"ETH","40.00","50.00","-10.00","Buy","10.00"');
    expect(csv.startsWith("\uFEFF\"Symbol\"")).toBe(true);
  });

  it("exports small quantities in decimal notation", () => {
    const result = calculateRebalance([
      { symbol: "BTC", assetType: "crypto", amount: 0.0000001, value: 10, price: 100000000 },
      { symbol: "ETH", assetType: "crypto", amount: 9, value: 90, price: 10 },
    ], [
      { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 0 },
      { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 100 },
    ]);
    const csv = suggestionsToCsv(result, "USD", (key) => (en as Record<string, string>)[key] ?? key);
    expect(csv).toContain('"BTC","10.00","0.00","10.00","Sell","-10.00","-0.00000010"');
  });

  it("redacts embedded credentials from trade CSV", () => {
    const result = calculateRebalance([
      { symbol: "sk-abcdefghijklmnop1234567890", assetType: "crypto", amount: 1, value: 100, price: 100 },
    ], [{ kind: "asset", assetType: "crypto", symbol: "sk-abcdefghijklmnop1234567890", percent: 100 }]);
    const csv = suggestionsToCsv(result, "USD", (key) => (en as Record<string, string>)[key] ?? key);
    expect(csv.toLowerCase()).not.toContain("sk-abcdefghijklmnop1234567890");
  });
});
