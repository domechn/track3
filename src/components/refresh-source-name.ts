import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import { sourceIdentity } from "@/middlelayers/source-status";

export function refreshSourceName(source: PortfolioSourceStatus): string {
  return source.label === source.provider && !source.hint ? source.label : sourceIdentity(source);
}
