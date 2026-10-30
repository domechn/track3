import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fixture from "./charts-profit-test-fixtures";

vi.mock("./datafetch/utils/cache", async (original) => {
  const real = await original<typeof import("./datafetch/utils/cache")>();
  return {
    ...real,
    getLocalStorageCacheInstance: () => ({
      getCache: () => undefined,
      setCache: () => {},
      clearCache: () => {},
    }),
    getCacheGroupEpoch: () => 0,
  };
});
vi.mock("./entities/assets", () => ({ ASSET_HANDLER: fixture.assetHandler }));
vi.mock("./entities/transactions", () => ({ TRANSACTION_HANDLER: fixture.txnHandler }));

import { calculateTotalProfit } from "./charts-profit";
import { generateTransactions } from "./charts-refresh";

const generate = generateTransactions;
const holding = (wallet: string, amount: number, price: number, symbol = "BTC") =>
  ({ wallet, amount, price, symbol });
const range = (start: string, end: string) => ({ start: new Date(start), end: new Date(end) });
const year = range("2024-01-01T00:00:00.000Z", "2024-12-31T23:59:59.999Z");

beforeEach(() => fixture.reset());

describe("numeric profit from refresh snapshots", () => {
  it("counts a held BTC with no February transaction: 1 × (300 − 200) = 100", async () => {
    fixture.load([
      { at: "2024-01-15T00:00:00.000Z", holdings: [holding("w1", 1, 100)] },
      { at: "2024-02-01T00:00:00.000Z", holdings: [holding("w1", 1, 200)] },
      { at: "2024-02-28T00:00:00.000Z", holdings: [holding("w1", 1, 300)] },
    ], generate);
    const result = await calculateTotalProfit(range("2024-02-01T00:00:00.000Z", "2024-02-29T23:59:59.999Z"));
    expect(result.total).toBe(100);
    expect(result.coins.map((coin) => coin.symbol)).toEqual(["BTC"]);
  });

  it("uses the last snapshot before February when the first February refresh is late", async () => {
    fixture.load([
      { at: "2024-01-31T12:00:00.000Z", holdings: [holding("w1", 1, 100)] },
      { at: "2024-02-01T12:00:00.000Z", holdings: [holding("w1", 1, 150)] },
      { at: "2024-02-28T12:00:00.000Z", holdings: [holding("w1", 1, 160)] },
    ], generate);
    const result = await calculateTotalProfit(range("2024-02-01T00:00:00.000Z", "2024-02-29T23:59:59.999Z"));
    expect(result.total).toBe(60);
    expect(result.coins[0].costAvgPrice).toBe(100);
  });

  it("falls back to the first snapshot inside a range with no earlier snapshot", async () => {
    fixture.load([
      { at: "2024-02-10T00:00:00.000Z", holdings: [holding("w1", 2, 100)] },
      { at: "2024-02-28T00:00:00.000Z", holdings: [holding("w1", 2, 140)] },
    ], generate);
    expect((await calculateTotalProfit(range("2024-02-01T00:00:00.000Z", "2024-02-29T23:59:59.999Z"))).total).toBe(80);
  });

  it("uses the edited first-snapshot buy price instead of its market price", async () => {
    fixture.load([
      { at: "2024-01-01T00:00:00.000Z", holdings: [holding("w1", 1, 100)] },
      { at: "2024-01-02T00:00:00.000Z", holdings: [holding("w1", 1, 200)] },
    ], generate, (txn) => { if (txn.txnCreatedAt.startsWith("2024-01-01")) txn.price = 50; });
    const result = await calculateTotalProfit(year, "BTC", "crypto");
    expect(result.total).toBe(150);
    expect(result.coins[0]).toMatchObject({ buyAmount: 1, costAvgPrice: 50, value: 150 });
  });

  it("twelve monthly price-only profits sum to the year for several price paths", async () => {
    for (const { amount, monthlyChange, expected } of [
      { amount: 1, monthlyChange: 1, expected: 12 },
      { amount: 2, monthlyChange: 3, expected: 72 },
      { amount: 3, monthlyChange: -1, expected: -36 },
    ]) {
      fixture.load([
        { at: "2024-01-01T00:00:00.000Z", holdings: [holding("w1", amount, 100)] },
        ...Array.from({ length: 12 }, (_, month) => ({
          at: new Date(Date.UTC(2024, month + 1, 0, 12)).toISOString(),
          holdings: [holding("w1", amount, 100 + (month + 1) * monthlyChange)],
        })),
      ], generate);
      const months = await Promise.all(Array.from({ length: 12 }, (_, month) =>
        calculateTotalProfit({
          start: new Date(Date.UTC(2024, month, 1)),
          end: new Date(Date.UTC(2024, month + 1, 1) - 1),
        })));
      expect(months.map((result) => result.total)).toEqual(Array(12).fill(amount * monthlyChange));
      expect(months.reduce((sum, result) => sum + (result.total ?? 0), 0)).toBe(expected);
      expect((await calculateTotalProfit(year)).total).toBe(expected);
    }
  });

  it("month and year profits exclude an April deposit at its price", async () => {
    fixture.load([
      { at: "2024-01-01T00:00:00.000Z", holdings: [holding("w1", 1, 100)] },
      ...Array.from({ length: 12 }, (_, month) => ({
        at: new Date(Date.UTC(2024, month + 1, 0, 12)).toISOString(),
        holdings: [holding("w1", month < 3 ? 1 : 2, 110 + month * 10)],
      })),
    ], generate, (txn) => {
      if (txn.txnCreatedAt.startsWith("2024-04-30")) txn.txnType = "deposit";
    });
    const months = await Promise.all(Array.from({ length: 12 }, (_, month) =>
      calculateTotalProfit({
        start: new Date(Date.UTC(2024, month, 1)),
        end: new Date(Date.UTC(2024, month + 1, 1) - 1),
      })));
    expect(months.map((result) => result.total)).toEqual([10, 10, 10, 10, 20, 20, 20, 20, 20, 20, 20, 20]);
    expect(months.reduce((sum, result) => sum + (result.total ?? 0), 0)).toBe(200);
    expect((await calculateTotalProfit(year)).total).toBe(200);
  });

  it("does not list a zero balance coin with no transaction", async () => {
    fixture.load([
      { at: "2024-01-01T00:00:00.000Z", holdings: [holding("w1", 0, 100)] },
      { at: "2024-01-02T00:00:00.000Z", holdings: [holding("w1", 0, 200)] },
    ], generate);
    expect((await calculateTotalProfit(year)).coins).toEqual([]);
  });

  it("does not count a same-snapshot wallet transfer as a buy or sale", async () => {
    fixture.load([
      { at: "2024-01-01T00:00:00.000Z", holdings: [holding("w1", 1, 100)] },
      { at: "2024-01-02T00:00:00.000Z", holdings: [holding("w1", 1, 200)] },
      { at: "2024-01-03T00:00:00.000Z", holdings: [holding("w2", 1, 200)] },
    ], generate);
    const result = await calculateTotalProfit(year, "BTC", "crypto");
    expect(result.total).toBe(100);
    expect(result.coins[0]).toMatchObject({ buyAmount: 1, sellAmount: 0, costAvgPrice: 100, sellAvgPrice: 0 });
  });

  it("prices a relabeled deposit at its acquisition price", async () => {
    fixture.load([
      { at: "2024-01-01T00:00:00.000Z", holdings: [holding("w1", 1, 100)] },
      { at: "2024-01-02T00:00:00.000Z", holdings: [holding("w1", 2, 150)] },
    ], generate, (txn) => { if (txn.txnCreatedAt.startsWith("2024-01-02")) txn.txnType = "deposit"; });
    const result = await calculateTotalProfit(year, "BTC", "crypto");
    expect(result.total).toBe(50);
    expect(result.coins[0]).toMatchObject({ buyAmount: 2, costAvgPrice: 125 });
  });

  it("a first-snapshot deposit contributes zero profit", async () => {
    fixture.load([
      { at: "2024-01-01T00:00:00.000Z", holdings: [holding("w1", 1, 100)] },
    ], generate, (txn) => { txn.txnType = "deposit"; });
    expect((await calculateTotalProfit(year, "BTC", "crypto")).total).toBe(0);
  });

  it("a deposit at the range start leaves the prior ten coins in the baseline", async () => {
    fixture.load([
      { at: "2023-12-20T00:00:00.000Z", holdings: [holding("w1", 10, 100)] },
      { at: "2024-01-01T00:00:00.000Z", holdings: [holding("w1", 11, 100)] },
      { at: "2024-01-10T00:00:00.000Z", holdings: [holding("w1", 11, 200)] },
    ], generate, (txn) => { if (txn.txnCreatedAt.startsWith("2024-01-01")) txn.txnType = "deposit"; });
    const result = await calculateTotalProfit(year, "BTC", "crypto");
    expect(result.total).toBe(1100);
    expect(result.coins[0].buyAmount).toBe(11);
  });

  it("a zero-price acquisition gaining 50 has undefined finite return", async () => {
    fixture.load([
      { at: "2024-01-01T00:00:00.000Z", holdings: [holding("w1", 1, 0)] },
      { at: "2024-01-02T00:00:00.000Z", holdings: [holding("w1", 1, 50)] },
    ], generate);
    const result = await calculateTotalProfit(year, "BTC", "crypto");
    expect(result.total).toBe(50);
    expect(result.coins[0].costAvgPrice).toBe(0);
    expect(result.coins[0].percentage).toBeUndefined();
  });

  it("shows a zero return when both cost and profit are zero", async () => {
    fixture.load([
      { at: "2024-01-01T00:00:00.000Z", holdings: [holding("w1", 1, 0)] },
      { at: "2024-01-02T00:00:00.000Z", holdings: [holding("w1", 1, 0)] },
    ], generate);
    const result = await calculateTotalProfit(year, "BTC", "crypto");
    expect(result.coins[0].percentage).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it("omits a zero-balance row with only a withdrawal transaction", async () => {
    fixture.load([
      { at: "2024-01-01T00:00:00.000Z", holdings: [holding("w1", 0, 100)] },
      { at: "2024-01-02T00:00:00.000Z", holdings: [holding("w1", 0, 200)] },
    ], generate);
    fixture.db.txns.push({
      id: 99, assetID: fixture.db.assets[0].id, uuid: "u0", assetType: "crypto",
      wallet: "w1", symbol: "BTC", amount: 1, price: 100, txnType: "withdraw",
      txnCreatedAt: "2024-01-01T00:00:00.000Z",
      createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z",
    });
    expect((await calculateTotalProfit(year, "BTC", "crypto")).coins).toEqual([]);
  });

  it("a refresh at 23:59:59.999 contributes its 100 price gain to January", async () => {
    fixture.load([
      { at: "2024-01-01T00:00:00.000Z", holdings: [holding("w1", 1, 100)] },
      { at: "2024-01-31T23:59:59.999Z", holdings: [holding("w1", 1, 200)] },
    ], generate);
    expect((await calculateTotalProfit(range("2024-01-01T00:00:00.000Z", "2024-01-31T23:59:59.999Z"))).total).toBe(100);
  });
});
