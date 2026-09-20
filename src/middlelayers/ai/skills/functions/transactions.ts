// Atomic transaction-data access functions.

import { TRANSACTION_HANDLER } from "../../../entities/transactions";
import { getAssetType } from "../../../datafetch/utils/coins";
import type { TransactionModel } from "../../../types";
import type { AssetType } from "../../../datafetch/types";
import { trace, traceError } from "./trace";

// ── Types ──

export interface TransactionFilters {
  symbol?: string;
  assetType?: AssetType;
  from?: Date;
  to?: Date;
  limit?: number;
  txnType?: string;
}

export type TransactionTypeStats = {
  count: number;
  /** Sum of amount (units of the asset). */
  amount: number;
  /** Sum of amount * price in USD. */
  volume: number;
};

export interface TransactionStats {
  buy: TransactionTypeStats;
  sell: TransactionTypeStats;
  deposit: TransactionTypeStats;
  withdraw: TransactionTypeStats;
}

// ── Query ──

/** Return transactions matching the given filters, sorted by txnCreatedAt DESC. */
export async function getTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionModel[]> {
  trace("getTransactions", JSON.stringify({...filters, limit: filters.limit}).slice(0, 300));
  const { symbol, assetType, from, to, limit, txnType } = filters;
  try {
  // If we have a date range, use the date-range query; otherwise list all.
  let results: TransactionModel[];
  if (from || to) {
    const groups = await TRANSACTION_HANDLER.listTransactionsByDateRange(
      from ?? new Date(0),
      to ?? new Date(),
      symbol,
    );
    results = groups.flat();
  } else {
    results = await TRANSACTION_HANDLER.listTransactions(symbol);
  }

  const filtered = results.filter((t) => {
    if (assetType && getAssetType(t) !== assetType) return false;
    if (txnType && t.txnType !== txnType) return false;
    return true;
  });

  const sorted = filtered
    .slice()
    .sort(
      (a, b) =>
        new Date(b.txnCreatedAt).getTime() -
        new Date(a.txnCreatedAt).getTime(),
    );

  // No limit means the whole filtered set: aggregates (transaction_stats)
  // must not silently drop the oldest rows.
  const result =
    limit === undefined
      ? sorted
      : sorted.slice(0, Math.max(1, Math.min(1000, Math.floor(limit))));
  trace("getTransactions", "->", result.length, "txns");
  return result;
  } catch (err) {
    traceError("getTransactions failed", err);
    throw err;
  }
}

/** Aggregate transaction stats from the given transaction list. */
export function getTransactionStats(
  transactions: TransactionModel[],
): TransactionStats {
  const stats: TransactionStats = {
    buy: { count: 0, amount: 0, volume: 0 },
    sell: { count: 0, amount: 0, volume: 0 },
    deposit: { count: 0, amount: 0, volume: 0 },
    withdraw: { count: 0, amount: 0, volume: 0 },
  };

  for (const t of transactions) {
    const type = t.txnType as keyof TransactionStats;
    const s = stats[type];
    if (s) {
      s.count += 1;
      s.amount += t.amount;
      s.volume += t.amount * t.price;
    }
  }

  return stats;
}

/** Convenience: get transactions and stats in one call. */
export async function getTransactionsWithStats(
  filters: TransactionFilters = {},
): Promise<{ transactions: TransactionModel[]; stats: TransactionStats }> {
  const transactions = await getTransactions(filters);
  const stats = getTransactionStats(transactions);
  return { transactions, stats };
}
