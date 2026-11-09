import type { AssetType } from "@/middlelayers/datafetch/types";
import {
  getAssetIdentity,
  getAssetType,
} from "@/middlelayers/datafetch/utils/coins";

export function parseAssetTypeSearchParam(
  assetType?: string | null,
): AssetType {
  return assetType === "stock" ? "stock" : "crypto";
}

export function buildAssetDetailsPath(asset: {
  symbol: string;
  assetType?: AssetType;
}): string {
  return `/coins/${encodeURIComponent(asset.symbol)}?assetType=${getAssetType(asset)}`;
}

export function formatAssetLabel(asset: {
  symbol: string;
  assetType?: AssetType;
}): string {
  return asset.symbol;
}

export function getAssetKey(asset: {
  symbol?: string;
  assetType?: AssetType;
}): string {
  return getAssetIdentity(asset);
}
