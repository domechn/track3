import { useContext, useState } from "react";
import {
  refreshAllData,
  type FailedPortfolioSource,
  type RefreshAllDataResult,
} from "../middlelayers/charts";
import { trackEventWithClientID } from "../utils/app";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "./ui/button";
import { UpdateIcon } from "@radix-ui/react-icons";
import { RefreshButtonLoadingContext } from "./index/index";
import { getMemoryCacheInstance } from "@/middlelayers/datafetch/utils/cache";
import { updateAllCurrencyRates } from "@/middlelayers/configuration";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { useTranslation } from "@/i18n";

const retries = 3;
const retryInterval = 3000; // 3s

const App = ({
  loading: refreshLoading,
  afterRefresh,
}: {
  loading: boolean;
  afterRefresh?: (success: boolean) => unknown;
}) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [failureDialogOpen, setFailureDialogOpen] = useState(false);
  const [failedSources, setFailedSources] = useState<FailedPortfolioSource[]>(
    [],
  );

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
      const res = await fn();
      return res;
    } catch (error) {
      if (times === 0) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
      toast({
        description: t("refresh.retrying", {
          message: (error as Error).message || String(error),
          count: retries - times + 1,
        }),
      });
      return retry(fn, times - 1, interval);
    }
  };

  function addProgress(p: number) {
    setRefreshProgress((preP: number) => Math.min(preP + p, 100));
  }

  function clearProgress() {
    setRefreshProgress(0);
  }

  const runRefresh = (useLastKnownDataForFailedSources = false) => {
    setRefreshLoading(true);
    setFailureDialogOpen(false);

    let refreshError: Error | undefined;
    let refreshResult: RefreshAllDataResult | undefined;

    updateAllCurrencyRates()
      .catch(() => {
        // non-fatal: proceed with refresh even if rate update fails
      })
      .then(() =>
        retry(
          async () => {
            clearProgress();
            return refreshAllData(addProgress, {
              useLastKnownDataForFailedSources,
            });
          },
          retries,
          retryInterval,
        ),
      )
      .then((result) => {
        refreshResult = result;
        if (!result.requiresDataSourceAction) {
          getMemoryCacheInstance("data-fetch").clearCache();
        }
      })
      .catch((err) => {
        refreshError = err;
      })
      .finally(() => {
        setRefreshLoading(false);
        clearProgress();
        let trackProps = {};
        if (refreshError) {
          const description = refreshError.message;
          toast({
            description,
            variant: "destructive",
          });
          trackProps = {
            errorMessage: description,
          };
        } else if (refreshResult?.requiresDataSourceAction) {
          setFailedSources(refreshResult.failedSources);
          setFailureDialogOpen(true);
          trackProps = {
            failedSources: refreshResult.failedSources
              .map((source) => source.analyzerName)
              .join(","),
          };
        } else {
          toast({
            description: refreshResult?.usedLastKnownData
              ? t("refresh.partialSuccess")
              : t("refresh.success"),
          });
        }
        trackEventWithClientID("data_refreshed", trackProps);

        if (afterRefresh) {
          afterRefresh(
            !refreshError && !refreshResult?.requiresDataSourceAction,
          );
        }
      });
  };

  const handleButtonClick = () => {
    runRefresh(false);
  };

  return (
    <div>
      <Button
        variant="outline"
        onClick={handleButtonClick}
        disabled={refreshLoading}
      >
        <UpdateIcon
          className={`mr-2 h-4 w-4 ${refreshLoading && "animate-spin"}`}
        />
        <p className="hidden sm:inline-block">{t("refresh.button")}</p>
      </Button>
      <AlertDialog open={failureDialogOpen} onOpenChange={setFailureDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("refresh.failureTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("refresh.failureDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-2 space-y-3">
            {failedSources.map((source) => (
              <div
                key={source.analyzerName}
                className="rounded-md border px-4 py-3"
              >
                <div className="text-sm font-semibold">
                  {source.analyzerName}
                </div>
                <div className="mt-1 text-sm text-muted-foreground break-all leading-relaxed">
                  {source.error}
                </div>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => runRefresh(true)}
              className="gap-1"
            >
              {t("refresh.useLast")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => runRefresh(false)}
              className="gap-1"
            >
              {t("refresh.retryAll")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default App;
