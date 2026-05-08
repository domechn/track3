import _ from "lodash";
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

export async function refreshAllData(addProgress: AddProgressFunc) {
  const lastAssets = _(await ASSET_HANDLER.listAssets(1))
    .flatten()
    .value();
  // will add 90 percent in query coins data
  const coins = await queryCoinsData(lastAssets, addProgress);

  // todo: add db transaction
  const uid = await ASSET_HANDLER.saveCoinsToDatabase(coins);
  addProgress(5);

  // calculate transactions and save
  const newAssets = _(await ASSET_HANDLER.listAssets(1))
    .flatten()
    .value();
  await TRANSACTION_HANDLER.saveTransactions(
    generateTransactions(uid, lastAssets, newAssets),
  );
  addProgress(5);
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

  const updatedTxns = _(after)
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
        return;
      }
      if (a.amount === l.amount) {
        return;
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
    .compact()
    .value();
  const removedTxns = _(before)
    .filter((la) => !afterAssetMap.has(getAssetKey(la)))
    .map((la) => {
      if (la.amount === 0) {
        return;
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
    .compact()
    .value();

  return [...updatedTxns, ...removedTxns];
}

// query the real-time price of the last queried asset
export async function queryRealTimeAssetsValue(): Promise<Asset[]> {
  const cache = getMemoryCacheInstance(
    CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY,
  );
  // const cache = getLocalStorageCacheInstance(CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY)
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
  const lastAssets = _(await ASSET_HANDLER.listAssets(1))
    .flatten()
    .value();

  const walletCoins = await queryCoinsDataByWalletCoins(
    _(assets)
      .map((a) => ({
        symbol: a.symbol,
        assetType: getAssetType(a),
        amount: a.amount,
        // wallet here dose not matter
        wallet: a.wallet ?? OthersAnalyzer.wallet,
      }))
      .value(),
    config,
    lastAssets,
    userProInfo,
  );

  const assetRes = _(walletCoins)
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
      const lastAst = _(assets).find(
        (a) => a.symbol === t.symbol && getAssetType(a) === getAssetType(t),
      );
      if (lastAst && ast.amount !== lastAst.amount) {
        ast.amount = lastAst.amount;
        ast.value = lastAst.value;
        ast.price = lastAst.price;
      }
      return ast;
    })
    .value();

  // 15 min ttl
  cache.setCache(cacheKey, assetRes, 15 * 60);
  return assetRes;
}

export async function fixSymbolDataIfNeeded(symbol: string) {
  // get max createdAt from assets_v2
  const maxCreatedAt = await ASSET_HANDLER.getLatestCreatedAt();
  if (!maxCreatedAt) {
    console.debug("there is no assets_v2 data");
    return;
  }
  // get max createdAt from assets_v2 for this symbol
  const symbolMaxCreatedAt = await ASSET_HANDLER.getLatestCreatedAt(symbol);
  if (!symbolMaxCreatedAt) {
    console.debug("there is no assets_v2 data for symbol", symbol);
    return;
  }

  // if they are the same, return
  if (maxCreatedAt === symbolMaxCreatedAt) {
    console.debug(
      "maxCreatedAt and symbolMaxCreatedAt are the same, no need to fix",
    );
    return;
  }

  // if symbol amount is 0, return
  const symbolModels = await ASSET_HANDLER.listAssetsMaxCreatedAt(
    undefined,
    undefined,
    symbol,
  );
  const symbolAmount = _(symbolModels).sumBy("amount");
  if (symbolAmount === 0) {
    console.debug("symbol amount is 0, no need to fix");
    return;
  }

  const symbolCreatedAt = _(symbolModels).first()?.createdAt;
  if (!symbolCreatedAt) {
    console.debug("symbol createdAt is not found, no need to fix");
    return;
  }

  const nextOtherSymbolModels = await ASSET_HANDLER.listAssetsAfterCreatedAt(
    new Date(symbolCreatedAt).getTime() + 1000,
    1,
    "asc",
  );

  const nextCreatedAt = _(nextOtherSymbolModels).first()?.createdAt;
  const nextUUID = _(nextOtherSymbolModels).first()?.uuid;
  if (!nextCreatedAt || !nextUUID) {
    console.debug("next createdAt or uuid is not found, no need to fix");
    return;
  }
  console.info(`there is some issue with ${symbol} data, need to fix`);

  // if they are different, find the next createdAt for this symbol
  // insert the createdAt and amount, value, price for this symbol into assets_v2
  // then insert a transaction, type is sell all of this coin
  console.debug("next createdAt is", nextCreatedAt);
  const needAddedModels = _(symbolModels)
    .map((m) => ({
      ...m,
      id: 0,
      uuid: nextUUID,
      createdAt: nextCreatedAt,
      amount: 0,
      value: 0,
    }))
    .value();

  const savedModels = await ASSET_HANDLER.saveAssets(needAddedModels);

  // no need to save transactions for now since all transactions are already saved
  const needAddedTransactions = generateTransactions(
    nextUUID,
    symbolModels,
    savedModels,
  );
  await TRANSACTION_HANDLER.saveTransactions(needAddedTransactions);
}

async function queryCoinsDataByWalletCoins(
  assets: WalletCoin[],
  config: GlobalConfig,
  lastAssets: AssetModel[],
  userProInfo: UserLicenseInfo,
  addProgress?: AddProgressFunc,
): Promise<WalletCoinUSD[]> {
  const needPriceAssets = _(assets)
    .filter((a) => !a.price)
    .value();
  const cryptoPriceSymbols = _(needPriceAssets)
    .filter((a) => getAssetType(a) === "crypto")
    .map("symbol")
    .push("USDT")
    .push("BTC")
    .uniq()
    .compact()
    .value();
  const stockPriceSymbols = _(needPriceAssets)
    .filter((a) => getAssetType(a) === "stock")
    .map("symbol")
    .uniq()
    .compact()
    .value();
  const [cryptoPriceMap, stockPriceMap] = await Promise.all([
    cryptoPriceSymbols.length > 0
      ? queryCoinPrices(cryptoPriceSymbols, userProInfo)
      : Promise.resolve({}),
    fetchStockPrices(stockPriceSymbols),
  ]);
  const typedCryptoPriceMap = _(cryptoPriceMap)
    .mapKeys((_price, symbol) =>
      getAssetIdentity({ symbol, assetType: "crypto" }),
    )
    .value();
  const typedStockPriceMap = _(stockPriceMap)
    .mapKeys((_price, symbol) =>
      getAssetIdentity({ symbol, assetType: "stock" }),
    )
    .value();
  const priceMap = {
    ...cryptoPriceMap,
    ...stockPriceMap,
    ...typedCryptoPriceMap,
    ...typedStockPriceMap,
  };
  if (addProgress) {
    addProgress(10);
  }

  let latestAssets = _.clone(assets);

  const stableCoins = await queryStableCoins();

  const upperCaseStableCoins = _(stableCoins)
    .map((c) => c.toUpperCase())
    .value();

  // save stable coins to configuration
  await saveStableCoins(upperCaseStableCoins);

  const groupUSD: boolean = _(config).get(["configs", "groupUSD"]) || false;
  if (groupUSD) {
    _(assets)
      .groupBy("wallet")
      .forEach((coins, wallet) => {
        const cryptoCoins = _(coins)
          .filter((c) => getAssetType(c) === "crypto")
          .value();
        const nonCryptoCoins = _(coins)
          .filter((c) => getAssetType(c) !== "crypto")
          .value();
        // not case sensitive
        const usdAmount = _(cryptoCoins)
          .filter((c) => upperCaseStableCoins.includes(c.symbol.toUpperCase()))
          .map((c) => c.amount)
          .sum();
        const removedUSDCoins = _(cryptoCoins)
          .filter((c) => !upperCaseStableCoins.includes(c.symbol.toUpperCase()))
          .concat(nonCryptoCoins)
          .value();
        latestAssets = _(latestAssets)
          .filter((a) => a.wallet !== wallet)
          .concat(removedUSDCoins)
          .value();
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
  const btcData = _(assets).find(
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
  const filteredTotals = _(totals)
    .filter((t) => {
      // 3. BTC always save regardless
      if (t.symbol === "BTC") {
        return true;
      }

      // 1. If USD value < 1, consider it sold out, set amount and value to 0
      const isCurrentSoldOut = t.usdValue < 1;

      // Handle wallet comparison: lastAssets contains MD5 hashed wallet (no prefix)
      // Current wallet might have "md5:" prefix, so we need to normalize it
      const lastAsset = _(lastAssets).find(
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
    }))
    .value();

  if (addProgress) {
    addProgress(5);
  }
  const blacklist = await getBlacklistCoins();
  if (blacklist.length > 0) {
    const blacklistedSymbols = _(blacklist)
      .map((s) => s.toUpperCase())
      .value();
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
): Promise<WalletCoinUSD[]> {
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
  const assets = await loadPortfolios(
    config,
    lastAssets,
    addProgress,
    userProInfo,
  );

  return queryCoinsDataByWalletCoins(
    assets,
    config,
    lastAssets,
    userProInfo,
    addProgress,
  );
}
