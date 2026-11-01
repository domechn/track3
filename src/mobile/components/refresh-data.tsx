import { useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  refreshAllData,
  type RefreshAllDataResult,
} from "@/middlelayers/charts";
import type { RefreshOperation } from "@/middlelayers/charts-refresh";
import type { PortfolioSourceResult, PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import { v4 as uuidv4 } from "uuid";
import { trackRefreshEvent } from "@/middlelayers/ui-state/telemetry";
import { retries, retryInterval, readStoredStatuses, writeStoredStatuses, retryRefresh, mobileRefreshOptions } from "@/middlelayers/ui-state/source-status-store";
import { publishSourceStatuses } from "@/components/source-status-event";
import { bindRefreshRetry, refreshRetryScheduler } from "@/middlelayers/refresh-retry-scheduler";
import { useToast } from "@/mobile/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  ArchiveIcon, BackpackIcon, CheckIcon, CrossCircledIcon, CubeIcon,
  ExclamationTriangleIcon, GlobeIcon, UpdateIcon,
} from "@radix-ui/react-icons";
import { RefreshButtonLoadingContext } from "@/mobile/components/index";
import { getMemoryCacheInstance } from "@/middlelayers/datafetch/utils/cache";
import { getConfiguration, updateAllCurrencyRates } from "@/middlelayers/configuration";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/mobile/components/ui/alert-dialog";
import { useTranslation } from "@/mobile/i18n";
import { FullRefreshRequiredError } from "@/middlelayers/refresh-error";
import { processAlerts } from "@/middlelayers/alerts";
import { deliverAlerts, formatAlert } from "@/middlelayers/alert-notifications";
import { redactSecrets } from "@/middlelayers/security/redact";
import { cancelInsightRefresh, refreshInsights } from "@/middlelayers/insights-service";
import { normalizeSourceStatuses, sourceIdentity, sortSourceStatuses } from "@/middlelayers/source-status";
import { partialEndpointKeys } from "@/middlelayers/datafetch/utils/source-failure";
import { isIOS } from "@/utils/platform";
import { invoke } from "@tauri-apps/api/core";
import { listPortfolioSources } from "@/middlelayers/data";
import { invalidateUsageCache, isProVersion, LicenseCenter } from "@/middlelayers/license";
import { getUsageWarnings, type UsageWarning } from "@/middlelayers/usage-preflight";

let lastRetryResult: RefreshAllDataResult | undefined;

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
  const [showLastKnownOffer, setShowLastKnownOffer] = useState(false);
  const [preflight, setPreflight] = useState<{ sourceId?: string; warnings: UsageWarning[] } | null>(null);
  const [preflightPending, setPreflightPending] = useState(false);
  const preflightPendingRef = useRef(false);
  const refreshInProgress = useRef(false);
  const refreshLoadingRef = useRef(refreshLoading);
  refreshLoadingRef.current = refreshLoading;
  const retrySchedule = useSyncExternalStore(refreshRetryScheduler.subscribe, refreshRetryScheduler.status);
  const [sourceStatuses, setSourceStatuses] = useState<PortfolioSourceStatus[]>(readStoredStatuses);
  const [lastResult, setLastResult] = useState<RefreshAllDataResult | undefined>(() => lastRetryResult);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingSources, setPendingSources] = useState<Array<{ sourceId: string; label: string }>>([]);
  const [liveSources, setLiveSources] = useState<PortfolioSourceResult[]>([]);

  const {
    setButtonLoading: setRefreshLoading,
    setProgress: setRefreshProgress,
    refreshAction,
    progress,
  } = useContext(RefreshButtonLoadingContext);

  const retry = <T,>(fn: () => Promise<T>, times: number, interval: number): Promise<T> =>
    retryRefresh(fn, times, interval, (attempt) => {
      // Never show raw upstream errors: request URLs and exception text may contain credentials.
      toast({ description: `${t("refresh.retry")}${attempt}` });
    });

  function setProgress(p: number) {
    setRefreshProgress(Math.min(Math.max(p, 0), 100));
  }

  const runRefresh = async (sourceId?: string, automatic = false): Promise<PortfolioSourceStatus[] | null | undefined> => {
    if (refreshLoading || refreshInProgress.current) return;
    if (sourceId && !lastResult?.sourceResults) return null;
    if (!automatic) refreshRetryScheduler.manualStart();
    refreshInProgress.current = true;
    if (isIOS() && !automatic) setStatusDialogOpen(true);
    setRefreshing(true);
    setLiveSources([]);
    cancelInsightRefresh();
    setRefreshLoading(true);
    try {
      const [config, userInfo] = await Promise.all([getConfiguration(), isProVersion()]);
      setPendingSources(config ? listPortfolioSources(config, userInfo).filter((source) => !sourceId || source.sourceId === sourceId) : []);
    } catch {
      setPendingSources([]);
    }
    const operation: RefreshOperation = { operationUuid: uuidv4() };
    let succeeded = false;
    let retryStatuses: PortfolioSourceStatus[] | undefined;
    let insightStatuses = sourceStatuses;
    let alertResult: RefreshAllDataResult | undefined;
    try {
      if (!sourceId) {
        await updateAllCurrencyRates().catch(() => {});
      }
      setProgress(0);
      const result = await refreshAllData(
        setProgress,
        mobileRefreshOptions(sourceId, lastResult, sourceStatuses,
          (source) => setLiveSources((current) => [...current.filter((item) => item.sourceId !== source.sourceId), source])),
        operation,
        (attempt) => automatic ? attempt() : retry(attempt, retries, retryInterval),
      );
      succeeded = result.persisted !== false && !result.requiresDataSourceAction;
      const freshAutomaticTotal = automatic && succeeded && !result.usedLastKnownData;
      if (!automatic || freshAutomaticTotal) {
        setShowLastKnownOffer(!automatic && succeeded && !!result.usedLastKnownData);
      }
      if (succeeded) {
        alertResult = result;
        getMemoryCacheInstance("data-fetch").clearCache();
      }
      if (result.sourceStatuses) {
        const statuses = normalizeSourceStatuses(result.sourceStatuses);
        retryStatuses = statuses;
        if (!automatic) refreshRetryScheduler.complete(statuses);
        setSourceStatuses(statuses);
        insightStatuses = statuses;
        setStatusDialogOpen((open) => automatic ? open && !statuses.every((source) => source.status === "ok")
          : statuses.some((source) => source.status === "failed" || source.status === "stale"));
        try {
          writeStoredStatuses(statuses);
        } catch {
          // The current session still shows the warning when storage is unavailable.
        }
        publishSourceStatuses(statuses);
      }
      lastRetryResult = result;
      setLastResult(result);
      if (succeeded && !automatic) {
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
      } else if (!succeeded && !automatic) {
        const unavailable = insightStatuses.filter((source) => source.status !== "ok" &&
          (!sourceId || source.sourceId === sourceId)).map((source) =>
          sourceIdentity({ ...source, label: sourceLabel(source) })).join(", ");
        const key = sourceId ? "refresh.sourceRetryFailed" : "refresh.allSourcesFailed";
        toast({ description: unavailable ? t(key).replace("{sources}", unavailable) : t(`${key}Generic`),
          variant: "destructive" });
      }
      trackRefreshEvent({
        failedSources: result.sourceStatuses?.filter((source) => source.status === "stale" || source.status === "failed")
          .map((source) => source.sourceId).join(",") ?? "",
        partialSources: result.sourceStatuses?.filter((source) => source.status === "partial")
          .map((source) => source.sourceId).join(",") ?? "",
      });
    } catch (error) {
      if (error instanceof FullRefreshRequiredError) refreshRetryScheduler.stop();
      const messageKey = error instanceof FullRefreshRequiredError
        ? "refresh.runFullRefresh"
        : error instanceof Error && error.message.startsWith("no configuration found")
          ? "refresh.noConfiguration"
          : "refresh.unexpectedError";
      if (!automatic) toast({ description: t(messageKey), variant: "destructive" });
      trackRefreshEvent({ failed: "true" });
      if (automatic) throw error;
    } finally {
      await invalidateUsageCache();
      refreshInProgress.current = false;
      refreshRetryScheduler.poke();
      setRefreshing(false);
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
    return retryStatuses;
  };

  const runRefreshRef = useRef(runRefresh);
  runRefreshRef.current = runRefresh;
  useEffect(() => bindRefreshRetry(
    (sourceId) => isIOS()
      ? invoke("ios_auto_retry_allowed").then((allowed) => allowed === true ? runRefreshRef.current(sourceId, true) : undefined)
      : runRefreshRef.current(sourceId, true),
    () => !refreshLoadingRef.current && !refreshInProgress.current && !preflightPendingRef.current,
  ), []);

  const requestRefresh = async (sourceId?: string) => {
    if (refreshLoading || preflight || preflightPendingRef.current || refreshInProgress.current) return;
    preflightPendingRef.current = true;
    setPreflightPending(true);
    try {
      const [config, userInfo] = await Promise.all([getConfiguration(), isProVersion()]);
      if (config && userInfo.isPro) {
        const sourceIds = listPortfolioSources(config, userInfo)
          .filter((source) => !sourceId || source.sourceId === sourceId)
          .map((source) => source.sourceId);
        if (sourceIds.some((id) => id.startsWith("erc20:") || id.startsWith("trc20:"))) {
          const usage = await LicenseCenter.getInstance().getUsage();
          const warnings = getUsageWarnings(sourceIds, usage);
          if (warnings.length) {
            setPreflight({ sourceId, warnings });
            return;
          }
        }
      }
    } catch {
      // Usage lookup is advisory. A refresh still runs when it is unavailable.
    } finally {
      preflightPendingRef.current = false;
      setPreflightPending(false);
    }
    await runRefresh(sourceId);
  };

  useEffect(() => {
    refreshAction.current = () => requestRefresh();
    return () => { refreshAction.current = null; };
  }, [refreshAction, requestRefresh]);

  const hasFailure = sourceStatuses.some((source) => source.status === "failed" || source.status === "stale");
  const hasPartial = sourceStatuses.some((source) => source.status === "partial");
  const sourceLabel = (source: Pick<PortfolioSourceStatus, "sourceId" | "label">) => {
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
  const progressSources = [...pendingSources, ...liveSources.filter((source) =>
    !pendingSources.some((pending) => pending.sourceId === source.sourceId))];
  const failedStatuses = sortedStatuses.filter((source) => source.status === "failed");
  const partialStatuses = sortedStatuses.filter((source) => source.status === "partial");
  const failedNames = failedStatuses.map(displayIdentity).join(", ");
  const nextRetryAt = Math.min(...Object.values(retrySchedule.nextBySource));
  const retryStatus = Number.isFinite(nextRetryAt)
    ? t("refresh.autoRetry.next").replace("{time}", new Date(nextRetryAt).toLocaleTimeString(
      locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false }))
    : retrySchedule.stopped ? t("refresh.autoRetry.stopped") : "";
  const kindIcon = { exchange: GlobeIcon, wallet: CubeIcon, broker: BackpackIcon, others: ArchiveIcon };
  const statusStyle = {
    ok: "t3-pill t3-refresh-status-pill",
    stale: "t3-pill t3-refresh-status-pill",
    partial: "t3-pill t3-refresh-status-pill",
    failed: "t3-pill t3-refresh-status-pill",
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
    "ERC20 balance provider is not configured": "refresh.detail.providerNotConfigured",
    "Upstream provider error": "refresh.detail.upstreamProvider",
  };

  return (
    <div className="t3-refresh-controls flex items-center gap-2">
      <span role="status" className="sr-only">{refreshLoading || preflightPending ? t("refresh.inProgress") : ""}</span>
      <Button variant="outline" className="t3-refresh-button" aria-label={t("common.refresh")} onClick={() => requestRefresh()} disabled={refreshLoading || preflightPending}>
        <UpdateIcon aria-hidden="true" className={`mr-2 h-4 w-4 ${refreshLoading || preflightPending ? "animate-spin motion-reduce:animate-none" : ""}`} />
        <p className="hidden sm:inline-block">{t("common.refresh")}</p>
      </Button>
      {sourceStatuses.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="t3-refresh-source-trigger"
          data-tone={hasFailure ? "err" : hasPartial ? "warn" : "ok"}
          onClick={() => setStatusDialogOpen(true)}
          disabled={preflightPending}
        >
          {!hasFailure && hasPartial && <ExclamationTriangleIcon aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
          {t("refresh.sourceStatus")}
        </Button>
      )}
      <AlertDialog open={!!preflight} onOpenChange={(open) => { if (!open) setPreflight(null); }}>
        <AlertDialogContent overlayProps={isIOS() ? undefined : { className: "t3-refresh-overlay" }} className={isIOS() ? "ios-d3-refresh-sheet t3-refresh-popover bottom-0 left-0 top-auto max-h-[90dvh] w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]" : "t3-refresh-popover sm:max-w-md"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("refresh.preflight.title")}</AlertDialogTitle>
            <AlertDialogDescription asChild><div className="space-y-2">
              {preflight?.warnings.map(({ resource, needed, remaining, stale }) =>
                <p key={resource}>{t("refresh.preflight.desc")
                  .replace("{needed}", String(needed))
                  .replace("{resource}", resource.toUpperCase())
                  .replace("{remaining}", String(remaining))
                  .replace("{n}", String(stale))}</p>)}
            </div></AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button onClick={() => {
              const sourceId = preflight?.sourceId;
              setPreflight(null);
              void runRefresh(sourceId);
            }}>{t("refresh.preflight.continue")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={statusDialogOpen} onOpenChange={(open) => {
        setStatusDialogOpen(open);
        if (!open) setShowLastKnownOffer(false);
      }}>
        <AlertDialogContent overlayProps={isIOS() ? undefined : { className: "t3-refresh-overlay" }} className={isIOS()
          ? "ios-d3-refresh-sheet t3-refresh-popover bottom-0 left-0 top-auto max-h-[90dvh] w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          : "t3-refresh-popover sm:max-w-md"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("refresh.sourceStatus")}</AlertDialogTitle>
            <AlertDialogDescription>
              {refreshing ? t("refresh.inProgress") : partialStatuses.length
                ? t("refresh.partialSummary")
                  .replace("{total}", String(sourceStatuses.length))
                  .replace("{failed}", String(failedStatuses.length))
                  .replace("{partial}", String(partialStatuses.length))
                  .replace("{stale}", String(sortedStatuses.filter((source) => source.status === "stale").length))
                : failedStatuses.length
                ? t(isIOS() ? "refresh.failedSummaryMobile" : "refresh.failedSummary")
                  .replace("{count}", String(failedStatuses.length))
                  .replace("{total}", String(sourceStatuses.length))
                  .replace("{sources}", failedNames)
                : sourceStatuses.some((source) => source.status === "stale")
                  ? isIOS()
                    ? t("refresh.staleSummaryMobile")
                      .replace("{count}", String(sortedStatuses.filter((source) => source.status === "stale").length))
                      .replace("{total}", String(sourceStatuses.length))
                    : t("refresh.staleWarning").replace("{sources}",
                      sortedStatuses.filter((source) => source.status === "stale").map(displayIdentity).join(", "))
                  : t("refresh.allCurrent")}
            </AlertDialogDescription>
            {retryStatus && <p className="text-xs text-muted-foreground">{retryStatus}</p>}
            {refreshing && <div role="progressbar" aria-label={t("refresh.inProgress")} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
            </div>}
          </AlertDialogHeader>
          <div className="ios-d3-refresh-status-list my-2 max-h-80 overflow-y-auto">
            {refreshing && (progressSources.length ? progressSources : [{ sourceId: "loading", label: t("refresh.inProgress") }]).map((pending) => {
              const completed = liveSources.find((source) => source.sourceId === pending.sourceId);
              const previousFailed = sourceStatuses.some((source) => source.sourceId === pending.sourceId && source.status === "failed");
              const StatusIcon = completed?.status === "stale" || completed?.status === "partial" ? ExclamationTriangleIcon
                  : completed ? CheckIcon : UpdateIcon;
              const label = sourceLabel(pending);
              return <div key={pending.sourceId} data-source-status-row role="group" aria-label={label} className="ios-d3-refresh-row t3-refresh-source-row flex items-center justify-between gap-3 px-4 py-3">
                <div className="ios-d3-refresh-row-main">
                  <StatusIcon aria-hidden="true" className={`h-5 w-5 shrink-0 ${completed ? completed.status === "stale" || completed.status === "partial" ? "text-amber-600" : "text-green-600 dark:text-green-400" : "animate-spin text-primary motion-reduce:animate-none"}`} />
                  <div className="ios-d3-refresh-row-content">
                    <div className="ios-d3-refresh-row-title">{label}</div>
                    <div className="text-xs text-muted-foreground">{completed ? t(`refresh.status.${completed.status}`) : t("refresh.inProgress")}</div>
                  </div>
                </div>
                <span className="ios-d3-refresh-row-duration text-muted-foreground">{completed?.startedAt && completed.finishedAt
                  ? `${((Date.parse(completed.finishedAt) - Date.parse(completed.startedAt)) / 1000).toFixed(1)}s`
                  : ""}</span>
                {(previousFailed || completed?.status === "stale") && completed?.category !== "quota" && !sourceStatuses.some((source) => source.sourceId === pending.sourceId && source.category === "quota") && <Button size="sm" variant="secondary" disabled
                  aria-label={t("refresh.retrySource").replace("{source}", label)}>{t("refresh.retryButton")}</Button>}
              </div>;
            })}
            {!refreshing && sortedStatuses.map((source) => {
              const Icon = kindIcon[source.kind ?? "others"];
              const StatusIcon = statusIcon[source.status];
              return (
              <div key={source.sourceId} role="group" aria-label={displayIdentity(source)}
                data-source-status-row className="ios-d3-refresh-row t3-refresh-source-row flex items-center justify-between gap-3 px-4 py-3">
                <div className="ios-d3-refresh-row-main">
                  {isIOS() && <StatusIcon aria-hidden="true" className={`mt-1 h-5 w-5 shrink-0 ${source.status === "ok" ? "text-green-600 dark:text-green-400" : source.status === "failed" ? "text-destructive" : "text-amber-600"}`} />}
                  <div className="ios-d3-refresh-row-content">
                  <div className="ios-d3-refresh-row-title" title={sourceLabel(source)}>{sourceLabel(source)}</div>
                  {source.provider && <div className="ios-d3-refresh-identity text-xs text-muted-foreground">
                    <Icon aria-hidden="true" className="mr-1 inline-block h-3.5 w-3.5" />
                    {source.provider}{source.hint && ` · ${displayHint(source)}`}
                  </div>}
                  </div>
                </div>
                {source.startedAt && source.finishedAt && <span className="ios-d3-refresh-row-duration text-muted-foreground">
                  {((Date.parse(source.finishedAt) - Date.parse(source.startedAt)) / 1000).toFixed(1)}s
                </span>}
                {source.status !== "ok" && source.category !== "quota" && lastResult?.sourceResults && (
                  <Button
                    size="sm"
                    variant={isIOS() ? "secondary" : "outline"}
                    disabled={refreshLoading || preflightPending}
                    aria-label={t("refresh.retrySource").replace("{source}", displayIdentity(source))}
                    onClick={() => requestRefresh(source.sourceId)}
                  >
                    {t("refresh.retryButton")}
                  </Button>
                )}
                <div className="ios-d3-refresh-condition flex flex-wrap items-center gap-1.5 text-xs">
                    {isIOS() ? <span className="text-muted-foreground">{t(`refresh.status.${source.status}`)}</span>
                      : <span data-tone={source.status === "ok" ? "ok" : source.status === "failed" ? "err" : "warn"} className={`inline-flex items-center gap-1 font-medium ${statusStyle[source.status]}`}>
                        <StatusIcon aria-hidden="true" className="h-3.5 w-3.5" />
                        {t(`refresh.status.${source.status}`)}
                      </span>}
                    {source.status !== "ok" && source.status !== "partial" && <span className="text-muted-foreground">
                      · {t(`refresh.reason.${source.category ?? "other"}`)}
                    </span>}
                  </div>
                  {source.status === "partial" && <div className="ios-d3-refresh-extra mt-1 text-xs text-amber-900 dark:text-amber-300">
                    {partialMessage(source)}
                  </div>}
                  {source.status !== "ok" && source.detail && <details className="ios-d3-refresh-extra mt-1 text-xs text-muted-foreground">
                    <summary>{t("refresh.details")}</summary>
                    <span>{redactSecrets(t(detailKey[source.detail]))}</span>
                  </details>}
                {(source.status === "stale" || source.status === "failed") && source.lastSuccessAt && <div className="ios-d3-refresh-last-data text-xs text-muted-foreground">
                  {t("refresh.lastData").replace("{time}", new Intl.DateTimeFormat(isIOS() ? locale === "zh" ? "zh-CN" : "en-US" : "sv-SE", isIOS()
                    ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }
                    : { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(source.lastSuccessAt)))}
                </div>}
              </div>
            ); })}
          </div>
          {showLastKnownOffer && <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <p>{t("refresh.lastKnownSaved")}</p>
            <Button className="mt-2" variant="outline" size="sm" onClick={() => {
              setShowLastKnownOffer(false);
              setStatusDialogOpen(false);
            }}>{t("refresh.useLastKnown")}</Button>
          </div>}
          <AlertDialogFooter>
            {!refreshing && retrySchedule.stopped && hasFailure && <Button variant="outline"
              disabled={refreshLoading || preflightPending} onClick={() => requestRefresh()}>{t("refresh.autoRetry.fullRefresh")}</Button>}
            {!refreshing && !retrySchedule.stopped && failedStatuses.some((source) => source.category !== "quota") && <Button variant="outline"
              disabled={refreshLoading || preflightPending} onClick={() => requestRefresh()}>{t("refresh.retryAllFailed")}</Button>}
            <AlertDialogCancel>{t("refresh.close")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default App;
