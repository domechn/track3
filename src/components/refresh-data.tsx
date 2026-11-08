import { useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import {
  refreshAllData,
  type RefreshAllDataResult,
} from "../middlelayers/charts";
import type { RefreshOperation } from "../middlelayers/charts-refresh";
import type { PortfolioSourceResult, PortfolioSourceStatus } from "../middlelayers/portfolio-baseline";
import { v4 as uuidv4 } from "uuid";
import { trackRefreshEvent } from "@/middlelayers/ui-state/telemetry";
import { retries, retryInterval, readStoredStatuses, writeStoredStatuses, retryRefresh, desktopRefreshOptions } from "@/middlelayers/ui-state/source-status-store";
import { bindRefreshRetry, refreshRetryScheduler } from "@/middlelayers/refresh-retry-scheduler";
import { useToast } from "@/components/ui/use-toast";
import { overviewRefreshActivityEvent, overviewRefreshRequestedEvent, overviewUseLastKnownEvent, publishSourceStatuses } from "./source-status-event";
import { Button } from "./ui/button";
import { ToastAction } from "./ui/toast";
import {
  ArchiveIcon, BackpackIcon, CheckIcon, CrossCircledIcon, CubeIcon,
  ExclamationTriangleIcon, GlobeIcon, InfoCircledIcon, ReloadIcon, UpdateIcon,
} from "@radix-ui/react-icons";
import { RefreshButtonLoadingContext } from "./index/index";
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
} from "./ui/alert-dialog";
import { useTranslation } from "@/i18n";
import { useWindowSize } from "@/utils/hook";
import { FullRefreshRequiredError } from "@/middlelayers/refresh-error";
import { processAlerts } from "@/middlelayers/alerts";
import { deliverAlerts, formatAlert } from "@/middlelayers/alert-notifications";
import { redactSecrets } from "@/middlelayers/security/redact";
import { cancelInsightRefresh, refreshInsights } from "@/middlelayers/insights-service";
import { normalizeSourceStatuses, sortSourceStatuses } from "@/middlelayers/source-status";
import { partialEndpointKeys } from "@/middlelayers/datafetch/utils/source-failure";
import { listPortfolioSources } from "@/middlelayers/data";
import { invalidateUsageCache, isProVersion, LicenseCenter } from "@/middlelayers/license";
import { getUsageWarnings, type UsageWarning } from "@/middlelayers/usage-preflight";
import { useRefreshQuota } from "./refresh-quota";
import { FULL_REFRESH_REQUEST_EVENT } from "./refresh-request";
import { sourceDisplayNames } from "./source-display-name";
import { runningSourceStarts } from "./source-run-progress";
import { refreshSourceName } from "./refresh-source-name";

let lastRetryResult: RefreshAllDataResult | undefined;
type NearQuota = { resource: "ERC20" | "TRON"; used: number; limit: number; periodEnd: string };

const App = ({
  loading: refreshLoading,
  afterRefresh,
  overviewFlow = false,
  liveTotalVisible = false,
  fidelity = false,
}: {
  loading: boolean;
  afterRefresh?: (success: boolean) => unknown;
  overviewFlow?: boolean;
  liveTotalVisible?: boolean;
  fidelity?: boolean;
}) => {
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const desktopFlow = (useWindowSize().width ?? window.innerWidth) >= 761;
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusPosition, setStatusPosition] = useState<{ top: number; right: number }>();
  const [showLastKnownOffer, setShowLastKnownOffer] = useState(false);
  const [sourceStatuses, setSourceStatuses] = useState<PortfolioSourceStatus[]>(readStoredStatuses);
  const [pendingSources, setPendingSources] = useState<Array<{ sourceId: string; label: string }>>([]);
  const [liveSources, setLiveSources] = useState<PortfolioSourceResult[]>([]);
  const refreshStartedAt = useRef(new Date().toISOString());
  const [now, setNow] = useState(Date.now);
  const sourceTriggerRef = useRef<HTMLButtonElement>(null);
  const [lastResult, setLastResult] = useState<RefreshAllDataResult | undefined>(() => lastRetryResult);
  const lastResultRef = useRef(lastResult);
  const [preflight, setPreflight] = useState<{ sourceId?: string; warnings: UsageWarning[] } | null>(null);
  const [preflightPending, setPreflightPending] = useState(false);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const preflightPendingRef = useRef(false);
  const refreshInProgress = useRef(false);
  const pendingRetryRef = useRef<{ sourceId?: string } | null>(null);
  const refreshLoadingRef = useRef(refreshLoading);
  const openStatus = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setStatusPosition({
      top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - Math.min(window.innerHeight * 0.6, 420) - 8)),
      right: Math.max(8, Math.min(window.innerWidth - Math.min(390, window.innerWidth - 32) - 8,
        window.innerWidth - rect.right)),
    });
    setStatusDialogOpen(true);
  };
  refreshLoadingRef.current = refreshLoading;
  useEffect(() => {
    const closeOnNavigation = () => {
      setStatusDialogOpen(false);
      setShowLastKnownOffer(false);
    };
    window.addEventListener("hashchange", closeOnNavigation);
    return () => window.removeEventListener("hashchange", closeOnNavigation);
  }, []);
  useEffect(() => {
    if (!statusDialogOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setStatusDialogOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [statusDialogOpen]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(overviewRefreshActivityEvent, { detail: refreshLoading }));
    return () => { window.dispatchEvent(new CustomEvent(overviewRefreshActivityEvent, { detail: false })); };
  }, [refreshLoading]);
  const retrySchedule = useSyncExternalStore(refreshRetryScheduler.subscribe, refreshRetryScheduler.status);

  const {
    setButtonLoading: setRefreshLoading,
    setProgress: setRefreshProgress,
  } = useContext(RefreshButtonLoadingContext);

  const retry = <T,>(fn: () => Promise<T>, times: number, interval: number): Promise<T> =>
    retryRefresh(fn, times, interval, (attempt) => {
      // Never show raw upstream errors: request URLs and exception text may contain credentials.
      toast({ description: `${t("refresh.retry")}${attempt}` });
    });

  function setProgress(p: number) {
    setRefreshProgress(Math.min(Math.max(p, 0), 100));
  }

  const runRefresh = async (sourceId?: string, automatic = false, nearQuota?: NearQuota): Promise<PortfolioSourceStatus[] | null | undefined> => {
    if (refreshInProgress.current) return;
    if (sourceId && !lastResultRef.current?.sourceResults) return null;
    if (!automatic) refreshRetryScheduler.manualStart();
    refreshInProgress.current = true;
    setRunning(true);
    if (!automatic) setShowLastKnownOffer(false);
    setNow(Date.now());
    refreshStartedAt.current = new Date().toISOString();
    setLiveSources([]);
    setPendingSources([]);
    cancelInsightRefresh();
    setRefreshLoading(true);
    try {
      const [config, userInfo] = await Promise.all([getConfiguration(), isProVersion()]);
      setPendingSources(config ? listPortfolioSources(config, userInfo)
        .filter((source) => !sourceId || source.sourceId === sourceId) : []);
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
        { ...desktopRefreshOptions(sourceId, lastResultRef.current, sourceStatuses),
          onSourceResult: (source) => setLiveSources((current) =>
            [...current.filter((item) => item.sourceId !== source.sourceId), source]) },
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
        try {
          writeStoredStatuses(statuses);
        } catch {
          // The current session still shows the warning when storage is unavailable.
        }
        publishSourceStatuses(statuses);
      }
      lastRetryResult = result;
      lastResultRef.current = result;
      setLastResult(result);
      const quotaFailure = insightStatuses.some((source) => source.status !== "ok" && source.category === "quota");
      const retryable = insightStatuses.filter((source) =>
        (source.status === "failed" || source.status === "stale") && source.category !== "quota");
      const retrySourceId = retryable.length === 1 ? retryable[0].sourceId : undefined;
      const noticeActions = () => <>
        {quotaFailure
          ? <ToastAction altText={t("refresh.seeUsage")} onClick={() => { window.location.hash = "#/settings/systemInfo"; }}>
            {t("refresh.seeUsage")}
          </ToastAction>
          : <ToastAction altText={t("refresh.retryButton")} onClick={() => {
            if (refreshInProgress.current) pendingRetryRef.current = { sourceId: retrySourceId };
            else void runRefreshRef.current(retrySourceId);
          }}>
            {t("refresh.retryButton")}
          </ToastAction>}
      </>;
      if (succeeded && !automatic) {
        const unavailable = insightStatuses.filter((source) => source.status === "stale" || source.status === "failed").map((source) =>
          refreshSourceName({ ...source, label: sourceLabel(source) })).join(", ");
        const incomplete = insightStatuses.some((source) => source.status === "failed");
        const partialSources = insightStatuses.filter((source) => source.status === "partial");
        const usualWarning = partialSources.some((source) => source.partial?.lowerThanPrevious);
        const partialWarning = partialSources.length
          ? t(usualWarning ? "refresh.partialToastLower" : "refresh.partialToast")
            .replace("{sources}", partialSources.map((source) =>
              refreshSourceName({ ...source, label: sourceLabel(source) })).join(", ")) : "";
        const statusWarning = incomplete
          ? t("refresh.incomplete").replace("{sources}", unavailable)
          : result.usedLastKnownData
            ? unavailable ? t("refresh.partial").replace("{sources}", unavailable) : t("refresh.partialGeneric")
            : "";
        const hasWarning = !!statusWarning || !!partialWarning;
        const singleFailed = retryable.length === 1 && !quotaFailure ? retryable[0] : undefined;
        const singleQuota = quotaFailure && !retryable.length
          ? insightStatuses.find((source) => source.status !== "ok" && source.category === "quota") : undefined;
        const nearQuotaNotice = !hasWarning && !singleQuota && !singleFailed ? nearQuota : undefined;
        toast({
          title: singleQuota ? t("refresh.fidelity.quotaReached")
            : singleFailed ? t("refresh.fidelity.sourceFailed").replace("{source}", sourceLabel(singleFailed))
              : nearQuotaNotice ? t("refresh.fidelity.quotaNearlyUsed")
              : t(hasWarning ? "refresh.fidelity.incomplete" : "refresh.fidelity.complete"),
          description: singleQuota ? t("refresh.fidelity.quotaSource").replace("{source}", sourceLabel(singleQuota))
            : singleFailed ? redactSecrets(singleFailed.detail ?? t("overview.fidelity.refreshUnavailable"))
              : nearQuotaNotice ? t("refresh.fidelity.quotaNearlyUsedDetail")
                .replace("{used}", String(nearQuotaNotice.used)).replace("{limit}", String(nearQuotaNotice.limit))
                .replace("{resource}", nearQuotaNotice.resource)
                .replace("{date}", new Date(nearQuotaNotice.periodEnd).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-GB", {
                  day: "numeric", month: "short", timeZone: "UTC",
                }))
              : [statusWarning, partialWarning].filter(Boolean).join(" ") ||
            (insightStatuses.length ? t("refresh.fidelity.completedAt")
              .replace("{count}", String(insightStatuses.filter((source) => source.status === "ok").length))
              .replace("{total}", String(insightStatuses.length))
              .replace("{time}", new Date().toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-GB", {
                hour: "2-digit", minute: "2-digit", hour12: false,
              })) : t("refresh.success")),
          tone: singleFailed ? "error" : hasWarning || nearQuotaNotice ? "warning" : "success",
          action: nearQuotaNotice ? <ToastAction altText={t("refresh.seeUsage")} onClick={() => { window.location.hash = "#/settings/systemInfo"; }}>
            {t("refresh.seeUsage")}
          </ToastAction> : hasWarning && (quotaFailure || retryable.length) ? noticeActions() : undefined,
        });
      } else if (!succeeded && !automatic) {
        const unavailable = insightStatuses.filter((source) => source.status !== "ok" &&
          (!sourceId || source.sourceId === sourceId)).map((source) =>
          refreshSourceName({ ...source, label: sourceLabel(source) })).join(", ");
        const key = sourceId ? "refresh.sourceRetryFailed" : "refresh.allSourcesFailed";
        toast({ title: t("refresh.fidelity.failed"),
          description: unavailable ? t(key).replace("{sources}", unavailable) : t(`${key}Generic`),
          variant: "destructive", tone: "error",
          action: noticeActions() });
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
      if (!automatic) toast({ title: t("refresh.fidelity.failed"), description: t(messageKey), variant: "destructive", tone: "error" });
      trackRefreshEvent({ failed: "true" });
      if (automatic) throw error;
    } finally {
      await invalidateUsageCache();
      refreshInProgress.current = false;
      setRunning(false);
      refreshRetryScheduler.poke();
      setRefreshLoading(false);
      setProgress(0);
      const pendingRetry = pendingRetryRef.current;
      pendingRetryRef.current = null;
      if (pendingRetry) queueMicrotask(() => void runRefreshRef.current(
        lastResultRef.current?.sourceResults ? pendingRetry.sourceId : undefined));
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
    (sourceId) => runRefreshRef.current(sourceId, true),
    () => !refreshLoadingRef.current && !refreshInProgress.current && !preflightPendingRef.current,
  ), []);

  const requestRefresh = async (sourceId?: string) => {
    if (refreshLoading || preflight || preflightPendingRef.current || refreshInProgress.current) return;
    preflightPendingRef.current = true;
    setPreflightPending(true);
    let nearQuota: NearQuota | undefined;
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
          if (usage?.enforced) {
            nearQuota = (["erc20", "tron"] as const).flatMap((resource) => {
              const kind = resource === "tron" ? "trc20" : "erc20";
              const consumed = sourceIds.filter((id) => id.startsWith(`${kind}:`)).length;
              const entry = usage.usage[resource];
              const used = entry.used + consumed;
              return consumed && entry.limit > 0 && used < entry.limit && entry.limit - used <= 2 &&
                Number.isFinite(new Date(entry.periodEnd).getTime())
                ? [{ resource: resource === "erc20" ? "ERC20" as const : "TRON" as const,
                  used, limit: entry.limit, periodEnd: entry.periodEnd }] : [];
            })[0];
          }
        }
      }
    } catch {
      // Usage lookup is advisory. A refresh still runs when it is unavailable.
    } finally {
      preflightPendingRef.current = false;
      setPreflightPending(false);
    }
    await runRefresh(sourceId, false, nearQuota);
  };
  const requestRefreshRef = useRef(requestRefresh);
  requestRefreshRef.current = requestRefresh;
  const canRetrySourceRef = useRef(!!lastResult?.sourceResults);
  canRetrySourceRef.current = !!lastResult?.sourceResults;
  useEffect(() => {
    const onRequest = (event: Event) => {
      const sourceId = (event as CustomEvent<{ sourceId?: string }>).detail?.sourceId;
      void requestRefreshRef.current(canRetrySourceRef.current ? sourceId : undefined);
    };
    window.addEventListener(overviewRefreshRequestedEvent, onRequest);
    return () => window.removeEventListener(overviewRefreshRequestedEvent, onRequest);
  }, []);
  useEffect(() => {
    const listener = () => { void requestRefreshRef.current(); };
    window.addEventListener(FULL_REFRESH_REQUEST_EVENT, listener);
    return () => window.removeEventListener(FULL_REFRESH_REQUEST_EVENT, listener);
  }, []);

  useLayoutEffect(() => {
    if (!overviewFlow || !desktopFlow || !liveTotalVisible || sourceStatuses.length === 0) return;
    const source = sourceTriggerRef.current;
    const live = document.querySelector<HTMLButtonElement>(".t3-desktop-column .t3-live-trigger");
    if (!source || !live) return;
    const place = () => {
      const box = live.getBoundingClientRect();
      source.style.left = `${box.right + 12}px`;
      source.style.top = `${box.top + (box.height - source.offsetHeight) / 2}px`;
      source.dataset.pinned = "";
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(live);
    const sidebar = document.querySelector(".t3-desktop-rail");
    const sidebarObserver = sidebar ? new MutationObserver(place) : undefined;
    if (sidebar) sidebarObserver?.observe(sidebar, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      sidebarObserver?.disconnect();
      window.removeEventListener("resize", place);
      source.style.removeProperty("left");
      source.style.removeProperty("top");
      delete source.dataset.pinned;
    };
  }, [desktopFlow, overviewFlow, liveTotalVisible, sourceStatuses.length]);

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
    refreshSourceName({ ...source, label: sourceLabel(source) });
  const displayHint = (source: PortfolioSourceStatus) =>
    source.kind === "exchange" && source.hint && !source.hint.startsWith("#")
      ? `${t("refresh.hint.apikey")} ${source.hint}` : source.hint;
  const sortedStatuses = sortSourceStatuses(sourceStatuses);
  const failedStatuses = sortedStatuses.filter((source) => source.status === "failed");
  const partialStatuses = sortedStatuses.filter((source) => source.status === "partial");
  const quotaStatuses = sortedStatuses.filter((source) => source.status !== "ok" && source.category === "quota");
  const quota = useRefreshQuota(quotaStatuses[0], refreshLoading || running);
  const nonQuotaIncompleteCount = sortedStatuses.filter((source) => source.status !== "ok" && source.category !== "quota").length;
  const incompleteCount = nonQuotaIncompleteCount + quotaStatuses.length;
  const failedNames = failedStatuses.map(displayIdentity).join(", ");
  const refreshing = refreshLoading || running;
  const currentSources = [...pendingSources, ...liveSources.filter((source) =>
    !pendingSources.some((pending) => pending.sourceId === source.sourceId))];
  const currentNames = sourceDisplayNames(currentSources.map((source) => ({
    id: source.sourceId,
    alias: displayIdentity(sourceStatuses.find((status) => status.sourceId === source.sourceId)
      ?? liveSources.find((result) => result.sourceId === source.sourceId)
      ?? { ...source, status: "ok" }),
  })));
  const startedSources = runningSourceStarts(currentSources, liveSources, refreshStartedAt.current);
  const storedNames = sourceDisplayNames(sourceStatuses.map((source) => ({ id: source.sourceId, alias: displayIdentity(source) })));
  const storedNameById = new Map(sourceStatuses.map((source, index) => [source.sourceId, storedNames[index]]));
  const currentRows = currentSources.map((source, index) => ({
    source, name: currentNames[index], result: liveSources.find((item) => item.sourceId === source.sourceId),
    startedAt: startedSources[source.sourceId],
    previous: sourceStatuses.find((item) => item.sourceId === source.sourceId),
  })).sort((a, b) => {
    const rank = (row: typeof a) => row.result ? row.result.status === "ok" ? 3 : 0 : row.startedAt ? 1 : 2;
    return rank(a) - rank(b);
  });
  const finishedCount = refreshing ? liveSources.length : sourceStatuses.filter((source) => source.status === "ok").length;
  const failedCount = refreshing ? liveSources.filter((source) => source.status === "stale").length
    : sourceStatuses.filter((source) => source.status === "failed" || source.status === "stale").length;
  const currentTotal = refreshing ? currentRows.length : sourceStatuses.length;
  const wideStatusFlow = desktopFlow && overviewFlow && (refreshing || hasFailure || !!lastResult);
  const nextRetryAt = Math.min(...Object.values(retrySchedule.nextBySource));
  const retryStatus = Number.isFinite(nextRetryAt)
    ? t("refresh.autoRetry.next").replace("{time}", new Date(nextRetryAt).toLocaleTimeString(
      locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false }))
    : retrySchedule.stopped ? t("refresh.autoRetry.stopped") : "";
  const kindIcon = { exchange: GlobeIcon, wallet: CubeIcon, broker: BackpackIcon, others: ArchiveIcon };
  const statusStyle = {
    ok: "t3-tag t3-refresh-status-pill",
    stale: "t3-tag t3-refresh-status-pill",
    partial: "t3-tag t3-refresh-status-pill",
    failed: "t3-tag t3-refresh-status-pill",
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
      {refreshing && currentTotal > 0 && wideStatusFlow
        ? <Button variant="outline" className="t3-refresh-progress-pill" onClick={openStatus}
          aria-label={currentTotal > 0 ? t("refresh.fidelity.refreshingCount").replace("{count}", String(finishedCount)).replace("{total}", String(currentTotal))
            : t("refresh.fidelity.refreshingSources")}>
          <ReloadIcon aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
          {currentTotal > 0 ? t("refresh.fidelity.refreshingCount").replace("{count}", String(finishedCount)).replace("{total}", String(currentTotal))
            : t("refresh.fidelity.refreshingSources")}
        </Button>
        : <Button variant="outline" className="t3-refresh-button" aria-label={t("common.refresh")} onClick={() => requestRefresh()} disabled={refreshLoading || preflightPending}>
          {fidelity ? <svg aria-hidden="true" className={`h-[14px] w-[14px] ${refreshLoading || preflightPending ? "animate-spin motion-reduce:animate-none" : ""}`} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 9a5.5 5.5 0 1 1-1.6-3.9M14.5 3v3h-3" /></svg>
            : overviewFlow ? <ReloadIcon aria-hidden="true" className={`mr-2 h-4 w-4 ${preflightPending ? "animate-spin motion-reduce:animate-none" : ""}`} />
              : <UpdateIcon aria-hidden="true" className={`mr-2 h-4 w-4 ${refreshLoading || preflightPending ? "animate-spin motion-reduce:animate-none" : ""}`} />}
          <p className="hidden sm:inline-block">{t("common.refresh")}</p>
        </Button>}
      {(sourceStatuses.length > 0 || refreshing) && (
        <Button
          ref={sourceTriggerRef}
          variant="outline"
          size="sm"
          className="t3-refresh-source-trigger"
          data-refreshed={lastResult ? "" : undefined}
          aria-label={t("refresh.sourceStatus")}
          title={failedCount ? t("refresh.fidelity.failedCount").replace("{count}", String(failedCount)) : t("refresh.sourceStatus")}
          data-tone={refreshing ? failedCount ? "err" : "ok" : hasFailure ? "err" : hasPartial ? "warn" : "ok"}
          onClick={openStatus}
          disabled={preflightPending}
        >
          {(hasFailure || !hasPartial) && <InfoCircledIcon aria-hidden="true" data-icon="source-info" className="t3-refresh-source-icon mr-1.5 h-3.5 w-3.5" />}
          {!hasFailure && hasPartial && <ExclamationTriangleIcon aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
          <span className="t3-refresh-source-default">{t("refresh.sourceStatus")}</span>
          {failedCount > 0 && <span className="t3-refresh-failed-count">{failedCount}</span>}
          <span className="t3-refresh-source-summary">{t("refresh.fidelity.sourceCountAt")
            .replace("{count}", String(finishedCount)).replace("{total}", String(currentTotal))
            .replace("{time}", new Date(sourceStatuses.map((source) => source.finishedAt).filter(Boolean).sort().at(-1) ?? Date.now())
              .toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }))}</span>
        </Button>
      )}
      <AlertDialog open={!!preflight} onOpenChange={(open) => { if (!open) setPreflight(null); }}>
        <AlertDialogContent overlayProps={{ className: "t3-refresh-overlay" }} className="t3-refresh-popover sm:max-w-md">
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
        if (!open) {
          setStatusDialogOpen(false);
          setShowLastKnownOffer(false);
        }
      }}>
        <AlertDialogContent overlayProps={{ className: "t3-refresh-overlay", onPointerDown: () => setStatusDialogOpen(false) }}
          className="t3-refresh-popover t3-refresh-status-popover sm:max-w-md" style={statusPosition}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(wideStatusFlow
              ? refreshing ? "refresh.fidelity.refreshingSources" : "refresh.fidelity.finished"
              : "refresh.sourceStatus")}</AlertDialogTitle>
            <AlertDialogDescription>
              {wideStatusFlow ? t(refreshing ? "refresh.fidelity.progressSummary"
                  : quotaStatuses.length ? nonQuotaIncompleteCount ? "refresh.fidelity.finishedMixedSummary"
                    : "refresh.fidelity.finishedQuotaSummary" : "refresh.fidelity.finishedSummary")
                .replace("{count}", String(finishedCount)).replace("{total}", String(currentTotal))
                .replace("{failed}", String(refreshing ? failedCount : incompleteCount))
                .replace("{quota}", String(quotaStatuses.length))
                : refreshing ? t("refresh.inProgress") : partialStatuses.length
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
            {retryStatus && <p className="text-xs text-muted-foreground">{retryStatus}</p>}
          </AlertDialogHeader>
          {wideStatusFlow || refreshing ? <div className="t3-refresh-flow-list" role="status" aria-live="polite" aria-busy={refreshing}>
            {(refreshing ? currentRows : sortedStatuses.map((source) => ({
              source, name: storedNameById.get(source.sourceId) ?? sourceLabel(source),
              result: source, previous: undefined, startedAt: undefined,
            }))).map(({ source, name, result, previous, startedAt }) => <div key={source.sourceId} data-source-status-row className="t3-refresh-flow-row" role="group" aria-label={name}>
              <i aria-hidden="true">{name.slice(0, 2)}</i>
              <div><strong>{name}</strong><small className={`tabular-nums ${result?.category === "quota" ? "quota" : result && result.status !== "ok" ? "failed" : ""}`}>
                {!result ? <><ReloadIcon aria-hidden="true" className="inline-block h-3 w-3 animate-spin motion-reduce:animate-none" />{" "}
                  {startedAt ? t("refresh.fidelity.refreshingElapsed").replace("{seconds}",
                    Math.max(0, (now - Date.parse(startedAt)) / 1000).toFixed(0)) : t("refresh.fidelity.waiting")}
                  {previous?.startedAt && previous.finishedAt && <> · {t("refresh.fidelity.lastDuration").replace("{seconds}",
                    ((Date.parse(previous.finishedAt) - Date.parse(previous.startedAt)) / 1000).toFixed(1))}</>}</>
                  : result.status === "ok"
                  ? <><CheckIcon aria-hidden="true" className="inline-block h-3 w-3" />{" "}
                    {result.startedAt && result.finishedAt
                      ? t("refresh.fidelity.doneIn").replace("{seconds}", Math.max(0,
                        (Date.parse(result.finishedAt) - Date.parse(result.startedAt)) / 1000).toFixed(1))
                      : t("refresh.fidelity.done")}</>
                  : result.category === "quota" ? quota && source.sourceId === quota.sourceId
                    ? t("refresh.fidelity.quotaPanelDetail").replace("{used}", String(quota.used))
                      .replace("{limit}", String(quota.limit)).replace("{resource}", quota.resource)
                      .replace("{date}", quota.date)
                    : t("refresh.fidelity.quotaReached")
                  : <><ExclamationTriangleIcon aria-hidden="true" className="inline-block h-3 w-3" />{" "}
                    {result.detail && detailKey[result.detail] ? t(detailKey[result.detail])
                      : t(`refresh.reason.${result.category ?? "other"}`)}</>}
              </small></div>
              {result?.category === "quota" && !refreshing && <button type="button" onClick={() => {
                window.location.hash = "#/settings/systemInfo";
              }}>{t("refresh.fidelity.managePlan")}</button>}
              {result && result.status !== "ok" && result.category !== "quota" &&
                <button type="button" onClick={() => {
                  setStatusDialogOpen(false);
                  if (refreshInProgress.current) pendingRetryRef.current = { sourceId: source.sourceId };
                  else void requestRefresh(lastResult?.sourceResults ? source.sourceId : undefined);
                }}>
                  {t("refresh.retryButton")}
                </button>}
            </div>)}
          </div> : <div className="t3-refresh-status-list my-2 max-h-80 overflow-y-auto" role="status" aria-live="polite" aria-busy={false}>
            {sortedStatuses.map((source) => {
              const Icon = kindIcon[source.kind ?? "others"];
              const StatusIcon = statusIcon[source.status];
              return (
              <div key={source.sourceId} role="group" aria-label={storedNameById.get(source.sourceId) ?? displayIdentity(source)}
                data-source-status-row className="t3-refresh-source-row flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold break-all">{storedNameById.get(source.sourceId) ?? displayIdentity(source)}</div>
                  {source.provider && <div className="text-xs text-muted-foreground">
                    <Icon aria-hidden="true" className="mr-1 inline-block h-3.5 w-3.5" />
                    {source.provider}{source.hint && ` · ${displayHint(source)}`}
                  </div>}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span data-tone={source.status === "ok" ? "positive" : source.status === "failed" ? "negative" : "warning"} className={`inline-flex items-center gap-1 font-medium ${statusStyle[source.status]}`}>
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
                {source.status !== "ok" && source.category !== "quota" && lastResult?.sourceResults && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={refreshLoading || preflightPending}
                    aria-label={t("refresh.retrySource").replace("{source}", storedNameById.get(source.sourceId) ?? displayIdentity(source))}
                    onClick={() => requestRefresh(source.sourceId)}
                  >
                    {t("refresh.retryButton")}
                  </Button>
                )}
              </div>
            ); })}
          </div>}
          {showLastKnownOffer && !refreshing && <div className="t3-refresh-last-known-offer rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <p>{t("refresh.lastKnownSaved")}</p>
            <Button variant="outline" size="sm" onClick={() => {
              window.dispatchEvent(new Event(overviewUseLastKnownEvent));
              setShowLastKnownOffer(false);
              setStatusDialogOpen(false);
            }}>{t("refresh.useLastKnown")}</Button>
          </div>}
          {wideStatusFlow && <div className="t3-refresh-flow-footer">
            <span>{refreshing ? t("refresh.fidelity.parallel") : t("refresh.fidelity.finishedAt")
              .replace("{time}", new Date().toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-GB", {
                hour: "2-digit", minute: "2-digit", hour12: false,
              }))}</span>
            {refreshing ? <AlertDialogCancel>{t("update.fidelity.hide")}</AlertDialogCancel>
              : hasFailure && !sourceStatuses.some((source) =>
                (source.status === "failed" || source.status === "stale") && source.category !== "quota")
                ? <AlertDialogCancel>{t("refresh.close")}</AlertDialogCancel>
                : hasFailure ? <button type="button" onClick={() => {
                  setStatusDialogOpen(false);
                  const retryable = sourceStatuses.filter((source) =>
                    (source.status === "failed" || source.status === "stale") && source.category !== "quota");
                  void requestRefresh(retryable.length === 1 ? retryable[0].sourceId : undefined);
                }}>
                {t("refresh.fidelity.retryFailed")}
              </button> : <AlertDialogCancel>{t("refresh.close")}</AlertDialogCancel>}
          </div>}
          {!wideStatusFlow && <AlertDialogFooter>
            {retrySchedule.stopped && hasFailure && <Button variant="outline"
              disabled={refreshLoading || preflightPending} onClick={() => requestRefresh()}>{t("refresh.autoRetry.fullRefresh")}</Button>}
            {!retrySchedule.stopped && failedStatuses.some((source) => source.category !== "quota") && <Button variant="outline"
              disabled={refreshLoading || preflightPending} onClick={() => requestRefresh()}>{t("refresh.retryAllFailed")}</Button>}
            <AlertDialogCancel>{t("refresh.close")}</AlertDialogCancel>
          </AlertDialogFooter>}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default App;
