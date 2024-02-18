import IndexApp from "@/components/index";
import AutoUpdater from "@/components/auto-updater";
import { Toaster } from "@/components/ui/toaster";
import React from "react";
import { ThemeProvider } from '@/components/common/theme'
import { themeLocalStorageKey } from './middlelayers/configuration'

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
      <ThemeProvider defaultTheme="dark" storageKey={themeLocalStorageKey}>
        <ChartResizeContext.Provider value={{ needResize, setNeedResize }}>
          <IndexApp />
        </ChartResizeContext.Provider>
      </ThemeProvider>
    </div>
  );
}

export default App;
