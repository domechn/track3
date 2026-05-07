import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateTotalProfit, queryTopCoinsRank } from "./charts";
import { ASSET_HANDLER } from "./entities/assets";
import { TRANSACTION_HANDLER } from "./entities/transactions";

vi.mock("./data", () => ({
  loadPortfolios: vi.fn(),
  queryCoinPrices: vi.fn(),
  queryStableCoins: vi.fn(),
}));

vi.mock("./configuration", () => ({
  getConfiguration: vi.fn(),
  getBlacklistCoins: vi.fn().mockResolvedValue([]),
  saveStableCoins: vi.fn(),
}));

vi.mock("../utils/color", () => ({
  generateRandomColors: vi.fn((count: number) =>
    Array.from({ length: count }, (_value, idx) => ({
      R: 80 + idx,
      G: 120 + idx,
      B: 160 + idx,
    })),
  ),
}));

vi.mock("./wallet", () => ({
  WalletAnalyzer: class {
    constructor(_listAssets: unknown) {}
  },
}));

vi.mock("./datafetch/coins/others", () => ({
  OthersAnalyzer: { wallet: "others" },
}));

vi.mock("./license", () => ({
  isProVersion: vi.fn(),
}));

vi.mock("./datafetch/utils/cache", () => ({
  getLocalStorageCacheInstance: vi.fn(() => ({
    getCache: vi.fn(),
    setCache: vi.fn(),
    clearCache: vi.fn(),
  })),
  getMemoryCacheInstance: vi.fn(() => ({
    getCache: vi.fn(),
    setCache: vi.fn(),
    clearCache: vi.fn(),
  })),
}));

vi.mock("./consts", () => ({
  CACHE_GROUP_KEYS: {
    REALTIME_ASSET_VALUES_CACHE_GROUP_KEY: "realtime-assets",
    TOTAL_PROFIT_CACHE_GROUP_KEY: "total-profit",
  },
}));

vi.mock("./entities/assets", () => ({
  ASSET_HANDLER: {
    listAssets: vi.fn(),
    listAssetsMaxCreatedAt: vi.fn(),
    listAssetsMinCreatedAt: vi.fn(),
    listSymbolGroupedAssetsByDateRange: vi.fn(),
  },
}));

vi.mock("./entities/transactions", () => ({
  TRANSACTION_HANDLER: {
    listTransactionsByDateRange: vi.fn(),
    saveTransactions: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("charts asset type handling", () => {
  it("keeps same-symbol stock and crypto ranks separate", async () => {
    vi.mocked(ASSET_HANDLER.listSymbolGroupedAssetsByDateRange).mockResolvedValue(
      [
        [
          {
            id: 1,
            uuid: "u1",
            createdAt: "2024-04-01T00:00:00.000Z",
            symbol: "BTC",
            assetType: "crypto",
            amount: 1,
            value: 100,
            price: 100,
            wallet: "wallet-1",
          },
          {
            id: 2,
            uuid: "u1",
            createdAt: "2024-04-01T00:00:00.000Z",
            symbol: "BTC",
            assetType: "stock",
            amount: 1,
            value: 50,
            price: 50,
            wallet: "broker-1",
          },
        ],
      ] as never,
    );

    const result = await queryTopCoinsRank({
      start: new Date("2024-04-01T00:00:00.000Z"),
      end: new Date("2024-04-02T00:00:00.000Z"),
    });

    expect(result.coins).toEqual([
      {
        coin: "BTC",
        assetType: "crypto",
        lineColor: "rgba(80, 120, 160, 1)",
        rankData: [{ timestamp: new Date("2024-04-01T00:00:00.000Z").getTime(), rank: 1 }],
      },
      {
        coin: "BTC",
        assetType: "stock",
        lineColor: "rgba(81, 121, 161, 1)",
        rankData: [{ timestamp: new Date("2024-04-01T00:00:00.000Z").getTime(), rank: 2 }],
      },
    ]);
  });

  it("filters total profit by asset type for same-symbol assets", async () => {
    const dateRange = {
      start: new Date("2024-04-01T00:00:00.000Z"),
      end: new Date("2024-04-30T00:00:00.000Z"),
    };

    vi.mocked(ASSET_HANDLER.listAssetsMaxCreatedAt).mockResolvedValue([
      {
        id: 10,
        uuid: "latest-stock",
        createdAt: "2024-04-30T00:00:00.000Z",
        symbol: "BTC",
        assetType: "stock",
        amount: 2,
        value: 30,
        price: 15,
        wallet: "broker-1",
      },
      {
        id: 11,
        uuid: "latest-crypto",
        createdAt: "2024-04-30T00:00:00.000Z",
        symbol: "BTC",
        assetType: "crypto",
        amount: 1,
        value: 100000,
        price: 100000,
        wallet: "wallet-1",
      },
    ] as never);

    vi.mocked(ASSET_HANDLER.listAssetsMinCreatedAt).mockResolvedValue([
      {
        id: 1,
        uuid: "earliest-stock",
        createdAt: "2024-04-01T00:00:00.000Z",
        symbol: "BTC",
        assetType: "stock",
        amount: 1,
        value: 10,
        price: 10,
        wallet: "broker-1",
      },
      {
        id: 2,
        uuid: "earliest-crypto",
        createdAt: "2024-04-01T00:00:00.000Z",
        symbol: "BTC",
        assetType: "crypto",
        amount: 1,
        value: 90000,
        price: 90000,
        wallet: "wallet-1",
      },
    ] as never);

    vi.mocked(TRANSACTION_HANDLER.listTransactionsByDateRange).mockResolvedValue([
      [
        {
          id: 100,
          uuid: "stock-buy",
          assetID: 1,
          assetType: "stock",
          wallet: "broker-1",
          symbol: "BTC",
          amount: 1,
          price: 10,
          txnType: "buy",
          txnCreatedAt: "2024-04-01T00:00:00.000Z",
          createdAt: "2024-04-01T00:00:00.000Z",
          updatedAt: "2024-04-01T00:00:00.000Z",
        },
        {
          id: 101,
          uuid: "crypto-buy",
          assetID: 2,
          assetType: "crypto",
          wallet: "wallet-1",
          symbol: "BTC",
          amount: 1,
          price: 90000,
          txnType: "buy",
          txnCreatedAt: "2024-04-01T00:00:00.000Z",
          createdAt: "2024-04-01T00:00:00.000Z",
          updatedAt: "2024-04-01T00:00:00.000Z",
        },
      ],
    ] as never);

    const result = await calculateTotalProfit(dateRange, "BTC", "stock");

    expect(result.coins).toEqual([
      {
        symbol: "BTC",
        assetType: "stock",
        value: 10,
        realSpentValue: 10,
        buyAmount: 1,
        sellAmount: 0,
        costAvgPrice: 10,
        sellAvgPrice: 0,
        percentage: 100,
      },
    ]);
    expect(result.total).toBe(10);
    expect(result.percentage).toBe(100);
  });
});