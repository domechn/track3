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
    listAssetsMaxCreatedAt: vi.fn(),
    listAssetsMinCreatedAt: vi.fn(),
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
  uuid: "refresh-1",
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

beforeEach(() => {
  vi.clearAllMocks();
  cache.values.clear();
  cache.epoch = 0;
  vi.mocked(ASSET_HANDLER.listAssetsMaxCreatedAt).mockResolvedValue([
    latestAsset,
  ]);
  vi.mocked(ASSET_HANDLER.listAssetsMinCreatedAt).mockResolvedValue([
    earliestAsset,
  ]);
  vi.mocked(
    TRANSACTION_HANDLER.listTransactionsByDateRange,
  ).mockResolvedValue([[transaction]]);
  vi.mocked(TRANSACTION_HANDLER.getTransactionByID).mockResolvedValue(
    transaction,
  );
  vi.mocked(TRANSACTION_HANDLER.createOrUpdate).mockResolvedValue(undefined);
  vi.mocked(invoke).mockResolvedValue(undefined);
});

it("finds the opening baseline, skipping a prior snapshot when one exists at month start", async () => {
  vi.mocked(selectFromDatabaseWithSql).mockResolvedValueOnce([
    { createdAt: "2026-04-04T12:00:00.000Z" },
  ]);
  const start = new Date(2026, 9, 1);
  expect(await queryPreviousProfitSnapshotDate(start)).toEqual(new Date("2026-04-04T12:00:00.000Z"));
  expect(selectFromDatabaseWithSql).toHaveBeenCalledWith(
    `SELECT CASE WHEN EXISTS (SELECT 1 FROM assets_v2 WHERE createdAt = ?)
      THEN NULL ELSE MAX(createdAt) END AS createdAt
      FROM assets_v2 WHERE createdAt < ?`,
    [start.toISOString(), start.toISOString()],
  );
});

async function warmProfitCache() {
  await calculateTotalProfit(dateRange, "BTC", "crypto");
  await calculateTotalProfit(dateRange, "BTC", "crypto");
  expect(ASSET_HANDLER.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(2);
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
    expect(ASSET_HANDLER.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(4);
    expect(
      TRANSACTION_HANDLER.listTransactionsByDateRange,
    ).toHaveBeenCalledTimes(2);
  });

  it("requeries profit handlers after a successful type update", async () => {
    await warmProfitCache();

    await updateTransactionTxnType(42, "sell");

    expect(cache.clearCache).toHaveBeenCalledTimes(1);
    await calculateTotalProfit(dateRange, "BTC", "crypto");
    expect(ASSET_HANDLER.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(4);
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
    expect(ASSET_HANDLER.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(2);
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
      expect(ASSET_HANDLER.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(4);
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
  vi.mocked(ASSET_HANDLER.listAssetsMaxCreatedAt).mockImplementation(async (start) =>
    start === undefined ? [] : [
      { ...latestAsset, id: 3, uuid: "r2", wallet: "w2", price: 210, value: 210, createdAt: "2024-04-03T00:00:00.000Z" },
    ]);
  vi.mocked(ASSET_HANDLER.listAssetsMinCreatedAt).mockResolvedValue([]);
  vi.mocked(TRANSACTION_HANDLER.listTransactionsByDateRange).mockResolvedValue([transactions]);

  const result = await calculateTotalProfit(dateRange, "BTC", "crypto");
  expect(result.total).toBe(210);
  expect(result.coins).toEqual([
    expect.objectContaining({ buyAmount: 2, sellAmount: 1, value: 210 }),
  ]);
});
