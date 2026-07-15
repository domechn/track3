import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import { isSameWallet, normalizeWalletToMD5 } from "../lib/utils";
import {
  AddProgressFunc,
  Asset,
  AssetModel,
  TransactionType,
  UserLicenseInfo,
  WalletCoinUSD,
} from "./types";
import {
  fetchPortfolios,
  queryCoinPrices,
  queryStableCoins,
} from "./data";
import type {
  FailedPortfolioSource,
  LoadPortfoliosOptions,
  LoadPortfoliosResult,
} from "./data";
import {
  canonicalizePortfolioBaseline,
  canonicalizePortfolioCoins,
  mergePortfoliosWithBaseline,
} from "./portfolio-baseline";
import type { PortfolioCanonicalization } from "./portfolio-baseline";
import {
  getConfiguration,
  getBlacklistCoins,
  getPortfolioInputGeneration,
  saveStableCoins,
} from "./configuration";
import {
  calculateTotalValue,
  getAssetIdentity,
  getAssetType,
} from "./datafetch/utils/coins";
import { fetchStockPrices } from "./datafetch/utils/price";
import { WalletAnalyzer } from "./wallet";
import { OthersAnalyzer } from "./datafetch/coins/others";
import { ASSET_HANDLER } from "./entities/assets";
import { isProVersion } from "./license";
import {
  getCacheGroupEpoch,
  getMemoryCacheInstance,
} from "./datafetch/utils/cache";
import { GlobalConfig, WalletCoin } from "./datafetch/types";
import { CACHE_GROUP_KEYS } from "./consts";
import {
  executeWriteWork,
  getLatestCommittedRefreshCreatedAt,
} from "./database";

export const WALLET_ANALYZER = new WalletAnalyzer((size) =>
  ASSET_HANDLER.listAssets(size),
);

export type RefreshAllDataOptions = LoadPortfoliosOptions;
export type RefreshRetry = <T>(attempt: () => Promise<T>) => Promise<T>;

export type RefreshOperation = {
  operationUuid: string;
  refreshCreatedAt?: string;
  prepared?: {
    payload: {
      operationUuid: string;
      createdAt: string;
      assets: RefreshAssetInput[];
      txns: RefreshTransactionDraft[];
    };
    result: RefreshAllDataResult;
  };
};

export type RefreshTransactionDraft = {
  uuid: string;
  assetType: "crypto" | "stock";
  wallet: string;
  symbol: string;
  amount: number;
  price: number;
  txnType: TransactionType;
  txnCreatedAt: string;
  createdAt: string;
  updatedAt: string;
};

type RefreshAssetInput = {
  assetType: "crypto" | "stock";
  wallet: string;
  symbol: string;
  amount: number;
  value: number;
  price: number;
};

export type RefreshAllDataResult = {
  failedSources: FailedPortfolioSource[];
  requiresDataSourceAction: boolean;
  usedLastKnownData: boolean;
};

type WalletCoinValueContext = {
  priceMap: Record<string, number>;
  upperCaseStableCoins: string[];
};

type QueryCoinsDataReady = {
  failedSources: FailedPortfolioSource[];
  requiresDataSourceAction: false;
  usedLastKnownData: boolean;
  blacklistedSymbols: string[];
  config: GlobalConfig;
  portfolioInputGeneration: number;
  portfolioResult: LoadPortfoliosResult;
  valueContext: WalletCoinValueContext;
};

type QueryCoinsDataResult =
  | QueryCoinsDataReady
  | {
      failedSources: FailedPortfolioSource[];
      requiresDataSourceAction: true;
      usedLastKnownData: false;
      blacklistedSymbols: [];
      portfolioInputGeneration: number;
    };

export function createRefreshOperation(): RefreshOperation {
  return {
    operationUuid: uuidv4(),
  };
}

function getSnapshotTimestamp(snapshot: AssetModel[]): number {
  return snapshot.reduce((latest, asset) => {
    const timestamp = Date.parse(asset.createdAt);
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
  }, Number.NEGATIVE_INFINITY);
}

function getSnapshotMaxId(snapshot: AssetModel[]): number {
  return snapshot.reduce(
    (latest, asset) => Math.max(latest, Number(asset.id) || 0),
    0,
  );
}

function selectLatestPersistedSnapshot(snapshots: AssetModel[][]): {
  assets: AssetModel[];
  latestTimestamp: number;
} {
  const latestTimestamp = snapshots.reduce(
    (latest, snapshot) => Math.max(latest, getSnapshotTimestamp(snapshot)),
    Number.NEGATIVE_INFINITY,
  );
  const assets =
    snapshots.slice().sort((left, right) => {
      const timestampDifference =
        getSnapshotTimestamp(right) - getSnapshotTimestamp(left);
      if (timestampDifference !== 0) {
        return timestampDifference;
      }
      const idDifference = getSnapshotMaxId(right) - getSnapshotMaxId(left);
      if (idDifference !== 0) {
        return idDifference;
      }
      return (right[0]?.uuid ?? "").localeCompare(left[0]?.uuid ?? "");
    })[0] ?? [];

  return { assets, latestTimestamp };
}

function allocateRefreshCreatedAt(latestPersistedTimestamp: number): string {
  const timestamp = Number.isFinite(latestPersistedTimestamp)
    ? Math.max(Date.now(), latestPersistedTimestamp + 1)
    : Date.now();
  return new Date(timestamp).toISOString();
}

export async function refreshAllData(
  setProgress: AddProgressFunc,
  options: RefreshAllDataOptions = {},
  operation: RefreshOperation = createRefreshOperation(),
  retry: RefreshRetry = (attempt) => attempt(),
): Promise<RefreshAllDataResult> {
  let queryProgress = 0;
  while (true) {
    let queryResult: QueryCoinsDataResult | undefined;
    if (!operation.prepared) {
      queryResult = await retry(() => {
        queryProgress = 0;
        setProgress(0);
        return queryCoinsData((increment) => {
          queryProgress = Math.min(queryProgress + increment, 90);
          setProgress(queryProgress);
        }, options);
      });
    }

    const result = await executeWriteWork(async (database) => {
      if (!operation.prepared) {
        const currentQueryResult = queryResult!;
        if (
          currentQueryResult.portfolioInputGeneration !==
          getPortfolioInputGeneration()
        ) {
          return undefined;
        }
        if (currentQueryResult.requiresDataSourceAction) {
          return {
            failedSources: currentQueryResult.failedSources,
            requiresDataSourceAction: true,
            usedLastKnownData: false,
          };
        }
        const readyQueryResult = currentQueryResult;
        const persistedSnapshots = await ASSET_HANDLER.listAssets(1);
        const {
          assets: rawLatestBaseline,
          latestTimestamp: latestAssetSnapshotTimestamp,
        } = selectLatestPersistedSnapshot(persistedSnapshots);
        const latestCommittedRefreshCreatedAt =
          await getLatestCommittedRefreshCreatedAt(database);
        const latestCommittedRefreshTimestamp = Date.parse(
          latestCommittedRefreshCreatedAt ?? "",
        );
        const latestPersistedTimestamp = Math.max(
          latestAssetSnapshotTimestamp,
          Number.isFinite(latestCommittedRefreshTimestamp)
            ? latestCommittedRefreshTimestamp
            : Number.NEGATIVE_INFINITY,
        );
        const refreshCreatedAt = allocateRefreshCreatedAt(
          latestPersistedTimestamp,
        );
        operation.refreshCreatedAt = refreshCreatedAt;
        const canonicalization = getPortfolioCanonicalization(
          readyQueryResult.config,
          readyQueryResult.valueContext,
          readyQueryResult.blacklistedSymbols,
        );
        const latestBaseline = canonicalizePortfolioBaseline(
          rawLatestBaseline,
          canonicalization,
        );
        const portfolioResult = mergePortfoliosWithBaseline(
          readyQueryResult.portfolioResult,
          latestBaseline,
          options,
          canonicalization,
        );
        const coins = resolveWalletCoins(
          portfolioResult.coins,
          latestBaseline,
          readyQueryResult.valueContext,
          canonicalization,
        );
        const transactions = generateTransactions(
          operation.operationUuid,
          refreshCreatedAt,
          latestBaseline,
          coins,
          readyQueryResult.blacklistedSymbols,
        );
        operation.prepared = {
          payload: {
            operationUuid: operation.operationUuid,
            createdAt: refreshCreatedAt,
            assets: generateRefreshAssets(coins, transactions),
            txns: transactions,
          },
          result: {
            failedSources: readyQueryResult.failedSources,
            requiresDataSourceAction: false,
            usedLastKnownData: readyQueryResult.usedLastKnownData,
          },
        };
      }

      setProgress(90);
      await retry(() =>
        invoke<void>("persist_refresh", operation.prepared!.payload),
      );
      setProgress(100);

      return operation.prepared.result;
    });
    if (result) {
      return result;
    }
  }
}

export function generateTransactions(
  operationUuid: string,
  refreshCreatedAt: string,
  before: AssetModel[],
  afterCoins: WalletCoinUSD[],
  blacklistedSymbols: string[] = [],
): RefreshTransactionDraft[] {
  const beforeAssetMap = new Map<string, AssetModel>();
  const afterAssetMap = new Map<string, WalletCoinUSD>();
  before.forEach((asset) => {
    beforeAssetMap.set(getStoredAssetIdentity(asset), asset);
  });
  afterCoins.forEach((asset) => {
    afterAssetMap.set(getRefreshCoinIdentity(asset), asset);
  });

  const makeDraft = (
    assetType: "crypto" | "stock",
    wallet: string,
    symbol: string,
    amount: number,
    price: number,
    txnType: TransactionType,
  ): RefreshTransactionDraft => ({
    uuid: operationUuid,
    assetType,
    wallet,
    symbol,
    amount,
    price,
    txnType,
    txnCreatedAt: refreshCreatedAt,
    createdAt: refreshCreatedAt,
    updatedAt: refreshCreatedAt,
  });

  const updatedTxns = afterCoins
    .map((a) => {
      const wallet = normalizeWalletToMD5(a.wallet);
      const l = beforeAssetMap.get(getRefreshCoinIdentity(a));
      if (!l) {
        if (a.amount !== 0) {
          return makeDraft(
            getAssetType(a),
            wallet,
            a.symbol,
            a.amount,
            a.price,
            "buy",
          );
        }
        return undefined;
      }
      if (a.amount === l.amount) {
        return undefined;
      }
      return makeDraft(
        getAssetType(a),
        wallet,
        a.symbol,
        Math.abs(a.amount - l.amount),
        a.price,
        a.amount > l.amount ? "buy" : "sell",
      );
    })
    .filter((x): x is RefreshTransactionDraft => !!x);
  const blacklisted = new Set(
    blacklistedSymbols.map((symbol) => symbol.toUpperCase()),
  );
  const removedTxns = before
    .filter(
      (lastAsset) =>
        !afterAssetMap.has(getStoredAssetIdentity(lastAsset)) &&
        !blacklisted.has(lastAsset.symbol.toUpperCase()),
    )
    .map((la) => {
      if (la.amount === 0) {
        return undefined;
      }
      return makeDraft(
        getAssetType(la),
        storedWallet(la.wallet),
        la.symbol,
        la.amount,
        la.price,
        "sell",
      );
    })
    .filter((x): x is RefreshTransactionDraft => !!x);

  return [...updatedTxns, ...removedTxns];
}

function generateRefreshAssets(
  afterCoins: WalletCoinUSD[],
  transactions: RefreshTransactionDraft[],
): RefreshAssetInput[] {
  const afterIdentities = new Set(afterCoins.map(getRefreshCoinIdentity));
  const currentAssets = afterCoins.map((coin) => ({
    assetType: getAssetType(coin),
    wallet: normalizeWalletToMD5(coin.wallet),
    symbol: coin.symbol,
    amount: coin.amount,
    value: coin.usdValue,
    price: coin.price,
  }));
  const removedAssets = transactions
    .filter(
      (transaction) =>
        transaction.txnType === "sell" &&
        !afterIdentities.has(getTransactionIdentity(transaction)),
    )
    .map((transaction) => ({
      assetType: transaction.assetType,
      wallet: transaction.wallet,
      symbol: transaction.symbol,
      amount: 0,
      value: 0,
      price: transaction.price,
    }));
  return [...currentAssets, ...removedAssets];
}

function storedWallet(wallet?: string): string {
  return wallet?.startsWith("md5:") ? wallet.slice(4) : (wallet ?? "");
}

function getStoredAssetIdentity(asset: AssetModel): string {
  return `${getAssetType(asset)}:${storedWallet(asset.wallet)}:${asset.symbol}`;
}

function getRefreshCoinIdentity(coin: WalletCoinUSD): string {
  return `${getAssetType(coin)}:${normalizeWalletToMD5(coin.wallet)}:${coin.symbol}`;
}

function getTransactionIdentity(transaction: RefreshTransactionDraft): string {
  return `${transaction.assetType}:${transaction.wallet}:${transaction.symbol}`;
}

// query the real-time price of the last queried asset
export async function queryRealTimeAssetsValue(): Promise<Asset[]> {
  const cache = getMemoryCacheInstance(
    CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY,
  );
  const cacheEpoch = getCacheGroupEpoch(
    CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY,
  );
  const cacheKey = `${cacheEpoch}-real-time-assets`;
  const c = cache.getCache<Asset[]>(cacheKey);
  if (c) {
    return c;
  }
  const size = 1;
  const result = await ASSET_HANDLER.listSymbolGroupedAssets(size);
  if (result.length === 0) {
    return [];
  }

  const assets = result[0];
  const config = await getConfiguration();
  if (!config) {
    throw new Error("no configuration found,\n please add configuration first");
  }
  // check if pro user
  const userProInfo = await isProVersion();
  const lastAssets = (await ASSET_HANDLER.listAssets(1)).flat();

  const walletCoins = await queryCoinsDataByWalletCoins(
    assets
      .map((a) => ({
        symbol: a.symbol,
        assetType: getAssetType(a),
        amount: a.amount,
        // wallet here dose not matter
        wallet: a.wallet ?? OthersAnalyzer.wallet,
      })),
    config,
    lastAssets,
    userProInfo,
  );

  const assetRes = walletCoins
    .map((t) => {
      const ast = {
        symbol: t.symbol,
        assetType: getAssetType(t),
        amount: t.amount,
        value: t.usdValue,
        price: t.price,
      };
      // check if there are assets without price, if exits, use the last price
      // sometimes coin price is provided by erc20 provider or cex, so it may not be existed in coin price query service ( coingecko )
      const lastAst = assets.find(
        (a) => a.symbol === t.symbol && getAssetType(a) === getAssetType(t),
      );
      if (lastAst && ast.amount !== lastAst.amount) {
        ast.amount = lastAst.amount;
        ast.value = lastAst.value;
        ast.price = lastAst.price;
      }
      return ast;
    });

  // 15 min ttl
  cache.setCache(cacheKey, assetRes, 15 * 60);
  return assetRes;
}

async function queryWalletCoinValueContext(
  assets: WalletCoin[],
  userProInfo: UserLicenseInfo,
  addProgress?: AddProgressFunc,
): Promise<WalletCoinValueContext> {
  const needPriceAssets = assets.filter((a) => !a.price);
  const cryptoPriceSymbols = Array.from(
    new Set(
      needPriceAssets
        .filter((a) => getAssetType(a) === "crypto")
        .map((a) => a.symbol)
        .concat(["USDT", "BTC"]),
    ),
  ).filter((x): x is string => !!x);
  const stockPriceSymbols = Array.from(
    new Set(
      needPriceAssets
        .filter((a) => getAssetType(a) === "stock")
        .map((a) => a.symbol),
    ),
  ).filter((x): x is string => !!x);
  const [cryptoPriceMap, stockPriceMap] = await Promise.all([
    cryptoPriceSymbols.length > 0
      ? queryCoinPrices(cryptoPriceSymbols, userProInfo)
      : Promise.resolve({}),
    fetchStockPrices(stockPriceSymbols),
  ]);
  const typedCryptoPriceMap: Record<string, number> = {};
  for (const symbol of Object.keys(cryptoPriceMap)) {
    typedCryptoPriceMap[getAssetIdentity({ symbol, assetType: "crypto" })] =
      cryptoPriceMap[symbol];
  }
  const typedStockPriceMap: Record<string, number> = {};
  for (const symbol of Object.keys(stockPriceMap)) {
    typedStockPriceMap[getAssetIdentity({ symbol, assetType: "stock" })] =
      stockPriceMap[symbol];
  }
  const priceMap = {
    ...cryptoPriceMap,
    ...stockPriceMap,
    ...typedCryptoPriceMap,
    ...typedStockPriceMap,
  };
  if (addProgress) {
    addProgress(10);
  }

  const stableCoins = await queryStableCoins();
  const upperCaseStableCoins = stableCoins.map((c) => c.toUpperCase());
  await saveStableCoins(upperCaseStableCoins);

  return {
    priceMap,
    upperCaseStableCoins,
  };
}

function resolveWalletCoins(
  assets: WalletCoin[],
  lastAssets: AssetModel[],
  valueContext: WalletCoinValueContext,
  canonicalization: PortfolioCanonicalization,
  addProgress?: AddProgressFunc,
): WalletCoinUSD[] {
  const { priceMap } = valueContext;
  const latestAssets = canonicalizePortfolioCoins(assets, canonicalization);

  // add btc value if not exist
  const btcData = latestAssets.find(
    (c) => c.symbol === "BTC" && getAssetType(c) === "crypto",
  );
  if (!btcData) {
    latestAssets.push({
      symbol: "BTC",
      assetType: "crypto",
      amount: 0,
      wallet: OthersAnalyzer.wallet,
    });
  }
  const totals = calculateTotalValue(latestAssets, priceMap);
  // 1. If USD value < 1, consider it sold out, set amount and value to 0
  // 2. If this asset is found both this time and last time (same symbol and wallet)
  // 2.1 If last time was 0, this time is also 0 or < 1, then drop this time
  // 2.2 Last time was 0, this time >= 1, save it
  // 2.3 If last time was not 0, this time is 0 or < 1, then save it
  // 2.4 If last time was not 0, this time > 1, then save it
  // 3. BTC always save regardless
  const filteredTotals = totals
    .filter((t) => {
      // 3. BTC always save regardless
      if (t.symbol === "BTC") {
        return true;
      }

      // 1. If USD value < 1, consider it sold out, set amount and value to 0
      const isCurrentSoldOut = t.usdValue < 1;

      // Handle wallet comparison: lastAssets contains MD5 hashed wallet (no prefix)
      // Current wallet might have "md5:" prefix, so we need to normalize it
      const lastAsset = lastAssets.find(
        (a) =>
          a.symbol === t.symbol &&
          getAssetType(a) === getAssetType(t) &&
          isSameWallet(a.wallet ?? "", t.wallet),
      );

      // If last asset not found, it's a new asset
      if (!lastAsset) {
        // New asset and < 1 USD, drop it directly
        return !isCurrentSoldOut;
      }

      // Last time amount was 0, means it was sold out
      const wasLastSoldOut = lastAsset.amount === 0;

      // 2.1 If last time was 0, this time is also 0 or < 1, then drop this time
      if (wasLastSoldOut && isCurrentSoldOut) {
        return false;
      }

      // 2.2 Last time was 0, this time >= 1, save it
      if (wasLastSoldOut && !isCurrentSoldOut) {
        return true;
      }

      // 2.3 If last time was not 0, this time is 0 or < 1, then save it
      if (!wasLastSoldOut && isCurrentSoldOut) {
        return true;
      }

      // 2.4 If last time was not 0, this time > 1, then save it
      if (!wasLastSoldOut && !isCurrentSoldOut) {
        return true;
      }

      return true;
    })
    .map((t) => ({
      ...t,
      // If USD value < 1, consider it sold out, set amount and value to 0
      usdValue: t.usdValue >= 1 ? t.usdValue : 0,
      amount: t.usdValue >= 1 ? t.amount : 0,
    }));

  if (addProgress) {
    addProgress(5);
  }
  const blacklistedSymbols = canonicalization.blacklistedSymbols ?? [];
  if (blacklistedSymbols.length > 0) {
    return filteredTotals.filter(
      (t) => !blacklistedSymbols.includes(t.symbol.toUpperCase()),
    );
  }

  return filteredTotals;
}

function getPortfolioCanonicalization(
  config: GlobalConfig,
  valueContext: WalletCoinValueContext,
  blacklistedSymbols: string[],
): PortfolioCanonicalization {
  return {
    groupStablecoins: !!(config as any)?.configs?.groupUSD,
    stablecoinSymbols: valueContext.upperCaseStableCoins,
    blacklistedSymbols,
  };
}

async function queryCoinsDataByWalletCoins(
  assets: WalletCoin[],
  config: GlobalConfig,
  lastAssets: AssetModel[],
  userProInfo: UserLicenseInfo,
  addProgress?: AddProgressFunc,
  knownBlacklistedSymbols?: string[],
): Promise<WalletCoinUSD[]> {
  const [valueContext, blacklistedSymbols] = await Promise.all([
    queryWalletCoinValueContext(assets, userProInfo, addProgress),
    knownBlacklistedSymbols
      ? Promise.resolve(knownBlacklistedSymbols)
      : getBlacklistCoins().then((symbols) =>
          symbols.map((symbol) => symbol.toUpperCase()),
        ),
  ]);
  const canonicalization = getPortfolioCanonicalization(
    config,
    valueContext,
    blacklistedSymbols,
  );
  return resolveWalletCoins(
    assets,
    lastAssets,
    valueContext,
    canonicalization,
    addProgress,
  );
}

// query all assets and calculate their value in USD
async function queryCoinsData(
  addProgress: AddProgressFunc,
  options: RefreshAllDataOptions = {},
): Promise<QueryCoinsDataResult> {
  addProgress(1);
  let portfolioInputGeneration: number;
  let config: GlobalConfig | undefined;
  do {
    portfolioInputGeneration = getPortfolioInputGeneration();
    config = await getConfiguration();
  } while (portfolioInputGeneration !== getPortfolioInputGeneration());
  if (!config) {
    throw new Error("no configuration found,\n please add configuration first");
  }
  addProgress(2);
  // check if pro user
  const userProInfo = await isProVersion();
  addProgress(2);
  const portfolioResult = await fetchPortfolios(
    config,
    addProgress,
    userProInfo,
  );

  if (
    portfolioResult.failedSources.length > 0 &&
    !options.useLastKnownDataForFailedSources
  ) {
    return {
      failedSources: portfolioResult.failedSources,
      requiresDataSourceAction: true,
      usedLastKnownData: false,
      blacklistedSymbols: [],
      portfolioInputGeneration,
    };
  }

  const blacklistedSymbols = (await getBlacklistCoins()).map((symbol) =>
    symbol.toUpperCase(),
  );
  const valueContext = await queryWalletCoinValueContext(
    portfolioResult.coins,
    userProInfo,
    addProgress,
  );

  return {
    failedSources: portfolioResult.failedSources,
    requiresDataSourceAction: false,
    usedLastKnownData:
      portfolioResult.failedSources.length > 0 &&
      !!options.useLastKnownDataForFailedSources,
    blacklistedSymbols,
    config,
    portfolioInputGeneration,
    portfolioResult,
    valueContext,
  };
}
