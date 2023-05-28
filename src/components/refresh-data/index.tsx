import "./index.css";
import refreshIcon from "../../assets/icons/refresh-icon.png";
import { useContext } from "react";
import { refreshAllData } from "../../middlelayers/charts";
import { toast } from "react-hot-toast";
import { LoadingContext } from '../../App'

const App = ({afterRefresh}:{
  afterRefresh?: (success:boolean) => unknown
}) => {
  const {setLoading} = useContext(LoadingContext);

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
