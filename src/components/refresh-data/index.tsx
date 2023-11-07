import "./index.css";
import { useContext, useState } from "react";
import { refreshAllData } from "../../middlelayers/charts";
import { toast } from "react-hot-toast";
import { LoadingContext } from "../../App";
import { updateAllCurrencyRates } from "../../middlelayers/currency";
import { trackEventWithClientID } from "../../utils/app";
import { Button } from "../ui/button";
import { ReloadIcon } from "@radix-ui/react-icons";

const retries = 3;
const retryInterval = 3000; // 3s

const App = ({
  afterRefresh,
}: {
  afterRefresh?: (success: boolean) => unknown;
}) => {
  const [refreshLoading, setRefreshLoading] = useState(false);

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
      toast.error(
        `${(error as Error).message || error}, Retrying... ${
          retries - times + 1
        }`
      );
      return retry(fn, times - 1, interval);
    }
  };

  const handleButtonClick = () => {
    setRefreshLoading(true);
    let refreshError: Error | undefined;

    retry(refreshAllData, retries, retryInterval)
      .then(async () => updateAllCurrencyRates())
      .catch((err) => {
        refreshError = err;
      })
      .finally(() => {
        setRefreshLoading(false);
        trackEventWithClientID("data_refreshed");
        if (refreshError) {
          toast.error(refreshError.message || (refreshError as any));
        } else {
          toast.success("Refresh successfully!");
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
        Refresh
      </Button>
    </div>
  );
};

export default App;
