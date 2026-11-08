import type { PortfolioSourceResult } from "@/middlelayers/portfolio-baseline";

const sequentialKinds = new Set(["erc20", "sol", "btc", "doge", "trc20", "ton", "sui"]);

export function runningSourceStarts(
  sources: readonly { sourceId: string }[],
  results: readonly PortfolioSourceResult[],
  refreshStartedAt: string,
): Record<string, string> {
  const resultsById = new Map(results.map((result) => [result.sourceId, result]));
  const lastFinishedByKind = new Map<string, string>();
  const runningKinds = new Set<string>();
  const started: Record<string, string> = {};
  for (const source of sources) {
    const kind = source.sourceId.split(":")[0];
    const sequential = sequentialKinds.has(kind);
    const result = resultsById.get(source.sourceId);
    if (result) {
      if (result.finishedAt) lastFinishedByKind.set(kind, result.finishedAt);
    } else if (!sequential || !runningKinds.has(kind)) {
      started[source.sourceId] = sequential ? lastFinishedByKind.get(kind) ?? refreshStartedAt : refreshStartedAt;
      if (sequential) runningKinds.add(kind);
    }
  }
  return started;
}
