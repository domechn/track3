import { format } from "date-fns";
import { calculateCostBasis } from "./cost-basis";
import type { CostBasisEvent, CostBasisMethod, CostBasisResult } from "./cost-basis";

export type CostBasisReport = CostBasisResult & {
  method: CostBasisMethod;
  from?: string;
  to?: string;
  totals: { proceeds: number; costBasis: number; gainLoss: number; shortTerm: number; longTerm: number };
  assets: { assetType: CostBasisEvent["assetType"]; symbol: string; proceeds: number; costBasis: number; gainLoss: number }[];
};

const localDate = (date: string) => format(new Date(date), "yyyy-MM-dd");

export function buildCostBasisReport(
  events: readonly CostBasisEvent[],
  options: { method: CostBasisMethod; from?: string; to?: string; holdingPeriodDays?: number; prices?: Record<string, number> },
): CostBasisReport {
  const ledger = calculateCostBasis(
    events.filter((event) => !options.to || !Number.isFinite(Date.parse(event.date)) || localDate(event.date) <= options.to),
    options,
  );
  const disposals = ledger.disposals.filter((row) =>
    !options.from || localDate(row.disposedAt) >= options.from,
  );
  const warnings = ledger.warnings.filter((warning) =>
    !options.from || !Number.isFinite(Date.parse(warning.date)) || localDate(warning.date) >= options.from,
  );
  const totals = { proceeds: 0, costBasis: 0, gainLoss: 0, shortTerm: 0, longTerm: 0 };
  const assetMap = new Map<string, CostBasisReport["assets"][number]>();
  for (const row of disposals) {
    totals.proceeds += row.proceeds;
    totals.costBasis += row.costBasis;
    totals.gainLoss += row.gainLoss;
    totals[row.term === "long" ? "longTerm" : "shortTerm"] += row.gainLoss;
    const key = `${row.assetType}:${row.symbol}`;
    const asset = assetMap.get(key) ?? {
      assetType: row.assetType, symbol: row.symbol,
      proceeds: 0, costBasis: 0, gainLoss: 0,
    };
    asset.proceeds += row.proceeds;
    asset.costBasis += row.costBasis;
    asset.gainLoss += row.gainLoss;
    assetMap.set(key, asset);
  }
  return {
    method: options.method, from: options.from, to: options.to,
    ...ledger, disposals, warnings, totals, assets: [...assetMap.values()].sort((a, b) => a.symbol.localeCompare(b.symbol)),
  };
}

export function serializeRealizedGains(report: CostBasisReport, format: "csv" | "json"): string {
  if (format === "json") {
    return JSON.stringify({
      method: report.method, from: report.from, to: report.to,
      totals: report.totals, warnings: report.warnings, disposals: report.disposals,
    }, null, 2);
  }
  const cell = (value: string | number, numeric = false) => {
    const raw = String(value);
    const safe = !numeric && typeof value === "string" && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  const usd = (value: number) => (Math.abs(value) < 0.005 ? 0 : value).toFixed(2);
  const quantity = (value: number) => String(value !== 0 && Math.abs(value) < 1e-8 ? value : Number(value.toFixed(8)));
  return [
    "Asset,Acquired Date,Disposed Date,Quantity,Proceeds,Cost Basis,Gain/Loss,Term,Method",
    ...report.disposals.map((row) => {
      const proceeds = usd(row.proceeds);
      const basis = usd(row.costBasis);
      return [
        row.symbol, localDate(row.acquiredAt), localDate(row.disposedAt),
        quantity(row.amount), proceeds, basis, usd(Number(proceeds) - Number(basis)), row.term, row.method,
      ].map((value, index) => cell(value, index >= 3 && index <= 6)).join(",");
    }),
  ].join("\n") + "\n";
}
