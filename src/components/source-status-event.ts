import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";

export const sourceStatusesChangedEvent = "source-statuses-changed";
export const overviewRefreshRequestedEvent = "overview-refresh-request";
export const overviewRefreshActivityEvent = "overview-refresh-activity";
export const overviewUseLastKnownEvent = "overview-use-last-known";

export function publishSourceStatuses(statuses: PortfolioSourceStatus[]) {
  window.dispatchEvent(new CustomEvent(sourceStatusesChangedEvent, { detail: statuses }));
}
