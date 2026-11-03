import type { AssetType } from "@/middlelayers/datafetch/types";

const names: Record<string, string> = {
  "crypto:BTC": "Bitcoin", "crypto:USDT": "Tether", "crypto:ETH": "Ethereum",
  "crypto:SOL": "Solana", "crypto:BNB": "BNB", "crypto:USDC": "USD Coin",
  "stock:AAPL": "Apple", "stock:NVDA": "NVIDIA",
};

export function planAssetName(asset: { assetType: AssetType; symbol: string }): string {
  return names[`${asset.assetType}:${asset.symbol}`] ?? asset.symbol;
}
