import IndexApp from "./components/index";
import AutoUpdater from "./components/common/auto-updater";
import "./App.css";
import { Toaster } from "react-hot-toast";

function App() {

  return (
    <div className="container">
      <Toaster />
      <AutoUpdater />
      <IndexApp />
    </div>
  );
}

export default App;
