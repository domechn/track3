import { useContext, useState } from "react";
import {
  refreshAllData,
  type RefreshAllDataResult,
} from "../middlelayers/charts";
import type { RefreshOperation } from "../middlelayers/charts-refresh";
import type { PortfolioSourceStatus } from "../middlelayers/portfolio-baseline";
import { v4 as uuidv4 } from "uuid";
import { trackEventWithClientID } from "../utils/app";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "./ui/button";
import {
  ArchiveIcon, BackpackIcon, CheckIcon, CrossCircledIcon, CubeIcon,
  ExclamationTriangleIcon, GlobeIcon, UpdateIcon,
} from "@radix-ui/react-icons";
import { RefreshButtonLoadingContext } from "./index/index";
import { getMemoryCacheInstance } from "@/middlelayers/datafetch/utils/cache";
import { updateAllCurrencyRates } from "@/middlelayers/configuration";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { useTranslation } from "@/i18n";
import { FullRefreshRequiredError } from "@/middlelayers/refresh-error";
import { ALERT_SOURCE_STATUS_STORAGE_KEY, processAlerts } from "@/middlelayers/alerts";
import { deliverAlerts, formatAlert } from "@/middlelayers/alert-notifications";
import { redactSecrets } from "@/middlelayers/security/redact";
import { cancelInsightRefresh, refreshInsights } from "@/middlelayers/insights-service";
import { normalizeSourceStatuses, sourceIdentity, sortSourceStatuses } from "@/middlelayers/source-status";
import { partialEndpointKeys } from "@/middlelayers/datafetch/utils/source-failure";

const retries = 3;
const retryInterval = 3000;
const sourceStatusStorageKey = ALERT_SOURCE_STATUS_STORAGE_KEY;

function readStoredStatuses(): PortfolioSourceStatus[] {
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

const App = ({
  loading: refreshLoading,
  afterRefresh,
}: {
  loading: boolean;
  afterRefresh?: (success: boolean) => unknown;
}) => {
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [sourceStatuses, setSourceStatuses] = useState<PortfolioSourceStatus[]>(readStoredStatuses);
  const [lastResult, setLastResult] = useState<RefreshAllDataResult>();

  const {
    setButtonLoading: setRefreshLoading,
    setProgress: setRefreshProgress,
  } = useContext(RefreshButtonLoadingContext);

  const retry = async <T,>(
    fn: () => Promise<T>,
    times: number,
    interval: number,
  ): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof FullRefreshRequiredError ||
        (error instanceof Error && error.message.startsWith("no configuration found"))) throw error;
      if (times === 0) throw error;
      await new Promise((resolve) => setTimeout(resolve, interval));
      // Never show raw upstream errors: request URLs and exception text may contain credentials.
      toast({ description: `${t("refresh.retry")}${retries - times + 1}` });
      return retry(fn, times - 1, interval);
    }
  };

  function setProgress(p: number) {
    setRefreshProgress(Math.min(Math.max(p, 0), 100));
  }

  const runRefresh = async (sourceId?: string) => {
    if (sourceId && !lastResult?.sourceResults) return;
    cancelInsightRefresh();
    setRefreshLoading(true);
    const operation: RefreshOperation = { operationUuid: uuidv4() };
    let succeeded = false;
    let insightStatuses = sourceStatuses;
    let alertResult: RefreshAllDataResult | undefined;
    try {
      if (!sourceId) {
        await updateAllCurrencyRates().catch(() => {});
      }
      setProgress(0);
      const result = await refreshAllData(
        setProgress,
        sourceId
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
          : sourceStatuses.length ? { previousSourceStatuses: sourceStatuses } : {},
        operation,
        (attempt) => retry(attempt, retries, retryInterval),
      );
      succeeded = result.persisted !== false && !result.requiresDataSourceAction;
      if (succeeded) {
        alertResult = result;
        getMemoryCacheInstance("data-fetch").clearCache();
      }
      if (result.sourceStatuses) {
        const statuses = normalizeSourceStatuses(result.sourceStatuses);
        setSourceStatuses(statuses);
        insightStatuses = statuses;
        setStatusDialogOpen(statuses.some((source) => source.status === "failed" || source.status === "stale"));
        try {
          localStorage.setItem(sourceStatusStorageKey, JSON.stringify(statuses));
        } catch {
          // The current session still shows the warning when storage is unavailable.
        }
      }
      setLastResult(result);
      if (succeeded) {
        const unavailable = insightStatuses.filter((source) => source.status === "stale" || source.status === "failed").map((source) =>
          sourceIdentity({ ...source, label: sourceLabel(source) })).join(", ");
        const incomplete = insightStatuses.some((source) => source.status === "failed");
        const partialSources = insightStatuses.filter((source) => source.status === "partial");
        const usualWarning = partialSources.some((source) => source.partial?.lowerThanPrevious);
        const partialWarning = partialSources.length
          ? t(usualWarning ? "refresh.partialToastLower" : "refresh.partialToast")
            .replace("{sources}", partialSources.map((source) =>
              sourceIdentity({ ...source, label: sourceLabel(source) })).join(", ")) : "";
        const statusWarning = incomplete
          ? t("refresh.incomplete").replace("{sources}", unavailable)
          : result.usedLastKnownData
            ? unavailable ? t("refresh.partial").replace("{sources}", unavailable) : t("refresh.partialGeneric")
            : "";
        toast({ description: [statusWarning, partialWarning].filter(Boolean).join(" ") || t("refresh.success") });
      } else {
        const unavailable = insightStatuses.filter((source) => source.status !== "ok" &&
          (!sourceId || source.sourceId === sourceId)).map((source) =>
          sourceIdentity({ ...source, label: sourceLabel(source) })).join(", ");
        const key = sourceId ? "refresh.sourceRetryFailed" : "refresh.allSourcesFailed";
        toast({ description: unavailable ? t(key).replace("{sources}", unavailable) : t(`${key}Generic`),
          variant: "destructive" });
      }
      trackEventWithClientID("data_refreshed", {
        failedSources: result.sourceStatuses?.filter((source) => source.status === "stale" || source.status === "failed")
          .map((source) => source.sourceId).join(",") ?? "",
        partialSources: result.sourceStatuses?.filter((source) => source.status === "partial")
          .map((source) => source.sourceId).join(",") ?? "",
      });
    } catch (error) {
      const messageKey = error instanceof FullRefreshRequiredError
        ? "refresh.runFullRefresh"
        : error instanceof Error && error.message.startsWith("no configuration found")
          ? "refresh.noConfiguration"
          : "refresh.unexpectedError";
      toast({ description: t(messageKey), variant: "destructive" });
      trackEventWithClientID("data_refreshed", { failed: "true" });
    } finally {
      setRefreshLoading(false);
      setProgress(0);
      afterRefresh?.(succeeded);
      if (succeeded) {
        if (alertResult) {
          const resultForAlerts = alertResult;
          queueMicrotask(() => {
            void processAlerts(resultForAlerts.sourceResults, resultForAlerts.sourceStatuses)
              .then((alerts) => deliverAlerts(alerts, (alert) => {
                const text = formatAlert(alert, t);
                toast({ title: text.title, description: text.message });
              }, t))
              .catch(() => console.warn("alert evaluation failed"));
          });
        }
        queueMicrotask(() => {
          void refreshInsights(insightStatuses, locale).catch(() => console.warn("insight generation failed"));
        });
      }
    }
  };

  const hasFailure = sourceStatuses.some((source) => source.status === "failed" || source.status === "stale");
  const hasPartial = sourceStatuses.some((source) => source.status === "partial");
  const sourceLabel = (source: PortfolioSourceStatus) => {
    const wallet = /^(erc20|sol|btc|doge|trc20|ton|sui):(\d+)$/.exec(source.sourceId);
    if (wallet && source.label.toLowerCase() === `${wallet[1]} wallet ${Number(wallet[2]) + 1}`) {
      return t("refresh.walletSource")
        .replace("{chain}", wallet[1].toUpperCase())
        .replace("{number}", String(Number(wallet[2]) + 1));
    }
    return source.sourceId === "others" ? t("refresh.othersSource") : source.label;
  };
  const displayIdentity = (source: PortfolioSourceStatus) =>
    sourceIdentity({ ...source, label: sourceLabel(source) });
  const displayHint = (source: PortfolioSourceStatus) =>
    source.kind === "exchange" && source.hint && !source.hint.startsWith("#")
      ? `${t("refresh.hint.apikey")} ${source.hint}` : source.hint;
  const sortedStatuses = sortSourceStatuses(sourceStatuses);
  const failedStatuses = sortedStatuses.filter((source) => source.status === "failed");
  const partialStatuses = sortedStatuses.filter((source) => source.status === "partial");
  const failedNames = failedStatuses.map(displayIdentity).join(", ");
  const kindIcon = { exchange: GlobeIcon, wallet: CubeIcon, broker: BackpackIcon, others: ArchiveIcon };
  const statusStyle = {
    ok: "border-green-600/30 bg-green-600/10 text-green-800 dark:text-green-300",
    stale: "border-amber-600/30 bg-amber-600/10 text-amber-900 dark:text-amber-300",
    partial: "border-amber-600/30 bg-amber-600/10 text-amber-900 dark:text-amber-300",
    failed: "border-red-600/30 bg-red-600/10 text-red-800 dark:text-red-300",
  };
  const statusIcon = { ok: CheckIcon, stale: ExclamationTriangleIcon,
    partial: ExclamationTriangleIcon, failed: CrossCircledIcon };
  const partialMessage = (source: PortfolioSourceStatus) => {
    const endpoints = source.partial?.endpoints.map((name) =>
      t(`refresh.endpoint.${partialEndpointKeys[name] ?? "other"}`)) ?? [];
    const names = new Intl.ListFormat(locale === "zh" ? "zh-CN" : "en", {
      style: "long", type: "conjunction",
    }).format(endpoints);
    return t(source.partial?.lowerThanPrevious ? "refresh.partialSourceLower" : "refresh.partialSource")
      .replace("{endpoints}", names || t("refresh.endpoint.other"));
  };
  const detailKey: Record<string, string> = {
    "Source timed out": "refresh.detail.timeout",
    "Unsupported exchange": "refresh.detail.unsupported",
    "Invalid source holdings": "refresh.detail.invalidholdings",
  };

  return (
    <div className="flex items-center gap-2">
      <span role="status" className="sr-only">{refreshLoading ? t("refresh.inProgress") : ""}</span>
      <Button variant="outline" aria-label={t("common.refresh")} onClick={() => runRefresh()} disabled={refreshLoading}>
        <UpdateIcon aria-hidden="true" className={`mr-2 h-4 w-4 ${refreshLoading ? "animate-spin motion-reduce:animate-none" : ""}`} />
        <p className="hidden sm:inline-block">{t("common.refresh")}</p>
      </Button>
      {sourceStatuses.length > 0 && (
        <Button
          variant={hasFailure ? "destructive" : "outline"}
          size="sm"
          className={!hasFailure && hasPartial ? "text-amber-900 dark:text-amber-300" : undefined}
          onClick={() => setStatusDialogOpen(true)}
          disabled={refreshLoading}
        >
          {!hasFailure && hasPartial && <ExclamationTriangleIcon aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
          {t("refresh.sourceStatus")}
        </Button>
      )}
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("refresh.sourceStatus")}</AlertDialogTitle>
            <AlertDialogDescription>
              {partialStatuses.length
                ? t("refresh.partialSummary")
                  .replace("{total}", String(sourceStatuses.length))
                  .replace("{failed}", String(failedStatuses.length))
                  .replace("{partial}", String(partialStatuses.length))
                  .replace("{stale}", String(sortedStatuses.filter((source) => source.status === "stale").length))
                : failedStatuses.length
                ? t("refresh.failedSummary")
                  .replace("{count}", String(failedStatuses.length))
                  .replace("{total}", String(sourceStatuses.length))
                  .replace("{sources}", failedNames)
                : sourceStatuses.some((source) => source.status === "stale")
                  ? t("refresh.staleWarning").replace("{sources}",
                    sortedStatuses.filter((source) => source.status === "stale").map(displayIdentity).join(", "))
                  : t("refresh.allCurrent")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-2 max-h-80 space-y-2 overflow-y-auto">
            {sortedStatuses.map((source) => {
              const Icon = kindIcon[source.kind ?? "others"];
              const StatusIcon = statusIcon[source.status];
              return (
              <div key={source.sourceId} role="group" aria-label={displayIdentity(source)}
                data-source-status-row className="flex items-center justify-between gap-3 rounded-md border px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold break-all">{sourceLabel(source)}</div>
                  {source.provider && <div className="text-xs text-muted-foreground">
                    <Icon aria-hidden="true" className="mr-1 inline-block h-3.5 w-3.5" />
                    {source.provider}{source.hint && ` · ${displayHint(source)}`}
                  </div>}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${statusStyle[source.status]}`}>
                      <StatusIcon aria-hidden="true" className="h-3.5 w-3.5" />
                      {t(`refresh.status.${source.status}`)}
                    </span>
                    {source.status !== "ok" && source.status !== "partial" && <span className="text-muted-foreground">
                      {t(`refresh.reason.${source.category ?? "other"}`)}
                    </span>}
                  </div>
                  {source.status === "partial" && <div className="mt-1 text-xs text-amber-900 dark:text-amber-300">
                    {partialMessage(source)}
                  </div>}
                  {source.status !== "ok" && source.detail && <details className="mt-1 text-xs text-muted-foreground">
                    <summary>{t("refresh.details")}</summary>
                    <span>{redactSecrets(t(detailKey[source.detail]))}</span>
                  </details>}
                  {(source.status === "stale" || source.status === "failed") && source.lastSuccessAt && <div className="mt-1 text-xs text-muted-foreground">
                    {t("refresh.lastData").replace("{time}", new Intl.DateTimeFormat("sv-SE", {
                      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
                    }).format(new Date(source.lastSuccessAt)))}
                  </div>}
                </div>
                {source.status !== "ok" && lastResult?.sourceResults && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={refreshLoading}
                    aria-label={t("refresh.retrySource").replace("{source}", displayIdentity(source))}
                    onClick={() => runRefresh(source.sourceId)}
                  >
                    {t("refresh.retryButton")}
                  </Button>
                )}
              </div>
            ); })}
          </div>
          <AlertDialogFooter>
            {failedStatuses.length > 0 && <Button variant="outline"
              disabled={refreshLoading} onClick={() => runRefresh()}>{t("refresh.retryAllFailed")}</Button>}
            <AlertDialogCancel>{t("refresh.close")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default App;
