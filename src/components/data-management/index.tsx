import { toast } from "react-hot-toast";
import {
  exportHistoricalData,
  importHistoricalData,
} from "../../middlelayers/data";
import "./index.css";

const App = ({ onDataImported }: { onDataImported?: () => void }) => {
  async function onExportDataClick() {
    await exportHistoricalData();
    toast.success("export data successfully");
  }

  async function onImportDataClick() {
    return importHistoricalData()
      .then(() => {
        toast.success("import data successfully");

        onDataImported && onDataImported();
      })
      .catch((err) => {
        toast.error(err.message || err);
      });
  }

  return (
    <div className="dataManagement">
      <h2>Data Center</h2>
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
