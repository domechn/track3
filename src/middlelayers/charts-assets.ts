import _ from "lodash";
import { generateRandomColors } from "../utils/color";
import {
  Asset,
  AssetModel,
  AssetReference,
  LatestAssetsPercentageData,
  MaxTotalValueData,
  TDateRange,
  TotalValueData,
} from "./types";
import { getBlacklistCoins } from "./configuration";
import { getAssetType } from "./datafetch/utils/coins";
import { timeToDateStr } from "../utils/date";
import { ASSET_HANDLER } from "./entities/assets";
import { AssetType } from "./datafetch/types";
import { filterByAssetType, toAssetReference } from "./charts-shared";

// listAllowedSymbols return all symbol names
// returns sort by latest value desc
export async function listAllowedSymbols(): Promise<AssetReference[]> {
  const groupedAssets = await ASSET_HANDLER.listSymbolGroupedAssets(1);
  return _(groupedAssets[0] ?? [])
    .filter((asset) => asset.amount !== 0)
    .orderBy(["value", "symbol"], ["desc", "asc"])
    .map((asset) => toAssetReference(asset))
    .value();
}

export async function queryAssetMaxAmountBySymbol(
  symbol: string,
  dateRange?: TDateRange,
  assetType?: AssetType,
): Promise<number> {
  const groupedAssets = dateRange
    ? await ASSET_HANDLER.listAssetsBySymbolByDateRange(
        symbol,
        dateRange.start,
        dateRange.end,
      )
    : await ASSET_HANDLER.listAssetsBySymbol(symbol);

  return (
    _(groupedAssets)
      .map((models) => filterByAssetType(models, assetType))
      .filter((models) => models.length > 0)
      .map((models) => _(models).sumBy("amount"))
      .max() ?? 0
  );
}

export async function queryLastAssetsBySymbol(
  symbol: string,
  dateRange?: TDateRange,
  assetType?: AssetType,
): Promise<Asset | undefined> {
  if (dateRange) {
    const models = await ASSET_HANDLER.listAssetsMaxCreatedAt(
      dateRange.start,
      dateRange.end,
      symbol,
    );
    return convertAssetModelsToAsset(filterByAssetType(models, assetType));
  }
  const models = await ASSET_HANDLER.listAssetsBySymbol(symbol, 1);
  return convertAssetModelsToAsset(
    filterByAssetType(_(models).flatten().value(), assetType),
  );
}

// models: must only contain same symbol and asset type assets
function convertAssetModelsToAsset(models: AssetModel[]): Asset | undefined {
  if (models.length === 0) {
    return;
  }

  const first = models[0];
  const total = _(models).reduce(
    (acc, cur) => ({
      amount: acc.amount + cur.amount,
      value: acc.value + cur.value,
    }),
    { amount: 0, value: 0 },
  );

  return {
    symbol: first.symbol,
    assetType: getAssetType(first),
    amount: total.amount,
    value: total.value,
    price: first.price,
  };
}

export async function queryAssetsAfterCreatedAt(
  createdAt?: number,
): Promise<AssetModel[]> {
  return ASSET_HANDLER.listAssetsAfterCreatedAt(createdAt);
}

export async function queryAssetsByIDs(ids: number[]): Promise<AssetModel[]> {
  return ASSET_HANDLER.listAssetsByIDs(ids);
}

export async function queryAssetsByUUIDs(
  uuids: string[],
): Promise<AssetModel[]> {
  return ASSET_HANDLER.listAssetsByUUIDs(uuids);
}

export async function queryTotalValue(
  dateRange?: TDateRange,
): Promise<TotalValueData> {
  if (dateRange) {
    const results = await ASSET_HANDLER.listTotalValueRecords(
      dateRange.start,
      dateRange.end,
    );
    const latest = _(results).last();
    return {
      totalValue: latest?.totalValue || 0,
    };
  }

  const results = await ASSET_HANDLER.listSymbolGroupedAssets(1);

  if (results.length === 0) {
    return {
      totalValue: 0,
    };
  }

  const latest = results[0];

  const latestTotal = _(latest).sumBy("value") || 0;

  return {
    totalValue: latestTotal,
  };
}

export async function queryMaxTotalValue(
  dateRange: TDateRange,
): Promise<MaxTotalValueData> {
  const record = await ASSET_HANDLER.listMaxTotalValueRecord(
    dateRange.start,
    dateRange.end,
  );
  if (!record) {
    return {
      uuid: "",
      totalValue: 0,
      date: new Date(),
    };
  }
  return {
    uuid: record.uuid,
    totalValue: record.totalValue,
    date: new Date(record.createdAt),
  };
}

export async function queryLastRefreshAt(): Promise<string | undefined> {
  const lc = await ASSET_HANDLER.getLatestCreatedAt();
  return lc ? timeToDateStr(new Date(lc).getTime(), true) : undefined;
}

export async function queryLatestAssets(): Promise<Asset[]> {
  const size = 1;

  const assets = await ASSET_HANDLER.listSymbolGroupedAssets(size);
  if (assets.length === 0) {
    return [];
  }

  const blacklist = await getBlacklistCoins();
  const blacklistedSymbols = _(blacklist)
    .map((s) => s.toUpperCase())
    .value();
  return _(assets[0])
    .filter((a) => a.amount !== 0)
    .filter((a) => !blacklistedSymbols.includes(a.symbol.toUpperCase()))
    .map((a) => ({
      symbol: a.symbol,
      assetType: getAssetType(a),
      amount: a.amount,
      value: a.value,
      price: a.value / a.amount,
    }))
    .value();
}

export async function queryLatestAssetsPercentage(
  dateRange?: TDateRange,
): Promise<LatestAssetsPercentageData> {
  const assets = dateRange
    ? await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(
        dateRange.start,
        dateRange.end,
      )
    : await ASSET_HANDLER.listSymbolGroupedAssets(1);
  if (assets.length === 0) {
    return [];
  }

  // ignore coins whose amount is 0 and blacklisted symbols
  const blacklist = await getBlacklistCoins();
  const blacklistedSymbols = _(blacklist)
    .map((s) => s.toUpperCase())
    .value();
  const latest = _(assets[0])
    .filter(
      (a) =>
        a.amount !== 0 && !blacklistedSymbols.includes(a.symbol.toUpperCase()),
    )
    .value();
  const backgroundColors = generateRandomColors(_(latest).size());

  const total = _(latest).sumBy("value") + 10 ** -21; // avoid total is 0

  const res: {
    coin: string;
    assetType: ReturnType<typeof getAssetType>;
    percentage: number;
    amount: number;
    value: number;
  }[] = _(latest)
    .map((t) => ({
      coin: t.symbol,
      assetType: getAssetType(t),
      amount: t.amount,
      value: t.value,
      percentage: (t.value / total) * 100,
    }))
    .value();

  return _(res)
    .sortBy("percentage")
    .reverse()
    .map((v, idx) => ({
      ...v,
      chartColor: `rgba(${backgroundColors[idx].R}, ${backgroundColors[idx].G}, ${backgroundColors[idx].B}, 1)`,
    }))
    .value();
}

export async function queryCoinDataByUUID(uuid: string): Promise<Asset[]> {
  const models = await ASSET_HANDLER.listSymbolGroupedAssetsByUUID(uuid);

  const res: Asset[] = _(models)
    .map((m) => ({
      symbol: m.symbol,
      assetType: getAssetType(m),
      amount: m.amount,
      value: m.value,
      price: m.price,
    }))
    .value();
  return res;
}

export async function queryAllDataDates(): Promise<
  {
    id: string;
    date: string;
  }[]
> {
  const records = await ASSET_HANDLER.listAllUUIDWithCreatedAt();

  return _(records)
    .map((record) => ({
      id: record.uuid,
      date: timeToDateStr(new Date(record.createdAt).getTime()),
    }))
    .value();
}
