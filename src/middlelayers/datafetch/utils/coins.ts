import { WalletCoinUSD } from "@/middlelayers/types";
import { AssetType, WalletCoin } from "../types";

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
  const flat = coinLists.flat();
  const grouped = flat.reduce((wallets, coin) => {
    const key = `${coin.wallet}:${getAssetType(coin)}`;
    (wallets[key] ??= []).push(coin);
    return wallets;
  }, {} as Record<string, WalletCoin[]>);
  return Object.values(grouped).flatMap((group) =>
    Object.values(
      group.reduce((symbols, coin) => {
        const key = coin.symbol;
        if (!symbols[key]) {
          symbols[key] = { ...coin, amount: 0 };
        }
        symbols[key].amount += coin.amount;
        if (coin.price) symbols[key].price = coin.price;
        return symbols;
      }, {} as Record<string, WalletCoin>)
    )
  );
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
  return coinList.map((c) => ({
      symbol: c.symbol,
      amount: +c.amount,
      assetType: getAssetType(c),
      price: getPriceFromWalletCoin(c),
      usdValue: c.amount * getPriceFromWalletCoin(c),
      wallet: c.wallet,
    }));
}
