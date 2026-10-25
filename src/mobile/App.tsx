import "./ios-style.css";
import IndexApp from "@/mobile/components/index";
import { Toaster } from "@/mobile/components/ui/toaster";
import React from "react";
import { ThemeProvider } from "@/mobile/components/common/theme";
import { themeLocalStorageKey } from "@/middlelayers/configuration";
import { I18nProvider, useTranslation } from "@/mobile/i18n";
import { isIOS, PlatformProvider } from "@/utils/platform";
import IOSKeyRecoveryNotice from "@/mobile/components/ios-key-recovery-notice";
import AppErrorBoundary from "@/mobile/components/app-error-boundary";
import IOSStartupGate from "@/mobile/components/ios-startup-gate";

export const ChartResizeContext = React.createContext<{
  needResize: number;
  setNeedResize: React.Dispatch<React.SetStateAction<number>>;
}>(null as any);

function Shell() {
  const { t } = useTranslation();
  const [needResize, setNeedResize] = React.useState(0);
  const focusMainContent = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      document.getElementById("app-main-content")?.focus({ preventScroll: true });
    },
    [],
  );

  return (
    <ThemeProvider defaultTheme={isIOS() ? "system" : "light"} storageKey={themeLocalStorageKey}>
      <div className="min-h-dvh">
        <a
          href="#app-main-content"
          onClick={focusMainContent}
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {t("app.skipToMainContent")}
        </a>
        <Toaster />
        <IOSStartupGate>
          <IOSKeyRecoveryNotice />
          <div>
            <ChartResizeContext.Provider value={{ needResize, setNeedResize }}>
              <IndexApp />
            </ChartResizeContext.Provider>
          </div>
        </IOSStartupGate>
      </div>
    </ThemeProvider>
  );
}

function App() {
  return (
    <I18nProvider>
      <AppErrorBoundary>
        <PlatformProvider>
          <Shell />
        </PlatformProvider>
      </AppErrorBoundary>
    </I18nProvider>
  );
}

export default App;
