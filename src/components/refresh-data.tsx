import { useContext } from "react";
import { refreshAllData } from "../middlelayers/charts";
import { trackEventWithClientID } from "../utils/app";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "./ui/button";
import { UpdateIcon } from "@radix-ui/react-icons";
import { RefreshButtonLoadingContext } from "./index/index";
import { getMemoryCacheInstance } from "@/middlelayers/datafetch/utils/cache";
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
      async () => {
        clearProgress();
        return refreshAllData(addProgress);
      },
      retries,
      retryInterval
    )
      .then(async () => {
        // clean cache after all analyzers finished successfully
        getMemoryCacheInstance("data-fetch").clearCache();
        return updateAllCurrencyRates();
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
        } else {
          toast({
            description: "Refresh successfully!",
          });
        }
        trackEventWithClientID("data_refreshed", trackProps);

        if (afterRefresh) {
          afterRefresh(!refreshError);
        }
      });
  };

  return (
    <div>
      <Button variant="ghost" onClick={handleButtonClick} disabled={refreshLoading}>
        <UpdateIcon
          className={`mr-2 h-4 w-4 ${refreshLoading && "animate-spin"}`}
        />
        <p className="hidden sm:inline-block">Refresh</p>
      </Button>
    </div>
  );
};

export default App;
