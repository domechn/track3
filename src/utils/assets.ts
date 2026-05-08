import type { AssetType } from "@/middlelayers/datafetch/types";
import { getAssetIdentity, getAssetType } from "@/middlelayers/datafetch/utils/coins";

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
  return getAssetType(asset) === "crypto"
    ? asset.symbol
    : `${asset.symbol} (${getAssetType(asset)})`;
}

export function getAssetLogoKey(asset: {
  symbol?: string;
  assetType?: AssetType;
}): string {
  return getAssetIdentity(asset);
}

export function shouldDownloadCryptoLogo(asset: {
  assetType?: AssetType;
}): boolean {
  return getAssetType(asset) === "crypto";
}