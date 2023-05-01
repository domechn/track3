import "./index.css";
import refreshIcon from "./refresh-icon.png";
import Loading from "../common/loading";
import { useState } from "react";
import { refreshAllData } from "../../middlelayers/charts";
import { Toaster, toast } from "react-hot-toast";

const App = ({afterRefresh}:{
  afterRefresh?: (success:boolean) => unknown
}) => {
  const [loading, setLoading] = useState(false);

  const handleButtonClick = () => {
    setLoading(true);

    let refreshError: Error | undefined;
    refreshAllData()
      .catch((err) => {
        refreshError = err;
      })
      .finally(() => {
        setLoading(false);
        if (refreshError) {
          toast.error(refreshError.message);
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
      <Loading loading={loading} />
      <Toaster />
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
