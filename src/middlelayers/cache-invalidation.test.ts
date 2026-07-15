import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetModel, TransactionModel } from "./types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("./database", () => ({
  executeWrite: vi.fn(),
  executeWriteWork: vi.fn(),
  getLatestCommittedRefreshCreatedAt: vi.fn(),
}));

vi.mock("./data", () => ({
  fetchPortfolios: vi.fn(),
  queryCoinPrices: vi.fn(),
  queryStableCoins: vi.fn(),
}));

vi.mock("./configuration", () => ({
  getConfiguration: vi.fn(),
  getBlacklistCoins: vi.fn(),
  getPortfolioInputGeneration: vi.fn(),
  saveStableCoins: vi.fn(),
}));

vi.mock("./wallet", () => ({
  WalletAnalyzer: class {
    constructor(_listAssets: unknown) {}
  },
}));

vi.mock("./datafetch/coins/others", () => ({
  OthersAnalyzer: { wallet: "others" },
}));

vi.mock("./datafetch/utils/price", () => ({
  fetchStockPrices: vi.fn(),
}));

vi.mock("./license", () => ({
  isProVersion: vi.fn(),
}));

vi.mock("./entities/assets", () => ({
  ASSET_HANDLER: {
    listAssetsMaxCreatedAt: vi.fn(),
    listAssetsMinCreatedAt: vi.fn(),
    listSymbolGroupedAssets: vi.fn(),
    listAssets: vi.fn(),
  },
}));

vi.mock("./entities/transactions", () => ({
  TRANSACTION_HANDLER: {
    listTransactionsByDateRange: vi.fn(),
  },
}));

import {
  getCacheGroupEpoch,
  invalidateCacheGroups,
} from "./datafetch/utils/cache";
import { CACHE_GROUP_KEYS } from "./consts";
import { calculateTotalProfit } from "./charts-profit";
import { queryRealTimeAssetsValue } from "./charts-refresh";
import { ASSET_HANDLER } from "./entities/assets";
import { TRANSACTION_HANDLER } from "./entities/transactions";
import {
  getBlacklistCoins,
  getConfiguration,
  saveStableCoins,
} from "./configuration";
import { queryCoinPrices, queryStableCoins } from "./data";
import { fetchStockPrices } from "./datafetch/utils/price";
import { isProVersion } from "./license";

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
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(ASSET_HANDLER.listAssetsMaxCreatedAt).mockResolvedValue([
    latestAsset,
  ]);
  vi.mocked(ASSET_HANDLER.listAssetsMinCreatedAt).mockResolvedValue([
    { ...latestAsset, createdAt: "2024-04-01T00:00:00.000Z" },
  ]);
  vi.mocked(
    TRANSACTION_HANDLER.listTransactionsByDateRange,
  ).mockResolvedValue([[transaction]]);
  vi.mocked(ASSET_HANDLER.listSymbolGroupedAssets).mockResolvedValue([
    [latestAsset],
  ]);
  vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([[latestAsset]]);
  vi.mocked(getConfiguration).mockResolvedValue({
    configs: { groupUSD: false },
  } as never);
  vi.mocked(getBlacklistCoins).mockResolvedValue([]);
  vi.mocked(queryCoinPrices).mockResolvedValue({ BTC: 120, USDT: 1 });
  vi.mocked(queryStableCoins).mockResolvedValue([]);
  vi.mocked(saveStableCoins).mockResolvedValue(undefined as never);
  vi.mocked(fetchStockPrices).mockResolvedValue({});
  vi.mocked(isProVersion).mockResolvedValue({ isPro: false });
});

describe("generic data cache invalidation", () => {
  it("advances both epochs before storage cleanup and requeries both handlers when cleanup fails", async () => {
    await calculateTotalProfit(dateRange, "BTC", "crypto");
    await calculateTotalProfit(dateRange, "BTC", "crypto");
    await queryRealTimeAssetsValue();
    await queryRealTimeAssetsValue();

    expect(ASSET_HANDLER.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(1);
    expect(ASSET_HANDLER.listSymbolGroupedAssets).toHaveBeenCalledTimes(1);

    const profitEpoch = getCacheGroupEpoch(
      CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY,
    );
    const realtimeEpoch = getCacheGroupEpoch(
      CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY,
    );
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        expect(
          getCacheGroupEpoch(
            CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY,
          ),
        ).toBe(profitEpoch + 1);
        expect(
          getCacheGroupEpoch(
            CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY,
          ),
        ).toBe(realtimeEpoch + 1);
        throw new Error("sensitive local storage failure");
      });

    try {
      expect(() =>
        invalidateCacheGroups({
          localStorage: [
            CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY,
          ],
          memory: [
            CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY,
          ],
        }),
      ).not.toThrow();

      expect(
        getCacheGroupEpoch(
          CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY,
        ),
      ).toBe(profitEpoch + 1);
      expect(
        getCacheGroupEpoch(
          CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY,
        ),
      ).toBe(realtimeEpoch + 1);

      await calculateTotalProfit(dateRange, "BTC", "crypto");
      await queryRealTimeAssetsValue();

      expect(ASSET_HANDLER.listAssetsMaxCreatedAt).toHaveBeenCalledTimes(2);
      expect(ASSET_HANDLER.listSymbolGroupedAssets).toHaveBeenCalledTimes(2);
      expect(consoleWarn).toHaveBeenCalledWith(
        "local storage cache cleanup failed",
      );
      expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain(
        "sensitive local storage failure",
      );
    } finally {
      removeItem.mockRestore();
      consoleWarn.mockRestore();
    }
  });
});
