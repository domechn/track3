import type { RebalanceProfile, RebalanceTarget } from "@/middlelayers/rebalance";

export function profileFromTargets(targets: Array<RebalanceTarget & { id: number }>, tolerancePercent: number): RebalanceProfile {
  const cleanTargets: RebalanceTarget[] = targets.map((target) =>
    target.kind === "asset"
      ? { kind: "asset", assetType: target.assetType, symbol: target.symbol.trim().toUpperCase(), percent: target.percent }
      : target.kind === "type"
        ? { kind: "type", assetType: target.assetType, percent: target.percent }
        : { kind: "cash", percent: target.percent },
  );
  return { targets: cleanTargets, tolerancePercent };
}
