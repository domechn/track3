import React, { useEffect, useState } from "react";
import { useTranslation } from "@/i18n";
import { redactSecrets } from "@/middlelayers/security/redact";
import { reloadApp } from "@/utils/app";
import { getDatabase } from "@/middlelayers/database";
import { CopyIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import appPackage from "../../package.json";

type State = { error?: Error };

function ErrorScreen({ error }: { error: Error }) {
  const { t } = useTranslation();
  const [schema, setSchema] = useState("—");
  useEffect(() => {
    let active = true;
    void getDatabase().then((db) => db.select<{ data: string }[]>(
      "SELECT data FROM configuration WHERE id = 999",
    )).then((rows) => { if (active) setSchema(rows[0]?.data ?? "—"); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const details = redactSecrets(error.stack ?? `${error.name}: ${error.message}`)
    .replace(/https?:\/\/[^/\s)]+/g, "").replace(/\?[^:\s)]*/g, "");
  const diagnostic = `Track3 ${appPackage.version} · schema ${schema} · ${navigator.platform || "unknown platform"} · ${new Date().toISOString()}`;
  const copyText = `${diagnostic}\n${details}`;
  return <main className="t3-desktop-error" id="app-main-content" tabIndex={-1}>
    <div className="t3-desktop-error-card">
      <ExclamationTriangleIcon aria-hidden="true" className="t3-desktop-error-icon" />
      <h1>{t("startup.fidelity.errorTitle")}</h1>
      <p>{t("startup.fidelity.errorBody")}</p>
      <div className="t3-desktop-error-details">
        <span>{t("startup.fidelity.errorDetails")}</span>
        <small>{diagnostic}</small>
        <pre>{details}</pre>
      </div>
      <div className="t3-desktop-error-actions">
        <button type="button" onClick={() => void navigator.clipboard?.writeText(copyText)}>
          <CopyIcon aria-hidden="true" />
          {t("startup.fidelity.copyDetails")}
        </button>
        <button type="button" onClick={reloadApp}>{t("startup.fidelity.reload")}</button>
      </div>
      <p>{t("startup.fidelity.errorHint")}</p>
    </div>
  </main>;
}

export default class DesktopErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    return this.state.error ? <ErrorScreen error={this.state.error} /> : this.props.children;
  }
}
