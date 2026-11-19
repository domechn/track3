import type { AssetType } from "../datafetch/types";
import { isBrokerCashSymbol } from "./currency";

export const INSIGNIFICANT_HOLDING_USD = 1;

export function isInsignificantHolding(holding: {
  symbol: string;
  assetType: AssetType;
  wallet?: string;
  value: number;
  customPrice?: unknown;
  isStableCoin?: boolean;
  isBrokerCash?: boolean;
}): boolean {
  return Number.isFinite(holding.value) &&
    holding.value < INSIGNIFICANT_HOLDING_USD &&
    !holding.isStableCoin &&
    !holding.customPrice &&
    !(holding.isBrokerCash ??
      (holding.assetType === "stock" && isBrokerCashSymbol(holding.symbol)));
}
