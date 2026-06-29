import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { ASSET_HANDLER } from "../../entities/assets";
import { TRANSACTION_HANDLER } from "../../entities/transactions";
import { getAssetType } from "../../datafetch/utils/coins";
import type { AssetType } from "../../datafetch/types";
import { chartColors } from "@/utils/chart-theme";

const skill: Skill = {
  name: "health_score",
  description:
    "Compute a deterministic portfolio health score over the latest " +
    "snapshot. The score combines diversification (HHI), concentration " +
    "(top-3 weight), cash ratio, 30-day return, and recent transaction " +
    "activity. Use this when the user asks how healthy their portfolio is.",
  parameters: {
    type: "object",
    properties: {},
  },
  async run(args, ctx): Promise<ToolResult> {
    const totals = await ASSET_HANDLER.listTotalValueRecords();
    const latest = totals[totals.length - 1];
    if (!latest) {
      return {
        data: { empty: true, overall: 0, factors: defaultFactors() },
        text: "No portfolio data to score.",
      };
    }

    const assets = await ASSET_HANDLER.listAssetsByUUIDs([latest.uuid]);
    const positions = aggregatePositions(assets);
    const totalUsd = positions.reduce((s, p) => s + p.value, 0);

    // Diversification (HHI): sum of squared weights, inverted.
    const hhi =
      totalUsd > 0
        ? positions.reduce((s, p) => s + (p.value / totalUsd) ** 2, 0)
        : 1;
    const diversification = clamp01(1 - hhi);

    // Top-3 concentration: sum of top-3 weights, inverted.
    const sorted = positions.slice().sort((a, b) => b.value - a.value);
    const top3 = sorted.slice(0, 3).reduce((s, p) => s + p.value, 0);
    const concentration = clamp01(1 - (totalUsd > 0 ? top3 / totalUsd : 1));

    // Cash ratio: USD value / total.
    const cashValue =
      positions.find((p) => p.symbol.toUpperCase() === "USD")?.value ?? 0;
    const cashRatio = totalUsd > 0 ? clamp01(cashValue / totalUsd) : 0;

    // 30-day return: look up the snapshot closest to 30 days before.
    const thirtyDayCutoff = latest.createdAt.getTime() - 30 * 24 * 60 * 60 * 1000;
    const earlier = pickClosest(totals, thirtyDayCutoff);
    const recentReturn =
      earlier && earlier.totalValue > 0
        ? clamp01(
            ((latest.totalValue - earlier.totalValue) / earlier.totalValue + 0.5) /
              1.0,
          )
        : 0.5;

    // Activity: count of transactions in the last 30 days.
    const recentTx = await TRANSACTION_HANDLER.listTransactionsByDateRange(
      new Date(thirtyDayCutoff),
      latest.createdAt,
    );
    const activity = clamp01(recentTx.length / 10);

    const factors = {
      diversification,
      concentration,
      cashRatio,
      recentReturn,
      activity,
    };
    const overall =
      (factors.diversification +
        factors.concentration +
        factors.cashRatio +
        factors.recentReturn +
        factors.activity) /
      5;

    const rate = ctx.baseCurrency.rate || 1;
    const chart = {
      type: "radar" as const,
      labels: [
        "Diversification",
        "Low concentration",
        "Cash buffer",
        "30-day return",
        "Activity",
      ],
      datasets: [
        {
          label: "Health score",
          data: [
            factors.diversification,
            factors.concentration,
            factors.cashRatio,
            factors.recentReturn,
            factors.activity,
          ],
          backgroundColor: chartColors[0]?.bg ?? "rgba(59,130,246,0.25)",
          borderColor: chartColors[0]?.main ?? "#3B82F6",
          fill: true,
        },
      ],
      title: "Portfolio health",
    };

    return {
      data: {
        asOf: latest.createdAt.toISOString(),
        baseCurrency: ctx.baseCurrency.currency,
        overall,
        factors,
        totals: {
          valueUsd: totalUsd,
          value: totalUsd * rate,
        },
        topPositions: sorted.slice(0, 5).map((p) => ({
          symbol: p.symbol,
          assetType: p.assetType,
          valueUsd: p.value,
          value: p.value * rate,
        })),
      },
      chart,
      text: `Portfolio health: ${(overall * 100).toFixed(0)}/100.`,
    };
  },
};

function aggregatePositions(
  assets: { symbol: string; value: number; amount: number; assetType?: AssetType }[],
): { symbol: string; assetType: AssetType; value: number; amount: number }[] {
  const map = new Map<string, { symbol: string; assetType: AssetType; value: number; amount: number }>();
  for (const a of assets) {
    const assetType = getAssetType(a);
    const key = `${assetType}:${a.symbol}`;
    const existing = map.get(key);
    if (existing) {
      existing.amount += a.amount || 0;
      existing.value += a.value || 0;
    } else {
      map.set(key, {
        symbol: a.symbol,
        assetType,
        amount: a.amount || 0,
        value: a.value || 0,
      });
    }
  }
  return Array.from(map.values());
}

function pickClosest<T extends { createdAt: Date; totalValue: number }>(
  records: T[],
  target: number,
): T | undefined {
  if (records.length === 0) return undefined;
  return records.reduce((best, r) => {
    if (!best) return r;
    return Math.abs(r.createdAt.getTime() - target) <
      Math.abs(best.createdAt.getTime() - target)
      ? r
      : best;
  }, undefined as T | undefined);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function defaultFactors() {
  return {
    diversification: 0,
    concentration: 0,
    cashRatio: 0,
    recentReturn: 0,
    activity: 0,
  };
}

registerSkill(skill);
export default skill;
