import { isSameWallet } from "../lib/utils";
import {
  AddProgressFunc,
  Asset,
  AssetModel,
  TransactionModel,
  UserLicenseInfo,
  WalletCoinUSD,
} from "./types";
import { loadPortfolios, queryCoinPrices, queryStableCoins } from "./data";
import type { FailedPortfolioSource, LoadPortfoliosOptions } from "./data";
import {
  getConfiguration,
  getBlacklistCoins,
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
import { getMemoryCacheInstance } from "./datafetch/utils/cache";
import { GlobalConfig, WalletCoin } from "./datafetch/types";
import { CACHE_GROUP_KEYS } from "./consts";
import { TRANSACTION_HANDLER } from "./entities/transactions";

export const WALLET_ANALYZER = new WalletAnalyzer((size) =>
  ASSET_HANDLER.listAssets(size),
);

export type RefreshAllDataOptions = LoadPortfoliosOptions;

export type RefreshAllDataResult = {
  failedSources: FailedPortfolioSource[];
  requiresDataSourceAction: boolean;
  usedLastKnownData: boolean;
};

type QueryCoinsDataResult = RefreshAllDataResult & {
  coins: WalletCoinUSD[];
};

export async function refreshAllData(
  addProgress: AddProgressFunc,
  options: RefreshAllDataOptions = {},
): Promise<RefreshAllDataResult> {
  const lastAssets = (await ASSET_HANDLER.listAssets(1)).flat();
  // will add 90 percent in query coins data
  const queryResult = await queryCoinsData(lastAssets, addProgress, options);
  if (queryResult.requiresDataSourceAction) {
    return {
      failedSources: queryResult.failedSources,
      requiresDataSourceAction: true,
      usedLastKnownData: false,
    };
  }

  // todo: add db transaction
  const uid = await ASSET_HANDLER.saveCoinsToDatabase(queryResult.coins);
  addProgress(5);

  // calculate transactions and save
  const newAssets = (await ASSET_HANDLER.listAssets(1)).flat();
  await TRANSACTION_HANDLER.saveTransactions(
    generateTransactions(uid, lastAssets, newAssets),
  );
  addProgress(5);

  return {
    failedSources: queryResult.failedSources,
    requiresDataSourceAction: false,
    usedLastKnownData: queryResult.usedLastKnownData,
  };
}

function generateTransactions(
  uid: string,
  before: AssetModel[],
  after: AssetModel[],
): TransactionModel[] {
  const getAssetKey = (asset: AssetModel) =>
    `${getAssetType(asset)}:${asset.symbol}:${asset.wallet}`;
  const beforeAssetMap = new Map<string, AssetModel>();
  const afterAssetMap = new Map<string, AssetModel>();
  before.forEach((asset) => {
    beforeAssetMap.set(getAssetKey(asset), asset);
  });
  after.forEach((asset) => {
    afterAssetMap.set(getAssetKey(asset), asset);
  });

  const updatedTxns = after
    .map((a) => {
      const l = beforeAssetMap.get(getAssetKey(a));
      if (!l) {
        if (a.amount !== 0) {
          return {
            uuid: uid,
            assetID: a.id,
            assetType: getAssetType(a),
            wallet: a.wallet,
            symbol: a.symbol,
            amount: a.amount,
            price: a.price,
            txnType: "buy",
            txnCreatedAt: a.createdAt,
            createdAt: a.createdAt,
          } as TransactionModel;
        }
        return undefined as unknown as TransactionModel;
      }
      if (a.amount === l.amount) {
        return undefined as unknown as TransactionModel;
      }
      return {
        uuid: uid,
        assetID: a.id,
        assetType: getAssetType(a),
        wallet: a.wallet,
        symbol: a.symbol,
        amount: Math.abs(a.amount - l.amount),
        price: a.price,
        txnType: a.amount > l.amount ? "buy" : "sell",
        txnCreatedAt: a.createdAt,
      } as TransactionModel;
    })
    .filter((x): x is TransactionModel => !!x);
  const removedTxns = before
    .filter((la) => !afterAssetMap.has(getAssetKey(la)))
    .map((la) => {
      if (la.amount === 0) {
        return undefined as unknown as TransactionModel;
      }
      return {
        uuid: uid,
        assetID: la.id,
        assetType: getAssetType(la),
        wallet: la.wallet,
        symbol: la.symbol,
        amount: la.amount,
        price: la.price,
        txnType: "sell",
        txnCreatedAt: la.createdAt,
      } as TransactionModel;
    })
    .filter((x): x is TransactionModel => !!x);

  return [...updatedTxns, ...removedTxns];
}

// query the real-time price of the last queried asset
export async function queryRealTimeAssetsValue(): Promise<Asset[]> {
  const cache = getMemoryCacheInstance(
    CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY,
  );
  const cacheKey = "real-time-assets";
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

async function queryCoinsDataByWalletCoins(
  assets: WalletCoin[],
  config: GlobalConfig,
  lastAssets: AssetModel[],
  userProInfo: UserLicenseInfo,
  addProgress?: AddProgressFunc,
): Promise<WalletCoinUSD[]> {
  const needPriceAssets = assets.filter((a) => !a.price);
  const cryptoPriceSymbols = Array.from(new Set(
    needPriceAssets
      .filter((a) => getAssetType(a) === "crypto")
      .map((a) => a.symbol)
      .concat(["USDT", "BTC"])
  )).filter((x): x is string => !!x);
  const stockPriceSymbols = Array.from(new Set(
    needPriceAssets
      .filter((a) => getAssetType(a) === "stock")
      .map((a) => a.symbol)
  )).filter((x): x is string => !!x);
  const [cryptoPriceMap, stockPriceMap] = await Promise.all([
    cryptoPriceSymbols.length > 0
      ? queryCoinPrices(cryptoPriceSymbols, userProInfo)
      : Promise.resolve({}),
    fetchStockPrices(stockPriceSymbols),
  ]);
  const typedCryptoPriceMap: Record<string, number> = {};
  for (const symbol of Object.keys(cryptoPriceMap)) {
    typedCryptoPriceMap[getAssetIdentity({ symbol, assetType: "crypto" })] = cryptoPriceMap[symbol];
  }
  const typedStockPriceMap: Record<string, number> = {};
  for (const symbol of Object.keys(stockPriceMap)) {
    typedStockPriceMap[getAssetIdentity({ symbol, assetType: "stock" })] = stockPriceMap[symbol];
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

  let latestAssets = [...assets];

  const stableCoins = await queryStableCoins();

  const upperCaseStableCoins = stableCoins.map((c) => c.toUpperCase());

  // save stable coins to configuration
  await saveStableCoins(upperCaseStableCoins);

  const groupUSD: boolean = (config as any)?.configs?.groupUSD || false;
  if (groupUSD) {
    Object.values(
      assets.reduce((map, coin) => {
        const w = coin.wallet ?? "";
        if (!map[w]) map[w] = [];
        map[w].push(coin);
        return map;
      }, {} as Record<string, WalletCoin[]>)
    ).forEach((coins) => {
      const wallet = coins[0]?.wallet ?? "";
      const cryptoCoins = coins.filter((c) => getAssetType(c) === "crypto");
      const nonCryptoCoins = coins.filter((c) => getAssetType(c) !== "crypto");
      // not case sensitive
      const usdAmount = cryptoCoins
        .filter((c) => upperCaseStableCoins.includes(c.symbol.toUpperCase()))
        .reduce((s, c) => s + c.amount, 0);
      const removedUSDCoins = cryptoCoins
        .filter((c) => !upperCaseStableCoins.includes(c.symbol.toUpperCase()))
        .concat(nonCryptoCoins);
      latestAssets = latestAssets
        .filter((a) => a.wallet !== wallet)
        .concat(removedUSDCoins);
      if (usdAmount > 0) {
        latestAssets.push({
          symbol: "USDT",
          assetType: "crypto",
          amount: usdAmount,
          wallet,
        });
      }
    });
  }

  // add btc value if not exist
  const btcData = assets.find(
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
  const blacklist = await getBlacklistCoins();
  if (blacklist.length > 0) {
    const blacklistedSymbols = blacklist.map((s) => s.toUpperCase());
    return filteredTotals.filter(
      (t) => !blacklistedSymbols.includes(t.symbol.toUpperCase()),
    );
  }

  return filteredTotals;
}

// query all assets and calculate their value in USD
async function queryCoinsData(
  lastAssets: AssetModel[],
  addProgress: AddProgressFunc,
  options: RefreshAllDataOptions = {},
): Promise<QueryCoinsDataResult> {
  addProgress(1);
  const config = await getConfiguration();
  if (!config) {
    throw new Error("no configuration found,\n please add configuration first");
  }
  addProgress(2);
  // check if pro user
  const userProInfo = await isProVersion();
  addProgress(2);
  // will add 70 percent progress in load portfolios
  const portfolioResult = await loadPortfolios(
    config,
    lastAssets,
    addProgress,
    userProInfo,
    options,
  );

  if (
    portfolioResult.failedSources.length > 0 &&
    !options.useLastKnownDataForFailedSources
  ) {
    return {
      coins: [],
      failedSources: portfolioResult.failedSources,
      requiresDataSourceAction: true,
      usedLastKnownData: false,
    };
  }

  const coins = await queryCoinsDataByWalletCoins(
    portfolioResult.coins,
    config,
    lastAssets,
    userProInfo,
    addProgress,
  );

  return {
    coins,
    failedSources: portfolioResult.failedSources,
    requiresDataSourceAction: false,
    usedLastKnownData:
      portfolioResult.failedSources.length > 0 &&
      !!options.useLastKnownDataForFailedSources,
  };
}
