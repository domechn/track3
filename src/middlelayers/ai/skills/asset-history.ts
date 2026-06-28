import { defineTool } from "@earendil-works/pi-coding-agent";
import { getBaseCurrency, sObj, sNumber, sString, sOptional } from "../pi-agent";
import { ASSET_HANDLER } from "../../entities/assets";
import { getAssetType } from "../../datafetch/utils/coins";
import { chartColors } from "@/utils/chart-theme";
import type { ChartToolDetails } from "../pi-agent";
import type { AssetType } from "../../datafetch/types";

export default defineTool({
  name: "asset_history",
  label: "Asset history",
  description: "Return a single asset\u2019s historical amount, value, and price. Use this when the user asks about a specific coin or stock over time.",
  parameters: sObj({
    symbol: sString("Asset symbol, e.g. BTC."),
    assetType: sOptional(sObj({}, { desc: "Defaults to crypto when omitted." })),
    from: sOptional(sString("ISO date (inclusive).")),
    to: sOptional(sString("ISO date (inclusive).")),
  }),
  execute: async (_toolCallId: string, params: any) => {
    const bc = getBaseCurrency();
    const symbol = (params.symbol ?? "").trim().toUpperCase();
    if (!symbol) return { content: [{ type: "text", text: "asset_history requires a symbol argument." }], details: { data: { error: "symbol is required" } } as ChartToolDetails };
    const assetType: AssetType = params.assetType === "stock" ? "stock" : "crypto";
    const start = parseDate(params.from);
    const end = parseDate(params.to);
    const groups = await ASSET_HANDLER.listAssetsBySymbolByDateRange(symbol, start, end);
    const flat = groups.flat().filter(a => getAssetType(a) === assetType);
    if (flat.length === 0) return { content: [{ type: "text", text: `No history for ${symbol} (${assetType}) in the requested range.` }], details: { data: { empty: true } } as ChartToolDetails };
    const sorted = flat.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const rate = bc.rate || 1;
    const series = sorted.map(a => ({ timestamp: new Date(a.createdAt).getTime(), amount: a.amount, valueUsd: a.value, value: a.value * rate, priceUsd: a.price || 0, price: (a.price || 0) * rate }));
    const first = series[0]!;
    const last = series[series.length - 1]!;
    const pnlUsd = last.valueUsd - first.valueUsd;
    const pnlPct = first.valueUsd > 0 ? ((last.valueUsd - first.valueUsd) / first.valueUsd) * 100 : 0;
    const chart = series.length > 0 ? { type: "line" as const, labels: series.map(p => new Date(p.timestamp).toISOString()), datasets: [{ label: `Value (${bc.currency})`, data: series.map(p => p.value), borderColor: chartColors[0]?.main ?? "#3B82F6", backgroundColor: chartColors[0]?.bg ?? "rgba(59,130,246,0.2)", fill: true }], title: `${symbol} value over time` } : undefined;
    return {
      content: [{ type: "text", text: `${symbol} (${assetType}) history spans ${series.length} points. PnL: ${pnlPct.toFixed(2)}%.` }],
      details: { chart, data: { symbol, assetType, baseCurrency: bc.currency, from: new Date(first.timestamp).toISOString(), to: new Date(last.timestamp).toISOString(), series, pnl: { absoluteUsd: pnlUsd, absolute: pnlUsd * rate, percentage: pnlPct }, firstAmount: first.amount, lastAmount: last.amount } } as ChartToolDetails,
    };
  },
});

function parseDate(raw: unknown): Date | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
