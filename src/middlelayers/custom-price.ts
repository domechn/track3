import { isSameWallet } from "@/lib/utils";
import { getAssetIdentity } from "./datafetch/utils/coins";
import type { AssetModel } from "./types";
import type { AssetType, OtherPrice, WalletCoin } from "./datafetch/types";

const validQuote = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value > 0;

export function validateCustomPrice(
  price: OtherPrice,
  customSymbols: readonly string[],
  ownSymbol: string,
): boolean {
  if (!price || typeof price !== "object" || typeof ownSymbol !== "string") return false;
  if (price.kind === "manual") {
    return typeof price.setAt === "string" &&
      Number.isFinite(price.usd) && price.usd > 0 && price.usd <= 1e12 &&
      Number.isFinite(Date.parse(price.setAt)) &&
      (price.note === undefined || (typeof price.note === "string" && price.note.length <= 140));
  }
  if (price.kind !== "follow" || typeof price.symbol !== "string") return false;
  const symbol = price.symbol.trim().toUpperCase();
  return (price.assetType === "crypto" || price.assetType === "stock") &&
    !!symbol && symbol !== ownSymbol.trim().toUpperCase() &&
    !customSymbols.some((item) => typeof item === "string" && item.trim().toUpperCase() === symbol) &&
    Number.isFinite(price.ratio) && price.ratio > 0;
}

export function customFollowTargets(coins: WalletCoin[]): Array<{ assetType: AssetType; symbol: string }> {
  const targets = new Map<string, { assetType: AssetType; symbol: string }>();
  for (const coin of coins) {
    if (coin.wallet !== "others" || coin.customPrice?.kind !== "follow") continue;
    const target = { assetType: coin.customPrice.assetType, symbol: coin.customPrice.symbol.trim().toUpperCase() };
    targets.set(getAssetIdentity(target), target);
  }
  return [...targets.values()];
}

export function resolveCustomPrices(
  coins: WalletCoin[],
  marketPrices: Record<string, number>,
  lastAssets: AssetModel[],
): WalletCoin[] {
  return coins.flatMap((coin) => {
    if (coin.wallet !== "others" || !coin.customPrice) return [coin];
    const market = marketPrices[getAssetIdentity(coin)] ?? marketPrices[coin.symbol.trim().toUpperCase()];
    if (validQuote(market)) return [coin];
    const rule = coin.customPrice;
    const target = rule.kind === "follow"
      ? marketPrices[getAssetIdentity(rule)] ?? (rule.assetType === "crypto" ? marketPrices[rule.symbol] : undefined)
      : undefined;
    const proposed = rule.kind === "manual" ? rule.usd :
      validQuote(target) ? target * rule.ratio : undefined;
    const lastAsset = lastAssets.find((asset) =>
      getAssetIdentity(asset) === getAssetIdentity(coin) &&
      isSameWallet(asset.wallet ?? "", coin.wallet)
    );
    const previous = lastAsset && validQuote(lastAsset.price) ? lastAsset.price : undefined;
    const value = validQuote(proposed) ? proposed : previous;
    if (value === undefined) return lastAsset ? [] : [coin];
    return [{ ...coin, price: { base: "usd", value } }];
  });
}
