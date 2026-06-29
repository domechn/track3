import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import {
  getSnapshotSummaries,
  getAssetsBySnapshot,
  groupAssets,
} from "./functions/assets";

const skill: Skill = {
  name: "portfolio_comparison",
  description:
    "Compare two portfolio snapshots by UUID or by nearest date. Returns " +
    "total value delta, top movers, and new/removed positions. Use this " +
    "for questions about portfolio change between two points in time.",
  parameters: {
    type: "object",
    properties: {
      left: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO date for the older/left snapshot." },
          uuid: { type: "string", description: "Snapshot UUID." },
        },
        description: "Older snapshot. Provide either date or uuid.",
      },
      right: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO date for the newer/right snapshot." },
          uuid: { type: "string", description: "Snapshot UUID." },
        },
        description: "Newer snapshot. Provide either date or uuid.",
      },
    },
    required: ["left", "right"],
  },
  async run(args, ctx): Promise<ToolResult> {
    const left = await resolveSnapshot(
      args.left as Record<string, unknown> | undefined,
    );
    const right = await resolveSnapshot(
      args.right as Record<string, unknown> | undefined,
    );

    if (!left || !right) {
      return {
        data: { error: "Could not resolve one or both sides" },
        text: "Could not resolve one or both sides of the comparison.",
      };
    }

    // Ensure left < right chronologically
    if (left.createdAt.getTime() > right.createdAt.getTime()) {
      return runCompare(right, left, ctx);
    }

    return runCompare(left, right, ctx);
  },
};

async function resolveSnapshot(
  side: Record<string, unknown> | undefined,
): Promise<
  { uuid: string; createdAt: Date; totalValue: number } | undefined
> {
  if (!side) return undefined;
  const totals = await getSnapshotSummaries();
  if (totals.length === 0) return undefined;

  const uuid = side.uuid as string | undefined;
  if (uuid) return totals.find((t) => t.uuid === uuid);

  const dateStr = side.date as string | undefined;
  if (dateStr) {
    const target = new Date(dateStr).getTime();
    if (Number.isNaN(target)) return undefined;
    return totals.reduce((best, t) => {
      const d = Math.abs(t.createdAt.getTime() - target);
      if (!best || d < Math.abs(best.createdAt.getTime() - target)) return t;
      return best;
    }, undefined as (typeof totals)[number] | undefined);
  }

  return undefined;
}

async function runCompare(
  left: { uuid: string; createdAt: Date; totalValue: number },
  right: { uuid: string; createdAt: Date; totalValue: number },
  ctx: { baseCurrency: { rate: number; currency: string } },
): Promise<ToolResult> {
  const [leftAssets, rightAssets] = await Promise.all([
    getAssetsBySnapshot(left.uuid),
    getAssetsBySnapshot(right.uuid),
  ]);

  const leftGrouped = groupAssets(leftAssets);
  const rightGrouped = groupAssets(rightAssets);

  const lMap = new Map(
    leftGrouped.map((g) => [`${g.assetType}:${g.symbol}`, g]),
  );
  const rMap = new Map(
    rightGrouped.map((g) => [`${g.assetType}:${g.symbol}`, g]),
  );

  const allKeys = new Set([...lMap.keys(), ...rMap.keys()]);
  const deltas: Array<{
    symbol: string;
    assetType: string;
    leftValue: number;
    rightValue: number;
    deltaUsd: number;
    deltaPct: number;
  }> = [];

  for (const key of allKeys) {
    const l = lMap.get(key);
    const r = rMap.get(key);
    const leftVal = l?.value ?? 0;
    const rightVal = r?.value ?? 0;
    deltas.push({
      symbol: l?.symbol ?? r!.symbol,
      assetType: l?.assetType ?? r!.assetType,
      leftValue: leftVal,
      rightValue: rightVal,
      deltaUsd: rightVal - leftVal,
      deltaPct:
        leftVal > 0
          ? ((rightVal - leftVal) / leftVal) * 100
          : rightVal > 0
            ? Infinity
            : 0,
    });
  }

  const rate = ctx.baseCurrency.rate || 1;
  const totalDeltaUsd = right.totalValue - left.totalValue;
  const totalDeltaPct =
    left.totalValue > 0
      ? ((right.totalValue - left.totalValue) / left.totalValue) * 100
      : 0;

  const movers = deltas
    .filter((d) => d.deltaUsd !== 0)
    .sort((a, b) => Math.abs(b.deltaUsd) - Math.abs(a.deltaUsd))
    .slice(0, 10)
    .map((d) => ({
      ...d,
      delta: d.deltaUsd * rate,
    }));

  const newPositions = deltas
    .filter((d) => d.leftValue === 0 && d.rightValue > 0)
    .map((d) => ({
      symbol: d.symbol,
      assetType: d.assetType,
      valueUsd: d.rightValue,
      value: d.rightValue * rate,
    }));

  const removedPositions = deltas
    .filter((d) => d.rightValue === 0 && d.leftValue > 0)
    .map((d) => ({
      symbol: d.symbol,
      assetType: d.assetType,
      valueUsd: d.leftValue,
      value: d.leftValue * rate,
    }));

  return {
    data: {
      left: {
        uuid: left.uuid,
        createdAt: left.createdAt.toISOString(),
        valueUsd: left.totalValue,
      },
      right: {
        uuid: right.uuid,
        createdAt: right.createdAt.toISOString(),
        valueUsd: right.totalValue,
      },
      baseCurrency: ctx.baseCurrency.currency,
      totalDeltaUsd,
      totalDelta: totalDeltaUsd * rate,
      totalDeltaPct,
      movers,
      newPositions,
      removedPositions,
    },
    text: `From ${left.createdAt.toISOString()} to ${right.createdAt.toISOString()}: total change ${totalDeltaPct >= 0 ? "+" : ""}${totalDeltaPct.toFixed(2)}% (${(totalDeltaUsd * rate).toFixed(2)} ${ctx.baseCurrency.currency}).`,
  };
}

registerSkill(skill);
export default skill;
