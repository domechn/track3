import "./index.css";
import refreshIcon from "../../assets/icons/refresh-icon.png";
import { useContext } from "react";
import { refreshAllData } from "../../middlelayers/charts";
import { toast } from "react-hot-toast";
import { LoadingContext } from "../../App";
import { updateAllCurrencyRates } from "../../middlelayers/currency";
import { trackEvent } from '@aptabase/tauri'

const retries = 3;
const retryInterval = 3000; // 3s

const App = ({
  afterRefresh,
}: {
  afterRefresh?: (success: boolean) => unknown;
}) => {
  const { setLoading } = useContext(LoadingContext);

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
    setLoading(true);

    let refreshError: Error | undefined;

    retry(refreshAllData, retries, retryInterval)
      .then(async () => updateAllCurrencyRates())
      .catch((err) => {
        refreshError = err;
      })
      .finally(() => {
        setLoading(false);
        trackEvent("data_refreshed")
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
      <button className="refresh-button" onClick={handleButtonClick}>
        <img
          src={refreshIcon}
          alt="refresh"
          style={{
            border: 0,
            height: 30,
            width: 30,
          }}
        />
      </button>
    </div>
  );
};

export default App;
