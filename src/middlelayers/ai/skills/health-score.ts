import { defineTool } from "@earendil-works/pi-coding-agent";
import { getBaseCurrency, sObj } from "../pi-agent";
import { ASSET_HANDLER } from "../../entities/assets";
import { TRANSACTION_HANDLER } from "../../entities/transactions";
import { getAssetType } from "../../datafetch/utils/coins";
import { chartColors } from "@/utils/chart-theme";
import type { ChartToolDetails } from "../pi-agent";
import type { AssetType } from "../../datafetch/types";

export default defineTool({
  name: "health_score",
  label: "Health score",
  description: "Compute a deterministic portfolio health score combining diversification, concentration, cash ratio, 30-day return, and recent transaction activity.",
  parameters: sObj({}),
  execute: async (_toolCallId: string, _params: any) => {
    const bc = getBaseCurrency();
    const totals = await ASSET_HANDLER.listTotalValueRecords();
    const latest = totals[totals.length - 1];
    if (!latest) return { content: [{ type: "text", text: "No portfolio data to score." }], details: { data: { empty: true } } as ChartToolDetails };
    const assets = await ASSET_HANDLER.listAssetsByUUIDs([latest.uuid]);
    const positions = aggregatePositions(assets);
    const totalUsd = positions.reduce((s, p) => s + p.value, 0);
    const hhi = totalUsd > 0 ? positions.reduce((s, p) => s + (p.value / totalUsd) ** 2, 0) : 1;
    const diversification = clamp01(1 - hhi);
    const sorted = positions.slice().sort((a, b) => b.value - a.value);
    const top3 = sorted.slice(0, 3).reduce((s, p) => s + p.value, 0);
    const concentration = clamp01(1 - (totalUsd > 0 ? top3 / totalUsd : 1));
    const cashValue = positions.find(p => p.symbol.toUpperCase() === "USD")?.value ?? 0;
    const cashRatio = totalUsd > 0 ? clamp01(cashValue / totalUsd) : 0;
    const thirtyDayCutoff = latest.createdAt.getTime() - 30 * 24 * 60 * 60 * 1000;
    const earlier = pickClosest(totals, thirtyDayCutoff);
    const recentReturn = earlier && earlier.totalValue > 0 ? clamp01(((latest.totalValue - earlier.totalValue) / earlier.totalValue + 0.5) / 1.0) : 0.5;
    const recentTx = await TRANSACTION_HANDLER.listTransactionsByDateRange(new Date(thirtyDayCutoff), latest.createdAt);
    const activity = clamp01(recentTx.length / 10);
    const factors = { diversification, concentration, cashRatio, recentReturn, activity };
    const overall = (factors.diversification + factors.concentration + factors.cashRatio + factors.recentReturn + factors.activity) / 5;
    const rate = bc.rate || 1;
    const chart = { type: "radar" as const, labels: ["Diversification", "Low concentration", "Cash buffer", "30-day return", "Activity"], datasets: [{ label: "Health score", data: [factors.diversification, factors.concentration, factors.cashRatio, factors.recentReturn, factors.activity], backgroundColor: chartColors[0]?.bg ?? "rgba(59,130,246,0.25)", borderColor: chartColors[0]?.main ?? "#3B82F6", fill: true }], title: "Portfolio health" };
    return { content: [{ type: "text", text: `Portfolio health: ${(overall * 100).toFixed(0)}/100.` }], details: { chart, data: { asOf: latest.createdAt.toISOString(), baseCurrency: bc.currency, overall, factors, totals: { valueUsd: totalUsd, value: totalUsd * rate }, topPositions: sorted.slice(0, 5).map(p => ({ symbol: p.symbol, assetType: p.assetType, valueUsd: p.value, value: p.value * rate })) } } as ChartToolDetails };
  },
});

function aggregatePositions(assets: { symbol: string; value: number; amount: number; assetType?: AssetType }[]) {
  const map = new Map<string, { symbol: string; assetType: AssetType; value: number; amount: number }>();
  for (const a of assets) {
    const assetType = getAssetType(a);
    const key = `${assetType}:${a.symbol}`;
    const existing = map.get(key);
    if (existing) { existing.amount += a.amount || 0; existing.value += a.value || 0; }
    else map.set(key, { symbol: a.symbol, assetType, amount: a.amount || 0, value: a.value || 0 });
  }
  return Array.from(map.values());
}
function pickClosest<T extends { createdAt: Date; totalValue: number }>(records: T[], target: number): T | undefined {
  if (records.length === 0) return undefined;
  return records.reduce((best, r) => !best ? r : Math.abs(r.createdAt.getTime() - target) < Math.abs(best.createdAt.getTime() - target) ? r : best, undefined as T | undefined);
}
function clamp01(n: number): number { if (!Number.isFinite(n)) return 0; return Math.max(0, Math.min(1, n)); }
