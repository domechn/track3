import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import { sourceIdentity } from "@/middlelayers/source-status";

export function refreshSourceName(source: PortfolioSourceStatus): string {
  if (!source.hint && (source.label === source.provider || source.sourceId.startsWith(`${source.provider}:`))) {
    return source.label;
  }
  return sourceIdentity(source);
}
