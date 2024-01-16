import IndexApp from "@/components/index";
import AutoUpdater from "@/components/auto-updater";
import { Toaster } from "@/components/ui/toaster";
import React from "react";
import { QueryClientProvider } from "react-query";
import { UICacheCenter } from './utils/cache'

export const ChartResizeContext = React.createContext<{
  needResize: number;
  setNeedResize: React.Dispatch<React.SetStateAction<number>>;
}>(null as any);

function App() {
  const [needResize, setNeedResize] = React.useState(0);

  return (
    <div className="container">
      <Toaster />
      <AutoUpdater />
      <ChartResizeContext.Provider value={{ needResize, setNeedResize }}>
        <QueryClientProvider client={UICacheCenter.getQueryClient()}>
          <IndexApp />
        </QueryClientProvider>
      </ChartResizeContext.Provider>
    </div>
  );
}

export default App;
