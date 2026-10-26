import type { ProUsage } from "./license";

export type UsageWarning = {
  resource: "erc20" | "tron";
  needed: number;
  remaining: number;
  stale: number;
};

export function getUsageWarnings(sourceIds: string[], usage?: ProUsage): UsageWarning[] {
  if (!usage?.enforced) return [];
  return (["erc20", "tron"] as const).flatMap((resource) => {
    const sourceKind = resource === "tron" ? "trc20" : "erc20";
    const needed = sourceIds.filter((sourceId) => sourceId.startsWith(`${sourceKind}:`)).length;
    const remaining = usage.usage[resource]?.remaining;
    return Number.isFinite(remaining) && needed > remaining
      ? [{ resource, needed, remaining, stale: needed - remaining }]
      : [];
  });
}
