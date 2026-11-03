import { format } from "date-fns";
import { buildCostBasisReport, type CostBasisReport } from "@/middlelayers/cost-basis-report";
import { fromStoredTransactions, type CostBasisMethod } from "@/middlelayers/cost-basis";
import type { AssetModel, TransactionModel } from "@/middlelayers/types";

// shortcut: the desktop page must share its fetched rows with the tables; move this price mapping into the shared loader when middlelayer edits are allowed.
export async function buildCostBasisViewReport(
  transactions: TransactionModel[],
  latestAssets: AssetModel[],
  options: { method: CostBasisMethod; from?: string; to?: string; holdingPeriodDays?: number },
): Promise<CostBasisReport> {
  const grouped = new Map<string, { amount: number; value: number }>();
  for (const asset of latestAssets) {
    const key = `${asset.assetType ?? "crypto"}:${asset.symbol.trim().toUpperCase()}`;
    const group = grouped.get(key) ?? { amount: 0, value: 0 };
    if (Number.isFinite(asset.price) && asset.price > 0 && asset.amount > 0) {
      group.amount += asset.amount;
      group.value += asset.amount * asset.price;
    }
    grouped.set(key, group);
  }
  const prices: Record<string, number> = {};
  for (const [key, group] of grouped) {
    if (group.amount > 0) prices[key] = group.value / group.amount;
  }
  const included = transactions.filter((transaction) =>
    !options.to || !Number.isFinite(Date.parse(transaction.txnCreatedAt)) ||
    format(new Date(transaction.txnCreatedAt), "yyyy-MM-dd") <= options.to);
  return buildCostBasisReport(fromStoredTransactions(included), { ...options, prices });
}
