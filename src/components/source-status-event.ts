import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";

export const sourceStatusesChangedEvent = "source-statuses-changed";

export function publishSourceStatuses(statuses: PortfolioSourceStatus[]) {
  window.dispatchEvent(new CustomEvent(sourceStatusesChangedEvent, { detail: statuses }));
}
