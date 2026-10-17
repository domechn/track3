import { describe, expect, it } from "vitest";
import { calculateCostBasis, fromStoredTransactions } from "./cost-basis";
import type { CostBasisEvent } from "./cost-basis";

const at = (day: string) => `${day}T00:00:00.000Z`;
const event = (
  id: string,
  date: string,
  type: CostBasisEvent["type"],
  amount: number,
  price: number,
  rest: Partial<CostBasisEvent> = {},
): CostBasisEvent => ({
  id, date: at(date), type, assetType: "crypto", symbol: "BTC",
  wallet: "a", amount, price, ...rest,
});

describe("calculateCostBasis", () => {
  const trades = [
    event("a", "2024-01-01", "buy", 2, 100),
    event("b", "2024-02-01", "buy", 1, 200),
    event("c", "2025-02-01", "sell", 2, 300),
  ];

  it.each([
    ["FIFO", 200, 400, ["a"]],
    ["LIFO", 300, 300, ["b", "a"]],
    ["HIFO", 300, 300, ["b", "a"]],
    ["AVERAGE", 800 / 3, 1000 / 3, ["a"]],
  ] as const)("calculates %s partial disposal with hand checked basis", (method, basis, gain, ids) => {
    const result = calculateCostBasis(trades, { method, prices: { "crypto:BTC": 350 } });
    expect(result.disposals.reduce((sum, row) => sum + row.costBasis, 0)).toBeCloseTo(basis);
    expect(result.disposals.reduce((sum, row) => sum + row.gainLoss, 0)).toBeCloseTo(gain);
    expect(result.disposals.map((row) => row.lotId)).toEqual(ids);
    expect(result.disposals.reduce((sum, row) => sum + row.proceeds, 0)).toBeCloseTo(600);
    expect(result.disposals.reduce((sum, row) => sum + row.costBasis + row.gainLoss, 0)).toBeCloseTo(600);
    expect(result.openLots.reduce((sum, lot) => sum + lot.amount, 0)).toBeCloseTo(1);
    expect(result.openLots.reduce((sum, lot) => sum + lot.costBasis, 0) + basis).toBeCloseTo(400);
  });

  it("includes buy fees in basis and sell fees in net proceeds", () => {
    const result = calculateCostBasis([
      event("a", "2024-01-01", "buy", 2, 100, { fee: 10 }),
      event("b", "2024-01-02", "sell", 1, 150, { fee: 5 }),
    ], { method: "FIFO" });
    expect(result.disposals[0]).toMatchObject({
      proceeds: 145, costBasis: 105, gainLoss: 40,
    });
    expect(result.openLots[0].costBasis).toBe(105);
    expect(result.disposals[0].costBasis + result.disposals[0].gainLoss).toBeCloseTo(result.disposals[0].proceeds);
    expect(result.disposals[0].costBasis + result.openLots[0].costBasis).toBeCloseTo(210);
  });

  it("preserves lots through own-wallet transfers", () => {
    const result = calculateCostBasis([
      event("buy", "2024-01-01", "buy", 1, 100),
      event("out", "2024-05-01", "transfer-out", 1, 120, { wallet: "a", transferId: "move" }),
      event("in", "2024-05-01", "transfer-in", 1, 120, { wallet: "b", transferId: "move" }),
      event("sell", "2025-02-01", "sell", 1, 200, { wallet: "b" }),
    ], { method: "FIFO" });
    expect(result.disposals).toHaveLength(1);
    expect(result.disposals[0]).toMatchObject({
      lotId: "buy", costBasis: 100, gainLoss: 100, term: "long",
    });
    expect(result.warnings).toEqual([]);
  });

  it("matches transfer legs with normalized symbols", () => {
    const result = calculateCostBasis([
      event("buy", "2024-01-01", "buy", 1, 100),
      event("out", "2024-05-01", "transfer-out", 1, 120, { symbol: " BTC ", wallet: "a", transferId: "move" }),
      event("in", "2024-05-01", "transfer-in", 1, 120, { symbol: "btc", wallet: "b", transferId: "move" }),
    ], { method: "FIFO" });
    expect(result.warnings).toEqual([]);
    expect(result.openLots).toEqual([expect.objectContaining({ id: "buy", amount: 1 })]);
  });

  it("removes a transfer network fee without realizing a gain or resetting acquisition", () => {
    const stored: Parameters<typeof fromStoredTransactions>[0] = [
      { id: 1, uuid: "buy", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 100, txnType: "buy", txnCreatedAt: at("2023-01-01") },
      { id: 2, uuid: "move", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 500, txnType: "sell", txnCreatedAt: at("2024-02-01") },
      { id: 3, uuid: "move", assetType: "crypto", symbol: "BTC", wallet: "b", amount: 0.9995, price: 500, txnType: "buy", txnCreatedAt: at("2024-02-01") },
      { id: 4, uuid: "sell", assetType: "crypto", symbol: "BTC", wallet: "b", amount: 0.9995, price: 600, txnType: "sell", txnCreatedAt: at("2024-03-01") },
    ];
    const result = calculateCostBasis(fromStoredTransactions(stored), { method: "FIFO" });
    expect(result.disposals).toHaveLength(1);
    expect(result.disposals[0]).toMatchObject({
      eventId: "4", lotId: "1", acquiredAt: at("2023-01-01"),
      amount: 0.9995, costBasis: 99.95, term: "long",
    });
    expect(result.openLots).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("preserves basis for a relabeled withdrawal and later deposit in another wallet", () => {
    const stored: Parameters<typeof fromStoredTransactions>[0] = [
      { id: 1, uuid: "buy", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 100, txnType: "buy", txnCreatedAt: at("2024-01-01") },
      { id: 2, uuid: "first-refresh", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 150, txnType: "withdraw", txnCreatedAt: at("2024-02-01") },
      { id: 3, uuid: "later-refresh", assetType: "crypto", symbol: "BTC", wallet: "b", amount: 0.999, price: 160, txnType: "deposit", txnCreatedAt: at("2024-02-02") },
      { id: 4, uuid: "sale", assetType: "crypto", symbol: "BTC", wallet: "b", amount: 0.999, price: 200, txnType: "sell", txnCreatedAt: at("2025-02-02") },
    ];
    const converted = fromStoredTransactions(stored);
    expect(converted.slice(1, 3)).toEqual([
      expect.objectContaining({ type: "transfer-out", transferId: "2:3" }),
      expect.objectContaining({ type: "transfer-in", transferId: "2:3" }),
    ]);
    const result = calculateCostBasis(converted, { method: "FIFO" });
    expect(result.disposals).toEqual([
      expect.objectContaining({ eventId: "4", lotId: "1", amount: 0.999, costBasis: 99.9 }),
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("does not pair a deposit months after a withdrawal", () => {
    const stored: Parameters<typeof fromStoredTransactions>[0] = [
      { id: 1, uuid: "buy", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 100, txnType: "buy", txnCreatedAt: at("2024-01-01") },
      { id: 2, uuid: "withdrawal", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 150, txnType: "withdraw", txnCreatedAt: at("2024-02-01") },
      { id: 3, uuid: "deposit", assetType: "crypto", symbol: "BTC", wallet: "b", amount: 1, price: 160, txnType: "deposit", txnCreatedAt: at("2024-05-01") },
    ];
    const result = calculateCostBasis(fromStoredTransactions(stored), { method: "FIFO" });
    expect(result.openLots).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toEqual(["unknown-disposal", "unknown-basis"]);
  });

  it("does not pair a deposit that precedes a withdrawal in actual time", () => {
    const stored: Parameters<typeof fromStoredTransactions>[0] = [
      { id: 1, uuid: "out", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 100, txnType: "withdraw", txnCreatedAt: "2024-01-01T00:00:00Z" },
      { id: 2, uuid: "in", assetType: "crypto", symbol: "BTC", wallet: "b", amount: 1, price: 100, txnType: "deposit", txnCreatedAt: "2024-01-01T01:00:00+05:00" },
    ];
    expect(fromStoredTransactions(stored).map((item) => item.type)).toEqual(["withdraw", "deposit"]);
  });

  it("warns about a matching sale and buy in different wallets on the next refresh", () => {
    const stored: Parameters<typeof fromStoredTransactions>[0] = [
      { id: 1, uuid: "buy", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 100, txnType: "buy", txnCreatedAt: at("2024-01-01") },
      { id: 2, uuid: "first-refresh", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 150, txnType: "sell", txnCreatedAt: at("2024-02-01") },
      { id: 3, uuid: "later-refresh", assetType: "crypto", symbol: "BTC", wallet: "b", amount: 1, price: 160, txnType: "buy", txnCreatedAt: at("2024-02-02") },
    ];
    const result = calculateCostBasis(fromStoredTransactions(stored), { method: "FIFO" });
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "possible-transfer", eventId: "2" }));
  });

  it("warns when opposite wallet changes in one snapshot do not fit a transfer fee", () => {
    const stored: Parameters<typeof fromStoredTransactions>[0] = [
      { id: 1, uuid: "buy", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 100, txnType: "buy", txnCreatedAt: at("2024-01-01") },
      { id: 2, uuid: "move", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 500, txnType: "sell", txnCreatedAt: at("2024-02-01") },
      { id: 3, uuid: "move", assetType: "crypto", symbol: "BTC", wallet: "b", amount: 0.9, price: 500, txnType: "buy", txnCreatedAt: at("2024-02-01") },
    ];
    const result = calculateCostBasis(fromStoredTransactions(stored), { method: "FIFO" });
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "possible-transfer", eventId: "2" }));
  });

  it("recognizes a transfer with a fee exactly at the one percent limit", () => {
    const stored: Parameters<typeof fromStoredTransactions>[0] = [
      { id: 1, uuid: "buy", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 100, txnType: "buy", txnCreatedAt: at("2024-01-01") },
      { id: 2, uuid: "move", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 500, txnType: "sell", txnCreatedAt: at("2024-02-01") },
      { id: 3, uuid: "move", assetType: "crypto", symbol: "BTC", wallet: "b", amount: 0.99, price: 500, txnType: "buy", txnCreatedAt: at("2024-02-01") },
    ];
    const result = calculateCostBasis(fromStoredTransactions(stored), { method: "FIFO" });
    expect(result.disposals).toEqual([]);
    expect(result.openLots).toEqual([expect.objectContaining({ amount: 0.99, costBasis: 99 })]);
  });

  it("warns when a sell has only an already paired buy across wallets", () => {
    const stored: Parameters<typeof fromStoredTransactions>[0] = [
      { id: 1, uuid: "buy", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 2, price: 100, txnType: "buy", txnCreatedAt: at("2024-01-01") },
      { id: 2, uuid: "move", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 500, txnType: "sell", txnCreatedAt: at("2024-02-01") },
      { id: 3, uuid: "move", assetType: "crypto", symbol: "BTC", wallet: "b", amount: 1, price: 500, txnType: "buy", txnCreatedAt: at("2024-02-01") },
      { id: 4, uuid: "move", assetType: "crypto", symbol: "BTC", wallet: "c", amount: 1, price: 500, txnType: "sell", txnCreatedAt: at("2024-02-01") },
    ];
    const result = calculateCostBasis(fromStoredTransactions(stored), { method: "FIFO" });
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "possible-transfer", eventId: "4" }));
  });

  it("warns for unmatched explicit transfer legs", () => {
    const result = calculateCostBasis([
      event("out", "2024-01-01", "transfer-out", 1, 100, { transferId: "orphan" }),
    ], { method: "FIFO" });
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "unmatched-transfer", eventId: "out" }));
    expect(result.disposals).toEqual([]);
  });

  it("flags deposits with unknown basis", () => {
    const result = calculateCostBasis([
      event("deposit", "2024-01-01", "deposit", 1, 100),
    ], { method: "FIFO" });
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "unknown-basis", eventId: "deposit" }));
    expect(result.disposals).toEqual([]);
  });

  it("removes withdrawn quantity from open lots without a taxable sale", () => {
    const result = calculateCostBasis([
      event("buy", "2024-01-01", "buy", 2, 100),
      event("withdraw", "2024-02-01", "withdraw", 1, 500),
    ], { method: "FIFO", prices: { "crypto:BTC": 600 } });
    expect(result.disposals).toEqual([]);
    expect(result.openLots).toEqual([expect.objectContaining({ amount: 1, costBasis: 100 })]);
    expect(result.unrealized).toEqual([expect.objectContaining({ amount: 1, gainLoss: 500 })]);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "unknown-disposal", eventId: "withdraw" }));
  });

  it("does not reuse withdrawn basis for a later sale", () => {
    const result = calculateCostBasis([
      event("older", "2024-01-01", "buy", 1, 100),
      event("newer", "2024-02-01", "buy", 1, 200),
      event("withdraw", "2024-03-01", "withdraw", 1, 500),
      event("sell", "2024-04-01", "sell", 1, 300),
    ], { method: "FIFO" });
    expect(result.disposals).toEqual([
      expect.objectContaining({ lotId: "newer", costBasis: 200, gainLoss: 100 }),
    ]);
    expect(result.openLots).toEqual([]);
  });

  it("uses highest basis rather than newest date for HIFO", () => {
    const events = [
      event("older", "2024-01-01", "buy", 1, 300),
      event("newer", "2024-02-01", "buy", 1, 100),
      event("sell", "2024-03-01", "sell", 1, 400),
    ];
    expect(calculateCostBasis(events, { method: "HIFO" }).disposals[0]).toMatchObject({ lotId: "older", costBasis: 300, gainLoss: 100 });
    expect(calculateCostBasis(events, { method: "LIFO" }).disposals[0]).toMatchObject({ lotId: "newer", costBasis: 100, gainLoss: 300 });
  });

  it.each(["FIFO", "LIFO"] as const)("uses input order to break same-time %s lot ties", (method) => {
    const result = calculateCostBasis([
      event("9", "2024-01-01", "buy", 1, 100),
      event("10", "2024-01-01", "buy", 1, 200),
      event("sale", "2024-02-01", "sell", 1, 300),
    ], { method });
    expect(result.disposals[0].lotId).toBe(method === "FIFO" ? "9" : "10");
  });

  it("re-pools weighted average cost after a partial sale and new purchase", () => {
    const result = calculateCostBasis([
      event("first", "2024-01-01", "buy", 2, 100),
      event("sale1", "2024-02-01", "sell", 1, 150),
      event("second", "2024-03-01", "buy", 1, 300),
      event("sale2", "2024-04-01", "sell", 1, 400),
    ], { method: "AVERAGE" });
    expect(result.disposals).toEqual([
      expect.objectContaining({ eventId: "sale1", costBasis: 100, gainLoss: 50 }),
      expect.objectContaining({ eventId: "sale2", costBasis: 200, gainLoss: 200 }),
    ]);
    expect(result.openLots).toEqual([expect.objectContaining({ id: "second", amount: 1, costBasis: 200 })]);
    for (const row of result.disposals) {
      expect(row.costBasis + row.gainLoss).toBeCloseTo(row.proceeds);
    }
    expect(result.disposals.reduce((sum, row) => sum + row.costBasis, 0) +
      result.openLots.reduce((sum, lot) => sum + lot.costBasis, 0)).toBeCloseTo(500);
  });

  it("keeps a sale exactly 365 days after acquisition short term", () => {
    const result = calculateCostBasis([
      event("buy", "2023-01-01", "buy", 1, 100),
      event("sell", "2024-01-01", "sell", 1, 200),
    ], { method: "FIFO" });
    expect(result.disposals[0].term).toBe("short");
  });

  it("treats explicit swap legs as disposal and acquisition, including stablecoins", () => {
    const result = calculateCostBasis([
      event("usdt", "2024-01-01", "buy", 100, 1, { symbol: "USDT" }),
      event("swap-out", "2024-01-02", "swap-out", 100, 1.01, { symbol: "USDT" }),
      event("swap-in", "2024-01-02", "swap-in", 1, 101),
      event("sell", "2024-01-03", "sell", 1, 110),
    ], { method: "FIFO" });
    expect(result.disposals.map((row) => row.gainLoss)).toEqual([1, 9]);
  });

  it("creates zero-cost airdrop lots and uses the configurable holding threshold", () => {
    const result = calculateCostBasis([
      event("airdrop", "2024-01-01", "airdrop", 1, 50),
      event("sell", "2024-07-01", "sell", 1, 60),
    ], { method: "FIFO", holdingPeriodDays: 180 });
    expect(result.disposals[0]).toMatchObject({ costBasis: 0, gainLoss: 60, term: "long" });
  });

  it("flags uncovered quantity without creating a negative lot or invented gain", () => {
    const result = calculateCostBasis([
      event("buy", "2024-01-01", "buy", 1, 100),
      event("sell", "2024-02-01", "sell", 2, 200),
    ], { method: "FIFO" });
    expect(result.disposals).toHaveLength(1);
    expect(result.disposals[0]).toMatchObject({ amount: 1, proceeds: 200, costBasis: 100 });
    expect(result.openLots).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "missing-lots", eventId: "sell", amount: 1 }));
  });

  it("warns when a sale has a tiny quantity with no matching lot", () => {
    const result = calculateCostBasis([
      event("sell", "2024-02-01", "sell", 5e-11, 200),
    ], { method: "FIFO" });
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "missing-lots", eventId: "sell", amount: 5e-11 }));
  });

  it.each(["FIFO", "AVERAGE"] as const)("fully closes a lot sold in 100 ordinary %s pieces", (method) => {
    const result = calculateCostBasis([
      event("buy", "2024-01-01", "buy", 1, 100),
      ...Array.from({ length: 100 }, (_, index) => event(`sell-${index}`, "2024-02-01", "sell", 0.01, 200)),
    ], { method });
    expect(result.warnings).toEqual([]);
    expect(result.openLots).toEqual([]);
    expect(result.disposals).toHaveLength(100);
  });

  it.each(["FIFO", "AVERAGE"] as const)("does not retain a rounding dust lot after %s partial sales", (method) => {
    const result = calculateCostBasis([
      event("buy", "2024-01-01", "buy", 0.999, 100),
      ...Array.from({ length: 30 }, (_, index) => event(`sell-${index}`, "2024-02-01", "sell", 0.0333, 200)),
    ], { method });
    expect(result.warnings).toEqual([]);
    expect(result.openLots).toEqual([]);
  });

  it("keeps a tiny purchased amount in open lots", () => {
    const result = calculateCostBasis([
      event("buy", "2024-01-01", "buy", 5e-11, 100),
    ], { method: "FIFO" });
    expect(result.openLots).toEqual([expect.objectContaining({ amount: 5e-11 })]);
  });

  it("processes a sale according to its actual instant across time zones", () => {
    const result = calculateCostBasis([
      event("buy", "2024-01-01", "buy", 1, 100, { date: "2024-01-01T00:00:00Z" }),
      event("sell", "2024-01-01", "sell", 1, 200, { date: "2024-01-01T01:00:00+05:00" }),
    ], { method: "FIFO" });
    expect(result.disposals).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "missing-lots", eventId: "sell" }));
    expect(result.openLots).toEqual([expect.objectContaining({ id: "buy", amount: 1 })]);
  });

  it("sorts valid events chronologically when an invalid date is present", () => {
    const result = calculateCostBasis([
      event("sale", "2024-02-01", "sell", 1, 200),
      event("invalid", "2024-02-01", "buy", 1, 100, { date: "invalid" }),
      event("late", "2024-03-01", "buy", 1, 300),
      event("early", "2024-01-01", "buy", 1, 100),
    ], { method: "FIFO" });
    expect(result.disposals).toEqual([expect.objectContaining({ eventId: "sale", lotId: "early" })]);
    expect(result.warnings).toEqual([expect.objectContaining({ code: "invalid-event", eventId: "invalid" })]);
  });

  it("does not pair an earlier deposit after a withdrawal when another date is invalid", () => {
    const stored: Parameters<typeof fromStoredTransactions>[0] = [
      { id: 1, uuid: "out", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 100, txnType: "withdraw", txnCreatedAt: at("2024-02-01") },
      { id: 2, uuid: "invalid", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 100, txnType: "buy", txnCreatedAt: "invalid" },
      { id: 3, uuid: "later", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 100, txnType: "buy", txnCreatedAt: at("2024-03-01") },
      { id: 4, uuid: "in", assetType: "crypto", symbol: "BTC", wallet: "b", amount: 1, price: 100, txnType: "deposit", txnCreatedAt: at("2024-01-01") },
    ];
    expect(fromStoredTransactions(stored).map(({ type }) => type)).toEqual(["withdraw", "buy", "buy", "deposit"]);
  });

  it("calculates unrealized gain from latest asset price", () => {
    const result = calculateCostBasis([
      event("buy", "2024-01-01", "buy", 2, 100),
    ], { method: "FIFO", prices: { "crypto:BTC": 120 } });
    expect(result.unrealized).toEqual([
      expect.objectContaining({ symbol: "BTC", amount: 2, costBasis: 200, marketValue: 240, gainLoss: 40 }),
    ]);
  });

  it.each(["HIFO", "AVERAGE"] as const)("processes a large %s history without repeated lot scans", (method) => {
    const history: CostBasisEvent[] = [];
    for (let index = 0; index < 8000; index++) {
      history.push(event(`buy-${index}`, "2024-01-01", "buy", 1, 100 + index / 100));
    }
    for (let index = 0; index < 8000; index++) {
      history.push(event(`sell-${index}`, "2024-02-01", "sell", 1, 200));
    }
    const start = performance.now();
    const result = calculateCostBasis(history, { method });
    expect(result.disposals).toHaveLength(8000);
    expect(result.openLots).toEqual([]);
    expect(performance.now() - start).toBeLessThan(3000);
  }, 15_000);

  it("keeps unrealized gain attributable to each open lot", () => {
    const result = calculateCostBasis([
      event("first", "2024-01-01", "buy", 1, 100),
      event("second", "2024-02-01", "buy", 1, 200),
    ], { method: "FIFO", prices: { "crypto:BTC": 300 } });
    expect(result.unrealized).toEqual([
      expect.objectContaining({ id: "first", marketValue: 300, costBasis: 100, gainLoss: 200 }),
      expect.objectContaining({ id: "second", marketValue: 300, costBasis: 200, gainLoss: 100 }),
    ]);
  });

  it("pairs same-snapshot opposite wallet changes as a transfer", () => {
    const stored: Parameters<typeof fromStoredTransactions>[0] = [
      { id: 1, uuid: "buy", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 100, txnType: "buy", txnCreatedAt: at("2024-01-01") },
      { id: 2, uuid: "move", assetType: "crypto", symbol: "BTC", wallet: "a", amount: 1, price: 120, txnType: "sell", txnCreatedAt: at("2024-02-01") },
      { id: 3, uuid: "move", assetType: "crypto", symbol: "BTC", wallet: "b", amount: 1, price: 120, txnType: "buy", txnCreatedAt: at("2024-02-01") },
    ];
    const result = calculateCostBasis(fromStoredTransactions(stored), { method: "FIFO" });
    expect(result.disposals).toEqual([]);
    expect(result.openLots).toEqual([expect.objectContaining({ id: "1", amount: 1, costBasis: 100 })]);
  });

  it("flags unsupported stored transaction types instead of treating them as sales", () => {
    const result = calculateCostBasis([
      event("buy", "2024-01-01", "buy", 1, 100),
      event("other", "2024-02-01", "reward" as CostBasisEvent["type"], 1, 200),
    ], { method: "FIFO" });
    expect(result.disposals).toEqual([]);
    expect(result.openLots[0].amount).toBe(1);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "invalid-event", eventId: "other" }));
  });
});
