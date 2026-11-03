type PriceTransaction = {
  assetType: string;
  symbol: string;
  txnType: string;
  txnCreatedAt: string;
  amount: number;
  price: number;
};

export type PriceSummary = {
  bought: number;
  averageBuy: number;
  sold: number;
  averageSell: number;
};

export function summarizeCostBasisPrices(
  transactions: readonly PriceTransaction[],
  from: string,
  to: string,
): Map<string, PriceSummary> {
  const totals = new Map<string, { bought: number; buyValue: number; sold: number; sellValue: number }>();
  for (const row of transactions) {
    const day = format(new Date(row.txnCreatedAt), "yyyy-MM-dd");
    if ((from && day < from) || (to && day > to) ||
      (row.txnType !== "buy" && row.txnType !== "sell")) continue;
    const key = `${row.assetType}:${row.symbol}`;
    const value = totals.get(key) ?? { bought: 0, buyValue: 0, sold: 0, sellValue: 0 };
    if (row.txnType === "buy") {
      value.bought += row.amount;
      value.buyValue += row.amount * row.price;
    } else {
      value.sold += row.amount;
      value.sellValue += row.amount * row.price;
    }
    totals.set(key, value);
  }
  return new Map([...totals].map(([symbol, value]) => [symbol, {
    bought: value.bought,
    averageBuy: value.bought ? value.buyValue / value.bought : 0,
    sold: value.sold,
    averageSell: value.sold ? value.sellValue / value.sold : 0,
  }]));
}
import { format } from "date-fns";

