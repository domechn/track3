import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetModel, TransactionModel } from "./types";

const cache = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  return {
    values,
    epoch: 0,
    getCache: vi.fn((key: string) => values.get(key)),
    setCache: vi.fn((key: string, value: unknown) => values.set(key, value)),
    clearCache: vi.fn(() => values.clear()),
  };
});

vi.mock("./datafetch/utils/cache", () => ({
  getLocalStorageCacheInstance: vi.fn(() => cache),
  getCacheGroupEpoch: vi.fn(() => cache.epoch),
  invalidateCacheGroups: vi.fn(() => {
    cache.epoch += 1;
    try {
      cache.clearCache();
    } catch {
      // Mirrors the fail-safe production invalidation contract.
    }
  }),
}));

vi.mock("./database", () => ({
  executeWriteWork: vi.fn((operation: () => Promise<unknown>) => operation()),
  selectFromDatabaseWithSql: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

vi.mock("./entities/assets", () => ({
  ASSET_HANDLER: {
    listAssetsByDateRange: vi.fn(),
    listAssetsBySymbolByDateRange: vi.fn(),
    listSnapshotDatesByDateRange: vi.fn(),
    listLastSnapshotBefore: vi.fn(),
  },
}));

vi.mock("./entities/transactions", () => ({
  TRANSACTION_HANDLER: {
    listTransactionsByDateRange: vi.fn(),
    getTransactionByID: vi.fn(),
    createOrUpdate: vi.fn(),
    listTransactions: vi.fn(),
  },
}));

import {
  calculateTotalProfit,
  calculateTotalProfitBatch,
  queryPreviousProfitSnapshotDate,
  updateTransactionPrice,
  updateTransactionTxnType,
} from "./charts-profit";
import { selectFromDatabaseWithSql } from "./database";
import { invoke } from "@tauri-apps/api/core";
import { ASSET_HANDLER } from "./entities/assets";
import { TRANSACTION_HANDLER } from "./entities/transactions";

const dateRange = {
  start: new Date("2024-04-01T00:00:00.000Z"),
  end: new Date("2024-04-30T00:00:00.000Z"),
};

const latestAsset: AssetModel = {
  id: 7,
  uuid: "refresh-1",
  createdAt: "2024-04-30T00:00:00.000Z",
  assetType: "crypto",
  symbol: "BTC",
  amount: 1,
  value: 120,
  price: 120,
  wallet: "wallet-1",
};

const earliestAsset: AssetModel = {
  ...latestAsset,
  createdAt: "2024-04-01T00:00:00.000Z",
  value: 100,
  price: 100,
};

const transaction: TransactionModel = {
  id: 42,
  uuid: "refresh-0",
  assetID: 7,
  assetType: "crypto",
  wallet: "wallet-1",
  symbol: "BTC",
  amount: 1,
  price: 100,
  txnType: "buy",
  txnCreatedAt: "2024-04-01T00:00:00.000Z",
  createdAt: "2024-04-01T00:00:00.000Z",
  updatedAt: "2024-04-01T00:00:00.000Z",
};

it("loads overlapping year and month profits from one snapshot query", async () => {
  vi.mocked(ASSET_HANDLER.listLastSnapshotBefore).mockResolvedValue([
    { ...earliestAsset, uuid: "prior", createdAt: "2023-12-31T00:00:00.000Z", value: 100, price: 100 },
  ]);
  vi.mocked(ASSET_HANDLER.listAssetsByDateRange).mockResolvedValue([
    [{ ...earliestAsset, uuid: "jan", createdAt: "2024-01-31T00:00:00.000Z", value: 110, price: 110 }],
    [{ ...earliestAsset, uuid: "feb", createdAt: "2024-02-28T00:00:00.000Z", value: 120, price: 120 }],
  ]);
  vi.mocked(TRANSACTION_HANDLER.listTransactionsByDateRange).mockResolvedValue([]);
  const ranges = [
    { start: new Date("2024-01-01T00:00:00.000Z"), end: new Date("2024-02-29T23:59:59.999Z") },
    { start: new Date("2024-01-01T00:00:00.000Z"), end: new Date("2024-01-31T23:59:59.999Z") },
    { start: new Date("2024-02-01T00:00:00.000Z"), end: new Date("2024-02-29T23:59:59.999Z") },
  ];
  expect((await calculateTotalProfitBatch(ranges)).map((profit) => profit.knownTotal)).toEqual([20, 10, 10]);
  expect(ASSET_HANDLER.listAssetsByDateRange).toHaveBeenCalledTimes(1);
  expect(TRANSACTION_HANDLER.listTransactionsByDateRange).toHaveBeenCalledTimes(1);
});

it("retains later known intervals after a batched unpaired withdrawal", async () => {
  const make = (uuid: string, createdAt: string, amount: number, price: number): AssetModel => ({
    ...earliestAsset, uuid, createdAt, symbol: "ETH", amount, price, value: amount * price,
  });
  vi.mocked(ASSET_HANDLER.listLastSnapshotBefore).mockResolvedValue([make("prior", "2023-12-15T12:00:00.000Z", 1, 100)]);
  vi.mocked(ASSET_HANDLER.listAssetsByDateRange).mockResolvedValue([
    [make("jan", "2024-01-15T12:00:00.000Z", 1, 100)],
    [make("march", "2024-03-15T12:00:00.000Z", .75, 120)],
    [make("april", "2024-04-15T12:00:00.000Z", .75, 130)],
  ]);
  vi.mocked(TRANSACTION_HANDLER.listTransactionsByDateRange).mockResolvedValue([[
    { ...transaction, uuid: "march", symbol: "ETH", amount: .25, price: 100,
      txnType: "withdraw", txnCreatedAt: "2024-03-15T12:00:00.000Z" },
  ]]);
  const year = { start: new Date("2024-01-01T00:00:00.000Z"), end: new Date("2024-12-31T23:59:59.999Z") };
  const april = { start: new Date("2024-04-01T00:00:00.000Z"), end: new Date("2024-04-30T23:59:59.999Z") };
  const [annual, month] = await calculateTotalProfitBatch([year, april]);
  expect(annual.knownTotal).toBe(7.5);
  expect(month.knownTotal).toBe(7.5);
  expect(annual.unknownCoins).toHaveLength(1);
});

it("sums the additive 2024 fixture across twelve batched months", async () => {
  const snapshots = Array.from({ length: 13 }, (_, index) => {
    const month = index - 1;
    const createdAt = new Date(Date.UTC(2024, month, 15, 12)).toISOString();
    const uuid = `additive-${month}`;
    const btcPrice = month < 0 ? 42_265 : 42_265 + (93_430 - 42_265) * (month + 1) / 12;
    const assets: AssetModel[] = [
      { ...earliestAsset, uuid, createdAt, wallet: "btc-wallet", symbol: "BTC", amount: 8, price: btcPrice, value: 8 * btcPrice },
      { ...earliestAsset, uuid, createdAt, wallet: "eth-wallet", symbol: "ETH", amount: month < 2 ? 1 : .75,
        price: month < 2 ? 100 : month === 2 ? 120 : 130,
        value: month < 2 ? 100 : month === 2 ? 90 : 97.5 },
    ];
    if (month >= 0) {
      const quantity = 217_677 * (month + 1) / 12;
      assets.push({ ...earliestAsset, uuid, createdAt, wallet: "cash-wallet", symbol: "USDT",
        amount: quantity, price: 1, value: quantity });
    }
    return assets;
  });
  vi.mocked(ASSET_HANDLER.listLastSnapshotBefore).mockResolvedValue(snapshots[0]);
  vi.mocked(ASSET_HANDLER.listAssetsByDateRange).mockResolvedValue(snapshots.slice(1).reverse());
  vi.mocked(TRANSACTION_HANDLER.listTransactionsByDateRange).mockResolvedValue(snapshots.slice(1).map((assets, month) => {
    const createdAt = assets[0].createdAt;
    const uuid = assets[0].uuid;
    return [
      { ...transaction, id: 100 + month, uuid, wallet: "cash-wallet", symbol: "USDT",
        amount: 217_677 / 12, price: 1, txnType: "deposit", txnCreatedAt: createdAt },
      ...(month === 2 ? [{ ...transaction, id: 200, uuid, wallet: "eth-wallet", symbol: "ETH",
        amount: .25, price: 100, txnType: "withdraw" as const, txnCreatedAt: createdAt }] : []),
    ];
  }));
  const year = { start: new Date(2024, 0, 1), end: new Date(2024, 11, 31, 23, 59, 59, 999) };
  const months = Array.from({ length: 12 }, (_, month) => ({
    start: new Date(2024, month, 1),
    end: new Date(2024, month + 1, 1, 0, 0, 0, -1),
  }));
  const [annual, ...monthly] = await calculateTotalProfitBatch([year, ...months]);
  expect(annual.knownTotal).toBeCloseTo(409_327.5, 2);
  expect(annual.knownTotal).toBeCloseTo(monthly.reduce((sum, profit) => sum + (profit.knownTotal ?? 0), 0), 2);
});

beforeEach(() => {
  vi.clearAllMocks();
  cache.values.clear();
  cache.epoch = 0;
  vi.mocked(ASSET_HANDLER.listAssetsByDateRange).mockResolvedValue([[{ ...earliestAsset, uuid: "refresh-0" }], [latestAsset]]);
  vi.mocked(ASSET_HANDLER.listAssetsBySymbolByDateRange).mockResolvedValue([[{ ...earliestAsset, uuid: "refresh-0" }], [latestAsset]]);
  vi.mocked(ASSET_HANDLER.listSnapshotDatesByDateRange).mockResolvedValue([
    { uuid: "refresh-0", createdAt: earliestAsset.createdAt },
    { uuid: "refresh-1", createdAt: latestAsset.createdAt },
  ]);
  vi.mocked(ASSET_HANDLER.listLastSnapshotBefore).mockResolvedValue([]);
  vi.mocked(
    TRANSACTION_HANDLER.listTransactionsByDateRange,
  ).mockResolvedValue([[transaction]]);
  vi.mocked(TRANSACTION_HANDLER.getTransactionByID).mockResolvedValue(
    transaction,
  );
  vi.mocked(TRANSACTION_HANDLER.createOrUpdate).mockResolvedValue(undefined);
  vi.mocked(invoke).mockResolvedValue(undefined);
});

it("limits a coin profit query to that symbol's snapshot and transaction rows", async () => {
  const result = await calculateTotalProfit(dateRange, "BTC", "crypto");
  expect(result.coins.map((coin) => coin.symbol)).toEqual(["BTC"]);
  expect(ASSET_HANDLER.listAssetsBySymbolByDateRange).toHaveBeenCalledWith("BTC", dateRange.start, dateRange.end);
  expect(TRANSACTION_HANDLER.listTransactionsByDateRange).toHaveBeenCalledWith(
    new Date(dateRange.start.getTime() - 7 * 86_400_000),
    new Date(dateRange.end.getTime() + 7 * 86_400_000),
    "BTC",
  );
});

it("matches the portfolio coin P&L when a snapshot between holdings has no coin row", async () => {
  const prior = { ...earliestAsset, uuid: "prior", createdAt: "2024-03-31T00:00:00.000Z" };
  const gap = { ...earliestAsset, uuid: "gap", createdAt: "2024-04-15T00:00:00.000Z", symbol: "ETH", price: 150, value: 150 };
  const returnAsset = { ...latestAsset, uuid: "return", createdAt: "2024-04-30T00:00:00.000Z", price: 200, value: 200 };
  const buy = { ...transaction, uuid: "return", txnCreatedAt: returnAsset.createdAt, price: 190 };
  vi.mocked(ASSET_HANDLER.listLastSnapshotBefore).mockResolvedValue([prior]);
  vi.mocked(ASSET_HANDLER.listAssetsByDateRange).mockResolvedValue([[returnAsset], [gap]]);
  vi.mocked(ASSET_HANDLER.listAssetsBySymbolByDateRange).mockResolvedValue([[returnAsset]]);
  vi.mocked(TRANSACTION_HANDLER.listTransactionsByDateRange).mockResolvedValue([[buy]]);
  vi.mocked(ASSET_HANDLER.listSnapshotDatesByDateRange).mockResolvedValue([
    { uuid: "return", createdAt: returnAsset.createdAt },
    { uuid: "gap", createdAt: gap.createdAt },
  ]);

  const portfolio = await calculateTotalProfit(dateRange);
  const coinPage = await calculateTotalProfit(dateRange, "BTC", "crypto");
  expect(portfolio.coins.find((coin) => coin.symbol === "BTC")).toMatchObject({
    value: 10, unrecordedChange: -100,
  });
  expect(coinPage.coins.find((coin) => coin.symbol === "BTC")).toMatchObject({
    value: 10, unrecordedChange: -100,
  });
});

it("finds the opening baseline before the requested start", async () => {
  vi.mocked(selectFromDatabaseWithSql).mockResolvedValueOnce([
    { createdAt: "2026-04-04T12:00:00.000Z" },
  ]);
  const start = new Date(2026, 9, 1);
  expect(await queryPreviousProfitSnapshotDate(start)).toEqual(new Date("2026-04-04T12:00:00.000Z"));
  expect(selectFromDatabaseWithSql).toHaveBeenCalledWith(
    `SELECT MAX(createdAt) AS createdAt FROM assets_v2 WHERE createdAt < ?`,
    [start.toISOString()],
  );
});

async function warmProfitCache() {
  await calculateTotalProfit(dateRange, "BTC", "crypto");
  await calculateTotalProfit(dateRange, "BTC", "crypto");
  expect(ASSET_HANDLER.listAssetsBySymbolByDateRange).toHaveBeenCalledTimes(1);
  expect(
    TRANSACTION_HANDLER.listTransactionsByDateRange,
  ).toHaveBeenCalledTimes(1);
}

describe("transaction mutations invalidate the total-profit cache", () => {
  it.each([
    ["price", () => updateTransactionPrice(42, 110), "update_local_transaction_price", { id: 42, price: 110 }],
    ["type", () => updateTransactionTxnType(42, "sell"), "update_local_transaction_type", { id: 42, txnType: "sell" }],
  ] as const)("sends a %s edit through the transactional backend", async (_label, update, command, values) => {
    await update();
    expect(invoke).toHaveBeenCalledWith(command, values);
  });

  it("requeries profit handlers after a successful price update", async () => {
    await warmProfitCache();

    await updateTransactionPrice(42, 110);

    expect(cache.clearCache).toHaveBeenCalledTimes(1);
    await calculateTotalProfit(dateRange, "BTC", "crypto");
    expect(ASSET_HANDLER.listAssetsBySymbolByDateRange).toHaveBeenCalledTimes(2);
    expect(
      TRANSACTION_HANDLER.listTransactionsByDateRange,
    ).toHaveBeenCalledTimes(2);
  });

  it("requeries profit handlers after a successful type update", async () => {
    await warmProfitCache();

    await updateTransactionTxnType(42, "sell");

    expect(cache.clearCache).toHaveBeenCalledTimes(1);
    await calculateTotalProfit(dateRange, "BTC", "crypto");
    expect(ASSET_HANDLER.listAssetsBySymbolByDateRange).toHaveBeenCalledTimes(2);
    expect(
      TRANSACTION_HANDLER.listTransactionsByDateRange,
    ).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["price", () => updateTransactionPrice(42, 110)],
    ["type", () => updateTransactionTxnType(42, "sell")],
  ])("keeps the warm cache when a %s update fails", async (_label, update) => {
    await warmProfitCache();
    vi.mocked(invoke).mockRejectedValueOnce(
      new Error("write failed"),
    );

    await expect(update()).rejects.toThrow("write failed");

    expect(cache.clearCache).not.toHaveBeenCalled();
    await calculateTotalProfit(dateRange, "BTC", "crypto");
    expect(ASSET_HANDLER.listAssetsBySymbolByDateRange).toHaveBeenCalledTimes(1);
    expect(
      TRANSACTION_HANDLER.listTransactionsByDateRange,
    ).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["price", () => updateTransactionPrice(42, 110)],
    ["type", () => updateTransactionTxnType(42, "sell")],
  ])(
    "commits a %s update and bypasses stale profit data when storage cache clearing fails",
    async (_label, update) => {
      await warmProfitCache();
      cache.clearCache.mockImplementationOnce(() => {
        throw new Error("local storage unavailable");
      });

      await expect(update()).resolves.toBeUndefined();

      await calculateTotalProfit(dateRange, "BTC", "crypto");
      expect(ASSET_HANDLER.listAssetsBySymbolByDateRange).toHaveBeenCalledTimes(2);
      expect(
        TRANSACTION_HANDLER.listTransactionsByDateRange,
      ).toHaveBeenCalledTimes(2);
    },
  );
});

it("counts a sale before a later same-snapshot transfer in Profit", async () => {
  const transactions: TransactionModel[] = [
    { ...transaction, id: 1, assetID: 1, uuid: "r0", wallet: "w1", amount: 1, price: 100, txnType: "buy", txnCreatedAt: "2024-04-01T00:00:00.000Z" },
    { ...transaction, id: 2, assetID: 2, uuid: "r0", wallet: "w3", amount: 1, price: 100, txnType: "buy", txnCreatedAt: "2024-04-01T00:00:00.000Z" },
    { ...transaction, id: 3, assetID: 1, uuid: "r1", wallet: "w1", amount: 1, price: 200, txnType: "sell", txnCreatedAt: "2024-04-02T00:00:00.000Z" },
    { ...transaction, id: 4, assetID: 2, uuid: "r2", wallet: "w3", amount: 1, price: 210, txnType: "sell", txnCreatedAt: "2024-04-03T00:00:00.000Z" },
    { ...transaction, id: 5, assetID: 3, uuid: "r2", wallet: "w2", amount: 1, price: 210, txnType: "buy", txnCreatedAt: "2024-04-03T00:00:00.000Z" },
  ];
  vi.mocked(ASSET_HANDLER.listAssetsBySymbolByDateRange).mockResolvedValue([
    [{ ...latestAsset, id: 1, uuid: "r0", wallet: "w1", price: 100, value: 100, createdAt: "2024-04-01T00:00:00.000Z" },
      { ...latestAsset, id: 2, uuid: "r0", wallet: "w3", price: 100, value: 100, createdAt: "2024-04-01T00:00:00.000Z" }],
    [{ ...latestAsset, id: 2, uuid: "r1", wallet: "w3", price: 200, value: 200, createdAt: "2024-04-02T00:00:00.000Z" }],
    [{ ...latestAsset, id: 3, uuid: "r2", wallet: "w2", price: 210, value: 210, createdAt: "2024-04-03T00:00:00.000Z" }],
  ]);
  vi.mocked(ASSET_HANDLER.listSnapshotDatesByDateRange).mockResolvedValue([
    { uuid: "r0", createdAt: "2024-04-01T00:00:00.000Z" },
    { uuid: "r1", createdAt: "2024-04-02T00:00:00.000Z" },
    { uuid: "r2", createdAt: "2024-04-03T00:00:00.000Z" },
  ]);
  vi.mocked(TRANSACTION_HANDLER.listTransactionsByDateRange).mockResolvedValue([transactions]);

  const result = await calculateTotalProfit(dateRange, "BTC", "crypto");
  expect(result.total).toBe(210);
  expect(result.coins).toEqual([
    expect.objectContaining({ buyAmount: 2, sellAmount: 1, value: 210 }),
  ]);
});
