import { toast } from "react-hot-toast";
import {
  exportHistoricalData,
  importHistoricalData,
} from "../../middlelayers/data";
import "./index.css";

const App = () => {
  async function onExportDataClick() {
    await exportHistoricalData();
  }

  async function onImportDataClick() {
    return importHistoricalData().catch((err) => {
      toast.error(err.message || err);
    });
  }

  return (
    <div className="dataManagement">
      <h2>Historical Data</h2>
      <div>
        <button onClick={onImportDataClick}>import data</button>
      </div>

      <div>
        <button onClick={onExportDataClick}>export data</button>
      </div>
    </div>
  );
};

export default App;
