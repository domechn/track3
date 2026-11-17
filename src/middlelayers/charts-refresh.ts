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
  LoadPortfoliosResult,
  PortfolioSourceResult,
  PortfolioSourceStatus,
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
  listAllCurrencyRates,
  saveStableCoins,
} from "./configuration";
import {
  calculateTotalValue,
  combineCoinLists,
  getAssetIdentity,
  getAssetType,
} from "./datafetch/utils/coins";
import { fetchStockPrices } from "./datafetch/utils/price";
import { isBrokerCashSymbol } from "./entities/currency";
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
import { FullRefreshRequiredError } from "./refresh-error";
import { partialFromSourceStatuses, validatePartialSnapshot, type PartialSnapshot } from "./snapshot-partial";
import { customFollowTargets, resolveCustomPrices, validateCustomPrice } from "./custom-price";
import { readStoredStatuses } from "./ui-state/source-status-store";

export type LiveAssets = Asset[] & {
  partial?: boolean;
  reason?: "rateLimited" | "pricesMissing" | "stockPricesMissing" | "rateUnavailable" | "ibkrToken" | "partialSource" | "unknown";
  missingCount?: number;
  missingSymbols?: LiveMissingSymbol[];
  dustSymbols?: LiveMissingSymbol[];
  missingShare?: number;
};

export type LiveMissingSymbol = Pick<AssetModel, "symbol" | "assetType"> & { lastValue: number };

type LivePriceStatus = {
  reason?: LiveAssets["reason"];
  missingRateSymbols: Set<string>;
  missingCount: number;
  missingSymbols: LiveMissingSymbol[];
  dustSymbols: LiveMissingSymbol[];
  missingShare?: number;
};

function liveQuoteReason(error: unknown, fallback: LiveAssets["reason"]): LiveAssets["reason"] {
  const message = error instanceof Error ? error.message : String(error);
  if (/IBKR.*(?:1012|token expired)|(?:1012|token expired).*IBKR/i.test(message)) return "ibkrToken";
  if (/(?:429|1018|rate.?limit|too many requests)/i.test(message)) return "rateLimited";
  return fallback;
}

export const WALLET_ANALYZER = new WalletAnalyzer((size) =>
  ASSET_HANDLER.listAssets(size),
);

export type RefreshAllDataOptions = {
  onSourceResult?: (source: PortfolioSourceResult) => void;
  retrySourceId?: string;
  previousSourceResults?: PortfolioSourceResult[];
  previousSourceStatuses?: PortfolioSourceStatus[];
  previousInputGeneration?: number;
  previousRefreshCreatedAt?: string;
  previousSnapshotId?: string | null;
  previousSnapshotKey?: string;
};
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
      partial?: PartialSnapshot;
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
  sourceResults?: PortfolioSourceResult[];
  sourceStatuses?: PortfolioSourceStatus[];
  persisted?: boolean;
  portfolioInputGeneration?: number;
  refreshCreatedAt?: string;
  snapshotId?: string | null;
  snapshotKey?: string;
};

type WalletCoinValueContext = {
  priceMap: Record<string, number>;
  upperCaseStableCoins: string[];
};

type QueryCoinsDataReady = {
  failedSources: FailedPortfolioSource[];
  requiresDataSourceAction: false;
  blacklistedSymbols: string[];
  config: GlobalConfig;
  portfolioInputGeneration: number;
  portfolioResult: LoadPortfoliosResult;
  valueContext: WalletCoinValueContext;
  stalePrices: { crypto: Record<string, number>; stock: Record<string, number> };
};

type QueryCoinsDataResult =
  | QueryCoinsDataReady
  | {
      failedSources: FailedPortfolioSource[];
      requiresDataSourceAction: true;
      usedLastKnownData: false;
      blacklistedSymbols: [];
      portfolioInputGeneration: number;
      sourceResults?: PortfolioSourceResult[];
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

function getSnapshotContentKey(assets: Array<Pick<AssetModel, "symbol" | "amount" | "value" | "price"> & {
  assetType?: AssetModel["assetType"];
  wallet?: string;
}>): string {
  return JSON.stringify(assets.map((asset) => [
    getAssetType(asset), storedWallet(asset.wallet), asset.symbol,
    asset.amount, asset.value, asset.price,
  ]).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))));
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
            sourceResults: currentQueryResult.sourceResults,
            sourceStatuses: currentQueryResult.sourceResults?.map((source) => {
              const previousStatus = options.previousSourceStatuses?.find(
                (previous) => previous.sourceId === source.sourceId,
              );
              const status = source.status !== "stale"
                ? source.status
                : previousStatus?.status ?? "failed" as const;
              const partial = status === "partial" ? source.partial ?? previousStatus?.partial : undefined;
              return {
                sourceId: source.sourceId,
                label: source.label,
                kind: source.kind,
                provider: source.provider,
                hint: source.hint,
                detail: source.detail,
                status,
                ...(partial ? { partial } : {}),
                category: source.category,
                startedAt: source.startedAt,
                finishedAt: source.finishedAt,
                lastSuccessAt: previousStatus?.lastSuccessAt,
              };
            }),
            persisted: false,
            portfolioInputGeneration: options.previousInputGeneration,
            refreshCreatedAt: options.previousRefreshCreatedAt,
            snapshotId: options.previousSnapshotId,
            snapshotKey: options.previousSnapshotKey,
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
        if (
          options.retrySourceId &&
          (options.previousSnapshotId === undefined ||
            options.previousSnapshotId !== (rawLatestBaseline[0]?.uuid ?? null) ||
            options.previousSnapshotKey !== getSnapshotContentKey(rawLatestBaseline) ||
            options.previousRefreshCreatedAt !== latestCommittedRefreshCreatedAt)
        ) {
          throw new FullRefreshRequiredError("Portfolio changed. Run a full refresh.");
        }
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
        const sourceStatuses = readyQueryResult.portfolioResult.sourceResults?.map(
          (source): PortfolioSourceStatus => {
            const status = source.status !== "stale"
              ? source.status
              : latestBaseline.some(
                  (asset) =>
                    asset.amount !== 0 &&
                    source.walletIdentities.some((identity) =>
                      isSameWallet(identity, asset.wallet ?? ""),
                    ),
                )
                ? "stale"
                : "failed";
            const previousSuccess = options.previousSourceStatuses?.find(
              (previous) => previous.sourceId === source.sourceId,
            )?.lastSuccessAt;
            const lastSuccessAt = (status === "ok" || status === "partial") ? refreshCreatedAt : previousSuccess ??
              (status === "stale" && Number.isFinite(latestAssetSnapshotTimestamp)
                ? new Date(latestAssetSnapshotTimestamp).toISOString() : undefined);
            const previousSourceAssets = latestBaseline.filter((asset) =>
              source.walletIdentities.some((identity) => isSameWallet(identity, asset.wallet ?? "")));
            const sharesIdentity = readyQueryResult.portfolioResult.sourceResults?.some((other) =>
              other.sourceId !== source.sourceId && (
                other.walletIdentities.some((identity) =>
                  source.walletIdentities.some((own) => isSameWallet(own, identity))) ||
                other.coins.some((coin) =>
                  source.walletIdentities.some((own) => isSameWallet(own, coin.wallet)))
              ));
            const lowerThanPrevious = source.partial && previousSourceAssets.length && !sharesIdentity
              ? calculateTotalValue(canonicalizePortfolioCoins(source.coins, canonicalization),
                  readyQueryResult.valueContext.priceMap).reduce((sum, coin) => sum + coin.usdValue, 0) <
                previousSourceAssets.reduce((sum, asset) => sum + asset.value, 0)
              : undefined;
            return {
              sourceId: source.sourceId,
              label: source.label,
              kind: source.kind,
              provider: source.provider,
              hint: source.hint,
              status,
              ...(source.partial ? { partial: { ...source.partial,
                ...(lowerThanPrevious !== undefined ? { lowerThanPrevious } : {}) } } : {}),
              category: source.category,
              detail: source.detail,
              startedAt: source.startedAt,
              finishedAt: source.finishedAt,
              ...(lastSuccessAt ? { lastSuccessAt } : {}),
            };
          },
        );
        if (sourceStatuses?.length && sourceStatuses.every((source) =>
          source.status === "stale" || source.status === "failed")) {
          return {
            failedSources: readyQueryResult.failedSources,
            requiresDataSourceAction: true,
            usedLastKnownData: sourceStatuses.some((source) => source.status === "stale"),
            sourceResults: readyQueryResult.portfolioResult.sourceResults,
            sourceStatuses,
            persisted: false,
            portfolioInputGeneration: readyQueryResult.portfolioInputGeneration,
            refreshCreatedAt: latestCommittedRefreshCreatedAt,
            snapshotId: rawLatestBaseline[0]?.uuid ?? null,
            snapshotKey: getSnapshotContentKey(rawLatestBaseline),
          };
        }
        const portfolioResult = mergePortfoliosWithBaseline(
          readyQueryResult.portfolioResult,
          latestBaseline,
          canonicalization,
        );
        const currentPrices = { ...readyQueryResult.valueContext.priceMap };
        for (const [assetType, prices] of [
          ["crypto", readyQueryResult.stalePrices.crypto],
          ["stock", readyQueryResult.stalePrices.stock],
        ] as const) {
          for (const [symbol, price] of Object.entries(prices)) {
            currentPrices[getAssetIdentity({ assetType, symbol })] = price;
          }
        }
        if (readyQueryResult.failedSources.length > 0) {
          updateStalePrices(
            portfolioResult.coins,
            latestBaseline,
            readyQueryResult.portfolioResult.coins,
            readyQueryResult.failedSources,
            readyQueryResult.stalePrices,
            readyQueryResult.valueContext.priceMap,
          );
        }
        const missingQuoteWallets: string[] = [];
        const missingQuoteAssets = new Set<string>();
        const coins = resolveWalletCoins(
          portfolioResult.coins,
          latestBaseline,
          readyQueryResult.valueContext,
          canonicalization,
          undefined,
          readyQueryResult.failedSources.flatMap((source) => source.walletIdentities),
          missingQuoteWallets,
          missingQuoteAssets,
        );
        const transactions = generateTransactions(
          operation.operationUuid,
          refreshCreatedAt,
          latestBaseline,
          coins,
          readyQueryResult.blacklistedSymbols,
          currentPrices,
          missingQuoteAssets,
        );
        const refreshAssets = generateRefreshAssets(coins, transactions);
        let partial = sourceStatuses && partialFromSourceStatuses(
          sourceStatuses, readyQueryResult.portfolioResult.sourceResults, refreshCreatedAt,
        );
        if (missingQuoteWallets.length) {
          const missing = partial?.missing.slice() ?? [];
          for (const wallet of new Set(missingQuoteWallets.map(normalizeWalletToMD5))) {
            if (missing.length === 64) break;
            if (!missing.some((source) => source.wallet === wallet)) {
              missing.push({ wallet, kind: "wallet", provider: "Price quote", category: "service" });
            }
          }
          partial = validatePartialSnapshot({
            sourcesTotal: Math.max(sourceStatuses?.length ?? 0, 1),
            missing, fill: "last_known", createdAt: refreshCreatedAt,
          });
        }
        operation.prepared = {
          payload: {
            operationUuid: operation.operationUuid,
            createdAt: refreshCreatedAt,
            assets: refreshAssets,
            txns: transactions,
            ...(partial ? { partial } : {}),
          },
          result: {
            failedSources: readyQueryResult.failedSources,
            requiresDataSourceAction: false,
            usedLastKnownData: missingQuoteWallets.length > 0 || !!sourceStatuses?.some((source) => source.status === "stale"),
            sourceResults: readyQueryResult.portfolioResult.sourceResults,
            sourceStatuses,
            persisted: true,
            portfolioInputGeneration: readyQueryResult.portfolioInputGeneration,
            refreshCreatedAt,
            snapshotId: operation.operationUuid,
            snapshotKey: getSnapshotContentKey(refreshAssets),
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
  currentPrices: Record<string, number> = {},
  missingQuoteAssets: ReadonlySet<string> = new Set(),
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

  const makeVanishedDraft = (asset: AssetModel): RefreshTransactionDraft | undefined => {
    const identity = getAssetIdentity(asset);
    const quotedPrice = getAssetType(asset) === "stock" && isBrokerCashSymbol(asset.symbol)
      ? undefined : currentPrices[identity];
    const currentPrice = quotedPrice !== undefined && Number.isFinite(quotedPrice) && quotedPrice > 0
      ? quotedPrice : undefined;
    const previousPrice = Number.isFinite(asset.price) && asset.price > 0
      ? asset.price : asset.value / asset.amount;
    const price = currentPrice ?? previousPrice;
    if (!Number.isFinite(price) || price <= 0) {
      return undefined;
    }
    return makeDraft(
      getAssetType(asset), storedWallet(asset.wallet), asset.symbol, asset.amount,
      price, currentPrice === undefined ? "withdraw" : "sell",
    );
  };

  const updatedTxns = afterCoins
    .map((a) => {
      if (missingQuoteAssets.has(getRefreshCoinIdentity(a))) return undefined;
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
      if (a.amount === 0 && l.amount > 0) {
        return makeVanishedDraft(l);
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
        !missingQuoteAssets.has(getStoredAssetIdentity(lastAsset)) &&
        !blacklisted.has(lastAsset.symbol.toUpperCase()),
    )
    .map((la) => {
      if (la.amount === 0) {
        return undefined;
      }
      return makeVanishedDraft(la);
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
    price: coin.amount === 0
      ? transactions.find((transaction) =>
          getTransactionIdentity(transaction) === getRefreshCoinIdentity(coin) &&
          (transaction.txnType === "sell" || transaction.txnType === "withdraw")
        )?.price ?? coin.price
      : coin.price,
  }));
  const removedAssets = transactions
    .filter(
      (transaction) =>
        (transaction.txnType === "sell" || transaction.txnType === "withdraw") &&
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
export async function queryRealTimeAssetsValue(): Promise<LiveAssets> {
  const cache = getMemoryCacheInstance(
    CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY,
  );
  const cacheEpoch = getCacheGroupEpoch(
    CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY,
  );
  const cacheKey = `${cacheEpoch}-real-time-assets`;
  const c = cache.getCache<LiveAssets>(cacheKey);
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
  const lastAssets = (await ASSET_HANDLER.listAssets(1)).flat()
    .filter((row) => row.uuid === assets[0]?.uuid);
  const liveStatus: LivePriceStatus = {
    missingRateSymbols: new Set(), missingCount: 0,
    missingSymbols: [], dustSymbols: [], missingShare: 0,
  };
  const customSymbols = config.others?.map((entry) => entry.symbol) ?? [];

  const walletCoins = await queryCoinsDataByWalletCoins(
    assets
      .map((a) => {
        const custom = config.others?.find((entry) =>
          !entry.attachTo && getAssetIdentity(entry) === getAssetIdentity(a) && entry.price &&
          validateCustomPrice(entry.price, customSymbols, entry.symbol));
        const customPrice = custom && isSameWallet(a.wallet ?? "", OthersAnalyzer.wallet) &&
          lastAssets.filter((row) => getAssetIdentity(row) === getAssetIdentity(a))
            .every((row) => isSameWallet(row.wallet ?? "", OthersAnalyzer.wallet))
          ? custom.price : undefined;
        return {
          symbol: a.symbol,
          assetType: getAssetType(a),
          amount: a.amount,
          wallet: customPrice ? OthersAnalyzer.wallet : a.wallet ?? OthersAnalyzer.wallet,
          ...(customPrice ? { customPrice } : {}),
        };
      }),
    config,
    lastAssets,
    userProInfo,
    undefined,
    undefined,
    true,
    liveStatus,
  );

  const assetRes: LiveAssets = walletCoins
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
    }).filter((asset) => asset.amount > 0 && Number.isFinite(asset.price) && asset.price > 0 &&
      Number.isFinite(asset.value) && asset.value >= 0);

  const sourceProblems = readStoredStatuses().filter((status) => status.status !== "ok");
  const ibkrProblem = sourceProblems.find((status) => status.detail === "IBKR token expired");
  const limitedProblem = sourceProblems.find((status) => status.category === "rateLimit");
  assetRes.partial = liveStatus.reason !== undefined || liveStatus.missingCount > 0 || sourceProblems.length > 0;
  assetRes.missingCount = liveStatus.missingCount;
  assetRes.missingSymbols = liveStatus.missingSymbols;
  assetRes.dustSymbols = liveStatus.dustSymbols;
  assetRes.missingShare = liveStatus.missingShare;
  assetRes.reason = ibkrProblem ? "ibkrToken" : limitedProblem ? "rateLimited"
    : liveStatus.reason ?? (sourceProblems.length ? "partialSource" : liveStatus.missingCount ? "pricesMissing" : undefined);
  if (assets.some((asset) => asset.amount > 0) && assetRes.length === 0) {
    throw new Error(assetRes.reason === "pricesMissing"
      ? `pricesMissing:${liveStatus.missingCount}` : assetRes.reason ?? "pricesMissing");
  }

  // 15 min ttl
  if (!liveStatus.reason && !liveStatus.missingCount) cache.setCache(cacheKey, assetRes, 15 * 60);
  return assetRes;
}

async function queryWalletCoinValueContext(
  assets: WalletCoin[],
  userProInfo: UserLicenseInfo,
  addProgress?: AddProgressFunc,
  savedStockRows = false,
  liveStatus?: LivePriceStatus,
): Promise<WalletCoinValueContext> {
  const needPriceAssets = assets.filter((a) => !a.price);
  const followTargets = customFollowTargets(assets);
  const cryptoPriceSymbols = Array.from(
    new Set(
      needPriceAssets
        .filter((a) => getAssetType(a) === "crypto")
        .map((a) => a.symbol)
        .concat(followTargets.filter((target) => target.assetType === "crypto").map((target) => target.symbol))
        .concat(["USDT", "BTC"]),
    ),
  ).filter((x): x is string => !!x);
  const stockPriceSymbols = Array.from(
    new Set(
      needPriceAssets
        .filter((a) => getAssetType(a) === "stock")
        .map((a) => a.symbol)
        .concat(followTargets.filter((target) => target.assetType === "stock").map((target) => target.symbol)),
    ),
  ).filter((x): x is string => !!x && (!savedStockRows || !isBrokerCashSymbol(x)));
  const coinQuoteNeeded = needPriceAssets.some((a) => getAssetType(a) === "crypto") ||
    followTargets.some((target) => target.assetType === "crypto");
  const cashSymbols = [...new Set(
    needPriceAssets.filter((asset) => savedStockRows && getAssetType(asset) === "stock" && isBrokerCashSymbol(asset.symbol))
      .map((asset) => asset.symbol.toUpperCase())
  )];
  const [cryptoPriceMap, stockPriceMap, currencyRates]: [
    Record<string, number>, Record<string, number>, Awaited<ReturnType<typeof listAllCurrencyRates>>,
  ] = await Promise.all([
    cryptoPriceSymbols.length > 0
      ? queryCoinPrices(cryptoPriceSymbols, userProInfo).catch((error: unknown) => {
        if (!liveStatus) throw error;
        // USDT and BTC are always requested, so the call also runs when no holding needs a coin quote.
        const reason = liveQuoteReason(error, coinQuoteNeeded ? "pricesMissing" : undefined);
        if (reason === "rateLimited" || (reason && !liveStatus.reason)) liveStatus.reason = reason;
        return {};
      })
      : Promise.resolve({}),
    stockPriceSymbols.length ? fetchStockPrices(stockPriceSymbols).catch((error: unknown) => {
      if (!liveStatus) throw error;
      const reason = liveQuoteReason(error, "stockPricesMissing");
      if (reason === "rateLimited" || !liveStatus.reason) liveStatus.reason = reason;
      return {};
    }) : Promise.resolve({}),
    cashSymbols.some((symbol) => symbol !== "USD")
      ? listAllCurrencyRates().catch(() => {
        if (liveStatus) liveStatus.reason = "rateUnavailable";
        return [];
      })
      : Promise.resolve([]),
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
  for (const symbol of cashSymbols) {
    const rate = symbol === "USD" ? 1 : currencyRates.find((entry) => entry.currency.toUpperCase() === symbol)?.rate;
    const price = rate && rate > 0 ? 1 / rate : undefined;
    typedStockPriceMap[getAssetIdentity({ symbol, assetType: "stock" })] =
      price !== undefined && Number.isFinite(price) ? price : Number.NaN;
    if (liveStatus && !Number.isFinite(typedStockPriceMap[getAssetIdentity({ symbol, assetType: "stock" })])) {
      liveStatus.missingRateSymbols.add(symbol);
    }
  }
  const priceMap = {
    ...cryptoPriceMap,
    ...typedCryptoPriceMap,
    ...typedStockPriceMap,
  };
  if (liveStatus && !Number.isFinite(priceMap.USDT)) priceMap.USDT = Number.NaN;
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

async function queryStalePrices(
  failedSources: FailedPortfolioSource[],
  userInfo: UserLicenseInfo,
): Promise<{ crypto: Record<string, number>; stock: Record<string, number> }> {
  if (!failedSources.length) return { crypto: {}, stock: {} };
  const identities = failedSources.flatMap((source) => source.walletIdentities);
  const snapshots = await ASSET_HANDLER.listAssets(1);
  const staleAssets = selectLatestPersistedSnapshot(snapshots).assets.filter((asset) =>
    asset.amount > 0 && identities.some((identity) => isSameWallet(identity, asset.wallet ?? "")),
  );
  const cryptoSymbols = [...new Set(staleAssets.filter((asset) => getAssetType(asset) === "crypto").map((asset) => asset.symbol))];
  const stockSymbols = [...new Set(staleAssets.filter((asset) =>
    getAssetType(asset) === "stock" && !isBrokerCashSymbol(asset.symbol)
  ).map((asset) => asset.symbol))];
  const [crypto, stock] = await Promise.all([
    cryptoSymbols.length ? queryCoinPrices(cryptoSymbols, userInfo).catch(() => ({})) : Promise.resolve({}),
    stockSymbols.length ? fetchStockPrices(stockSymbols).catch(() => ({})) : Promise.resolve({}),
  ]);
  return { crypto, stock };
}

function updateStalePrices(
  coins: WalletCoin[],
  latestBaseline: AssetModel[],
  freshCoins: WalletCoin[],
  failedSources: FailedPortfolioSource[],
  stalePrices: { crypto: Record<string, number>; stock: Record<string, number> },
  priceMap: Record<string, number>,
): void {
  const identities = failedSources.flatMap((source) => source.walletIdentities);
  const staleAssets = latestBaseline.filter((asset) =>
    asset.amount > 0 && identities.some((identity) => isSameWallet(identity, asset.wallet ?? "")),
  );
  for (const [assetType, prices] of [["crypto", stalePrices.crypto], ["stock", stalePrices.stock]] as const) {
    for (const [symbol, price] of Object.entries(prices)) {
      priceMap[getAssetIdentity({ symbol, assetType })] = price;
      if (assetType === "crypto") priceMap[symbol] = price;
    }
  }
  for (const fresh of freshCoins) {
    if (!fresh.price || !staleAssets.some((asset) =>
      asset.symbol === fresh.symbol && getAssetType(asset) === getAssetType(fresh)
    )) continue;
    priceMap[getAssetIdentity(fresh)] = fresh.price.base === "usdt"
      ? fresh.price.value * (priceMap.USDT ?? 1)
      : fresh.price.value;
  }
  for (const coin of coins) {
    if (!identities.some((identity) => isSameWallet(identity, coin.wallet))) continue;
    const key = getAssetIdentity(coin);
    if (priceMap[key] === undefined || !Number.isFinite(priceMap[key]) || priceMap[key] <= 0) {
      const baseline = staleAssets.find((asset) =>
        asset.symbol === coin.symbol && getAssetType(asset) === getAssetType(coin) &&
        isSameWallet(asset.wallet ?? "", coin.wallet)
      );
      if (baseline) priceMap[key] = baseline.price;
    }
  }
}

function resolveWalletCoins(
  assets: WalletCoin[],
  lastAssets: AssetModel[],
  valueContext: WalletCoinValueContext,
  canonicalization: PortfolioCanonicalization,
  addProgress?: AddProgressFunc,
  staleWalletIdentities: string[] = [],
  missingQuoteWallets: string[] = [],
  missingQuoteAssets: Set<string> = new Set(),
  allowWalletFallback = true,
): WalletCoinUSD[] {
  const { priceMap } = valueContext;
  const latestAssets = canonicalizePortfolioCoins(
    resolveCustomPrices(assets, priceMap, lastAssets), canonicalization,
  );

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
  for (const total of totals) {
    if (!allowWalletFallback) continue;
    if (total.amount <= 0 || Number.isFinite(total.price) && total.price > 0) continue;
    const previous = lastAssets.find((asset) =>
      asset.symbol === total.symbol && getAssetType(asset) === getAssetType(total) &&
      isSameWallet(asset.wallet ?? "", total.wallet) &&
      Number.isFinite(asset.price) && asset.price > 0,
    );
    if (previous) {
      missingQuoteWallets.push(total.wallet);
      missingQuoteAssets.add(getRefreshCoinIdentity(total));
      total.price = previous.price;
      total.usdValue = total.amount * previous.price;
    }
  }
  const isStaleWallet = (wallet: string) =>
    staleWalletIdentities.some((identity) => isSameWallet(identity, wallet));
  // Only a reported zero quantity can close a position. A tiny or unknown value cannot.
  const filteredTotals = totals
    .filter((t) => {
      if (t.amount > 0 && (!Number.isFinite(t.price) || t.price <= 0)) {
        return false;
      }
      if (isStaleWallet(t.wallet)) {
        return t.amount > 0;
      }
      if (t.symbol === "BTC") {
        return true;
      }
      if (t.amount > 0) return true;
      const lastAsset = lastAssets.find(
        (a) =>
          a.symbol === t.symbol &&
          getAssetType(a) === getAssetType(t) &&
          isSameWallet(a.wallet ?? "", t.wallet),
      );
      return !!lastAsset && lastAsset.amount > 0;
    });

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
  savedStockRows = false,
  liveStatus?: LivePriceStatus,
): Promise<WalletCoinUSD[]> {
  const [valueContext, blacklistedSymbols] = await Promise.all([
    queryWalletCoinValueContext(assets, userProInfo, addProgress, savedStockRows, liveStatus),
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
  const savedPriceIdentities = new Set<string>();
  if (liveStatus) {
    const savedByIdentity = new Map<string, { amount: number; quotedValue: number; valid: boolean }>();
    for (const row of lastAssets) {
      if (row.amount <= 0) continue;
      const identity = getAssetIdentity(row);
      const saved = savedByIdentity.get(identity) ?? { amount: 0, quotedValue: 0, valid: true };
      saved.amount += row.amount;
      saved.quotedValue += row.price * row.amount;
      saved.valid &&= Number.isFinite(row.price) && row.price > 0;
      savedByIdentity.set(identity, saved);
    }
    for (const asset of assets) {
      const identity = getAssetIdentity(asset);
      const saved = savedByIdentity.get(identity);
      const current = valueContext.priceMap[identity] ?? valueContext.priceMap[asset.symbol];
      if ((!Number.isFinite(current) || current <= 0) && !asset.customPrice &&
        saved?.valid && saved.amount > 0 && saved.quotedValue > 0) {
        valueContext.priceMap[identity] = saved.quotedValue / saved.amount;
        savedPriceIdentities.add(identity);
      }
    }
  }
  const resolved = resolveWalletCoins(
    assets,
    lastAssets,
    valueContext,
    canonicalization,
    addProgress,
    [],
    [],
    new Set(),
    !liveStatus,
  );
  if (!liveStatus) return resolved;
  const pricedIdentities = new Set(resolved
    .filter((row) => Number.isFinite(row.price) && row.price > 0 &&
      !savedPriceIdentities.has(getAssetIdentity(row)))
    .map((row) => getAssetIdentity(row)));
  const lastValueByIdentity = new Map<string, number>();
  const lastTotal = lastAssets.reduce((sum, asset) => {
    if (!Number.isFinite(asset.value) || asset.value <= 0 ||
      blacklistedSymbols.includes(asset.symbol.toUpperCase())) return sum;
    const identity = getAssetIdentity(asset);
    lastValueByIdentity.set(identity, (lastValueByIdentity.get(identity) ?? 0) + asset.value);
    return sum + asset.value;
  }, 0);
  const unresolved = new Map<string, LiveMissingSymbol>();
  for (const asset of assets) {
    if (asset.amount <= 0 || blacklistedSymbols.includes(asset.symbol.toUpperCase())) continue;
    const identity = getAssetIdentity(asset);
    if (pricedIdentities.has(identity)) continue;
    unresolved.set(identity, {
      symbol: asset.symbol, assetType: getAssetType(asset),
      lastValue: lastValueByIdentity.get(identity) ?? 0,
    });
  }
  const byLastValue = (left: LiveMissingSymbol, right: LiveMissingSymbol) =>
    right.lastValue - left.lastValue || left.symbol.localeCompare(right.symbol);
  for (const item of unresolved.values()) {
    if (item.lastValue > 0 && item.lastValue < lastTotal * 0.0001 && item.lastValue < 1) {
      liveStatus.dustSymbols.push(item);
    } else {
      liveStatus.missingSymbols.push(item);
    }
  }
  liveStatus.missingSymbols.sort(byLastValue);
  liveStatus.dustSymbols.sort(byLastValue);
  liveStatus.missingCount = liveStatus.missingSymbols.length;
  liveStatus.missingShare = lastTotal > 0 && liveStatus.missingSymbols.every((item) => item.lastValue > 0)
    ? liveStatus.missingSymbols.reduce((sum, item) => sum + item.lastValue, 0) / lastTotal : undefined;
  if (unresolved.size) {
    console.debug("Live missing price symbols:", [
      ...liveStatus.missingSymbols, ...liveStatus.dustSymbols,
    ].map((item) => item.symbol));
  }
  if (liveStatus.missingRateSymbols.size) liveStatus.reason = "rateUnavailable";
  else if (liveStatus.missingCount && !liveStatus.reason) liveStatus.reason = "pricesMissing";
  return resolved;
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
  if (
    options.retrySourceId &&
    options.previousInputGeneration !== undefined &&
    options.previousInputGeneration !== portfolioInputGeneration
  ) {
    throw new FullRefreshRequiredError("Source changed. Run a full refresh.");
  }
  addProgress(2);
  // check if pro user
  const userProInfo = await isProVersion();
  addProgress(2);
  let portfolioResult = options.retrySourceId
    ? await fetchPortfolios(config, addProgress, userProInfo, { sourceId: options.retrySourceId,
      ...(options.onSourceResult ? { onSourceResult: options.onSourceResult } : {}) })
    : options.onSourceResult
      ? await fetchPortfolios(config, addProgress, userProInfo, { onSourceResult: options.onSourceResult })
      : await fetchPortfolios(config, addProgress, userProInfo);
  if (options.retrySourceId) {
    const previous = options.previousSourceResults?.find((source) => source.sourceId === options.retrySourceId);
    const retried = portfolioResult.sourceResults?.[0];
    if (!previous || !retried || !previous.walletIdentities.every((identity) =>
      retried.walletIdentities.some((next) => isSameWallet(identity, next))
    )) {
      throw new FullRefreshRequiredError("Source changed. Run a full refresh.");
    }
    const sourceResults = options.previousSourceResults!.map((source) =>
      source.sourceId === options.retrySourceId ? retried : source
    );
    const failedSources = sourceResults
      .filter((source) => source.status === "stale")
      .map((source) => ({
        sourceId: source.sourceId,
        analyzerName: source.label,
        walletIdentities: source.walletIdentities,
        error: source.category ?? "other",
        category: source.category,
      }));
    portfolioResult = {
      coins: combineCoinLists(sourceResults.map((source) => source.coins)),
      failedSources,
      sourceResults,
    };
  }

  if (options.retrySourceId && portfolioResult.sourceResults?.find(
    (source) => source.sourceId === options.retrySourceId
  )?.status === "stale") {
    return {
      failedSources: portfolioResult.failedSources,
      requiresDataSourceAction: true,
      usedLastKnownData: false,
      blacklistedSymbols: [],
      portfolioInputGeneration,
      sourceResults: portfolioResult.sourceResults,
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
  for (const coin of portfolioResult.coins) {
    if (portfolioResult.failedSources.some((source) =>
      source.walletIdentities.some((wallet) => isSameWallet(wallet, coin.wallet))
    )) continue;
    const identity = getAssetIdentity(coin);
    const known = valueContext.priceMap[identity];
    if (Number.isFinite(known) && known > 0) continue;
    const supplied = coin.price?.value;
    const price = coin.price?.base === "usdt"
      ? (supplied ?? 0) * (valueContext.priceMap.USDT ?? 1)
      : supplied;
    if (price !== undefined && Number.isFinite(price) && price > 0) {
      valueContext.priceMap[identity] = price;
    }
  }
  // This prefetch only chooses quote symbols; the write barrier rereads the baseline.
  const latestBefore = selectLatestPersistedSnapshot(
    await ASSET_HANDLER.listAssets(1),
  ).assets;
  const vanished = latestBefore.filter((asset) =>
    asset.amount > 0 &&
    !portfolioResult.failedSources.some((source) =>
      source.walletIdentities.some((wallet) => isSameWallet(wallet, asset.wallet ?? ""))
    ) &&
    !portfolioResult.coins.some((coin) =>
      getAssetIdentity(coin) === getAssetIdentity(asset) &&
      isSameWallet(coin.wallet, asset.wallet ?? "")
    ) &&
    !(Number.isFinite(valueContext.priceMap[getAssetIdentity(asset)]) &&
      valueContext.priceMap[getAssetIdentity(asset)] > 0)
  );
  const cryptoSymbols = [...new Set(vanished.filter((asset) =>
    getAssetType(asset) === "crypto").map((asset) => asset.symbol))];
  const stockSymbols = [...new Set(vanished.filter((asset) =>
    getAssetType(asset) === "stock" && !isBrokerCashSymbol(asset.symbol)
  ).map((asset) => asset.symbol))];
  const [cryptoPrices, stockPrices] = await Promise.all([
    cryptoSymbols.length ? queryCoinPrices(cryptoSymbols, userProInfo).catch(() => ({})) : Promise.resolve({}),
    stockSymbols.length ? fetchStockPrices(stockSymbols).catch(() => ({})) : Promise.resolve({}),
  ]);
  for (const [assetType, prices] of [["crypto", cryptoPrices], ["stock", stockPrices]] as const) {
    for (const [symbol, price] of Object.entries(prices)) {
      valueContext.priceMap[getAssetIdentity({ assetType, symbol })] = price;
    }
  }
  const stalePrices = await queryStalePrices(portfolioResult.failedSources, userProInfo);

  return {
    failedSources: portfolioResult.failedSources,
    requiresDataSourceAction: false,
    blacklistedSymbols,
    config,
    portfolioInputGeneration,
    portfolioResult,
    valueContext,
    stalePrices,
  };
}
