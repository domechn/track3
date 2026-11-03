import React, { useEffect, useState } from "react";
import { CopyIcon, ExclamationTriangleIcon, ReloadIcon } from "@radix-ui/react-icons";
import { useTranslation } from "@/mobile/i18n";
import { reportIOSFrontendError } from "@/utils/ios-ready";
import { redactSecrets } from "@/middlelayers/security/redact";
import { getVersion } from "@/utils/app";
import "@/mobile/components/mobile/fidelity.css";

function ErrorFallback({ details, occurredAt }: { details: string; occurredAt: string }) {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => { void getVersion().then(setVersion).catch(() => {}); }, []);
  const copy = () => void navigator.clipboard?.writeText([details, version && `Track3 ${version}`, occurredAt].filter(Boolean).join("\n"));
  return (
    <main role="alert" className="fd-app-error">
      <div className="fd-app-error-content">
        <ExclamationTriangleIcon className="fd-app-error-icon" aria-hidden="true" />
        <h1>{t("fidelity.startup.errorTitle")}</h1>
        <p>{t("fidelity.startup.errorDescription")}</p>
        <div className="fd-app-error-details"><span>{t("fidelity.startup.errorDetails")}</span><pre>{details}</pre>
          <div className="fd-app-error-meta">{version && <span>Track3 {version}</span>}<time>{occurredAt}</time></div></div>
        <button type="button" className="fd-app-error-reload" onClick={() => window.location.reload()}><ReloadIcon aria-hidden="true" />{t("fidelity.startup.reload")}</button>
        <button type="button" className="fd-app-error-copy" onClick={copy}><CopyIcon aria-hidden="true" />{t("fidelity.startup.copyDetails")}</button>
        <small>{t("fidelity.startup.errorHint")}</small>
      </div>
    </main>
  );
}

export default class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { details: string | null; occurredAt: string | null }
> {
  state = { details: null, occurredAt: null };

  static getDerivedStateFromError(error: Error) {
    return { details: redactSecrets(error.stack ?? `${error.name}: ${error.message}`).slice(0, 4000),
      occurredAt: new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC") };
  }

  componentDidCatch(error: Error) {
    void reportIOSFrontendError(redactSecrets(`${error.message}\n${error.stack ?? ""}`));
  }

  render() {
    return this.state.details && this.state.occurredAt
      ? <ErrorFallback details={this.state.details} occurredAt={this.state.occurredAt} /> : this.props.children;
  }
}
