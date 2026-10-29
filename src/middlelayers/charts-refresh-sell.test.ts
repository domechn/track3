import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetModel, TransactionModel, WalletCoinUSD } from "./types";

const db = vi.hoisted(() => ({
  assets: [] as AssetModel[],
  txns: [] as TransactionModel[],
}));

vi.mock("./datafetch/utils/cache", async (importOriginal) => {
  const original = await importOriginal<typeof import("./datafetch/utils/cache")>();
  return {
    ...original,
    getLocalStorageCacheInstance: () => ({
      getCache: () => undefined,
      setCache: () => undefined,
      clearCache: () => undefined,
    }),
  };
});
vi.mock("./entities/assets", () => ({
  ASSET_HANDLER: {
    listAssetsMaxCreatedAt: async (_start: Date, _end: Date, symbol?: string) =>
      extreme("max", symbol),
    listAssetsMinCreatedAt: async (_start: Date, _end: Date, symbol?: string) =>
      extreme("min", symbol),
  },
}));
vi.mock("./entities/transactions", () => ({
  TRANSACTION_HANDLER: {
    listTransactionsByDateRange: async (_start: Date, _end: Date, symbol?: string) => {
      const grouped = new Map<string, TransactionModel[]>();
      for (const txn of db.txns.filter((row) => !symbol || row.symbol === symbol)) {
        grouped.set(txn.uuid, [...(grouped.get(txn.uuid) ?? []), txn]);
      }
      return [...grouped.values()];
    },
  },
}));

import { generateTransactions } from "./charts-refresh";
import { calculateTotalProfit } from "./charts-profit";
import { attributeSnapshots } from "./charts-attribution";
import { calculateCostBasis, fromStoredTransactions } from "./cost-basis";

type Holding = { wallet: string; symbol: string; amount: number; price: number };
type Snapshot = { at: string; holdings: Holding[]; prices?: Record<string, number> };
const at = (day: number) => `2024-01-0${day}T00:00:00.000Z`;
const range = { start: new Date(at(1)), end: new Date(at(9)) };
const btc = (wallet: string, amount: number, price: number): Holding =>
  ({ wallet, symbol: "BTC", amount, price });

function extreme(direction: "min" | "max", symbol?: string): AssetModel[] {
  const rows = db.assets.filter((asset) => !symbol || asset.symbol === symbol);
  const ordered = rows.slice().sort((left, right) =>
    direction === "min"
      ? left.createdAt.localeCompare(right.createdAt)
      : right.createdAt.localeCompare(left.createdAt));
  const selected = new Map<string, string>();
  for (const row of ordered) {
    const key = `${row.assetType}:${row.symbol}`;
    if (!selected.has(key)) selected.set(key, row.uuid);
  }
  return rows.filter((row) => selected.get(`${row.assetType}:${row.symbol}`) === row.uuid);
}

function load(snapshots: Snapshot[]) {
  db.assets = [];
  db.txns = [];
  let previous: AssetModel[] = [];
  let id = 1;
  const attribution = snapshots.map((snapshot, index) => {
    const uuid = `refresh-${index}`;
    const current: WalletCoinUSD[] = snapshot.holdings.map((holding) => ({
      assetType: "crypto",
      wallet: `md5:${holding.wallet}`,
      symbol: holding.symbol,
      amount: holding.amount,
      price: holding.price,
      usdValue: holding.amount * holding.price,
    }));
    const drafts = generateTransactions(
      uuid, snapshot.at, previous, current, [], {
        ...Object.fromEntries(current.filter((coin) => coin.amount > 0).map((coin) =>
          [`${coin.assetType}:${coin.symbol}`, coin.price])),
        ...snapshot.prices,
      },
    );
    const rows: AssetModel[] = current.map((coin) => ({
      id: id++, uuid, createdAt: snapshot.at, assetType: "crypto",
      wallet: coin.wallet.slice(4), symbol: coin.symbol,
      amount: coin.amount, value: coin.usdValue, price: coin.price,
    }));
    for (const draft of drafts.filter((txn) =>
      !rows.some((row) => row.wallet === txn.wallet && row.symbol === txn.symbol))) {
      rows.push({
        id: id++, uuid, createdAt: snapshot.at, assetType: draft.assetType,
        wallet: draft.wallet, symbol: draft.symbol, amount: 0, value: 0,
        price: draft.price,
      });
    }
    const txns: TransactionModel[] = drafts.map((draft) => ({
      ...draft, id: id++, assetID: rows.find((row) =>
        row.wallet === draft.wallet && row.symbol === draft.symbol)!.id,
    }));
    db.assets.push(...rows);
    db.txns.push(...txns);
    previous = rows;
    return { createdAt: snapshot.at, assets: rows, transactions: txns };
  });
  return attribution;
}

beforeEach(() => {
  db.assets = [];
  db.txns = [];
});

describe("whole-position refresh pricing", () => {
  it("marks profit unknown after an unpriced disappearance", async () => {
    load([
      { at: at(1), holdings: [btc("w1", 1, 100)] },
      { at: at(2), holdings: [btc("w1", 1, 250)] },
      { at: at(3), holdings: [] },
    ]);
    expect(db.txns.at(-1)).toMatchObject({ txnType: "withdraw", price: 250 });
    const profit = await calculateTotalProfit(range, "BTC", "crypto");
    expect(profit.coins[0]?.value).toBeNull();
    expect(profit.coins[0]?.percentage).toBeNull();
    expect(profit.total).toBeNull();
    expect(profit.percentage).toBeNull();
  });

  it("keeps a partial BTC sale at 300 with 300 total profit", async () => {
    load([
      { at: at(1), holdings: [btc("w1", 1, 100)] },
      { at: at(2), holdings: [btc("w1", 2, 200)] },
      { at: at(3), holdings: [btc("w1", 1, 300)] },
    ]);
    const profit = await calculateTotalProfit(range, "BTC", "crypto");
    expect(profit.coins[0]).toMatchObject({
      costAvgPrice: 150, sellAvgPrice: 300, sellAmount: 1,
    });
    expect(profit.total).toBe(300);
  });

  it("P2 records Sell Price 300, profit 200, and cost-basis gain 200", async () => {
    load([
      { at: at(1), holdings: [btc("w1", 1, 100)] },
      { at: at(2), holdings: [{ wallet: "w1", symbol: "USDT", amount: 300, price: 1 }],
        prices: { "crypto:BTC": 300 } },
    ]);
    const profit = await calculateTotalProfit(range, "BTC", "crypto");
    const btcProfit = profit.coins.find((coin) => coin.symbol === "BTC");
    expect(btcProfit?.sellAvgPrice).toBe(300);
    expect(profit.total).toBe(200);
    const basis = calculateCostBasis(fromStoredTransactions(db.txns), { method: "FIFO" });
    expect(basis.disposals.find((row) => row.symbol === "BTC")?.gainLoss).toBe(200);
  });

  it("A3 assigns a same-refresh wallet transfer's 20 rise to market movement", () => {
    const snapshots = load([
      { at: at(1), holdings: [btc("w1", 1, 100)] },
      { at: at(2), holdings: [btc("w2", 1, 120)], prices: { "crypto:BTC": 120 } },
    ]);
    const attribution = attributeSnapshots(snapshots);
    expect(attribution.totals).toEqual({
      priceEffect: 20, flowEffect: 0, residual: 0, totalChange: 20,
    });
    const basis = calculateCostBasis(fromStoredTransactions(db.txns), {
      method: "FIFO", prices: { "crypto:BTC": 120 },
    });
    expect(basis.disposals).toHaveLength(0);
    expect(basis.unrealized[0]?.gainLoss).toBe(20);
  });

  it("A4 assigns a full BTC sale's 200 rise to market movement", () => {
    const snapshots = load([
      { at: at(1), holdings: [btc("w1", 1, 100)] },
      { at: at(2), holdings: [{ wallet: "w1", symbol: "USDT", amount: 300, price: 1 }],
        prices: { "crypto:BTC": 300 } },
    ]);
    expect(attributeSnapshots(snapshots).totals).toEqual({
      priceEffect: 200, flowEffect: 0, residual: 0, totalChange: 200,
    });
  });

  it("P5b retains basis and market gain for a paired two-refresh transfer", async () => {
    const snapshots = load([
      { at: at(1), holdings: [btc("w1", 1, 100), btc("w3", 1, 100)] },
      { at: at(2), holdings: [btc("w3", 1, 200)], prices: { "crypto:BTC": 200 } },
      { at: at(3), holdings: [btc("w3", 1, 210), btc("w2", 1, 210)] },
    ]);
    const outgoing = db.txns.find((txn) =>
      txn.uuid === "refresh-1" && txn.wallet === "w1");
    expect(outgoing).toMatchObject({ txnType: "sell", amount: 1, price: 200 });
    const basis = calculateCostBasis(fromStoredTransactions(db.txns), {
      method: "FIFO", prices: { "crypto:BTC": 210 },
    });
    expect(basis.warnings.map((warning) => warning.code)).toContain("possible-transfer");
    expect(basis.disposals).toHaveLength(0);
    expect(basis.unrealized.reduce((sum, lot) => sum + lot.gainLoss, 0)).toBe(220);
    const profit = await calculateTotalProfit(range, "BTC", "crypto");
    expect(profit.total).toBe(220);
    expect(profit.coins[0]).toMatchObject({
      costAvgPrice: 100, sellAmount: 0,
    });
    expect(attributeSnapshots(snapshots).totals).toEqual({
      priceEffect: 220, flowEffect: 0, residual: 0, totalChange: 220,
    });
    const editedDates = snapshots.map((snapshot) => ({
      ...snapshot,
      transactions: snapshot.transactions.map((txn) =>
        txn.uuid === "refresh-1"
          ? { ...txn, txnCreatedAt: at(9) }
          : txn),
    }));
    expect(attributeSnapshots(editedDates).totals).toEqual({
      priceEffect: 220, flowEffect: 0, residual: 0, totalChange: 220,
    });
  });

  it("keeps an earlier sale when the next refresh has its own wallet transfer", async () => {
    load([
      { at: at(1), holdings: [btc("w1", 1, 100), btc("w3", 1, 100)] },
      { at: at(2), holdings: [btc("w3", 1, 200)], prices: { "crypto:BTC": 200 } },
      { at: at(3), holdings: [btc("w2", 1, 210)], prices: { "crypto:BTC": 210 } },
    ]);

    const basis = calculateCostBasis(fromStoredTransactions(db.txns), {
      method: "FIFO", prices: { "crypto:BTC": 210 },
    });
    expect(basis.disposals).toEqual([
      expect.objectContaining({
        disposedAt: at(2), proceeds: 200, costBasis: 100, gainLoss: 100,
      }),
    ]);
    expect(basis.openLots).toEqual([expect.objectContaining({ amount: 1, costBasis: 100 })]);

    const profit = await calculateTotalProfit(range, "BTC", "crypto");
    expect(profit.total).toBe(210);
  });
});
