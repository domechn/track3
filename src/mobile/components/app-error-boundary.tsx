import React from "react";
import { useTranslation } from "@/mobile/i18n";
import { reportIOSFrontendError } from "@/utils/ios-ready";

function ErrorFallback() {
  const { t } = useTranslation();
  return (
    <main role="alert" className="min-h-dvh ios-safe-area flex items-center justify-center p-6 text-center">
      <p>{t("app.loadFailed")}</p>
    </main>
  );
}

export default class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    void reportIOSFrontendError(`${error.message}\n${error.stack ?? ""}`);
  }

  render() {
    return this.state.hasError ? <ErrorFallback /> : this.props.children;
  }
}
