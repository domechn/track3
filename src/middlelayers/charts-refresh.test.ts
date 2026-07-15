import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import md5 from "md5";
import {
  executeWriteWork,
  getLatestCommittedRefreshCreatedAt,
} from "./database";
import {
  fetchPortfolios,
  loadPortfolios,
  queryCoinPrices,
  queryStableCoins,
} from "./data";
import {
  getBlacklistCoins,
  getConfiguration,
  getPortfolioInputGeneration,
  saveStableCoins,
} from "./configuration";
import { ASSET_HANDLER } from "./entities/assets";
import { TRANSACTION_HANDLER } from "./entities/transactions";
import { fetchStockPrices } from "./datafetch/utils/price";
import { isProVersion } from "./license";
import type { WalletCoin } from "./datafetch/types";
import type { AssetModel } from "./types";
import {
  generateTransactions,
  refreshAllData,
  type RefreshOperation,
} from "./charts-refresh";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("./database", () => ({
  executeWriteWork: vi.fn(),
  getLatestCommittedRefreshCreatedAt: vi.fn(),
}));

vi.mock("./data", () => ({
  fetchPortfolios: vi.fn(),
  loadPortfolios: vi.fn(),
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
  fetchStockPrices: vi.fn().mockResolvedValue({}),
}));

vi.mock("./license", () => ({
  isProVersion: vi.fn(),
}));

vi.mock("./datafetch/utils/cache", () => ({
  getCacheGroupEpoch: vi.fn(() => 0),
  getMemoryCacheInstance: vi.fn(() => ({
    getCache: vi.fn(),
    setCache: vi.fn(),
  })),
}));

vi.mock("./entities/assets", () => ({
  ASSET_HANDLER: {
    listAssets: vi.fn(),
    saveCoinsToDatabase: vi.fn(),
  },
}));

vi.mock("./entities/transactions", () => ({
  TRANSACTION_HANDLER: {
    saveTransactions: vi.fn(),
  },
}));

let operation: RefreshOperation & { refreshCreatedAt: string };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function serializeWriteWork() {
  let writeQueue: Promise<void> = Promise.resolve();
  vi.mocked(executeWriteWork).mockImplementation((callback) => {
    const result = writeQueue.then(() => callback({} as never));
    writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  });
}

function mockCommittedRefreshMarkers() {
  let latestCommittedTimestamp: string | undefined;
  const payloads: Array<{
    operationUuid: string;
    createdAt: string;
    assets: unknown[];
    txns: unknown[];
  }> = [];
  vi.mocked(getLatestCommittedRefreshCreatedAt).mockImplementation(
    async () => latestCommittedTimestamp,
  );
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    expect(command).toBe("persist_refresh");
    const payload = args as (typeof payloads)[number];
    payloads.push(payload);
    latestCommittedTimestamp = payload.createdAt;
  });
  return payloads;
}

function mockCanonicalStablecoinDiff(
  beforeAmount: number,
  afterAmount: number,
  blacklistedSymbols: string[] = [],
) {
  const wallet = "wallet-a";
  const storedWallet = md5(wallet);
  vi.mocked(getConfiguration).mockResolvedValue({
    configs: { groupUSD: true },
  } as never);
  vi.mocked(queryStableCoins).mockResolvedValue(["USDT", "USDC"]);
  vi.mocked(getBlacklistCoins).mockResolvedValue(blacklistedSymbols);
  vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([
    [
      {
        id: 41,
        uuid: "old-snapshot",
        createdAt: "2026-07-13T01:02:03.000Z",
        assetType: "crypto",
        wallet: storedWallet,
        symbol: "USDC",
        amount: beforeAmount,
        value: beforeAmount,
        price: 1,
      },
    ],
  ] as never);
  vi.mocked(fetchPortfolios).mockResolvedValue({
    coins: [
      {
        assetType: "crypto",
        wallet,
        symbol: "USDT",
        amount: afterAmount,
        price: { base: "usd", value: 1 },
      },
    ],
    failedSources: [
      {
        analyzerName: "CEX Analyzer",
        walletIdentities: [wallet],
        error: "Binance maintenance",
      },
    ],
  } as never);

  return storedWallet;
}

beforeEach(() => {
  vi.resetAllMocks();
  operation = {
    operationUuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    refreshCreatedAt: "2026-07-14T08:09:10.123Z",
  };
  vi.mocked(executeWriteWork).mockImplementation(async (callback) =>
    callback({} as never),
  );
  vi.mocked(getLatestCommittedRefreshCreatedAt).mockResolvedValue(undefined);
  vi.mocked(invoke).mockResolvedValue(undefined);
  vi.mocked(getConfiguration).mockResolvedValue({
    configs: { groupUSD: false },
  } as never);
  vi.mocked(getPortfolioInputGeneration).mockReturnValue(0);
  vi.mocked(getBlacklistCoins).mockResolvedValue([]);
  vi.mocked(saveStableCoins).mockResolvedValue(undefined as never);
  vi.mocked(queryStableCoins).mockResolvedValue([]);
  vi.mocked(queryCoinPrices).mockResolvedValue({ USDT: 1, BTC: 100 });
  vi.mocked(fetchStockPrices).mockResolvedValue({});
  vi.mocked(isProVersion).mockResolvedValue({ isPro: false });
});

describe("generateTransactions", () => {
  it("uses the refresh timestamp and identity for new, changed, and removed assets", () => {
    const before = [
      {
        id: 11,
        uuid: "old-snapshot",
        createdAt: "2026-07-13T01:02:03.000Z",
        assetType: "crypto" as const,
        wallet: "wallet-a",
        symbol: "BTC",
        amount: 1,
        value: 100,
        price: 100,
      },
      {
        id: 12,
        uuid: "old-snapshot",
        createdAt: "2026-07-13T01:02:03.000Z",
        assetType: "stock" as const,
        wallet: "broker-a",
        symbol: "ACME",
        amount: 2,
        value: 40,
        price: 20,
      },
    ];
    const afterCoins = [
      {
        assetType: "crypto" as const,
        wallet: "md5:wallet-a",
        symbol: "BTC",
        amount: 3,
        usdValue: 330,
        price: 110,
      },
      {
        assetType: "crypto" as const,
        wallet: "md5:wallet-b",
        symbol: "SOL",
        amount: 4,
        usdValue: 600,
        price: 150,
      },
    ];

    const result = generateTransactions(
      operation.operationUuid,
      operation.refreshCreatedAt,
      before,
      afterCoins,
    );

    expect(result).toEqual([
      {
        uuid: operation.operationUuid,
        assetType: "crypto",
        wallet: "wallet-a",
        symbol: "BTC",
        amount: 2,
        price: 110,
        txnType: "buy",
        txnCreatedAt: operation.refreshCreatedAt,
        createdAt: operation.refreshCreatedAt,
        updatedAt: operation.refreshCreatedAt,
      },
      {
        uuid: operation.operationUuid,
        assetType: "crypto",
        wallet: "wallet-b",
        symbol: "SOL",
        amount: 4,
        price: 150,
        txnType: "buy",
        txnCreatedAt: operation.refreshCreatedAt,
        createdAt: operation.refreshCreatedAt,
        updatedAt: operation.refreshCreatedAt,
      },
      {
        uuid: operation.operationUuid,
        assetType: "stock",
        wallet: "broker-a",
        symbol: "ACME",
        amount: 2,
        price: 20,
        txnType: "sell",
        txnCreatedAt: operation.refreshCreatedAt,
        createdAt: operation.refreshCreatedAt,
        updatedAt: operation.refreshCreatedAt,
      },
    ]);
    expect(result.every((transaction) => !("assetID" in transaction))).toBe(
      true,
    );
  });
});

describe("refreshAllData persistence", () => {
  it("allocates distinct marker timestamps for concurrent empty refreshes in one wall-clock millisecond", async () => {
    vi.useFakeTimers();
    try {
      const wallClock = "2026-07-15T00:00:00.000Z";
      vi.setSystemTime(new Date(wallClock));
      serializeWriteWork();
      vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([]);
      vi.mocked(getBlacklistCoins).mockResolvedValue(["BTC"]);
      vi.mocked(fetchPortfolios).mockResolvedValue({
        coins: [],
        failedSources: [],
      } as never);
      const payloads = mockCommittedRefreshMarkers();

      await Promise.all([
        refreshAllData(vi.fn(), {}, {
          operationUuid: "55555555-5555-4555-8555-555555555555",
        }),
        refreshAllData(vi.fn(), {}, {
          operationUuid: "66666666-6666-4666-8666-666666666666",
        }),
      ]);

      expect(payloads.map(({ assets, txns }) => ({ assets, txns }))).toEqual([
        { assets: [], txns: [] },
        { assets: [], txns: [] },
      ]);
      expect(payloads.map(({ createdAt }) => createdAt)).toEqual([
        wallClock,
        "2026-07-15T00:00:00.001Z",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("allocates a later timestamp for a non-empty refresh started beside an empty refresh in the same millisecond", async () => {
    vi.useFakeTimers();
    try {
      const wallClock = "2026-07-15T00:00:00.000Z";
      vi.setSystemTime(new Date(wallClock));
      serializeWriteWork();
      vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([]);
      vi.mocked(getBlacklistCoins).mockResolvedValue(["BTC"]);
      const emptyFetch = deferred<{
        coins: WalletCoin[];
        failedSources: [];
      }>();
      const nonEmptyFetch = deferred<{
        coins: WalletCoin[];
        failedSources: [];
      }>();
      const emptyFetchStarted = deferred<void>();
      const nonEmptyFetchStarted = deferred<void>();
      vi.mocked(fetchPortfolios)
        .mockImplementationOnce(async () => {
          emptyFetchStarted.resolve();
          return emptyFetch.promise as never;
        })
        .mockImplementationOnce(async () => {
          nonEmptyFetchStarted.resolve();
          return nonEmptyFetch.promise as never;
        });
      const payloads = mockCommittedRefreshMarkers();

      const emptyRefresh = refreshAllData(vi.fn(), {}, {
        operationUuid: "77777777-7777-4777-8777-777777777777",
      });
      await emptyFetchStarted.promise;
      const nonEmptyRefresh = refreshAllData(vi.fn(), {}, {
        operationUuid: "88888888-8888-4888-8888-888888888888",
      });
      await nonEmptyFetchStarted.promise;

      emptyFetch.resolve({ coins: [], failedSources: [] });
      await emptyRefresh;
      nonEmptyFetch.resolve({
        coins: [
          {
            assetType: "crypto",
            wallet: "wallet-a",
            symbol: "ETH",
            amount: 1,
            price: { base: "usd", value: 100 },
          },
        ],
        failedSources: [],
      });
      await nonEmptyRefresh;

      expect(payloads[0]).toMatchObject({
        createdAt: wallClock,
        assets: [],
        txns: [],
      });
      expect(payloads[1]).toMatchObject({
        createdAt: "2026-07-15T00:00:00.001Z",
        assets: [expect.objectContaining({ symbol: "ETH", amount: 1 })],
        txns: [expect.objectContaining({ symbol: "ETH", txnType: "buy" })],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits behind an already queued configuration write before returning a data-source action", async () => {
    let writeQueue: Promise<void> = Promise.resolve();
    vi.mocked(executeWriteWork).mockImplementation((callback) => {
      const result = writeQueue.then(() => callback({} as never));
      writeQueue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    });

    const oldConfig = {
      configs: { groupUSD: false },
      btc: { addresses: ["old-wallet"] },
    };
    const newConfig = {
      configs: { groupUSD: false },
      btc: { addresses: ["new-wallet"] },
    };
    let currentConfig = oldConfig;
    let portfolioInputGeneration = 7;
    vi.mocked(getConfiguration).mockImplementation(
      async () => currentConfig as never,
    );
    vi.mocked(getPortfolioInputGeneration).mockImplementation(
      () => portfolioInputGeneration,
    );

    const oldFetchCanReturn = deferred<void>();
    const oldFetchStarted = deferred<void>();
    const oldFetchReturned = deferred<void>();
    vi.mocked(fetchPortfolios).mockImplementation(async (config) => {
      const wallet = (config as never as typeof oldConfig).btc.addresses[0];
      if (wallet === "old-wallet") {
        oldFetchStarted.resolve();
        await oldFetchCanReturn.promise;
        oldFetchReturned.resolve();
        return {
          coins: [],
          failedSources: [
            {
              analyzerName: "Old Source",
              walletIdentities: ["old-wallet"],
              error: "old failure",
            },
          ],
        } as never;
      }
      return {
        coins: [],
        failedSources: [
          {
            analyzerName: "New Source",
            walletIdentities: ["new-wallet"],
            error: "new failure",
          },
        ],
      } as never;
    });

    const queueBlockerStarted = deferred<void>();
    const queueBlockerCanFinish = deferred<void>();
    const queueBlocker = executeWriteWork(async () => {
      queueBlockerStarted.resolve();
      await queueBlockerCanFinish.promise;
    });
    await queueBlockerStarted.promise;

    let configWriteStarted = false;
    const configWrite = executeWriteWork(async () => {
      configWriteStarted = true;
      portfolioInputGeneration += 1;
      currentConfig = newConfig;
      portfolioInputGeneration += 1;
    });

    let refreshSettled = false;
    const refresh = refreshAllData(vi.fn(), {}, operation).finally(() => {
      refreshSettled = true;
    });
    await oldFetchStarted.promise;

    oldFetchCanReturn.resolve();
    await oldFetchReturned.promise;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refreshSettled).toBe(false);
    expect(configWriteStarted).toBe(false);
    expect(portfolioInputGeneration).toBe(7);

    queueBlockerCanFinish.resolve();
    await queueBlocker;
    await configWrite;
    await expect(refresh).resolves.toEqual({
      failedSources: [
        {
          analyzerName: "New Source",
          walletIdentities: ["new-wallet"],
          error: "new failure",
        },
      ],
      requiresDataSourceAction: true,
      usedLastKnownData: false,
    });

    expect(fetchPortfolios).toHaveBeenCalledTimes(2);
    expect(fetchPortfolios).toHaveBeenNthCalledWith(
      1,
      oldConfig,
      expect.any(Function),
      expect.any(Object),
    );
    expect(fetchPortfolios).toHaveBeenNthCalledWith(
      2,
      newConfig,
      expect.any(Function),
      expect.any(Object),
    );
    expect(ASSET_HANDLER.listAssets).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("assigns commit-ordered timestamps when concurrent fetches finish in reverse order", async () => {
    vi.useFakeTimers();
    try {
      const wallClock = "2026-07-15T00:00:00.000Z";
      vi.setSystemTime(new Date(wallClock));
      let writeQueue: Promise<void> = Promise.resolve();
      vi.mocked(executeWriteWork).mockImplementation((callback) => {
        const result = writeQueue.then(() => callback({} as never));
        writeQueue = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      });

      let latestSnapshots: AssetModel[][] = [];
      vi.mocked(ASSET_HANDLER.listAssets).mockImplementation(
        async () => latestSnapshots,
      );
      const slowFetch = deferred<{
        coins: WalletCoin[];
        failedSources: [];
      }>();
      const fastFetch = deferred<{
        coins: WalletCoin[];
        failedSources: [];
      }>();
      const slowFetchStarted = deferred<void>();
      const fastFetchStarted = deferred<void>();
      vi.mocked(fetchPortfolios)
        .mockImplementationOnce(async () => {
          slowFetchStarted.resolve();
          return slowFetch.promise as never;
        })
        .mockImplementationOnce(async () => {
          fastFetchStarted.resolve();
          return fastFetch.promise as never;
        });

      const commits: Array<{
        operationUuid: string;
        createdAt: string;
      }> = [];
      vi.mocked(invoke).mockImplementation(async (_command, args) => {
        const payload = args as {
          operationUuid: string;
          createdAt: string;
          assets: Array<{
            assetType: "crypto" | "stock";
            wallet: string;
            symbol: string;
            amount: number;
            value: number;
            price: number;
          }>;
        };
        commits.push({
          operationUuid: payload.operationUuid,
          createdAt: payload.createdAt,
        });
        latestSnapshots = [
          payload.assets.map((asset, index) => ({
            ...asset,
            id: commits.length * 100 + index,
            uuid: payload.operationUuid,
            createdAt: payload.createdAt,
          })),
        ];
      });

      const slowOperation: RefreshOperation = {
        operationUuid: "11111111-1111-4111-8111-111111111111",
        refreshCreatedAt: "2026-07-15T00:00:00.001Z",
      };
      const fastOperation: RefreshOperation = {
        operationUuid: "22222222-2222-4222-8222-222222222222",
        refreshCreatedAt: "2026-07-15T00:00:00.002Z",
      };
      const slowRefresh = refreshAllData(vi.fn(), {}, slowOperation);
      await slowFetchStarted.promise;
      const fastRefresh = refreshAllData(vi.fn(), {}, fastOperation);
      await fastFetchStarted.promise;

      fastFetch.resolve({
        coins: [
          {
            assetType: "crypto",
            wallet: "wallet-a",
            symbol: "BTC",
            amount: 1,
            price: { base: "usd", value: 100 },
          },
        ],
        failedSources: [],
      });
      await fastRefresh;
      slowFetch.resolve({
        coins: [
          {
            assetType: "crypto",
            wallet: "wallet-a",
            symbol: "BTC",
            amount: 2,
            price: { base: "usd", value: 100 },
          },
        ],
        failedSources: [],
      });
      await slowRefresh;

      expect(commits.map(({ operationUuid }) => operationUuid)).toEqual([
        fastOperation.operationUuid,
        slowOperation.operationUuid,
      ]);
      expect(Date.parse(commits[0].createdAt)).toBeGreaterThanOrEqual(
        Date.parse(wallClock),
      );
      expect(Date.parse(commits[1].createdAt)).toBeGreaterThan(
        Date.parse(commits[0].createdAt),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("allocates distinct timestamps for concurrent commits in the same wall-clock millisecond", async () => {
    vi.useFakeTimers();
    try {
      const wallClock = "2026-07-15T00:00:00.000Z";
      vi.setSystemTime(new Date(wallClock));
      let writeQueue: Promise<void> = Promise.resolve();
      vi.mocked(executeWriteWork).mockImplementation((callback) => {
        const result = writeQueue.then(() => callback({} as never));
        writeQueue = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      });

      let latestSnapshots: AssetModel[][] = [];
      vi.mocked(ASSET_HANDLER.listAssets).mockImplementation(
        async () => latestSnapshots,
      );
      vi.mocked(fetchPortfolios)
        .mockResolvedValueOnce({
          coins: [
            {
              assetType: "crypto",
              wallet: "wallet-a",
              symbol: "BTC",
              amount: 1,
              price: { base: "usd", value: 100 },
            },
          ],
          failedSources: [],
        } as never)
        .mockResolvedValueOnce({
          coins: [
            {
              assetType: "crypto",
              wallet: "wallet-a",
              symbol: "BTC",
              amount: 2,
              price: { base: "usd", value: 100 },
            },
          ],
          failedSources: [],
        } as never);

      const committedTimestamps: string[] = [];
      vi.mocked(invoke).mockImplementation(async (_command, args) => {
        const payload = args as {
          operationUuid: string;
          createdAt: string;
          assets: Array<{
            assetType: "crypto" | "stock";
            wallet: string;
            symbol: string;
            amount: number;
            value: number;
            price: number;
          }>;
        };
        committedTimestamps.push(payload.createdAt);
        latestSnapshots = [
          payload.assets.map((asset, index) => ({
            ...asset,
            id: committedTimestamps.length * 100 + index,
            uuid: payload.operationUuid,
            createdAt: payload.createdAt,
          })),
        ];
      });

      const sameEarlyTimestamp = "2026-07-15T00:00:00.000Z";
      await Promise.all([
        refreshAllData(vi.fn(), {}, {
          operationUuid: "33333333-3333-4333-8333-333333333333",
          refreshCreatedAt: sameEarlyTimestamp,
        }),
        refreshAllData(vi.fn(), {}, {
          operationUuid: "44444444-4444-4444-8444-444444444444",
          refreshCreatedAt: sameEarlyTimestamp,
        }),
      ]);

      expect(committedTimestamps).toHaveLength(2);
      expect(committedTimestamps[0]).toBe(wallClock);
      expect(Date.parse(committedTimestamps[1])).toBe(
        Date.parse(committedTimestamps[0]) + 1,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses one complete legacy snapshot when multiple UUIDs share the latest timestamp", async () => {
    vi.useFakeTimers();
    try {
      const legacyTimestamp = "2026-07-15T00:00:00.000Z";
      vi.setSystemTime(new Date(legacyTimestamp));
      operation.refreshCreatedAt = legacyTimestamp;
      vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([
        [
          {
            id: 1,
            uuid: "legacy-a",
            createdAt: legacyTimestamp,
            assetType: "crypto",
            wallet: md5("wallet-a"),
            symbol: "BTC",
            amount: 10,
            value: 1000,
            price: 100,
          },
          {
            id: 2,
            uuid: "legacy-a",
            createdAt: legacyTimestamp,
            assetType: "crypto",
            wallet: md5("wallet-a"),
            symbol: "ETH",
            amount: 5,
            value: 50,
            price: 10,
          },
        ],
        [
          {
            id: 3,
            uuid: "legacy-b",
            createdAt: legacyTimestamp,
            assetType: "crypto",
            wallet: md5("wallet-a"),
            symbol: "BTC",
            amount: 20,
            value: 2000,
            price: 100,
          },
        ],
      ] as never);
      vi.mocked(fetchPortfolios).mockResolvedValue({
        coins: [
          {
            assetType: "crypto",
            wallet: "wallet-a",
            symbol: "BTC",
            amount: 21,
            price: { base: "usd", value: 100 },
          },
        ],
        failedSources: [],
      } as never);

      await refreshAllData(vi.fn(), {}, operation);

      const payload = vi.mocked(invoke).mock.calls[0][1] as {
        createdAt: string;
        txns: Array<{ symbol: string; amount: number; txnType: string }>;
      };
      expect(payload.createdAt).toBe("2026-07-15T00:00:00.001Z");
      expect(payload.txns).toEqual([
        expect.objectContaining({
          symbol: "BTC",
          amount: 1,
          txnType: "buy",
        }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("diffs an equal canonical stablecoin baseline without synthetic trades", async () => {
    const storedWallet = mockCanonicalStablecoinDiff(10, 10);

    await refreshAllData(
      vi.fn(),
      { useLastKnownDataForFailedSources: true },
      operation,
    );

    const payload = vi.mocked(invoke).mock.calls[0][1] as {
      assets: Array<{ wallet: string; symbol: string; amount: number }>;
      txns: Array<{ symbol: string; amount: number; txnType: string }>;
    };
    expect(
      payload.assets.filter((asset) => asset.wallet === storedWallet),
    ).toEqual([
      expect.objectContaining({ symbol: "USDT", amount: 10 }),
    ]);
    expect(payload.txns).toEqual([]);
  });

  it("applies a canonical blacklist to the raw stablecoin baseline before diffing", async () => {
    const storedWallet = mockCanonicalStablecoinDiff(10, 10, ["USDT"]);

    await refreshAllData(
      vi.fn(),
      { useLastKnownDataForFailedSources: true },
      operation,
    );

    const payload = vi.mocked(invoke).mock.calls[0][1] as {
      assets: Array<{ wallet: string; symbol: string }>;
      txns: Array<{ wallet: string; symbol: string; txnType: string }>;
    };
    expect(
      payload.assets.some((asset) => asset.wallet === storedWallet),
    ).toBe(false);
    expect(
      payload.txns.some((transaction) => transaction.wallet === storedWallet),
    ).toBe(false);
  });

  it("emits one canonical stablecoin transaction for a real amount change", async () => {
    const storedWallet = mockCanonicalStablecoinDiff(10, 12);

    await refreshAllData(
      vi.fn(),
      { useLastKnownDataForFailedSources: true },
      operation,
    );

    const payload = vi.mocked(invoke).mock.calls[0][1] as {
      assets: Array<{ wallet: string; symbol: string; amount: number }>;
      txns: Array<{
        wallet: string;
        symbol: string;
        amount: number;
        txnType: string;
      }>;
    };
    expect(
      payload.assets.filter((asset) => asset.wallet === storedWallet),
    ).toEqual([
      expect.objectContaining({ symbol: "USDT", amount: 12 }),
    ]);
    expect(payload.txns).toEqual([
      expect.objectContaining({
        wallet: storedWallet,
        symbol: "USDT",
        amount: 2,
        txnType: "buy",
      }),
    ]);
  });

  it("canonicalizes stablecoin identities before conservative failed-source fallback", async () => {
    const wallet = "wallet-a";
    const storedWallet = md5(wallet);
    vi.mocked(getConfiguration).mockResolvedValue({
      configs: { groupUSD: true },
    } as never);
    vi.mocked(queryStableCoins).mockResolvedValue(["USDT", "USDC"]);
    vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([
      [
        {
          id: 31,
          uuid: "old-snapshot",
          createdAt: "2026-07-13T01:02:03.000Z",
          assetType: "crypto",
          wallet: storedWallet,
          symbol: "USDT",
          amount: 10,
          value: 10,
          price: 1,
        },
      ],
    ] as never);
    vi.mocked(fetchPortfolios).mockResolvedValue({
      coins: [
        {
          assetType: "crypto",
          wallet,
          symbol: "USDC",
          amount: 5,
          price: { base: "usd", value: 1 },
        },
      ],
      failedSources: [
        {
          analyzerName: "CEX Analyzer",
          walletIdentities: [wallet],
          error: "Binance maintenance",
        },
      ],
    } as never);

    await refreshAllData(
      vi.fn(),
      { useLastKnownDataForFailedSources: true },
      operation,
    );

    const payload = vi.mocked(invoke).mock.calls[0][1] as {
      assets: Array<{
        assetType: string;
        wallet: string;
        symbol: string;
        amount: number;
      }>;
      txns: Array<{ symbol: string }>;
    };
    expect(
      payload.assets.filter(
        (asset) => asset.wallet === storedWallet && asset.symbol === "USDT",
      ),
    ).toEqual([
      expect.objectContaining({
        assetType: "crypto",
        amount: 10,
      }),
    ]);
    expect(payload.txns).toEqual([]);
  });

  it("canonicalizes every configured stablecoin without merging nonstable or blacklisted symbols", async () => {
    const wallet = "wallet-a";
    const storedWallet = md5(wallet);
    vi.mocked(getConfiguration).mockResolvedValue({
      configs: { groupUSD: true },
    } as never);
    vi.mocked(queryStableCoins).mockResolvedValue([
      "USDT",
      "USDC",
      "USDP",
      "DAI",
    ]);
    vi.mocked(getBlacklistCoins).mockResolvedValue(["DAI"]);
    vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([] as never);
    vi.mocked(fetchPortfolios).mockResolvedValue({
      coins: [
        {
          assetType: "crypto",
          wallet,
          symbol: "USDP",
          amount: 2,
          price: { base: "usd", value: 1 },
        },
        {
          assetType: "crypto",
          wallet,
          symbol: "DAI",
          amount: 100,
          price: { base: "usd", value: 1 },
        },
        {
          assetType: "crypto",
          wallet,
          symbol: "ETH",
          amount: 3,
          price: { base: "usd", value: 20 },
        },
      ],
      failedSources: [],
    } as never);

    await refreshAllData(vi.fn(), {}, operation);

    const payload = vi.mocked(invoke).mock.calls[0][1] as {
      assets: Array<{
        wallet: string;
        symbol: string;
        amount: number;
      }>;
      txns: Array<{ symbol: string }>;
    };
    expect(
      payload.assets.filter((asset) => asset.wallet === storedWallet),
    ).toEqual([
      expect.objectContaining({ symbol: "USDT", amount: 2 }),
      expect.objectContaining({ symbol: "ETH", amount: 3 }),
    ]);
    expect(
      payload.assets.some((asset) => asset.symbol === "DAI"),
    ).toBe(false);
    expect(payload.txns.map((transaction) => transaction.symbol)).toEqual([
      "USDT",
      "ETH",
    ]);
  });

  it("uses only the baseline imported while network fetching is in flight", async () => {
    let barrierActive = false;
    let importCommitted = false;
    let writeQueue: Promise<void> = Promise.resolve();
    const baselineReads: Array<{
      barrierActive: boolean;
      importCommitted: boolean;
    }> = [];
    vi.mocked(executeWriteWork).mockImplementation((callback) => {
      const result = writeQueue.then(async () => {
        barrierActive = true;
        try {
          return await callback({} as never);
        } finally {
          barrierActive = false;
        }
      });
      writeQueue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    });
    vi.mocked(ASSET_HANDLER.listAssets).mockImplementation(async () => {
      baselineReads.push({ barrierActive, importCommitted });
      const amount = importCommitted ? 20 : 10;
      return [
        [
          {
            id: amount,
            uuid: importCommitted ? "imported-snapshot" : "old-snapshot",
            createdAt: importCommitted
              ? "2026-07-14T07:00:00.000Z"
              : "2026-07-13T07:00:00.000Z",
            assetType: "crypto",
            wallet: "wallet-a",
            symbol: "BTC",
            amount,
            value: amount * 100,
            price: 100,
          },
        ],
      ] as never;
    });
    const networkFetch = deferred<{
      coins: Array<{
        assetType: "crypto";
        wallet: string;
        symbol: string;
        amount: number;
        price: { base: "usd"; value: number };
      }>;
      failedSources: Array<{
        analyzerName: string;
        walletIdentities: string[];
        error: string;
      }>;
    }>();
    vi.mocked(fetchPortfolios).mockReturnValue(networkFetch.promise as never);
    const refresh = refreshAllData(
      vi.fn(),
      { useLastKnownDataForFailedSources: true },
      operation,
    );
    await vi.waitFor(() => {
      expect(
        vi.mocked(fetchPortfolios).mock.calls.length +
          vi.mocked(loadPortfolios).mock.calls.length,
      ).toBe(1);
    });

    const concurrentImport = executeWriteWork(async () => {
      expect(barrierActive).toBe(true);
      importCommitted = true;
    });
    await concurrentImport;
    networkFetch.resolve({
      coins: [
        {
          assetType: "crypto",
          wallet: "md5:wallet-a",
          symbol: "BTC",
          amount: 5,
          price: { base: "usd", value: 100 },
        },
      ],
      failedSources: [
        {
          analyzerName: "CEX Analyzer",
          walletIdentities: ["wallet-a"],
          error: "Binance maintenance",
        },
      ],
    });
    await refresh;

    expect(fetchPortfolios).toHaveBeenCalledTimes(1);
    expect(loadPortfolios).not.toHaveBeenCalled();
    expect(baselineReads).toEqual([
      { barrierActive: true, importCommitted: true },
    ]);
    expect(invoke).toHaveBeenCalledWith("persist_refresh", {
      operationUuid: operation.operationUuid,
      createdAt: operation.refreshCreatedAt,
      assets: [
        expect.objectContaining({
          wallet: "wallet-a",
          symbol: "BTC",
          amount: 20,
          value: 2000,
        }),
      ],
      txns: [],
    });
  });

  it("discards remote data fetched with configuration replaced by an in-flight import", async () => {
    const oldConfig = {
      configs: { groupUSD: false },
      btc: { addresses: ["old-wallet"] },
    };
    const newConfig = {
      configs: { groupUSD: false },
      btc: { addresses: ["new-wallet"] },
    };
    let currentConfig = oldConfig;
    let portfolioInputGeneration = 4;
    vi.mocked(getConfiguration).mockImplementation(
      async () => currentConfig as never,
    );
    vi.mocked(getPortfolioInputGeneration).mockImplementation(
      () => portfolioInputGeneration,
    );
    vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([
      [
        {
          id: 61,
          uuid: "imported-snapshot",
          createdAt: "2026-07-14T07:00:00.000Z",
          assetType: "crypto",
          wallet: md5("new-wallet"),
          symbol: "BTC",
          amount: 5,
          value: 500,
          price: 100,
        },
      ],
    ] as never);

    const oldConfigurationFetch = deferred<{
      coins: Array<{
        assetType: "crypto";
        wallet: string;
        symbol: string;
        amount: number;
        price: { base: "usd"; value: number };
      }>;
      failedSources: [];
    }>();
    vi.mocked(fetchPortfolios).mockImplementation(async (config) => {
      const configuredWallet = (config as never as typeof oldConfig).btc
        .addresses[0];
      if (configuredWallet === "old-wallet") {
        return oldConfigurationFetch.promise as never;
      }
      return {
        coins: [
          {
            assetType: "crypto",
            wallet: "new-wallet",
            symbol: "BTC",
            amount: 7,
            price: { base: "usd", value: 100 },
          },
        ],
        failedSources: [],
      } as never;
    });

    const refresh = refreshAllData(vi.fn(), {}, operation);
    await vi.waitFor(() => {
      expect(fetchPortfolios).toHaveBeenCalledTimes(1);
    });

    await executeWriteWork(async () => {
      currentConfig = newConfig;
      portfolioInputGeneration += 1;
    });
    oldConfigurationFetch.resolve({
      coins: [
        {
          assetType: "crypto",
          wallet: "old-wallet",
          symbol: "BTC",
          amount: 99,
          price: { base: "usd", value: 100 },
        },
      ],
      failedSources: [],
    });

    await refresh;

    expect(fetchPortfolios).toHaveBeenCalledTimes(2);
    expect(fetchPortfolios).toHaveBeenNthCalledWith(
      1,
      oldConfig,
      expect.any(Function),
      expect.any(Object),
    );
    expect(fetchPortfolios).toHaveBeenNthCalledWith(
      2,
      newConfig,
      expect.any(Function),
      expect.any(Object),
    );
    expect(ASSET_HANDLER.listAssets).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith("persist_refresh", {
      operationUuid: operation.operationUuid,
      createdAt: operation.refreshCreatedAt,
      assets: [
        expect.objectContaining({
          wallet: md5("new-wallet"),
          symbol: "BTC",
          amount: 7,
        }),
      ],
      txns: [
        expect.objectContaining({
          wallet: md5("new-wallet"),
          symbol: "BTC",
          amount: 2,
          txnType: "buy",
        }),
      ],
    });
  });

  it("builds from the latest baseline and retries persistence inside one write barrier", async () => {
    let barrierActive = false;
    vi.mocked(executeWriteWork).mockImplementation(async (callback) => {
      barrierActive = true;
      try {
        return await callback({} as never);
      } finally {
        barrierActive = false;
      }
    });
    vi.mocked(ASSET_HANDLER.listAssets).mockImplementation(async () => {
      expect(barrierActive).toBe(true);
      return [
        [
          {
            id: 2,
            uuid: "latest-baseline",
            createdAt: "2026-07-14T01:02:03.000Z",
            assetType: "crypto",
            wallet: "wallet-a",
            symbol: "BTC",
            amount: 1,
            value: 100,
            price: 100,
          },
        ],
      ] as never;
    });
    vi.mocked(fetchPortfolios).mockImplementation(
      async (_config, addProgress) => {
        expect(barrierActive).toBe(false);
        addProgress(70);
        return {
          coins: [
            {
              assetType: "crypto",
              wallet: "md5:wallet-a",
              symbol: "BTC",
              amount: 2,
              price: { base: "usd", value: 100 },
            },
          ],
          failedSources: [],
        } as never;
      },
    );

    let committedPayload: unknown;
    vi.mocked(invoke)
      .mockImplementationOnce(async (_command, payload) => {
        expect(barrierActive).toBe(true);
        committedPayload = payload;
        throw new Error("persistence response lost");
      })
      .mockImplementationOnce(async (_command, payload) => {
        expect(barrierActive).toBe(true);
        expect(payload).toBe(committedPayload);
      });
    const retry = async <T,>(attempt: () => Promise<T>): Promise<T> => {
      try {
        return await attempt();
      } catch {
        expect(barrierActive).toBe(true);
        return attempt();
      }
    };

    const progressHistory: number[] = [];
    await refreshAllData(
      (progress) => progressHistory.push(progress),
      {},
      operation,
      retry,
    );

    expect(executeWriteWork).toHaveBeenCalledTimes(1);
    expect(ASSET_HANDLER.listAssets).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(vi.mocked(invoke).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        txns: [
          expect.objectContaining({
            symbol: "BTC",
            amount: 1,
            txnType: "buy",
          }),
        ],
      }),
    );
    expect(progressHistory.at(-1)).toBe(100);
    expect(
      progressHistory.every(
        (progress, index) =>
          index === 0 || progress >= progressHistory[index - 1],
      ),
    ).toBe(true);
  });

  it("resets absolute query progress before retrying a failed price stage", async () => {
    vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([] as never);
    vi.mocked(fetchPortfolios).mockImplementation(
      async (_config, addProgress) => {
        addProgress(70);
        return {
          coins: [
            {
              assetType: "crypto",
              wallet: "wallet-a",
              symbol: "BTC",
              amount: 1,
            },
          ],
          failedSources: [],
        } as never;
      },
    );
    vi.mocked(queryCoinPrices)
      .mockRejectedValueOnce(new Error("price service unavailable"))
      .mockResolvedValueOnce({ BTC: 100, USDT: 1 });
    const retry = async <T,>(attempt: () => Promise<T>): Promise<T> => {
      try {
        return await attempt();
      } catch {
        return attempt();
      }
    };

    const progressHistory: number[] = [];
    await refreshAllData(
      (progress) => progressHistory.push(progress),
      {},
      operation,
      retry,
    );

    expect(fetchPortfolios).toHaveBeenCalledTimes(2);
    expect(progressHistory).toEqual([
      0,
      1,
      3,
      5,
      75,
      0,
      1,
      3,
      5,
      75,
      85,
      90,
      100,
    ]);
  });

  it("replays the complete payload without refetching after a lost persistence response", async () => {
    vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([] as never);
    vi.mocked(fetchPortfolios)
      .mockResolvedValueOnce({
        coins: [
          {
            assetType: "crypto",
            wallet: "md5:wallet-a",
            symbol: "BTC",
            amount: 1,
            price: { base: "usd", value: 100 },
          },
        ],
        failedSources: [],
      } as never)
      .mockResolvedValueOnce({
        coins: [
          {
            assetType: "crypto",
            wallet: "md5:wallet-b",
            symbol: "SOL",
            amount: 99,
            price: { base: "usd", value: 150 },
          },
        ],
        failedSources: [],
      } as never);

    let committedPayload: unknown;
    vi.mocked(invoke)
      .mockImplementationOnce(async (_command, payload) => {
        committedPayload = payload;
        throw new Error("persistence response lost");
      })
      .mockResolvedValueOnce(undefined);

    const replayProgress: number[] = [];
    await expect(refreshAllData(vi.fn(), {}, operation)).rejects.toThrow(
      "persistence response lost",
    );
    await refreshAllData(
      (progress) => replayProgress.push(progress),
      {},
      operation,
    );

    expect(ASSET_HANDLER.listAssets).toHaveBeenCalledTimes(1);
    expect(fetchPortfolios).toHaveBeenCalledTimes(1);
    expect(queryCoinPrices).toHaveBeenCalledTimes(1);
    expect(queryStableCoins).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(vi.mocked(invoke).mock.calls[1][1]).toBe(committedPayload);
    expect(replayProgress).toEqual([90, 100]);
  });

  it("rebuilds an operation when fetching fails before a payload exists", async () => {
    vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([] as never);
    vi.mocked(fetchPortfolios)
      .mockRejectedValueOnce(new Error("source unavailable"))
      .mockResolvedValueOnce({
        coins: [
          {
            assetType: "crypto",
            wallet: "md5:wallet-a",
            symbol: "BTC",
            amount: 1,
            price: { base: "usd", value: 100 },
          },
        ],
        failedSources: [],
      } as never);

    await expect(refreshAllData(vi.fn(), {}, operation)).rejects.toThrow(
      "source unavailable",
    );
    await refreshAllData(vi.fn(), {}, operation);

    expect(ASSET_HANDLER.listAssets).toHaveBeenCalledTimes(1);
    expect(fetchPortfolios).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("adds a zero asset only for a positive balance that truly disappeared", async () => {
    vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([
      [
        {
          id: 21,
          uuid: "old-snapshot",
          createdAt: "2026-07-13T01:02:03.000Z",
          assetType: "crypto",
          wallet: "wallet-zero",
          symbol: "ZERO",
          amount: 0,
          value: 0,
          price: 1,
        },
        {
          id: 22,
          uuid: "old-snapshot",
          createdAt: "2026-07-13T01:02:03.000Z",
          assetType: "crypto",
          wallet: "wallet-blocked",
          symbol: "BLOCK",
          amount: 3,
          value: 30,
          price: 10,
        },
        {
          id: 23,
          uuid: "old-snapshot",
          createdAt: "2026-07-13T01:02:03.000Z",
          assetType: "stock",
          wallet: "broker-gone",
          symbol: "GONE",
          amount: 2,
          value: 40,
          price: 20,
        },
      ],
    ] as never);
    vi.mocked(getBlacklistCoins).mockResolvedValue(["block"]);
    vi.mocked(fetchPortfolios).mockResolvedValue({
      coins: [
        {
          assetType: "crypto",
          wallet: "md5:wallet-current",
          symbol: "BTC",
          amount: 1,
          price: { base: "usd", value: 100 },
        },
      ],
      failedSources: [],
    } as never);

    await refreshAllData(vi.fn(), {}, operation);

    const payload = vi.mocked(invoke).mock.calls[0][1] as {
      assets: Array<{ symbol: string; amount: number; price: number }>;
      txns: Array<{
        symbol: string;
        txnType: string;
        txnCreatedAt: string;
      }>;
    };
    expect(payload.assets).toEqual([
      expect.objectContaining({ symbol: "BTC", amount: 1 }),
      expect.objectContaining({ symbol: "GONE", amount: 0, price: 20 }),
    ]);
    expect(payload.txns).toEqual([
      expect.objectContaining({ symbol: "BTC", txnType: "buy" }),
      expect.objectContaining({
        symbol: "GONE",
        txnType: "sell",
        txnCreatedAt: operation.refreshCreatedAt,
      }),
    ]);
    expect(
      payload.assets.some(({ symbol }) => ["ZERO", "BLOCK"].includes(symbol)),
    ).toBe(false);
    expect(
      payload.txns.some(({ symbol }) => ["ZERO", "BLOCK"].includes(symbol)),
    ).toBe(false);
  });

  it("persists the snapshot and transaction drafts with one queued Rust command", async () => {
    vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([
      [
        {
          id: 12,
          uuid: "old-snapshot",
          createdAt: "2026-07-13T01:02:03.000Z",
          assetType: "stock",
          wallet: "broker-a",
          symbol: "ACME",
          amount: 2,
          value: 40,
          price: 20,
        },
      ],
    ] as never);
    vi.mocked(fetchPortfolios).mockResolvedValue({
      coins: [
        {
          assetType: "crypto",
          wallet: "md5:wallet-a",
          symbol: "BTC",
          amount: 1,
          price: { base: "usd", value: 100 },
        },
      ],
      failedSources: [],
    } as never);

    await refreshAllData(vi.fn(), {}, operation);

    expect(ASSET_HANDLER.listAssets).toHaveBeenCalledTimes(1);
    expect(ASSET_HANDLER.saveCoinsToDatabase).not.toHaveBeenCalled();
    expect(TRANSACTION_HANDLER.saveTransactions).not.toHaveBeenCalled();
    expect(executeWriteWork).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("persist_refresh", {
      operationUuid: operation.operationUuid,
      createdAt: operation.refreshCreatedAt,
      assets: [
        {
          assetType: "crypto",
          wallet: "wallet-a",
          symbol: "BTC",
          amount: 1,
          value: 100,
          price: 100,
        },
        {
          assetType: "stock",
          wallet: "broker-a",
          symbol: "ACME",
          amount: 0,
          value: 0,
          price: 20,
        },
      ],
      txns: [
        expect.objectContaining({
          uuid: operation.operationUuid,
          assetType: "crypto",
          wallet: "wallet-a",
          symbol: "BTC",
          txnType: "buy",
          txnCreatedAt: operation.refreshCreatedAt,
        }),
        expect.objectContaining({
          uuid: operation.operationUuid,
          assetType: "stock",
          wallet: "broker-a",
          symbol: "ACME",
          txnType: "sell",
          txnCreatedAt: operation.refreshCreatedAt,
        }),
      ],
    });
  });
});
