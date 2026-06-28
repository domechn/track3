import { defineTool } from "@earendil-works/pi-coding-agent";
import { getBaseCurrency, sObj, sString, sOptional } from "../pi-agent";
import { ASSET_HANDLER } from "../../entities/assets";
import { getAssetType } from "../../datafetch/utils/coins";
import { chartColors } from "@/utils/chart-theme";
import type { ChartToolDetails } from "../pi-agent";
import type { AssetModel } from "../../types";

export default defineTool({
  name: "compare_snapshots",
  label: "Compare snapshots",
  description: "Compare two portfolio snapshots by uuid or by nearest date. Returns total value delta, top movers, and new/removed positions. Use this for questions about portfolio change between two points in time.",
  parameters: sObj({
    left: sObj({ date: sOptional(sString()), uuid: sOptional(sString()) }),
    right: sObj({ date: sOptional(sString()), uuid: sOptional(sString()) }),
  }),
  execute: async (_toolCallId: string, params: any) => {
    const bc = getBaseCurrency();
    const totals = await ASSET_HANDLER.listTotalValueRecords();
    if (totals.length === 0) return { content: [{ type: "text", text: "No snapshots available to compare." }], details: { data: { empty: true } } as ChartToolDetails };
    const left = await resolveSide(totals, params.left);
    const right = await resolveSide(totals, params.right);
    if (!left || !right) return { content: [{ type: "text", text: "Could not resolve both sides." }], details: { data: { error: "Could not resolve both sides." } } as ChartToolDetails };
    if (left.createdAt.getTime() > right.createdAt.getTime()) return runCompare(right, left, bc);
    return runCompare(left, right, bc);
  },
});

async function runCompare(left: { uuid: string; createdAt: Date; totalValue: number }, right: { uuid: string; createdAt: Date; totalValue: number }, bc: { rate: number; currency: string }) {
  const [leftAssets, rightAssets] = await Promise.all([ASSET_HANDLER.listAssetsByUUIDs([left.uuid]), ASSET_HANDLER.listAssetsByUUIDs([right.uuid])]);
  const leftMap = groupBySymbol(leftAssets);
  const rightMap = groupBySymbol(rightAssets);
  const symbols = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const deltas: Array<{ symbol: string; assetType: string; leftValue: number; rightValue: number; deltaUsd: number; deltaPct: number }> = [];
  for (const sym of symbols) {
    const l = leftMap.get(sym);
    const r = rightMap.get(sym);
    const leftValue = l?.value ?? 0;
    const rightValue = r?.value ?? 0;
    const deltaUsd = rightValue - leftValue;
    const deltaPct = leftValue > 0 ? ((rightValue - leftValue) / leftValue) * 100 : rightValue > 0 ? Infinity : 0;
    deltas.push({ symbol: l?.symbol ?? r!.symbol, assetType: l?.assetType ?? r!.assetType, leftValue, rightValue, deltaUsd, deltaPct });
  }
  const rate = bc.rate || 1;
  const movers = deltas.filter(d => d.deltaUsd !== 0).sort((a, b) => Math.abs(b.deltaUsd) - Math.abs(a.deltaUsd)).slice(0, 10).map(d => ({ ...d, delta: d.deltaUsd * rate }));
  const newPositions = deltas.filter(d => d.leftValue === 0 && d.rightValue > 0).map(d => ({ symbol: d.symbol, assetType: d.assetType, valueUsd: d.rightValue, value: d.rightValue * rate }));
  const removedPositions = deltas.filter(d => d.rightValue === 0 && d.leftValue > 0).map(d => ({ symbol: d.symbol, assetType: d.assetType, valueUsd: d.leftValue, value: d.leftValue * rate }));
  const totalDeltaUsd = right.totalValue - left.totalValue;
  const totalDeltaPct = left.totalValue > 0 ? ((right.totalValue - left.totalValue) / left.totalValue) * 100 : 0;
  const chart = movers.length > 0 ? { type: "bar" as const, labels: movers.map(m => m.symbol), datasets: [{ label: `Change (${bc.currency})`, data: movers.map(m => m.delta), backgroundColor: movers.map(m => m.deltaUsd >= 0 ? (chartColors[1]?.main ?? "#10B981") : (chartColors[2]?.main ?? "#EF4444")) }], title: "Top movers" } : undefined;
  return {
    content: [{ type: "text", text: `From ${left.createdAt.toISOString()} to ${right.createdAt.toISOString()}: total change ${totalDeltaPct.toFixed(2)}% (${(totalDeltaUsd * rate).toFixed(2)} ${bc.currency}).` }],
    details: { chart, data: { left: { uuid: left.uuid, createdAt: left.createdAt.toISOString(), valueUsd: left.totalValue }, right: { uuid: right.uuid, createdAt: right.createdAt.toISOString(), valueUsd: right.totalValue }, baseCurrency: bc.currency, totalDeltaUsd, totalDelta: totalDeltaUsd * rate, totalDeltaPct, movers, newPositions, removedPositions } } as ChartToolDetails,
  };
}

function groupBySymbol(assets: AssetModel[]): Map<string, { symbol: string; assetType: string; value: number; amount: number }> {
  const map = new Map<string, { symbol: string; assetType: string; value: number; amount: number }>();
  for (const a of assets) {
    const assetType = getAssetType(a);
    const key = `${assetType}:${a.symbol}`;
    const existing = map.get(key);
    if (existing) { existing.amount += a.amount || 0; existing.value += a.value || 0; }
    else { map.set(key, { symbol: a.symbol, assetType, amount: a.amount || 0, value: a.value || 0 }); }
  }
  return map;
}

async function resolveSide(totals: { uuid: string; createdAt: Date; totalValue: number }[], side: { date?: string; uuid?: string } | undefined) {
  if (!side) return undefined;
  if (side.uuid) return totals.find(t => t.uuid === side.uuid);
  if (side.date) {
    const target = new Date(side.date).getTime();
    if (Number.isNaN(target)) return undefined;
    return totals.reduce((best, t) => {
      const d = Math.abs(t.createdAt.getTime() - target);
      if (!best || d < Math.abs(best.createdAt.getTime() - target)) return t;
      return best;
    }, undefined as typeof totals[number] | undefined);
  }
  return undefined;
}
