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

  const reversedData = data.slice().reverse();
  const step =
    reversedData.length > maxSize
      ? Math.floor(reversedData.length / maxSize)
      : 0;

  return reversedData
    .filter((_d, idx, arr) => {
      if (step === 0) return true;
      return idx === 0 || idx === arr.length - 1 || idx % step === 0;
    })
    .map((rs) => ({
      totalValue: rs.reduce((s, r) => s + r.value, 0),
      timestamp: new Date(rs[0]?.createdAt).getTime(),
    }));
}

export async function queryPNLTableValue(): Promise<PNLTableDate> {
  const pnlData = (await ASSET_HANDLER.listSymbolGroupedAssets(35))
    .slice()
    .reverse()
    .map((rs) => ({
      totalValue: rs.reduce((s, r) => s + r.value, 0),
      timestamp: new Date(rs[0]?.createdAt).getTime(),
    }));

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
    latestTotalValue: pnlData[pnlData.length - 1]?.totalValue,
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

  const groupedBySymbol = new Map<string, { symbol: string; assetType: AssetType; totalValue: number }>();
  for (const asset of assets.flat()) {
    const key = getAssetIdentity(asset);
    if (!groupedBySymbol.has(key)) {
      groupedBySymbol.set(key, { symbol: asset.symbol, assetType: getAssetType(asset), totalValue: 0 });
    }
    groupedBySymbol.get(key)!.totalValue += asset.value;
  }
  return Array.from(groupedBySymbol.values())
    .sort((a, b) => b.totalValue - a.totalValue || a.symbol.localeCompare(b.symbol))
    .slice(0, n)
    .map((asset) => ({
      symbol: asset.symbol,
      assetType: asset.assetType,
    }));
}

// return top 10 and other coins' percentage change during the date range
export async function queryAssetsPercentageChange(
  dataRange: TDateRange,
): Promise<AssetsPercentageChangeData> {
  const assets = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(
    dataRange.start,
    dataRange.end,
  );
  const reservedAssets = assets.slice().reverse();
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
    const total = asts.reduce((s, a) => s + a.value, 0);
    // get top 10 coins and their percentage change
    if (total === 0) {
      return {
        timestamp: new Date(asts[0]?.createdAt).getTime(),
        data: asts
          .map((a) => ({
            symbol: a.symbol,
            assetType: getAssetType(a),
            percentage: 0,
          })),
      };
    }

    return {
      timestamp: new Date(asts[0]?.createdAt).getTime(),
      data: asts.map((a) => ({
          symbol: a.symbol,
          assetType: getAssetType(a),
          percentage: (a.value / total) * 100,
        })),
    };
  };

  const data = reservedAssets
    .map((asts) => getPercentages(asts));
  return data
    .map((d) => ({
      timestamp: d.timestamp,
      percentages: d.data,
    }));
}

export async function queryTopCoinsRank(
  dateRange: TDateRange,
  maxSize = DATA_MAX_POINTS,
): Promise<TopCoinsRankData> {
  const assets = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(
    dateRange.start,
    dateRange.end,
  );

  const reservedAssets = assets.slice().reverse();

  const step =
    reservedAssets.length > maxSize
      ? Math.floor(reservedAssets.length / maxSize)
      : 0;
  const filteredReservedAssets = reservedAssets
    .filter((_d, idx, arr) => {
      if (step === 0) return true;
      return idx === 0 || idx === arr.length - 1 || idx % step === 0;
    });
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
    const rankedAssets = ass.slice().sort((a, b) => b.value - a.value).slice(0, 10);
    rankedAssets.forEach((asset, idx) => {
      coinRankMap.get(getAssetIdentity(asset))?.set(timestamp, idx + 1);
    });
  });
  const colors = generateRandomColors(coins.length);

  return {
    timestamps,
    coins: coins
      .map((coin, idx) => ({
        coin: coin.symbol,
        assetType: coin.assetType,
        lineColor: `rgba(${colors[idx].R}, ${colors[idx].G}, ${colors[idx].B}, 1)`,
        rankData: timestamps.map((timestamp) => ({
          timestamp,
          rank: coinRankMap.get(getAssetIdentity(coin))?.get(timestamp),
        })),
      })),
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

  const reservedAssets = assets.slice().reverse();

  const step =
    reservedAssets.length > maxSize
      ? Math.floor(reservedAssets.length / maxSize)
      : 0;
  const filteredReservedAssets = reservedAssets
    .filter((_d, idx, arr) => {
      if (step === 0) return true;
      return idx === 0 || idx === arr.length - 1 || idx % step === 0;
    });
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
    coins: coins
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
      })),
  };
}

function getCoins(assets: AssetModel[][], size = 10): AssetReference[] {
  // only take top 10 coins in each item
  const unique = new Map<string, AssetReference>();
  for (const as of assets) {
    const sorted = as.slice().sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, size > 0 ? size : sorted.length);
    for (const asset of top) {
      const key = getAssetIdentity(asset);
      if (!unique.has(key)) {
        unique.set(key, toAssetReference(asset));
      }
    }
  }
  return Array.from(unique.values());
}

export async function queryAssetChange(
  dateRange: TDateRange,
  maxSize = DATA_MAX_POINTS,
): Promise<AssetChangeData> {
  const assets = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(
    dateRange.start,
    dateRange.end,
  );

  const reversedAssets = assets.slice().reverse();
  const step =
    reversedAssets.length > maxSize
      ? Math.floor(reversedAssets.length / maxSize)
      : 0;
  const reservedAssets = reversedAssets
    .filter((_d, idx, arr) => {
      if (step === 0) return true;
      return idx === 0 || idx === arr.length - 1 || idx % step === 0;
    });

  return {
    timestamps: Array.from(new Set(
      reservedAssets.flat().map((t) => new Date(t.createdAt).getTime())
    )),
    data: reservedAssets.map((ass) => ({
        usdValue: ass.reduce((s, a) => s + a.value, 0),
        btcPrice: ass.find((a) => a.symbol === "BTC")?.price,
      })),
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
  const filteredAssets = assets
    .map((models) => filterByAssetType(models, assetType))
    .filter((models) => models.length > 0);
  if (filteredAssets.length === 0) {
    return;
  }
  const reservedAssets = filteredAssets.slice().reverse();

  const getAmountsAndTimestamps = (
    models: AssetModel[][],
  ): {
    amount: number;
    value: number;
    timestamp: number;
  }[] => {
    return models
      .map((assets) => {
        return {
          amount: assets.reduce((s, a) => s + a.amount, 0),
          value: assets.reduce((s, a) => s + a.value, 0),
          timestamp: new Date(assets[0].createdAt).getTime(),
        };
      });
  };

  const aat = getAmountsAndTimestamps(reservedAssets);
  const step = aat.length > maxSize ? Math.floor(aat.length / maxSize) : 0;
  const reservedAat = aat
    .filter((_d, idx, arr) => {
      if (step === 0) return true;
      return idx === 0 || idx === arr.length - 1 || idx % step === 0;
    });

  return {
    coin: symbol,
    amounts: reservedAat.map((a) => a.amount),
    values: reservedAat.map((a) => a.value),
    timestamps: reservedAat.map((a) => a.timestamp),
  };
}
