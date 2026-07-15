import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetModel, TransactionModel } from "./types";

const mocks = vi.hoisted(() => ({
  listAssetsMaxCreatedAt: vi.fn(),
  listAssetsMinCreatedAt: vi.fn(),
  listTransactionsByDateRange: vi.fn(),
}));

vi.mock("./database", () => ({
  executeWrite: vi.fn(),
}));

vi.mock("./entities/assets", () => ({
  ASSET_HANDLER: {
    listAssetsMaxCreatedAt: mocks.listAssetsMaxCreatedAt,
    listAssetsMinCreatedAt: mocks.listAssetsMinCreatedAt,
  },
}));

vi.mock("./entities/transactions", () => ({
  TRANSACTION_HANDLER: {
    listTransactionsByDateRange: mocks.listTransactionsByDateRange,
  },
}));

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
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  mocks.listAssetsMaxCreatedAt.mockResolvedValue([latestAsset]);
  mocks.listAssetsMinCreatedAt.mockResolvedValue([
    { ...latestAsset, createdAt: "2024-04-01T00:00:00.000Z" },
  ]);
  mocks.listTransactionsByDateRange.mockResolvedValue([[transaction]]);
});

async function loadProfitModules() {
  const profit = await import("./charts-profit");
  const cache = await import("./datafetch/utils/cache");
  return { profit, cache };
}

async function warmProfitCache() {
  const modules = await loadProfitModules();
  await modules.profit.calculateTotalProfit(dateRange, "BTC", "crypto");
  await modules.profit.calculateTotalProfit(dateRange, "BTC", "crypto");
  expect(mocks.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(1);
  return modules;
}

function profitCacheKeys() {
  return Object.keys(localStorage).filter((key) =>
    key.startsWith("total-profit/"),
  );
}

describe("persistent total-profit cache epochs", () => {
  it("returns fresh profit data without trusting cache when storage writes fail", async () => {
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("sensitive storage write failure");
      });

    try {
      const { calculateTotalProfit } = await import("./charts-profit");
      const first = await calculateTotalProfit(dateRange, "BTC", "crypto");
      const second = await calculateTotalProfit(dateRange, "BTC", "crypto");

      expect(first.total).toBe(second.total);
      expect(mocks.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(2);
      expect(consoleWarn).toHaveBeenCalledWith(
        "cache epoch persistence failed",
      );
      expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain(
        "sensitive storage write failure",
      );
    } finally {
      setItem.mockRestore();
      consoleWarn.mockRestore();
    }
  });

  it("stores total-profit entries with an explicit TTL", async () => {
    await warmProfitCache();

    const [cacheKey] = profitCacheKeys();
    expect(cacheKey).toBeDefined();
    const cached = JSON.parse(localStorage.getItem(cacheKey!) ?? "{}") as {
      validUntil?: number;
    };
    expect(cached.validUntil).toBeGreaterThan(Date.now());
  });

  it("treats an expired entry as a miss when deleting it fails", async () => {
    const { profit } = await warmProfitCache();
    const [cacheKey] = profitCacheKeys();
    expect(cacheKey).toBeDefined();
    const cached = JSON.parse(localStorage.getItem(cacheKey!) ?? "{}") as {
      validUntil: number;
    };
    cached.validUntil = Date.now() - 1;
    localStorage.setItem(cacheKey!, JSON.stringify(cached));

    const originalRemoveItem = Storage.prototype.removeItem;
    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation((key) => {
        if (key === cacheKey) {
          throw new Error("sensitive expired cache removal failure");
        }
        return originalRemoveItem.call(localStorage, key);
      });
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    try {
      await expect(
        profit.calculateTotalProfit(dateRange, "BTC", "crypto"),
      ).resolves.toBeDefined();
      expect(mocks.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(2);
      expect(consoleWarn).toHaveBeenCalledWith(
        "expired cache cleanup failed",
      );
      expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain(
        "sensitive expired cache removal failure",
      );
    } finally {
      removeItem.mockRestore();
      consoleWarn.mockRestore();
    }
  });

  it("persists the new epoch before failed entry removal so a restart misses stale data", async () => {
    const { profit } = await warmProfitCache();
    const originalRemoveItem = Storage.prototype.removeItem;
    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation((key) => {
        if (key.startsWith("total-profit/")) {
          throw new Error("sensitive cache removal failure");
        }
        return originalRemoveItem.call(localStorage, key);
      });

    try {
      profit.cleanTotalProfitCache();
      expect(profitCacheKeys()).toHaveLength(1);
    } finally {
      removeItem.mockRestore();
    }

    vi.resetModules();
    const restarted = await import("./charts-profit");
    await restarted.calculateTotalProfit(dateRange, "BTC", "crypto");

    expect(mocks.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(2);
  });

  it("fails closed across restart when persisting the new epoch fails", async () => {
    const { profit } = await warmProfitCache();
    const originalRemoveItem = Storage.prototype.removeItem;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("sensitive epoch persistence failure");
      });
    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation((key) => {
        if (key.startsWith("total-profit/")) {
          throw new Error("sensitive cache removal failure");
        }
        return originalRemoveItem.call(localStorage, key);
      });

    try {
      expect(() => profit.cleanTotalProfitCache()).not.toThrow();
      expect(profitCacheKeys()).toHaveLength(1);
    } finally {
      setItem.mockRestore();
      removeItem.mockRestore();
    }

    vi.resetModules();
    const restarted = await import("./charts-profit");
    await restarted.calculateTotalProfit(dateRange, "BTC", "crypto");

    expect(mocks.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(2);
  });

  it("misses a prior process cache after every invalidation storage operation fails", async () => {
    const { profit } = await warmProfitCache();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("sensitive epoch persistence failure");
      });
    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new Error("sensitive storage removal failure");
      });

    try {
      expect(() => profit.cleanTotalProfitCache()).not.toThrow();
      expect(profitCacheKeys()).toHaveLength(1);
    } finally {
      setItem.mockRestore();
      removeItem.mockRestore();
    }

    vi.resetModules();
    const restarted = await import("./charts-profit");
    await restarted.calculateTotalProfit(dateRange, "BTC", "crypto");

    expect(mocks.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(2);
  });

  it("ignores legacy unversioned permanent cache entries", async () => {
    const legacyKey = [
      "total-profit/0",
      dateRange.start.getTime(),
      dateRange.end.getTime(),
      "BTC",
      "crypto",
    ].join("-");
    localStorage.setItem(
      legacyKey,
      JSON.stringify({
        validUntil: 0,
        data: { total: 999, percentage: 999, coins: [] },
      }),
    );

    const { calculateTotalProfit } = await import("./charts-profit");
    const result = await calculateTotalProfit(dateRange, "BTC", "crypto");

    expect(mocks.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(1);
    expect(result.total).not.toBe(999);
  });
});
