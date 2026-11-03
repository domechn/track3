import { useEffect, useRef, useState } from "react";
import * as UpdateDialog from "@radix-ui/react-dialog";
import { check } from "@tauri-apps/plugin-updater";
import { reloadApp } from "@/utils/app";
import { useTranslation } from "@/i18n";
import { redactSecrets } from "@/middlelayers/security/redact";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CopyIcon, ExternalLinkIcon } from "@radix-ui/react-icons";

const App = () => {
  const { t, locale } = useTranslation();
  const [fidelityUpdate, setFidelityUpdate] = useState<Awaited<ReturnType<typeof check>>>(null);
  const [phase, setPhase] = useState<"none" | "available" | "notes" | "downloading" | "hidden" | "ready" | "readyHidden" | "failed">("none");
  const [contentLength, setContentLength] = useState(0);
  const [received, setReceived] = useState(0);
  const [downloadError, setDownloadError] = useState("");
  const [manualOpenError, setManualOpenError] = useState(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelAuto = () => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = null;
  };
  useEffect(() => {
    let active = true;
    void autoInstallLatestVersion(() => active).catch(() => {
      console.warn("Automatic update check failed");
    });
    return () => { active = false; cancelAuto(); };
  }, []);

  async function autoInstallLatestVersion(isActive: () => boolean) {
    const update = await check();
    if (!isActive() || !update?.available) {
      return false;
    }
    setFidelityUpdate(update);
    setPhase("available");
    autoTimer.current = setTimeout(() => { void download(update); }, 30_000);
    return true;
  }

  async function download(update = fidelityUpdate) {
    if (!update) return;
    cancelAuto();
    setReceived(0);
    setContentLength(0);
    setDownloadError("");
    setManualOpenError(false);
    setPhase("downloading");
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") setContentLength(event.data.contentLength ?? 0);
        if (event.event === "Progress") setReceived((value) => value + event.data.chunkLength);
      });
      setPhase("ready");
    } catch (error) {
      setDownloadError(redactSecrets(error instanceof Error ? error.message : String(error))
        .replace(/https?:\/\/\S+/g, "[URL]"));
      setPhase("failed");
    }
  }

  const version = fidelityUpdate?.version ?? "";
  const currentVersion = fidelityUpdate?.currentVersion ?? "";
  const percent = contentLength > 0 ? Math.min(100, Math.round(received / contentLength * 100)) : 0;
  const mb = (bytes: number) => (bytes / 1_000_000).toFixed(1);
  const notes = fidelityUpdate?.body?.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) ?? [];
  const releaseDate = fidelityUpdate?.date
    ? new Date(fidelityUpdate.date).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-GB",
      locale === "zh" ? { year: "numeric", month: "long", day: "numeric" }
        : { day: "numeric", month: "short", year: "numeric" }) : "";

  return <>{phase === "available" && <div className="t3-update-fidelity-toast" role="status">
      <span className="t3-update-fidelity-toast-icon" aria-hidden="true">↓</span>
      <div><strong>{t("update.fidelity.availableToast").replace("{version}", version)}</strong>
        <p>{t("update.fidelity.youHave").replace("{version}", currentVersion)}</p>
        <div className="t3-update-fidelity-toast-actions">
          <button type="button" onClick={() => {
            if (fidelityUpdate?.body) { cancelAuto(); setPhase("notes"); }
            else void download();
          }}>
            {fidelityUpdate?.body ? t("update.fidelity.seeNotes") : t("update.fidelity.downloadInstall")}
          </button>
          <button type="button" onClick={() => { cancelAuto(); setPhase("none"); }}>{t("settings.phase6.updateLater")}</button>
        </div>
      </div>
      <button type="button" className="t3-update-fidelity-toast-close" aria-label={t("common.close")} onClick={() => { cancelAuto(); setPhase("none"); }}>×</button>
    </div>}
    {phase === "hidden" && <button type="button" className="t3-update-fidelity-toast" onClick={() => setPhase("downloading")}>
      <span className="t3-update-fidelity-toast-icon" aria-hidden="true">↓</span>
      <span>{t("update.fidelity.downloading").replace("{version}", version)} · {percent}%</span>
    </button>}
    {phase === "readyHidden" && <button type="button" className="t3-update-fidelity-toast" onClick={() => setPhase("ready")}>
      {t("update.fidelity.readyTitle")} · {t("settings.phase6.updateRestart")}
    </button>}
    <UpdateDialog.Root open={phase === "notes" || phase === "downloading" || phase === "ready" || phase === "failed"}
      onOpenChange={(open) => { if (!open && phase === "notes") setPhase("available"); else if (!open && phase === "downloading") setPhase("hidden"); else if (!open && phase === "ready") setPhase("readyHidden"); else if (!open && phase === "failed") setPhase("none"); }}>
      <UpdateDialog.Portal>
        <UpdateDialog.Overlay className="t3-update-fidelity-scrim" />
        <UpdateDialog.Content className="t3-update-fidelity-dialog">
          {phase === "notes" && <>
            <UpdateDialog.Title>{t("update.fidelity.availableTitle").replace("{version}", version)}</UpdateDialog.Title>
            <UpdateDialog.Description>{t("update.fidelity.availableMeta").replace("{version}", currentVersion).replace("{date}", releaseDate)}</UpdateDialog.Description>
            <div className="t3-update-fidelity-notes">{notes.map((line, index) => line.startsWith("## ")
              ? <h3 key={index}>{line.slice(3)}</h3>
              : <p key={index}>{line.startsWith("- ") ? <><span aria-hidden="true">•</span>{line.slice(2)}</> : line}</p>)}</div>
            <div className="t3-update-fidelity-foot">
              <button type="button" onClick={() => setPhase("none")}>{t("settings.phase6.updateLater")}</button>
              <button type="button" className="primary" onClick={() => void download()}>{t("update.fidelity.downloadInstall")}</button>
            </div>
          </>}
          {(phase === "downloading" || phase === "hidden") && <>
            <UpdateDialog.Title>{t("update.fidelity.downloading").replace("{version}", version)}</UpdateDialog.Title>
            <UpdateDialog.Description>{t("update.fidelity.useWhileDownloading")}</UpdateDialog.Description>
            <div className="t3-update-fidelity-progress-label"><strong>{contentLength > 0
              ? t("update.fidelity.bytes").replace("{received}", mb(received)).replace("{total}", mb(contentLength))
              : t("update.fidelity.starting")}</strong><span>{contentLength > 0 ? `${percent}%` : "—"}</span></div>
            <div className="t3-update-fidelity-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${percent}%` }} />
            </div>
            <div className="t3-update-fidelity-foot"><button type="button" onClick={() => setPhase("hidden")}>{t("update.fidelity.hide")}</button></div>
          </>}
          {phase === "ready" && <>
            <span className="t3-update-fidelity-state-icon success" aria-hidden="true">✓</span>
            <UpdateDialog.Title>{t("update.fidelity.readyTitle")}</UpdateDialog.Title>
            <UpdateDialog.Description>{t("update.fidelity.readyDescription").replace("{version}", version)}</UpdateDialog.Description>
            <div className="t3-update-fidelity-info">{t("update.fidelity.readyHint")}</div>
            <div className="t3-update-fidelity-foot">
              <button type="button" onClick={() => setPhase("readyHidden")}>{t("settings.phase6.updateLater")}</button>
              <button type="button" className="primary" onClick={reloadApp}>{t("settings.phase6.updateRestart")}</button>
            </div>
          </>}
          {phase === "failed" && <>
            <span className="t3-update-fidelity-state-icon error" aria-hidden="true">!</span>
            <UpdateDialog.Title>{t("update.fidelity.failedTitle")}</UpdateDialog.Title>
            <UpdateDialog.Description>{t(contentLength
              ? "update.fidelity.failedAt" : "update.fidelity.failedDescription")
              .replace("{received}", mb(received)).replace("{total}", mb(contentLength))
              .replace("{version}", currentVersion)}</UpdateDialog.Description>
            <div className="t3-update-fidelity-error">{downloadError || t("update.fidelity.unknownError")}</div>
            {manualOpenError && <p role="alert">{t("update.fidelity.manualOpenFailed")}</p>}
            <div className="t3-update-fidelity-foot">
              <button type="button" onClick={() => void navigator.clipboard?.writeText(
                `Track3 ${currentVersion} → ${version}: ${mb(received)} of ${mb(contentLength)} MB; ${downloadError}`,
              )}><CopyIcon aria-hidden="true" />{t("startup.fidelity.copyDetails")}</button>
              <button type="button" onClick={() => void openUrl("https://github.com/domechn/track3/releases/latest")
                .catch(() => setManualOpenError(true))}
              ><ExternalLinkIcon aria-hidden="true" />{t("update.fidelity.downloadManually")}</button>
              <button type="button" className="primary" onClick={() => void download()}>{t("update.fidelity.tryAgain")}</button>
            </div>
          </>}
        </UpdateDialog.Content>
      </UpdateDialog.Portal>
    </UpdateDialog.Root>
  </>;
};

export default App;
