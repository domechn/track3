import type { CostBasisMethod } from "./cost-basis";
import type { CostBasisReport } from "./cost-basis-report";
import { fromStoredTransactions } from "./cost-basis";
import { buildCostBasisReport, serializeRealizedGains } from "./cost-basis-report";
import { TRANSACTION_HANDLER } from "./entities/transactions";
import { ASSET_HANDLER } from "./entities/assets";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { format } from "date-fns";
import { redactForExport, redactSecrets } from "./security/redact";

export async function loadCostBasisReport(
  options: { method: CostBasisMethod; from?: string; to?: string; holdingPeriodDays?: number },
): Promise<CostBasisReport> {
  const [transactions, snapshots] = await Promise.all([
    TRANSACTION_HANDLER.listTransactions(),
    ASSET_HANDLER.listAssets(1),
  ]);
  const prices: Record<string, number> = {};
  const latest = snapshots[0] ?? [];
  const grouped = new Map<string, { amount: number; value: number }>();
  for (const asset of latest) {
    const key = `${asset.assetType ?? "crypto"}:${asset.symbol.trim().toUpperCase()}`;
    const group = grouped.get(key) ?? { amount: 0, value: 0 };
    if (Number.isFinite(asset.price) && asset.price > 0 && asset.amount > 0) {
      group.amount += asset.amount;
      group.value += asset.amount * asset.price;
    }
    grouped.set(key, group);
  }
  for (const [key, group] of grouped) {
    if (group.amount > 0) prices[key] = group.value / group.amount;
  }
  const included = transactions.filter((transaction) =>
    !options.to || !Number.isFinite(Date.parse(transaction.txnCreatedAt)) ||
    format(new Date(transaction.txnCreatedAt), "yyyy-MM-dd") <= options.to,
  );
  return buildCostBasisReport(fromStoredTransactions(included), { ...options, prices });
}

export async function exportCostBasisReport(
  report: CostBasisReport,
  format: "csv" | "json",
): Promise<boolean> {
  const filePath = await save({
    filters: [{ name: `cost-basis-${format}`, extensions: [format] }],
    defaultPath: `track3-realized-gains.${format}`,
  });
  if (!filePath) return false;
  const serialized = serializeRealizedGains(report, format);
  await writeTextFile(filePath, format === "json"
    ? JSON.stringify(redactForExport(JSON.parse(serialized)), null, 2)
    : redactSecrets(serialized));
  return true;
}
