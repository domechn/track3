import IndexApp from "./components/index";
import AutoUpdater from "./components/common/auto-updater";
import "./App.css";
import { Toaster } from "react-hot-toast";
import Loading from "./components/common/loading";
import { useState } from "react";
import React from "react";

export const LoadingContext = React.createContext<{
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}>(null as any);

function App() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="container">
      <Toaster />
      <Loading loading={loading} />
      <AutoUpdater />
      <LoadingContext.Provider value={{ loading, setLoading }}>
        <IndexApp />
      </LoadingContext.Provider>
    </div>
  );
}

export default App;
