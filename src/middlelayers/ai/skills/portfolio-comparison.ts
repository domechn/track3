import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { trace } from "./functions/trace";
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
        type: "string",
        description:
          "Older snapshot: ISO date, snapshot UUID, or a relative spec such as " +
          "\"30 days ago\" / \"-30d\".",
      },
      right: {
        type: "string",
        description:
          "Newer snapshot in the same formats, or \"latest\". Defaults to the latest snapshot.",
      },
    },
    required: ["left"],
  },
  async run(args, ctx): Promise<ToolResult> {
    trace("SKILL: portfolio_comparison called", "args:", JSON.stringify(args).slice(0, 200));
    const totals = await getSnapshotSummaries();
    const left = resolveSnapshot(totals, args.left);
    const right = resolveSnapshot(totals, args.right || "latest");

    if (!left || !right) {
      return {
        data: {
          error: "Could not resolve one or both sides",
          left: args.left,
          right: args.right,
          hint: "Pass an ISO date, a snapshot UUID, \"latest\", or \"N days ago\".",
        },
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

type Snapshot = { uuid: string; createdAt: Date; totalValue: number };

/**
 * Resolve one side of the comparison. Planners send this in many shapes:
 * "2026-06-20", {date}, {uuid}, "latest", "30 days ago", "-30d", {daysAgo: 30}.
 */
function resolveSnapshot(totals: Snapshot[], side: unknown): Snapshot | undefined {
  if (totals.length === 0) return undefined;
  const latest = totals[totals.length - 1]!;

  if (side == null) return undefined;
  if (typeof side === "object") {
    const o = side as Record<string, unknown>;
    if (typeof o.uuid === "string") return totals.find((t) => t.uuid === o.uuid);
    if (typeof o.daysAgo === "number") return nearest(totals, daysAgo(o.daysAgo));
    if (typeof o.date === "string") return resolveSnapshot(totals, o.date);
    return Object.keys(o).length === 0 ? latest : undefined;
  }
  if (typeof side === "number") return nearest(totals, daysAgo(side));
  if (typeof side !== "string") return undefined;

  const raw = side.trim();
  if (!raw) return undefined;
  if (/^(latest|now|today|current)$/i.test(raw)) return latest;
  const byUuid = totals.find((t) => t.uuid === raw);
  if (byUuid) return byUuid;
  const rel = raw.match(/^-?\s*(\d+)\s*(d|day|days)(\s+ago)?$/i);
  if (rel) return nearest(totals, daysAgo(Number(rel[1])));
  const target = new Date(raw).getTime();
  return Number.isNaN(target) ? undefined : nearest(totals, target);
}

function daysAgo(days: number): number {
  return Date.now() - days * 86_400_000;
}

function nearest(totals: Snapshot[], target: number): Snapshot {
  return totals.reduce((best, t) =>
    Math.abs(t.createdAt.getTime() - target) < Math.abs(best.createdAt.getTime() - target)
      ? t
      : best,
  );
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
