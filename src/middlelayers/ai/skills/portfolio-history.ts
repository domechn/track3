import { defineTool } from "@earendil-works/pi-coding-agent";
import { getBaseCurrency, sObj, sNumber, sString, sOptional } from "../pi-agent";
import { ASSET_HANDLER } from "../../entities/assets";
import { chartColors } from "@/utils/chart-theme";
import type { ChartToolDetails } from "../pi-agent";

export default defineTool({
  name: "portfolio_history",
  label: "Portfolio history",
  description: "Return the portfolio value timeline over an optional date range, downsampled to a configurable number of points. Use this for questions about historical value, change over time, or trend.",
  parameters: sObj({
    from: sOptional(sString("ISO date (inclusive).")),
    to: sOptional(sString("ISO date (inclusive).")),
    maxPoints: sOptional(sNumber("Maximum number of points to return (default 80).")),
  }),
  execute: async (_toolCallId: string, params: any) => {
    const bc = getBaseCurrency();
    const maxPoints = clampMax(params.maxPoints);
    const start = parseDate(params.from);
    const end = parseDate(params.to);
    const records = await ASSET_HANDLER.listTotalValueRecords(start, end);
    if (records.length === 0) {
      return { content: [{ type: "text", text: "No portfolio history found in the requested range." }], details: { data: { empty: true } } as ChartToolDetails };
    }
    const step = records.length > maxPoints ? Math.max(1, Math.ceil(records.length / Math.max(1, maxPoints - 1))) : 0;
    const downsampled = records.filter((_r, idx, arr) => step === 0 ? true : idx === 0 || idx === arr.length - 1 || idx % step === 0);
    const rate = bc.rate || 1;
    const points = downsampled.map(r => ({ timestamp: new Date(r.createdAt).getTime(), valueUsd: r.totalValue, value: r.totalValue * rate }));
    const chart = points.length > 0 ? { type: "line" as const, labels: points.map(p => new Date(p.timestamp).toISOString()), datasets: [{ label: `Total value (${bc.currency})`, data: points.map(p => p.value), borderColor: chartColors[0]?.main ?? "#3B82F6", backgroundColor: chartColors[0]?.bg ?? "rgba(59,130,246,0.2)", fill: true }], title: "Portfolio value over time" } : undefined;
    return {
      content: [{ type: "text", text: `Portfolio history covers ${points.length} sampled points.` }],
      details: { chart, data: { baseCurrency: bc.currency, from: start?.toISOString() ?? records[0]!.createdAt, to: end?.toISOString() ?? records[records.length - 1]!.createdAt, points, summary: { startValue: points[0]?.value ?? 0, endValue: points[points.length - 1]?.value ?? 0, change: (points[points.length - 1]?.value ?? 0) - (points[0]?.value ?? 0) } } } as ChartToolDetails,
    };
  },
});

function clampMax(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 80;
  return Math.max(2, Math.min(1000, Math.floor(n)));
}
function parseDate(raw: unknown): Date | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
