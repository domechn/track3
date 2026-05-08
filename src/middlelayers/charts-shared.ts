import { AssetReference } from "./types";
import { getAssetType } from "./datafetch/utils/coins";
import { AssetType } from "./datafetch/types";

// if data length is greater than 100, only take 100 data points
export const DATA_MAX_POINTS = 100;

export function filterByAssetType<T extends { assetType?: AssetType }>(
  items: T[],
  assetType?: AssetType,
): T[] {
  return assetType
    ? items.filter((item) => getAssetType(item) === assetType)
    : items;
}

export function toAssetReference(asset: {
  symbol: string;
  assetType?: AssetType;
}): AssetReference {
  return {
    symbol: asset.symbol,
    assetType: getAssetType(asset),
  };
}
