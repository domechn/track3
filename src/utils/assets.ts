import type { AssetType } from "@/middlelayers/datafetch/types";
import {
  getAssetIdentity,
  getAssetType,
} from "@/middlelayers/datafetch/utils/coins";
import StockDefaultLogo from "@/assets/icons/stock-default-logo.svg";
import UnknownLogo from "@/assets/icons/unknown-logo.svg";

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

export function getAssetLogoKey(asset: {
  symbol?: string;
  assetType?: AssetType;
}): string {
  return getAssetIdentity(asset);
}

export function getDefaultAssetLogo(asset: {
  symbol?: string;
  assetType?: AssetType;
}): string {
  return getAssetType(asset) === "stock" ? StockDefaultLogo : UnknownLogo;
}

export function resolveAssetLogoSrc(
  asset: {
    symbol?: string;
    assetType?: AssetType;
  },
  logoSrc?: string | null,
): string {
  return logoSrc || getDefaultAssetLogo(asset);
}

export function shouldDownloadCryptoLogo(asset: {
  assetType?: AssetType;
}): boolean {
  return getAssetType(asset) === "crypto";
}
