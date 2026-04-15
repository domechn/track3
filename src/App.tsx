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
  const focusMainContent = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      document.getElementById("app-main-content")?.focus();
    },
    []
  );

  return (
    <ThemeProvider defaultTheme="light" storageKey={themeLocalStorageKey}>
      <div className="bg-gradient-to-br from-background via-background to-accent/20 min-h-screen" onContextMenu={renderRightClickMenu}>
        <a
          href="#app-main-content"
          onClick={focusMainContent}
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>
        <Toaster />
        <AutoUpdater />
        <div id="app-main-content" tabIndex={-1}>
          <ChartResizeContext.Provider value={{ needResize, setNeedResize }}>
            <IndexApp />
          </ChartResizeContext.Provider>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
