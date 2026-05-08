import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBlacklistCoins } from "./configuration";
import { ASSET_HANDLER } from "./entities/assets";
import { queryLatestAssets, queryLatestAssetsPercentage } from "./charts";

vi.mock("./data", () => ({
  loadPortfolios: vi.fn(),
  queryCoinPrices: vi.fn(),
  queryStableCoins: vi.fn(),
}));

vi.mock("./configuration", () => ({
  getConfiguration: vi.fn(),
  getBlacklistCoins: vi.fn(),
  saveStableCoins: vi.fn(),
}));

vi.mock("../utils/color", () => ({
  generateRandomColors: vi.fn((count: number) =>
    Array.from({ length: count }, (_value, idx) => ({
      R: 20 + idx,
      G: 40 + idx,
      B: 60 + idx,
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

vi.mock("./datafetch/utils/coins", () => ({
  calculateTotalValue: vi.fn(),
  getAssetType: vi.fn(
    (asset?: { assetType?: "crypto" | "stock" }) =>
      asset?.assetType ?? "crypto",
  ),
}));

vi.mock("./license", () => ({
  isProVersion: vi.fn(),
}));

vi.mock("./datafetch/utils/cache", () => ({
  getLocalStorageCacheInstance: vi.fn(),
  getMemoryCacheInstance: vi.fn(() => ({
    getCache: vi.fn(),
    setCache: vi.fn(),
    clearCache: vi.fn(),
  })),
}));

vi.mock("./consts", () => ({
  CACHE_GROUP_KEYS: {
    REALTIME_ASSET_VALUES_CACHE_GROUP_KEY: "realtime-assets",
  },
}));

vi.mock("./entities/assets", () => ({
  ASSET_HANDLER: {
    listAssets: vi.fn(),
    listSymbolGroupedAssets: vi.fn(),
    listSymbolGroupedAssetsByDateRange: vi.fn(),
  },
}));

vi.mock("./entities/transactions", () => ({
  TRANSACTION_HANDLER: {
    saveTransactions: vi.fn(),
  },
}));

const latestAssets = [
  [
    { symbol: "BTC", amount: 1, value: 100 },
    { symbol: "eth", amount: 2, value: 50 },
    { symbol: "DOGE", amount: 0, value: 0 },
  ],
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBlacklistCoins).mockResolvedValue([]);
});

describe("charts blacklist filtering", () => {
  it("excludes blacklisted symbols from latest assets regardless of case", async () => {
    vi.mocked(getBlacklistCoins).mockResolvedValue(["ETH"]);
    vi.mocked(ASSET_HANDLER.listSymbolGroupedAssets).mockResolvedValue(
      latestAssets as never,
    );

    await expect(queryLatestAssets()).resolves.toEqual([
      {
        symbol: "BTC",
        assetType: "crypto",
        amount: 1,
        value: 100,
        price: 100,
      },
    ]);
  });

  it("excludes blacklisted symbols before calculating latest asset percentages", async () => {
    const dateRange = {
      start: new Date("2024-04-01T00:00:00.000Z"),
      end: new Date("2024-04-30T00:00:00.000Z"),
    };
    vi.mocked(getBlacklistCoins).mockResolvedValue(["eth"]);
    vi.mocked(
      ASSET_HANDLER.listSymbolGroupedAssetsByDateRange,
    ).mockResolvedValue([
      [
        { symbol: "BTC", amount: 1, value: 80 },
        { symbol: "ETH", amount: 2, value: 20 },
        { symbol: "USDT", amount: 20, value: 20 },
      ],
    ] as never);

    const result = await queryLatestAssetsPercentage(dateRange);

    expect(
      ASSET_HANDLER.listSymbolGroupedAssetsByDateRange,
    ).toHaveBeenCalledWith(dateRange.start, dateRange.end);
    expect(result.map((item) => item.coin)).toEqual(["BTC", "USDT"]);
    expect(result[0].percentage).toBeCloseTo(80);
    expect(result[1].percentage).toBeCloseTo(20);
  });
});
