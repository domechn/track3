import { generateRandomColors } from "../utils/color";
import {
  AssetChangeData,
  AssetReference,
  AssetsPercentageChangeData,
  CoinsAmountAndValueChangeData,
  PNLChartData,
  PNLTableDate,
  TDateRange,
  TopCoinsPercentageChangeData,
  TopCoinsRankData,
} from "./types";
import { getAssetIdentity } from "./datafetch/utils/coins";
import { ASSET_HANDLER } from "./entities/assets";
import { AssetType } from "./datafetch/types";
import { selectFromDatabaseWithSql } from "./database";
import { downsampleIndices } from "./chart-downsample";
import {
  DATA_MAX_POINTS,
} from "./charts-shared";

export async function queryPNLChartValue(
  dateRange: TDateRange,
  maxSize = Infinity,
  excludedSymbols: string[] = [],
): Promise<PNLChartData> {
  const data = await ASSET_HANDLER.listTotalValueRecords(
    dateRange.start,
    dateRange.end,
    excludedSymbols,
  );
  return downsampleIndices([data.map((record) => record.totalValue)], maxSize)
    .map((index) => ({
      totalValue: data[index].totalValue,
      timestamp: new Date(data[index].createdAt).getTime(),
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
  const rows = await selectFromDatabaseWithSql<{ symbol: string; asset_type: AssetType }>(
    `SELECT MIN(TRIM(symbol)) AS symbol, asset_type FROM assets_v2
     WHERE createdAt >= ? AND createdAt <= ?
     GROUP BY asset_type, UPPER(TRIM(symbol))
     ORDER BY SUM(value) DESC, symbol ASC, asset_type ASC LIMIT ?`,
    [dateRange.start.toISOString(), dateRange.end.toISOString(), n],
  );
  return rows.map(({ symbol, asset_type }) => ({ symbol, assetType: asset_type }));
}

// return top 10 and other coins' percentage change during the date range
export async function queryAssetsPercentageChange(
  dataRange: TDateRange,
  n: number,
): Promise<AssetsPercentageChangeData> {
  const bounds = [dataRange.start.toISOString(), dataRange.end.toISOString()];
  const rows = await selectFromDatabaseWithSql<{
    uuid: string; createdAt: string; total: number;
    symbol: string | null; asset_type: AssetType | null; value: number | null;
  }>(
    `WITH top AS (
       SELECT UPPER(TRIM(symbol)) AS symbolKey, MIN(TRIM(symbol)) AS symbol, asset_type FROM assets_v2
       WHERE createdAt >= ? AND createdAt <= ?
       GROUP BY asset_type, UPPER(TRIM(symbol))
       ORDER BY SUM(value) DESC, symbol ASC, asset_type ASC LIMIT ?
     ), snapshots AS (
       SELECT uuid, MAX(createdAt) AS createdAt, SUM(value) AS total
       FROM assets_v2 WHERE createdAt >= ? AND createdAt <= ? GROUP BY uuid
     ), top_values AS (
       SELECT a.uuid, top.symbol, top.asset_type, SUM(a.value) AS value
       FROM assets_v2 a JOIN top
         ON UPPER(TRIM(a.symbol)) = top.symbolKey AND a.asset_type = top.asset_type
       WHERE a.createdAt >= ? AND a.createdAt <= ?
       GROUP BY a.uuid, top.symbol, top.asset_type
     )
     SELECT snapshots.*, top_values.symbol, top_values.asset_type, top_values.value
     FROM snapshots LEFT JOIN top_values ON snapshots.uuid = top_values.uuid
     ORDER BY snapshots.createdAt ASC, snapshots.uuid ASC`,
    [...bounds, n, ...bounds, ...bounds],
  );
  const grouped = new Map<string, AssetsPercentageChangeData[number] & { topValue: number; total: number }>();
  for (const row of rows) {
    let entry = grouped.get(row.uuid);
    if (!entry) {
      entry = { timestamp: new Date(row.createdAt).getTime(), percentages: [], topValue: 0, total: row.total };
      grouped.set(row.uuid, entry);
    }
    if (row.symbol && row.asset_type && row.value !== null) {
      entry.topValue += row.value;
      entry.percentages.push({
        symbol: row.symbol,
        assetType: row.asset_type,
        percentage: row.total ? row.value / row.total * 100 : 0,
      });
    }
  }
  return [...grouped.values()].map(({ timestamp, percentages, topValue, total }) => ({
    timestamp,
    percentages: [...percentages, {
      symbol: "__other__", assetType: "crypto",
      percentage: total ? (total - topValue) / total * 100 : 0,
    }],
  }));
}

export async function queryTopCoinsRank(
  dateRange: TDateRange,
  maxSize = DATA_MAX_POINTS,
): Promise<TopCoinsRankData> {
  const { snapshots, assets } = await querySampledTopAssets(dateRange, maxSize);
  const timestamps = snapshots.map((item) => new Date(item.createdAt).getTime());
  const coins = uniqueTopCoins(assets);
  const coinRankMap = new Map<string, Map<number, number>>();
  coins.forEach((coin) => {
    coinRankMap.set(getAssetIdentity(coin), new Map<number, number>());
  });
  assets.forEach((asset) =>
    coinRankMap.get(getAssetIdentity(asset))?.set(new Date(asset.createdAt).getTime(), asset.rank));
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
  const { snapshots, assets } = await querySampledTopAssets(dateRange, maxSize, true);
  const timestamps = snapshots.map((item) => new Date(item.createdAt).getTime());
  const coins = uniqueTopCoins(assets.filter((asset) => asset.rank <= 10));
  const coinAssetsBySymbol = new Map<string, typeof assets>();
  assets.forEach((asset) => {
    const assetKey = getAssetIdentity(asset);
    const items = coinAssetsBySymbol.get(assetKey) ?? [];
    items.push(asset);
    coinAssetsBySymbol.set(assetKey, items);
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

type TopAssetRow = {
  uuid: string; createdAt: string; symbol: string; assetType: AssetType;
  value: number; price: number; rank: number;
};

function uniqueTopCoins(assets: TopAssetRow[]): AssetReference[] {
  const unique = new Map<string, AssetReference>();
  for (const asset of assets) {
    const key = getAssetIdentity(asset);
    if (!unique.has(key)) {
      unique.set(key, { symbol: asset.symbol, assetType: asset.assetType });
    }
  }
  return Array.from(unique.values());
}

async function querySampledTopAssets(dateRange: TDateRange, maxSize: number, includeTopCoinHistory = false) {
  const snapshots = await selectFromDatabaseWithSql<{
    uuid: string; createdAt: string; total: number;
  }>(
    `SELECT uuid, MAX(createdAt) AS createdAt, SUM(value) AS total FROM assets_v2
     WHERE createdAt >= ? AND createdAt <= ?
     GROUP BY uuid ORDER BY createdAt ASC, uuid ASC`,
    [dateRange.start.toISOString(), dateRange.end.toISOString()],
  );
  const sampled = downsampleIndices([snapshots.map((snapshot) => snapshot.total)], maxSize)
    .map((index) => snapshots[index]);
  if (sampled.length === 0) return { snapshots: sampled, assets: [] as TopAssetRow[] };
  const assets = await selectFromDatabaseWithSql<TopAssetRow>(
    `WITH snapshots(uuid, createdAt) AS (
       VALUES ${sampled.map(() => "(?, ?)").join(",")}
     ), grouped AS (
       SELECT a.uuid, snapshots.createdAt, a.symbol, a.asset_type AS assetType,
              SUM(a.value) AS value, MIN(a.id) AS firstId
       FROM assets_v2 a JOIN snapshots ON snapshots.uuid = a.uuid
       GROUP BY a.uuid, a.asset_type, a.symbol
     ), ranked AS (
       SELECT grouped.uuid, grouped.createdAt, grouped.symbol, grouped.assetType,
              grouped.value, first.price, ROW_NUMBER() OVER (
         PARTITION BY grouped.uuid ORDER BY grouped.value DESC, grouped.symbol ASC, grouped.assetType ASC
       ) AS rank FROM grouped JOIN assets_v2 first ON first.id = grouped.firstId
     )
     SELECT * FROM ranked WHERE rank <= 10
       ${includeTopCoinHistory ? "OR (assetType, symbol) IN (SELECT assetType, symbol FROM ranked WHERE rank <= 10)" : ""}
     ORDER BY createdAt ASC, uuid ASC, rank ASC`,
    sampled.flatMap((snapshot) => [snapshot.uuid, snapshot.createdAt]),
  );
  return { snapshots: sampled, assets };
}

export async function queryAssetChange(
  dateRange: TDateRange,
  maxSize = Infinity,
): Promise<AssetChangeData> {
  const records = await selectFromDatabaseWithSql<{
    uuid: string; createdAt: string; usdValue: number; btcPrice: number | null;
  }>(
    `SELECT a.uuid, MAX(a.createdAt) AS createdAt, SUM(a.value) AS usdValue,
       (SELECT btc.price FROM assets_v2 btc
        WHERE btc.uuid = a.uuid AND btc.symbol = 'BTC'
        ORDER BY btc.id LIMIT 1) AS btcPrice
     FROM assets_v2 a WHERE a.createdAt >= ? AND a.createdAt <= ?
     GROUP BY a.uuid ORDER BY createdAt ASC, a.uuid ASC`,
    [dateRange.start.toISOString(), dateRange.end.toISOString()],
  );
  const sampled = downsampleIndices([records.map((record) => record.usdValue)], maxSize)
    .map((index) => records[index]);

  return {
    timestamps: sampled.map((record) => new Date(record.createdAt).getTime()),
    data: sampled.map((record) => ({
      usdValue: record.usdValue,
      btcPrice: record.btcPrice ?? undefined,
    })),
  };
}

export async function queryCoinsAmountChange(
  symbol: string,
  dateRange: TDateRange,
  maxSize = Infinity,
  assetType?: AssetType,
): Promise<CoinsAmountAndValueChangeData | undefined> {
  const records = await selectFromDatabaseWithSql<{
    uuid: string; createdAt: string; amount: number; value: number;
  }>(
    `SELECT uuid, MAX(createdAt) AS createdAt,
            SUM(amount) AS amount, SUM(value) AS value
     FROM assets_v2
     WHERE symbol = ? AND createdAt >= ? AND createdAt <= ?
       ${assetType ? "AND asset_type = ?" : ""}
     GROUP BY uuid ORDER BY createdAt ASC, uuid ASC`,
    [symbol, dateRange.start.toISOString(), dateRange.end.toISOString(), ...(assetType ? [assetType] : [])],
  );
  if (records.length === 0) {
    return;
  }
  const sampled = downsampleIndices(
    [records.map((record) => record.value), records.map((record) => record.amount)],
    maxSize,
  ).map((index) => records[index]);

  return {
    coin: symbol,
    amounts: sampled.map((record) => record.amount),
    values: sampled.map((record) => record.value),
    timestamps: sampled.map((record) => new Date(record.createdAt).getTime()),
  };
}
