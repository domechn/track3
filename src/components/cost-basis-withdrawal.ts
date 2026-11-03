import { calculateCostBasis, fromStoredTransactions, type CostBasisMethod, type CostBasisWarning } from "@/middlelayers/cost-basis";
import type { TransactionModel } from "@/middlelayers/types";

export function withdrawnLotDetails(
  transactions: readonly TransactionModel[],
  warnings: readonly CostBasisWarning[],
  method: CostBasisMethod,
): Map<string, { acquiredAt: string | null; costBasis: number }> {
  const ids = new Set(warnings.filter((warning) => warning.code === "unknown-disposal").map((warning) => warning.eventId));
  if (!ids.size || !transactions.length) return new Map();
  const events = fromStoredTransactions([...transactions]).map((event) =>
    ids.has(event.id) && event.type === "withdraw" ? { ...event, type: "sell" as const, price: 0 } : event);
  const disposals = calculateCostBasis(events, { method }).disposals;
  const result = new Map<string, { acquiredAt: string | null; costBasis: number }>();
  for (const disposal of disposals) {
    if (!ids.has(disposal.eventId)) continue;
    const previous = result.get(disposal.eventId);
    result.set(disposal.eventId, {
      acquiredAt: previous && previous.acquiredAt !== disposal.acquiredAt ? null : disposal.acquiredAt,
      costBasis: (previous?.costBasis ?? 0) + disposal.costBasis,
    });
  }
  return result;
}
