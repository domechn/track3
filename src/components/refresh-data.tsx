import { useContext } from "react";
import { refreshAllData } from "../middlelayers/charts";
import { trackEventWithClientID } from "../utils/app";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "./ui/button";
import { ReloadIcon } from "@radix-ui/react-icons";
import { RefreshButtonLoadingContext } from "./index/index";
import { CacheCenter } from "@/middlelayers/datafetch/utils/cache";
import { updateAllCurrencyRates } from "@/middlelayers/configuration";

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

  const {
    setButtonLoading: setRefreshLoading,
    setProgress: setRefreshProgress,
  } = useContext(RefreshButtonLoadingContext);

  const retry = async (
    fn: () => Promise<unknown>,
    times: number,
    interval: number
  ): Promise<unknown> => {
    try {
      const res = await fn();
      return res;
    } catch (error) {
      if (times === 0) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
      toast({
        description: `${(error as Error).message || error}, Retrying... ${
          retries - times + 1
        }`,
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

  const handleButtonClick = () => {
    setRefreshLoading(true);

    let refreshError: Error | undefined;

    retry(
      () => {
        clearProgress();
        return refreshAllData(addProgress);
      },
      retries,
      retryInterval
    )
      .then(async () => {
        // clean cache after all analyzers finished successfully
        CacheCenter.getInstance().clearCache();
        return updateAllCurrencyRates();
      })
      .catch((err) => {
        refreshError = err;
      })
      .finally(() => {
        setRefreshLoading(false);
        clearProgress();
        trackEventWithClientID("data_refreshed");
        if (refreshError) {
          toast({
            description: refreshError.message || (refreshError as any),
            variant: "destructive",
          });
        } else {
          toast({
            description: "Refresh successfully!",
          });
        }

        if (afterRefresh) {
          afterRefresh(!refreshError);
        }
      });
  };

  return (
    <div>
      <Button onClick={handleButtonClick} disabled={refreshLoading}>
        {/*  animate-spin */}
        <ReloadIcon
          className={`mr-2 h-4 w-4 ${refreshLoading && "animate-spin"}`}
        />
        <p className="hidden sm:inline-block">Refresh</p>
      </Button>
    </div>
  );
};

export default App;
