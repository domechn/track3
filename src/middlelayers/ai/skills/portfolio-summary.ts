import { defineTool } from "@earendil-works/pi-coding-agent";
import { getBaseCurrency, sObj, sNumber, sOptional } from "../pi-agent";
import { ASSET_HANDLER } from "../../entities/assets";
import { chartColors } from "@/utils/chart-theme";
import type { ChartToolDetails } from "../pi-agent";

export default defineTool({
  name: "portfolio_summary",
  label: "Portfolio summary",
  description:
    "Return the latest portfolio snapshot: total value in base currency, " +
    "asset count, and the top N holdings by weight. Use this whenever the " +
    "user asks for the current state of their portfolio.",
  parameters: sObj({
    topN: sOptional(sNumber("Number of top holdings to return (default 10).")),
  }),
  execute: async (_toolCallId: string, params: any) => {
    const topN = clampTopN(params.topN);
    const bc = getBaseCurrency();
    const totals = await ASSET_HANDLER.listTotalValueRecords();
    const latest = totals[totals.length - 1];
    if (!latest) {
      return { content: [{ type: "text", text: "No portfolio data has been recorded yet." }], details: { data: { empty: true } } as ChartToolDetails };
    }
    const assets = await ASSET_HANDLER.listAssetsByUUIDs([latest.uuid]);
    const totalUsd = assets.reduce((s, a) => s + (a.value || 0), 0);
    const rate = bc.rate || 1;
    const totalInBase = totalUsd * rate;
    const grouped = new Map<string, { symbol: string; assetType: string; amount: number; value: number }>();
    for (const a of assets) {
      const key = `${a.assetType ?? "crypto"}:${a.symbol}`;
      const existing = grouped.get(key);
      if (existing) { existing.amount += a.amount || 0; existing.value += a.value || 0; }
      else { grouped.set(key, { symbol: a.symbol, assetType: a.assetType ?? "crypto", amount: a.amount || 0, value: a.value || 0 }); }
    }
    const allHoldings = Array.from(grouped.values()).filter(g => g.value > 0).sort((a, b) => b.value - a.value);
    const totalForPercent = allHoldings.reduce((s, h) => s + h.value, 0);
    const topHoldings = allHoldings.slice(0, topN).map((h, i) => ({
      symbol: h.symbol, assetType: h.assetType, amount: h.amount, valueUsd: h.value,
      valueInBase: h.value * rate,
      percentage: totalForPercent > 0 ? (h.value / totalForPercent) * 100 : 0,
      chartColor: chartColors[i % chartColors.length]?.main ?? "#4B5563",
    }));
    const otherValue = allHoldings.slice(topN).reduce((s, h) => s + h.value, 0);
    const chart = topHoldings.length > 0 ? { type: "doughnut" as const, labels: topHoldings.map(h => `${h.percentage.toFixed(2)}% ${h.symbol}`), datasets: [{ data: topHoldings.map(h => h.valueInBase), backgroundColor: topHoldings.map(h => h.chartColor), borderColor: "rgba(255,255,255,0.15)", borderWidth: 2 }], title: "Top holdings" } : undefined;
    return {
      content: [{ type: "text", text: `Latest portfolio total: ${totalInBase.toFixed(2)} ${bc.currency} across ${grouped.size} assets.` }],
      details: { chart, data: { asOf: latest.createdAt, uuid: latest.uuid, baseCurrency: bc.currency, totalValueUsd: totalUsd, totalValue: totalInBase, assetCount: grouped.size, topHoldings, other: { valueUsd: otherValue, valueInBase: otherValue * rate, count: allHoldings.length - topHoldings.length } } } as ChartToolDetails,
    };
  },
});

function clampTopN(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 10;
  return Math.max(1, Math.min(50, Math.floor(n)));
}
