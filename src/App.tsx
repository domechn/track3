import IndexApp from "@/components/index";
import AutoUpdater from "@/components/auto-updater";
import { Toaster } from "@/components/ui/toaster";
import React from "react";
import { ThemeProvider } from "@/components/common/theme";
import { themeLocalStorageKey } from "./middlelayers/configuration";
import { renderRightClickMenu } from './utils/hook'

export const ChartResizeContext = React.createContext<{
  needResize: number;
  setNeedResize: React.Dispatch<React.SetStateAction<number>>;
}>(null as any);

function App() {
  const [needResize, setNeedResize] = React.useState(0);

  return (
    <div className="bg-gradient-to-br from-background via-background to-accent/20 min-h-screen" onContextMenu={renderRightClickMenu}>
      <Toaster />
      <AutoUpdater />
      <ThemeProvider defaultTheme="light" storageKey={themeLocalStorageKey}>
        <ChartResizeContext.Provider value={{ needResize, setNeedResize }}>
          <IndexApp />
        </ChartResizeContext.Provider>
      </ThemeProvider>
    </div>
  );
}

export default App;
