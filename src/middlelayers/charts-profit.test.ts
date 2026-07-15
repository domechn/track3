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
  executeWrite: vi.fn(),
}));

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
  updateTransactionPrice,
  updateTransactionTxnType,
} from "./charts-profit";
import { executeWrite } from "./database";
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
  vi.mocked(executeWrite).mockResolvedValue({ rowsAffected: 1 });
});

async function warmProfitCache() {
  await calculateTotalProfit(dateRange, "BTC", "crypto");
  await calculateTotalProfit(dateRange, "BTC", "crypto");
  expect(ASSET_HANDLER.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(1);
  expect(
    TRANSACTION_HANDLER.listTransactionsByDateRange,
  ).toHaveBeenCalledTimes(1);
}

describe("transaction mutations invalidate the total-profit cache", () => {
  it.each([
    {
      label: "price",
      update: () => updateTransactionPrice(42, 110),
      sql: "UPDATE transactions SET price = ?, updatedAt = ? WHERE id = ?",
      values: [110, "2026-07-15T04:05:06.789Z", 42],
    },
    {
      label: "type",
      update: () => updateTransactionTxnType(42, "sell"),
      sql: "UPDATE transactions SET txnType = ?, updatedAt = ? WHERE id = ?",
      values: ["sell", "2026-07-15T04:05:06.789Z", 42],
    },
  ])("updates updatedAt with the $label field", async ({ update, sql, values }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T04:05:06.789Z"));
    try {
      await update();

      expect(executeWrite).toHaveBeenCalledWith(sql, values);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses queued field updates so concurrent price and type changes are both preserved", async () => {
    const persisted = { price: transaction.price, txnType: transaction.txnType };
    let releasePriceWrite: (() => void) | undefined;
    const priceWriteBlocked = new Promise<void>((resolve) => {
      releasePriceWrite = resolve;
    });

    vi.mocked(executeWrite).mockImplementation(async (sql, values) => {
      if (
        sql ===
        "UPDATE transactions SET price = ?, updatedAt = ? WHERE id = ?"
      ) {
        await priceWriteBlocked;
        persisted.price = values?.[0] as number;
      } else if (
        sql ===
        "UPDATE transactions SET txnType = ?, updatedAt = ? WHERE id = ?"
      ) {
        persisted.txnType = values?.[0] as TransactionModel["txnType"];
      }
      return { rowsAffected: 1 };
    });

    const priceUpdate = updateTransactionPrice(42, 110);
    const typeUpdate = updateTransactionTxnType(42, "sell");

    await vi.waitFor(() => {
      expect(executeWrite).toHaveBeenCalledTimes(2);
    });
    releasePriceWrite?.();
    await Promise.all([priceUpdate, typeUpdate]);

    expect(executeWrite).toHaveBeenNthCalledWith(
      1,
      "UPDATE transactions SET price = ?, updatedAt = ? WHERE id = ?",
      [110, expect.any(String), 42],
    );
    expect(executeWrite).toHaveBeenNthCalledWith(
      2,
      "UPDATE transactions SET txnType = ?, updatedAt = ? WHERE id = ?",
      ["sell", expect.any(String), 42],
    );
    expect(persisted).toEqual({ price: 110, txnType: "sell" });
    expect(TRANSACTION_HANDLER.getTransactionByID).not.toHaveBeenCalled();
    expect(TRANSACTION_HANDLER.createOrUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["price", () => updateTransactionPrice(404, 110)],
    ["type", () => updateTransactionTxnType(404, "sell")],
  ])("rejects a %s update when the transaction does not exist", async (_label, update) => {
    vi.mocked(executeWrite).mockResolvedValueOnce({ rowsAffected: 0 });

    await expect(update()).rejects.toThrow("Transaction with id 404 not found");

    expect(cache.clearCache).not.toHaveBeenCalled();
  });

  it("requeries profit handlers after a successful price update", async () => {
    await warmProfitCache();

    await updateTransactionPrice(42, 110);

    expect(cache.clearCache).toHaveBeenCalledTimes(1);
    await calculateTotalProfit(dateRange, "BTC", "crypto");
    expect(ASSET_HANDLER.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(2);
    expect(
      TRANSACTION_HANDLER.listTransactionsByDateRange,
    ).toHaveBeenCalledTimes(2);
  });

  it("requeries profit handlers after a successful type update", async () => {
    await warmProfitCache();

    await updateTransactionTxnType(42, "sell");

    expect(cache.clearCache).toHaveBeenCalledTimes(1);
    await calculateTotalProfit(dateRange, "BTC", "crypto");
    expect(ASSET_HANDLER.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(2);
    expect(
      TRANSACTION_HANDLER.listTransactionsByDateRange,
    ).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["price", () => updateTransactionPrice(42, 110)],
    ["type", () => updateTransactionTxnType(42, "sell")],
  ])("keeps the warm cache when a %s update fails", async (_label, update) => {
    await warmProfitCache();
    vi.mocked(executeWrite).mockRejectedValueOnce(
      new Error("write failed"),
    );

    await expect(update()).rejects.toThrow("write failed");

    expect(cache.clearCache).not.toHaveBeenCalled();
    await calculateTotalProfit(dateRange, "BTC", "crypto");
    expect(ASSET_HANDLER.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(1);
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
      expect(ASSET_HANDLER.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(2);
      expect(
        TRANSACTION_HANDLER.listTransactionsByDateRange,
      ).toHaveBeenCalledTimes(2);
    },
  );
});
