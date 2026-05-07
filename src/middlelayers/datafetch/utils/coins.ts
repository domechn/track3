import { WalletCoinUSD } from "@/middlelayers/types";
import { AssetType, WalletCoin } from "../types";
import _ from "lodash";

export function getAssetType(asset?: { assetType?: AssetType }): AssetType {
  return asset?.assetType ?? "crypto";
}

export function getAssetIdentity(asset?: {
  symbol?: string;
  assetType?: AssetType;
}): string {
  const symbol = asset?.symbol?.trim().toUpperCase() ?? "";
  return `${getAssetType(asset)}:${symbol}`;
}

export function combineCoinLists(coinLists: WalletCoin[][]): WalletCoin[] {
  return _(coinLists)
    .flatten()
    .groupBy((c) => `${c.wallet}:${getAssetType(c)}`)
    .map((group) =>
      _(group)
        .groupBy("symbol")
        .map((group, symbol) => {
          const first = _(group).first()!;
          const amount = _(group).sumBy("amount");
          const price = _(group).find((g) => !!g.price)?.price;
          return {
            symbol,
            amount,
            price,
            wallet: first.wallet,
            assetType: getAssetType(first),
          };
        })
        .value(),
    )
    .flatten()
    .value();
}

export function calculateTotalValue(
  coinList: WalletCoin[],
  priceMap: { [k: string]: number },
): WalletCoinUSD[] {
  const usdtInUsd = priceMap["USDT"] ?? 1;
  const getPriceFromWalletCoin = (w: WalletCoin) => {
    const symbol = w.symbol.trim().toUpperCase();
    const assetPriceKey = getAssetIdentity(w);
    if (!w.price) {
      return priceMap[assetPriceKey] ?? priceMap[symbol] ?? priceMap[w.symbol] ?? 0;
    }

    if (w.price.base == "usdt") {
      return w.price.value * usdtInUsd;
    }
    return w.price.value;
  };
  return _(coinList)
    .map((c) => ({
      symbol: c.symbol,
      amount: +c.amount,
      assetType: getAssetType(c),
      price: getPriceFromWalletCoin(c),
      usdValue: c.amount * getPriceFromWalletCoin(c),
      wallet: c.wallet,
    }))
    .value();
}
