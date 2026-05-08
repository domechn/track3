import _ from "lodash";
import { generateRandomColors } from "../utils/color";
import {
  AssetChangeData,
  AssetModel,
  AssetReference,
  AssetsPercentageChangeData,
  CoinsAmountAndValueChangeData,
  PNLChartData,
  PNLTableDate,
  TDateRange,
  TopCoinsPercentageChangeData,
  TopCoinsRankData,
} from "./types";
import { getAssetIdentity, getAssetType } from "./datafetch/utils/coins";
import { ASSET_HANDLER } from "./entities/assets";
import { AssetType } from "./datafetch/types";
import {
  DATA_MAX_POINTS,
  filterByAssetType,
  toAssetReference,
} from "./charts-shared";

export async function queryPNLChartValue(
  dateRange: TDateRange,
  maxSize = DATA_MAX_POINTS,
): Promise<PNLChartData> {
  const data = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(
    dateRange.start,
    dateRange.end,
  );

  const reversedData = _(data).reverse().value();
  const step =
    reversedData.length > maxSize
      ? Math.floor(reversedData.length / maxSize)
      : 0;

  return _(reversedData)
    .filter((_d, idx, arr) => {
      if (step === 0) return true;
      return idx === 0 || idx === arr.length - 1 || idx % step === 0;
    })
    .map((rs) => ({
      totalValue: _(rs).sumBy("value"),
      timestamp: new Date(rs[0]?.createdAt).getTime(),
    }))
    .value();
}

export async function queryPNLTableValue(): Promise<PNLTableDate> {
  const pnlData = _(await ASSET_HANDLER.listSymbolGroupedAssets(35))
    .reverse()
    .map((rs) => ({
      totalValue: _(rs).sumBy("value"),
      timestamp: new Date(rs[0]?.createdAt).getTime(),
    }))
    .value();

  const getPNL = (days: number) => {
    if (pnlData.length < days + 1) {
      return;
    }

    const pickData = pnlData[pnlData.length - days - 1];
    const val = pnlData[pnlData.length - 1].totalValue - pickData.totalValue;
    return {
      value: val,
      timestamp: pickData.timestamp,
    };
  };

  return {
    latestTotalValue: _(pnlData).last()?.totalValue,
    todayPNL: getPNL(1),
    sevenTPnl: getPNL(8),
    thirtyPNL: getPNL(31),
  };
}

// returns top n coin symbols which have most value during the date range
export async function queryTopNAssets(
  dateRange: TDateRange,
  n: number,
): Promise<AssetReference[]> {
  const assets = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(
    dateRange.start,
    dateRange.end,
  );

  return _(assets)
    .flatten()
    .groupBy((asset) => getAssetIdentity(asset))
    .map((group) => ({
      symbol: group[0].symbol,
      assetType: getAssetType(group[0]),
      totalValue: _(group).sumBy("value"),
    }))
    .orderBy(["totalValue", "symbol"], ["desc", "asc"])
    .take(n)
    .map((asset) => ({
      symbol: asset.symbol,
      assetType: asset.assetType,
    }))
    .value();
}

// return top 10 and other coins' percentage change during the date range
export async function queryAssetsPercentageChange(
  dataRange: TDateRange,
): Promise<AssetsPercentageChangeData> {
  const assets = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(
    dataRange.start,
    dataRange.end,
  );
  const reservedAssets = _(assets).reverse().value();
  const getPercentages = (
    asts: AssetModel[],
  ): {
    timestamp: number;
    data: {
      symbol: string;
      assetType: AssetType;
      percentage: number;
    }[];
  } => {
    const total = _(asts).sumBy("value");
    // get top 10 coins and their percentage change
    if (total === 0) {
      return {
        timestamp: new Date(asts[0]?.createdAt).getTime(),
        data: _(asts)
          .map((a) => ({
            symbol: a.symbol,
            assetType: getAssetType(a),
            percentage: 0,
          }))
          .value(),
      };
    }

    return {
      timestamp: new Date(asts[0]?.createdAt).getTime(),
      data: _(asts)
        .map((a) => ({
          symbol: a.symbol,
          assetType: getAssetType(a),
          percentage: (a.value / total) * 100,
        }))
        .value(),
    };
  };

  const data = _(reservedAssets)
    .map((asts) => getPercentages(asts))
    .value();
  return _(data)
    .map((d) => ({
      timestamp: d.timestamp,
      percentages: d.data,
    }))
    .value();
}

export async function queryTopCoinsRank(
  dateRange: TDateRange,
  maxSize = DATA_MAX_POINTS,
): Promise<TopCoinsRankData> {
  const assets = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(
    dateRange.start,
    dateRange.end,
  );

  const reservedAssets = _(assets).reverse().value();

  const step =
    reservedAssets.length > maxSize
      ? Math.floor(reservedAssets.length / maxSize)
      : 0;
  const filteredReservedAssets = _(reservedAssets)
    .filter((_d, idx, arr) => {
      if (step === 0) return true;
      return idx === 0 || idx === arr.length - 1 || idx % step === 0;
    })
    .value();
  const timestamps = filteredReservedAssets.map((item) =>
    new Date(item[0]?.createdAt).getTime(),
  );
  const coins = getCoins(filteredReservedAssets);
  const coinRankMap = new Map<string, Map<number, number>>();
  coins.forEach((coin) => {
    coinRankMap.set(getAssetIdentity(coin), new Map<number, number>());
  });
  filteredReservedAssets.forEach((ass) => {
    const timestamp = new Date(ass[0]?.createdAt).getTime();
    const rankedAssets = _(ass).orderBy("value", "desc").take(10).value();
    rankedAssets.forEach((asset, idx) => {
      coinRankMap.get(getAssetIdentity(asset))?.set(timestamp, idx + 1);
    });
  });
  const colors = generateRandomColors(coins.length);

  return {
    timestamps,
    coins: _(coins)
      .map((coin, idx) => ({
        coin: coin.symbol,
        assetType: coin.assetType,
        lineColor: `rgba(${colors[idx].R}, ${colors[idx].G}, ${colors[idx].B}, 1)`,
        rankData: timestamps.map((timestamp) => ({
          timestamp,
          rank: coinRankMap.get(getAssetIdentity(coin))?.get(timestamp),
        })),
      }))
      .value(),
  };
}

export async function queryTopCoinsPercentageChangeData(
  dateRange: TDateRange,
  maxSize = DATA_MAX_POINTS,
): Promise<TopCoinsPercentageChangeData> {
  const assets = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(
    dateRange.start,
    dateRange.end,
  );

  const reservedAssets = _(assets).reverse().value();

  const step =
    reservedAssets.length > maxSize
      ? Math.floor(reservedAssets.length / maxSize)
      : 0;
  const filteredReservedAssets = _(reservedAssets)
    .filter((_d, idx, arr) => {
      if (step === 0) return true;
      return idx === 0 || idx === arr.length - 1 || idx % step === 0;
    })
    .value();
  const timestamps = filteredReservedAssets.map((item) =>
    new Date(item[0]?.createdAt).getTime(),
  );
  const coins = getCoins(filteredReservedAssets);
  const coinAssetsBySymbol = new Map<string, AssetModel[]>();
  filteredReservedAssets.forEach((ass) => {
    ass.forEach((asset) => {
      const assetKey = getAssetIdentity(asset);
      const items = coinAssetsBySymbol.get(assetKey) ?? [];
      items.push(asset);
      coinAssetsBySymbol.set(assetKey, items);
    });
  });
  const colors = generateRandomColors(coins.length);

  return {
    timestamps,
    coins: _(coins)
      .map((coin, idx) => ({
        coin: coin.symbol,
        assetType: coin.assetType,
        lineColor: `rgba(${colors[idx].R}, ${colors[idx].G}, ${colors[idx].B}, 1)`,
        percentageData: (() => {
          const coinDataList =
            coinAssetsBySymbol.get(getAssetIdentity(coin)) ?? [];
          if (coinDataList.length === 0) {
            return [];
          }
          const { value: firstCoinValue, price: firstCoinPrice } =
            coinDataList[0];
          return coinDataList.map((asset) => ({
            timestamp: new Date(asset.createdAt).getTime(),
            value:
              ((asset.value - firstCoinValue) / (firstCoinValue + 10 ** -21)) *
              100,
            price:
              ((asset.price - firstCoinPrice) / (firstCoinPrice + 10 ** -21)) *
              100,
          }));
        })(),
      }))
      .value(),
  };
}

function getCoins(assets: AssetModel[][], size = 10): AssetReference[] {
  // only take top 10 coins in each item
  return _(assets)
    .map((as) =>
      _(as)
        .sortBy("value")
        .reverse()
        .take(size > 0 ? size : _(as).size())
        .value(),
    )
    .flatten()
    .uniqBy((asset) => getAssetIdentity(asset))
    .map((asset) => toAssetReference(asset))
    .value();
}

export async function queryAssetChange(
  dateRange: TDateRange,
  maxSize = DATA_MAX_POINTS,
): Promise<AssetChangeData> {
  const assets = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(
    dateRange.start,
    dateRange.end,
  );

  const reversedAssets = _(assets).reverse().value();
  const step =
    reversedAssets.length > maxSize
      ? Math.floor(reversedAssets.length / maxSize)
      : 0;
  const reservedAssets = _(reversedAssets)
    .filter((_d, idx, arr) => {
      if (step === 0) return true;
      return idx === 0 || idx === arr.length - 1 || idx % step === 0;
    })
    .value();

  return {
    timestamps: _(reservedAssets)
      .flatten()
      .map((t) => new Date(t.createdAt).getTime())
      .uniq()
      .value(),
    data: _(reservedAssets)
      .map((ass) => ({
        usdValue: _(ass).sumBy("value"),
        btcPrice: _(ass).find((a) => a.symbol === "BTC")?.price,
      }))
      .value(),
  };
}

export async function queryCoinsAmountChange(
  symbol: string,
  dateRange: TDateRange,
  maxSize = DATA_MAX_POINTS,
  assetType?: AssetType,
): Promise<CoinsAmountAndValueChangeData | undefined> {
  const assets = await ASSET_HANDLER.listAssetsBySymbolByDateRange(
    symbol,
    dateRange.start,
    dateRange.end,
  );
  const filteredAssets = _(assets)
    .map((models) => filterByAssetType(models, assetType))
    .filter((models) => models.length > 0)
    .value();
  if (filteredAssets.length === 0) {
    return;
  }
  const reservedAssets = _(filteredAssets).reverse().value();

  const getAmountsAndTimestamps = (
    models: AssetModel[][],
  ): {
    amount: number;
    value: number;
    timestamp: number;
  }[] => {
    return _(models)
      .map((assets) => {
        return {
          amount: _(assets).sumBy("amount"),
          value: _(assets).sumBy("value"),
          timestamp: new Date(assets[0].createdAt).getTime(),
        };
      })
      .value();
  };

  const aat = getAmountsAndTimestamps(reservedAssets);
  const step = aat.length > maxSize ? Math.floor(aat.length / maxSize) : 0;
  const reservedAat = _(aat)
    .filter((_d, idx, arr) => {
      if (step === 0) return true;
      return idx === 0 || idx === arr.length - 1 || idx % step === 0;
    })
    .value();

  return {
    coin: symbol,
    amounts: _(reservedAat).map("amount").value(),
    values: _(reservedAat).map("value").value(),
    timestamps: _(reservedAat).map("timestamp").value(),
  };
}
