import { expect, it } from "vitest";
import { calculateSnapshotProfit } from "./charts-interval-profit";
import type { AssetModel, TransactionModel } from "./types";

const at = (month: number) => new Date(Date.UTC(2024, month, 15)).toISOString();
const asset = (month: number, symbol: string, amount: number, price: number): AssetModel => ({
  id: month * 10 + (symbol === "BTC" ? 1 : symbol === "ETH" ? 2 : 3), uuid: `u${month}`, createdAt: at(month),
  assetType: "crypto", symbol, wallet: "w", amount, value: amount * price, price,
});
const txn = (month: number, symbol: string, amount: number, price: number, txnType: TransactionModel["txnType"]): TransactionModel => ({
  id: month * 10 + (symbol === "BTC" ? 1 : symbol === "ETH" ? 2 : 3), assetID: month * 10 + 1, uuid: `u${month}`,
  createdAt: at(month), updatedAt: at(month), txnCreatedAt: at(month), assetType: "crypto",
  symbol, wallet: "w", amount, price, txnType,
});
const snap = (month: number, assets: AssetModel[], transactions: TransactionModel[] = []) =>
  ({ createdAt: at(month), assets, transactions });
const selected = (start: number, end: number) => ({ start: new Date(Date.UTC(2024, start, 1)), end: new Date(Date.UTC(2024, end + 1, 1) - 1) });

it("does not report opening holdings as an unrecorded change", () => {
  const history = [
    snap(0, [asset(0, "BTC", 2, 100), asset(0, "ETH", 1, 40)], [txn(0, "ETH", 1, 40, "buy")]),
    snap(1, [asset(1, "BTC", 2, 120), asset(1, "ETH", 1, 50)]),
  ];
  const result = calculateSnapshotProfit(history, selected(0, 1));
  expect(result.knownTotal).toBe(50);
  expect(result.unrecordedChange).toBe(0);
  expect(result.deposits).toBe(40);
});

it("includes first-snapshot holdings in the P&L percentage denominator", () => {
  const history = [
    snap(0, [asset(0, "BTC", 2, 100)]),
    snap(1, [asset(1, "BTC", 2, 120)]),
  ];
  const result = calculateSnapshotProfit(history, selected(0, 1));
  expect(result.knownTotal).toBe(40);
  expect(result.percentage).toBe(20);
});

it("marks a saved zero-price opening position unknown when its first quote arrives", () => {
  const history = [
    snap(0, [asset(0, "ETH", 2, 0)]),
    snap(1, [asset(1, "ETH", 2, 100)]),
  ];
  const result = calculateSnapshotProfit(history, selected(0, 1));
  expect(result.total).toBeNull();
  expect(result.knownTotal).toBe(0);
  expect(result.unknownCoins).toMatchObject([{ symbol: "ETH", intervals: [at(1)] }]);
});

it("keeps a lone untraded opening snapshot out of the profit coin list", () => {
  const result = calculateSnapshotProfit([snap(0, [asset(0, "BTC", 2, 100)])], selected(0, 0));
  expect(result.coins).toEqual([]);
});

it("includes a flat opening holding in the portfolio percentage denominator", () => {
  const history = [
    snap(0, [asset(0, "BTC", 1, 100), asset(0, "USDT", 100, 1)]),
    snap(1, [asset(1, "BTC", 1, 120), asset(1, "USDT", 100, 1)]),
  ];
  const result = calculateSnapshotProfit(history, selected(0, 1));
  expect(result.knownTotal).toBe(20);
  expect(result.percentage).toBe(10);
});

it("keeps unrecorded quantity changes outside P&L and adds month results to the year", () => {
  const history = [
    snap(-1, [asset(-1, "BTC", 2, 100)]),
    snap(0, [asset(0, "BTC", 2, 120)]),
    snap(1, [asset(1, "BTC", 5, 150)]),
    snap(2, [asset(2, "BTC", 5, 160)]),
  ];
  const year = calculateSnapshotProfit(history, selected(0, 11));
  const months = [0, 1, 2].map((month) => calculateSnapshotProfit(history, selected(month, month)));
  expect(year.knownTotal).toBe(150);
  expect(year.unrecordedChange).toBe(450);
  expect(months.reduce((sum, month) => sum + (month.knownTotal ?? 0), 0)).toBe(150);
});

it("values recorded buys at their own prices", () => {
  const history = [
    snap(0, [asset(0, "BTC", 1, 100)], [txn(0, "BTC", 1, 100, "buy")]),
    snap(1, [asset(1, "BTC", 2, 150)], [txn(1, "BTC", 1, 130, "buy")]),
  ];
  expect(calculateSnapshotProfit(history, selected(0, 1)).knownTotal).toBe(70);
});

it("excludes only the interval with an unpaired withdrawal", () => {
  const history = [
    snap(0, [asset(0, "BTC", 2, 100)], [txn(0, "BTC", 2, 100, "buy")]),
    snap(1, [asset(1, "BTC", 2, 110)]),
    snap(2, [asset(2, "BTC", 1, 120)], [txn(2, "BTC", 1, 120, "withdraw")]),
    snap(3, [asset(3, "BTC", 1, 130)]),
  ];
  const result = calculateSnapshotProfit(history, selected(0, 3));
  expect(result.total).toBeNull();
  expect(result.knownTotal).toBe(30);
  expect(result.unknownCoins).toMatchObject([{ symbol: "BTC", intervals: [at(2)], months: 1 }]);
  expect([0, 1, 2, 3].reduce((sum, month) =>
    sum + (calculateSnapshotProfit(history, selected(month, month)).knownTotal ?? 0), 0)).toBe(30);
});

it("marks an orphan withdrawal unknown even when both snapshot balances are zero", () => {
  const history = [
    snap(-1, [asset(-1, "BTC", 0, 100)]),
    snap(0, [asset(0, "BTC", 0, 110)], [txn(0, "BTC", 1, 110, "withdraw")]),
  ];
  const result = calculateSnapshotProfit(history, selected(0, 0));
  expect(result.total).toBeNull();
  expect(result.knownTotal).toBe(0);
  expect(result.unknownCoins).toMatchObject([{ symbol: "BTC", intervals: [at(0)] }]);
  expect(result.coins).toEqual([]);
  expect(result.unrecordedChange).toBe(0);
});

it("marks a partly known coin unknown without losing its known intervals", () => {
  const history = [
    snap(-1, [asset(-1, "BTC", 2, 100)]),
    snap(0, [asset(0, "BTC", 2, 110)]),
    snap(1, [asset(1, "BTC", 1, 120)], [txn(1, "BTC", 1, 120, "withdraw")]),
  ];
  expect(calculateSnapshotProfit(history, selected(0, 1)).coins)
    .toMatchObject([{ symbol: "BTC", value: 20, isUnknown: true }]);
});

it("rounds floating quantity noise to zero for intact multi-wallet holdings", () => {
  const history = [
    snap(-1, [asset(-1, "BTC", 0.1, 100), { ...asset(-1, "BTC", 0.2, 100), wallet: "w2" }]),
    snap(0, [asset(0, "BTC", 0.3, 110)]),
  ];
  expect(calculateSnapshotProfit(history, selected(0, 0)).unrecordedChange).toBe(0);
});

it("keeps the 2024 BTC rally additive beside 217,677 in recorded deposits", () => {
  const history = [
    snap(-1, [asset(-1, "BTC", 8, 42_265)]),
    ...Array.from({ length: 12 }, (_, month) => {
      const price = 42_265 + (93_430 - 42_265) * (month + 1) / 12;
      const holdings = [asset(month, "BTC", 8, price), asset(month, "USDT", 217_677 * (month + 1) / 12, 1)];
      return snap(month, holdings, [txn(month, "USDT", 217_677 / 12, 1, "deposit")]);
    }),
  ];
  const annual = calculateSnapshotProfit(history, selected(0, 11));
  const monthly = Array.from({ length: 12 }, (_, month) => calculateSnapshotProfit(history, selected(month, month)));
  expect(annual.knownTotal).toBeCloseTo(409_320, 2);
  expect(annual.deposits).toBeCloseTo(217_677, 2);
  expect(monthly.reduce((sum, result) => sum + (result.knownTotal ?? 0), 0)).toBeCloseTo(409_320, 2);
  expect(monthly.reduce((sum, result) => sum + result.deposits, 0)).toBeCloseTo(217_677, 2);
});

it("handles a recorded sale to zero and a later recorded rebuy", () => {
  const history = [
    snap(-1, [asset(-1, "BTC", 1, 100)]),
    snap(0, [asset(0, "BTC", 1, 120)]),
    snap(1, [asset(1, "BTC", 0, 130)], [txn(1, "BTC", 1, 130, "sell")]),
    snap(2, [asset(2, "USDT", 1, 1)]),
    snap(3, [asset(3, "BTC", 1, 100)], [txn(3, "BTC", 1, 100, "buy")]),
    snap(4, [asset(4, "BTC", 1, 140)]),
  ];
  const annual = calculateSnapshotProfit(history, selected(0, 11));
  expect(annual.knownTotal).toBe(70);
  expect(annual.unrecordedChange).toBe(0);
  expect(calculateSnapshotProfit(history, selected(2, 2)).unrecordedChange).toBe(1);
  expect(calculateSnapshotProfit(history, selected(3, 3)).unrecordedChange).toBe(-1);
  expect(Array.from({ length: 5 }, (_, month) => calculateSnapshotProfit(history, selected(month, month)).knownTotal ?? 0)
    .reduce((sum, value) => sum + value, 0)).toBe(70);
});

it("uses the whole last baseline snapshot when a coin has an older stale row", () => {
  const history = [
    snap(-7, [asset(-7, "ETH", 1, 100)]),
    snap(-1, [asset(-1, "BTC", 1, 50)]),
    snap(0, [asset(0, "BTC", 1, 60), asset(0, "ETH", 1, 200)]),
  ];
  const result = calculateSnapshotProfit(history, selected(0, 0));
  expect(result.knownTotal).toBe(10);
  expect(result.unrecordedChange).toBe(200);
});

it("assigns a gap after a deleted snapshot to the next surviving interval", () => {
  const history = [
    snap(-1, [asset(-1, "BTC", 1, 100)]),
    snap(0, [asset(0, "BTC", 1, 120)]),
    snap(2, [asset(2, "BTC", 1, 150)]),
  ];
  const year = calculateSnapshotProfit(history, selected(0, 11));
  expect(year.knownTotal).toBe(50);
  expect(calculateSnapshotProfit(history, selected(1, 1)).knownTotal).toBeNull();
  expect(calculateSnapshotProfit(history, selected(2, 2)).knownTotal).toBe(30);
});

it("matches a recorded transaction to a differently cased snapshot symbol", () => {
  const history = [
    snap(-1, [asset(-1, "btc", 1, 100)]),
    snap(0, [asset(0, "BtC", 2, 150)], [txn(0, "BTC", 1, 130, "buy")]),
  ];
  const result = calculateSnapshotProfit(history, selected(0, 0));
  expect(result.knownTotal).toBe(70);
  expect(result.unrecordedChange).toBe(0);
});

it("keeps a paired transfer across month boundaries known and additive", () => {
  const jan = "2024-01-31T12:00:00.000Z";
  const feb = "2024-02-01T12:00:00.000Z";
  const outgoing = { ...txn(0, "BTC", 1, 200, "withdraw"), id: 401, uuid: "jan", txnCreatedAt: jan };
  const incoming = { ...txn(1, "BTC", 1, 210, "deposit"), id: 402, uuid: "feb", txnCreatedAt: feb, wallet: "w2" };
  const history = [
    snap(-1, [asset(-1, "BTC", 2, 100)]),
    { createdAt: jan, assets: [{ ...asset(0, "BTC", 1, 200), uuid: "jan", createdAt: jan }], transactions: [outgoing] },
    { createdAt: feb, assets: [{ ...asset(1, "BTC", 2, 210), uuid: "feb", createdAt: feb }], transactions: [incoming] },
  ];
  const year = calculateSnapshotProfit(history, selected(0, 11));
  const first = calculateSnapshotProfit(history, selected(0, 0));
  const second = calculateSnapshotProfit(history, selected(1, 1));
  expect(year.total).toBe(220);
  expect(first.total).toBe(200);
  expect(second.total).toBe(20);
  expect(year.unknownCoins).toEqual([]);
});

it("adds randomized multi-wallet transfer and reward intervals across five partitions", () => {
  for (let seed = 1; seed <= 24; seed++) {
    let state = seed;
    const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 0x100000000);
    const prices = [100, ...Array.from({ length: 5 }, () => 90 + Math.floor(random() * 50))];
    const source = seed % 3;
    const destination = (source + 1) % 3;
    const third = (source + 2) % 3;
    const dates = Array.from({ length: 6 }, (_, day) => new Date(Date.UTC(2024, 0, 29 + day)).toISOString());
    const point = (day: number, balances: number[], transactions: TransactionModel[] = []) => ({
      createdAt: dates[day],
      assets: balances.flatMap((amount, wallet) => amount ? [{
        ...asset(0, "BTC", amount, prices[day]), id: day * 10 + wallet, uuid: `s${day}`,
        createdAt: dates[day], wallet: `w${wallet}`,
      }] : []),
      transactions: transactions.map((transaction, index) => ({
        ...transaction, id: day * 10 + index + 100, uuid: `s${day}`,
        createdAt: dates[day], updatedAt: dates[day], txnCreatedAt: dates[day],
      })),
    });
    const transfer = (wallet: number, price: number, txnType: "withdraw" | "deposit") =>
      ({ ...txn(0, "BTC", 1, price, txnType), wallet: `w${wallet}` });
    const start = [1, 1, 1];
    const out = [...start]; out[source]--;
    const incoming = [...out]; incoming[destination]++;
    const sameDay = [...incoming]; sameDay[destination]--; sameDay[third]++;
    const rewarded = [...sameDay]; rewarded[source]++;
    const history = [
      point(0, start),
      point(1, start),
      point(2, out, [transfer(source, prices[2], "withdraw")]),
      point(3, incoming, [transfer(destination, prices[3], "deposit")]),
      point(4, sameDay, [transfer(destination, prices[4], "withdraw"), transfer(third, prices[4], "deposit")]),
      point(5, rewarded),
    ];
    const window = (first: number, last: number) => ({
      start: new Date(dates[first]), end: new Date(dates[last]),
    });
    const whole = calculateSnapshotProfit(history, window(1, 5));
    const parts = [1, 2, 3, 4, 5].map((day) => calculateSnapshotProfit(history, window(day, day)));
    expect(whole.knownTotal).toBeCloseTo(3 * (prices[5] - prices[0]), 8);
    expect(whole.unrecordedChange).toBeCloseTo(prices[5], 8);
    expect(whole.deposits).toBe(0);
    expect(whole.unknownCoins).toEqual([]);
    expect(parts.reduce((sum, part) => sum + (part.knownTotal ?? 0), 0)).toBeCloseTo(whole.knownTotal!, 8);
    expect(parts.reduce((sum, part) => sum + part.unrecordedChange, 0)).toBeCloseTo(whole.unrecordedChange, 8);
    expect(parts.reduce((sum, part) => sum + part.deposits, 0)).toBe(whole.deposits);
  }
});

it("adds randomized snapshot histories across months, arbitrary partitions, and 90 day windows", () => {
  for (let seed = 1; seed <= 80; seed++) {
    let state = seed;
    const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 0x100000000);
    const quantities = [2, 0, 1];
    const history = [snap(-1, [asset(-1, "BTC", 2, 80), asset(-1, "ETH", 0, 40), asset(-1, "USDT", 1, 1)])];
    for (let month = 0; month < 12; month++) {
      const assets: AssetModel[] = [];
      const transactions: TransactionModel[] = [];
      ["BTC", "ETH", "USDT"].forEach((symbol, index) => {
        const previous = quantities[index];
        const delta = [-1, 0, 1][Math.floor(random() * 3)];
        quantities[index] = Math.max(0, previous + delta);
        const price = index === 2 ? 1 : 50 + month * 5 + Math.floor(random() * 20);
        if (quantities[index] || random() < .5) assets.push(asset(month, symbol, quantities[index], price));
        if (delta && random() < .7) transactions.push(txn(month, symbol, Math.abs(delta), price - 2,
          delta > 0 ? random() < .4 ? "deposit" : "buy" : random() < .25 ? "withdraw" : "sell"));
      });
      history.push(snap(month, assets, transactions));
    }
    const whole = calculateSnapshotProfit(history, selected(0, 11));
    const months = Array.from({ length: 12 }, (_, month) => calculateSnapshotProfit(history, selected(month, month)));
    expect(Math.abs((whole.knownTotal ?? 0) - months.reduce((sum, month) => sum + (month.knownTotal ?? 0), 0))).toBeLessThan(.01);
    expect(Math.abs(whole.unrecordedChange - months.reduce((sum, month) => sum + month.unrecordedChange, 0))).toBeLessThan(.01);
    const cut = 1 + Math.floor(random() * 10);
    const parts = [selected(0, cut), selected(cut + 1, 11)];
    expect(Math.abs((whole.knownTotal ?? 0) - parts.reduce((sum, part) =>
      sum + (calculateSnapshotProfit(history, part).knownTotal ?? 0), 0))).toBeLessThan(.01);
    const window = { start: new Date(Date.UTC(2024, 3, 1)), end: new Date(Date.UTC(2024, 6, 1) - 1) };
    const split = new Date(Date.UTC(2024, 4, 19));
    const full90 = calculateSnapshotProfit(history, window).knownTotal ?? 0;
    const split90 = (calculateSnapshotProfit(history, { start: window.start, end: new Date(split.getTime() - 1) }).knownTotal ?? 0)
      + (calculateSnapshotProfit(history, { start: split, end: window.end }).knownTotal ?? 0);
    expect(Math.abs(full90 - split90)).toBeLessThan(.01);
  }
});
