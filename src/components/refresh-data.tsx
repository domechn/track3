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
import { UpdateIcon } from "@radix-ui/react-icons";
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

const retries = 3;
const retryInterval = 3000;
const sourceStatusStorageKey = "track3-refresh-source-statuses";

function readStoredStatuses(): PortfolioSourceStatus[] {
  try {
    const value = JSON.parse(localStorage.getItem(sourceStatusStorageKey) ?? "[]");
    return Array.isArray(value)
      ? value.filter((source): source is PortfolioSourceStatus =>
          source &&
          typeof source.sourceId === "string" &&
          typeof source.label === "string" &&
          ["ok", "stale", "failed"].includes(source.status) &&
          (source.category === undefined ||
            ["auth", "network", "rateLimit", "unsupported", "other"].includes(source.category)),
        )
      : [];
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
  const { t } = useTranslation();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [sourceStatuses, setSourceStatuses] = useState(readStoredStatuses);
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
    setRefreshLoading(true);
    const operation: RefreshOperation = { operationUuid: uuidv4() };
    let succeeded = false;
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
            }
          : {},
        operation,
        (attempt) => retry(attempt, retries, retryInterval),
      );
      succeeded = result.persisted !== false && !result.requiresDataSourceAction;
      if (succeeded) {
        getMemoryCacheInstance("data-fetch").clearCache();
      }
      if (result.sourceStatuses) {
        setSourceStatuses(result.sourceStatuses);
        try {
          localStorage.setItem(sourceStatusStorageKey, JSON.stringify(result.sourceStatuses));
        } catch {
          // The current session still shows the warning when storage is unavailable.
        }
        setStatusDialogOpen(result.sourceStatuses.some((source) => source.status !== "ok"));
      }
      setLastResult(result);
      if (succeeded) {
        const incomplete = result.sourceStatuses?.some((source) => source.status === "failed");
        toast({ description: incomplete
          ? t("refresh.incomplete")
          : result.usedLastKnownData
            ? t("refresh.partial")
            : t("refresh.success") });
      } else {
        toast({ description: t(sourceId ? "refresh.sourceRetryFailed" : "refresh.allSourcesFailed"), variant: "destructive" });
      }
      trackEventWithClientID("data_refreshed", {
        failedSources: result.sourceStatuses?.filter((source) => source.status !== "ok").map((source) => source.sourceId).join(",") ?? "",
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
    }
  };

  const hasWarning = sourceStatuses.some((source) => source.status !== "ok");
  const sourceLabel = (source: PortfolioSourceStatus) => {
    const wallet = /^(erc20|sol|btc|doge|trc20|ton|sui):(\d+)$/.exec(source.sourceId);
    if (wallet && source.label.toLowerCase() === `${wallet[1]} wallet ${Number(wallet[2]) + 1}`) {
      return t("refresh.walletSource")
        .replace("{chain}", wallet[1].toUpperCase())
        .replace("{number}", String(Number(wallet[2]) + 1));
    }
    return source.sourceId === "others" ? t("refresh.othersSource") : source.label;
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => runRefresh()} disabled={refreshLoading}>
        <UpdateIcon className={`mr-2 h-4 w-4 ${refreshLoading ? "animate-spin" : ""}`} />
        <p className="hidden sm:inline-block">{t("common.refresh")}</p>
      </Button>
      {sourceStatuses.length > 0 && (
        <Button
          variant={hasWarning ? "destructive" : "outline"}
          size="sm"
          onClick={() => setStatusDialogOpen(true)}
          disabled={refreshLoading}
        >
          {t("refresh.sourceStatus")}
        </Button>
      )}
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("refresh.sourceStatus")}</AlertDialogTitle>
            <AlertDialogDescription>
              {sourceStatuses.some((source) => source.status === "failed")
                ? t("refresh.incomplete")
                : sourceStatuses.some((source) => source.status === "stale")
                  ? t("refresh.staleWarning")
                  : t("refresh.allCurrent")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-2 max-h-80 space-y-2 overflow-y-auto">
            {sourceStatuses.map((source) => (
              <div key={source.sourceId} className="flex items-center justify-between gap-3 rounded-md border px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold break-all">{sourceLabel(source)}</div>
                  <div className="text-sm text-muted-foreground">
                    {t(`refresh.status.${source.status}`)}
                    {source.status !== "ok" && ` · ${t(`refresh.reason.${source.category ?? "other"}`)}`}
                  </div>
                </div>
                {source.status !== "ok" && lastResult?.sourceResults && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={refreshLoading}
                    aria-label={t("refresh.retrySource").replace("{source}", sourceLabel(source))}
                    onClick={() => runRefresh(source.sourceId)}
                  >
                    {t("refresh.retryButton")}
                  </Button>
                )}
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("refresh.close")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default App;
