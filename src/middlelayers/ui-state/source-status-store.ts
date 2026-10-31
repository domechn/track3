import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import { ALERT_SOURCE_STATUS_STORAGE_KEY } from "@/middlelayers/alerts";
import { normalizeSourceStatuses } from "@/middlelayers/source-status";
import { FullRefreshRequiredError } from "@/middlelayers/refresh-error";
import type { RefreshAllDataOptions, RefreshAllDataResult } from "@/middlelayers/charts-refresh";
import type { PortfolioSourceResult } from "@/middlelayers/portfolio-baseline";

const sourceStatusStorageKey = ALERT_SOURCE_STATUS_STORAGE_KEY;
export const retries = 3;
export const retryInterval = 3000;

export function readStoredStatuses(): PortfolioSourceStatus[] {
  try {
    const stored = localStorage.getItem(sourceStatusStorageKey);
    if (!stored) return [];
    const statuses = normalizeSourceStatuses(JSON.parse(stored));
    if (stored !== JSON.stringify(statuses)) localStorage.setItem(sourceStatusStorageKey, JSON.stringify(statuses));
    return statuses;
  } catch {
    return [];
  }
}

export function writeStoredStatuses(statuses: PortfolioSourceStatus[]): void {
  localStorage.setItem(sourceStatusStorageKey, JSON.stringify(statuses));
}

export async function retryRefresh<T>(fn: () => Promise<T>, times: number, interval: number, onRetry: (attempt: number) => void): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof FullRefreshRequiredError ||
      (error instanceof Error && error.message.startsWith("no configuration found"))) throw error;
    if (times === 0) throw error;
    await new Promise((resolve) => setTimeout(resolve, interval));
    onRetry(retries - times + 1);
    return retryRefresh(fn, times - 1, interval, onRetry);
  }
}

export function desktopRefreshOptions(sourceId: string | undefined, lastResult: RefreshAllDataResult | undefined, sourceStatuses: PortfolioSourceStatus[]): RefreshAllDataOptions {
  return sourceId
    ? {
        retrySourceId: sourceId,
        previousSourceResults: lastResult!.sourceResults,
        previousSourceStatuses: sourceStatuses,
        ...(lastResult?.portfolioInputGeneration !== undefined
          ? { previousInputGeneration: lastResult.portfolioInputGeneration }
          : {}),
        ...(lastResult?.refreshCreatedAt
          ? { previousRefreshCreatedAt: lastResult.refreshCreatedAt }
          : {}),
        previousSnapshotId: lastResult?.snapshotId ?? null,
        previousSnapshotKey: lastResult?.snapshotKey,
      }
    : sourceStatuses.length ? { previousSourceStatuses: sourceStatuses } : {};
}

export function mobileRefreshOptions(sourceId: string | undefined, lastResult: RefreshAllDataResult | undefined, sourceStatuses: PortfolioSourceStatus[], onSourceResult: (source: PortfolioSourceResult) => void): RefreshAllDataOptions {
  return sourceId
    ? {
        retrySourceId: sourceId,
        onSourceResult,
        previousSourceResults: lastResult!.sourceResults,
        previousSourceStatuses: sourceStatuses,
        ...(lastResult?.portfolioInputGeneration !== undefined
          ? { previousInputGeneration: lastResult.portfolioInputGeneration }
          : {}),
        ...(lastResult?.refreshCreatedAt
          ? { previousRefreshCreatedAt: lastResult.refreshCreatedAt }
          : {}),
        previousSnapshotId: lastResult?.snapshotId ?? null,
        previousSnapshotKey: lastResult?.snapshotKey,
      }
    : { ...(sourceStatuses.length ? { previousSourceStatuses: sourceStatuses } : {}),
        onSourceResult };
}

