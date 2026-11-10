import { useEffect, useReducer, useRef, useState } from "react";
import * as UpdateDialog from "@radix-ui/react-dialog";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { reloadApp } from "@/utils/app";
import { useTranslation } from "@/i18n";
import { redactSecrets } from "@/middlelayers/security/redact";
import { openExternal } from "@/lib/external-links";
import ReleaseNotes from "@/components/release-notes";
import { initialUpdateState, updateReducer, type FailureReason } from "./auto-updater-state";

const CHECK_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 15 * 60_000;
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000];
export const updateDownloadEvent = "track3:update-download";
const mb = (bytes: number) => (bytes / 1_000_000).toFixed(1);
const safeDetails = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const hostOnly = message.replace(/https?:\/\/[^\s)]+/gi, (url) => {
    try { return new URL(url).host; } catch { return "[URL]"; }
  });
  const status = message.match(/\b(?:status:?\s*|HTTP\s+)([1-5]\d{2})\b/i)?.[1];
  return `${status ? `HTTP ${status}: ` : ""}${redactSecrets(hostOnly)}`;
};
const failureReason = (error: unknown): FailureReason => {
  const message = error instanceof Error ? error.message : String(error);
  if (/signature|verification|verify|public key/i.test(message)) return "signature";
  if (/\b(403|404)\b/.test(message)) return "http";
  return "network";
};

const AutoUpdater = () => {
  const { t, locale } = useTranslation();
  const [state, dispatch] = useReducer(updateReducer, initialUpdateState);
  const phase = useRef(state.phase);
  phase.current = state.phase;
  const [metadata, setMetadata] = useState<Update | null>(null);
  const [manualOpenError, setManualOpenError] = useState(false);
  const [retryDelay, setRetryDelay] = useState<number | null>(null);
  const initialUpdate = useRef<Update | null>(null);
  const attempt = useRef(0);
  const retryCount = useRef(0);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownedUpdate = useRef<Update | null>(null);
  const startedAt = useRef(0);
  const mounted = useRef(false);
  const clearTimer = (timer: { current: ReturnType<typeof setTimeout> | null }) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const clearDownloadTimers = () => { clearTimer(watchdog); clearTimer(retryTimer); };
  const close = (update: Update | null) => { if (update) void update.close().catch(() => {}); };

  useEffect(() => {
    mounted.current = true;
    let active = true;
    const checkAttempt = attempt.current;
    dispatch({ type: "check" });
    void check({ timeout: CHECK_TIMEOUT_MS }).then((update) => {
      if (!active || attempt.current !== checkAttempt) { close(update); return; }
      if (!update) { dispatch({ type: "none" }); return; }
      initialUpdate.current = update;
      setMetadata(update);
      dispatch({ type: "available" });
      autoTimer.current = setTimeout(() => { void startDownload(false); }, 30_000);
    }).catch(() => {
      if (active) { dispatch({ type: "none" }); console.warn("Automatic update check failed"); }
    });
    return () => {
      active = false;
      mounted.current = false;
      attempt.current++;
      clearTimer(autoTimer);
      clearDownloadTimers();
      close(initialUpdate.current);
      close(ownedUpdate.current);
    };
  }, []);

  useEffect(() => {
    const onDownload = (event: Event) => {
      const update = (event as CustomEvent<Update>).detail;
      if (ownedUpdate.current || ["connecting", "downloading", "verifying", "installing", "restart-required"].includes(phase.current)) {
        close(update);
        dispatch({ type: "show" });
        return;
      }
      close(initialUpdate.current);
      initialUpdate.current = update;
      void startDownload(true);
    };
    window.addEventListener(updateDownloadEvent, onDownload);
    return () => window.removeEventListener(updateDownloadEvent, onDownload);
  }, []);

  function fail(id: number, reason: FailureReason, details: string) {
    if (id !== attempt.current || !mounted.current) return;
    attempt.current++;
    clearTimer(watchdog);
    dispatch({ type: "fail", reason, details });
    console.error("Updater download failed:", details);
    close(ownedUpdate.current);
    ownedUpdate.current = null;
    const delay = RETRY_DELAYS_MS[retryCount.current];
    if (reason === "network" && delay !== undefined) {
      retryCount.current++;
      setRetryDelay(delay / 1000);
      retryTimer.current = setTimeout(() => { void startDownload(false); }, delay);
    } else setRetryDelay(null);
  }

  function armWatchdog(id: number, ms: number, detail: string) {
    clearTimer(watchdog);
    watchdog.current = setTimeout(() => fail(id, "network", detail), ms);
  }

  async function startDownload(manual: boolean) {
    clearTimer(autoTimer);
    clearDownloadTimers();
    if (manual) retryCount.current = 0;
    setRetryDelay(null);
    setManualOpenError(false);
    const id = ++attempt.current;
    dispatch({ type: "connect" });
    let update = initialUpdate.current;
    let installing = false;
    initialUpdate.current = null;
    try {
      if (!update) update = await check({ timeout: CHECK_TIMEOUT_MS });
      if (id !== attempt.current || !mounted.current) { close(update); return; }
      if (!update) throw new Error("Update is no longer available");
      ownedUpdate.current = update;
      setMetadata(update);
      armWatchdog(id, 20_000, "No first byte within 20 seconds");
      await update.download((event) => {
        if (id !== attempt.current) return;
        if (event.event === "Started") {
          startedAt.current = Date.now();
          dispatch({ type: "started", total: event.data.contentLength });
          armWatchdog(id, 30_000, "No download progress within 30 seconds");
        } else if (event.event === "Progress") {
          if (event.data.chunkLength <= 0) return;
          dispatch({ type: "progress", bytes: event.data.chunkLength, elapsedMs: Math.max(1, Date.now() - startedAt.current) });
          armWatchdog(id, 30_000, "No download progress within 30 seconds");
        } else if (event.event === "Finished") {
          clearTimer(watchdog);
          dispatch({ type: "verify" });
        }
      }, { timeout: DOWNLOAD_TIMEOUT_MS });
      if (id !== attempt.current || !mounted.current) return;
      clearTimer(watchdog);
      dispatch({ type: "install" });
      installing = true;
      await update.install();
      if (id === attempt.current && mounted.current) { retryCount.current = 0; dispatch({ type: "ready" }); }
    } catch (error) {
      fail(id, installing ? "install" : failureReason(error), safeDetails(error));
    } finally {
      if (ownedUpdate.current === update) ownedUpdate.current = null;
      close(update);
    }
  }

  function cancel() {
    attempt.current++;
    clearDownloadTimers();
    setRetryDelay(null);
    // shortcut: the updater has no abort signal; closing it prevents install, but the native request may run until its timeout.
    close(ownedUpdate.current);
    ownedUpdate.current = null;
    dispatch({ type: "cancel" });
  }
  function dismiss() {
    clearTimer(autoTimer);
    clearTimer(retryTimer);
    close(initialUpdate.current);
    initialUpdate.current = null;
    dispatch({ type: "none" });
  }

  const version = metadata?.version ?? "";
  const currentVersion = metadata?.currentVersion ?? "";
  const releaseDate = metadata?.date
    ? new Date(metadata.date).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-GB",
      locale === "zh" ? { year: "numeric", month: "long", day: "numeric" }
        : { day: "numeric", month: "short", year: "numeric" }) : "";
  const active = ["connecting", "downloading", "verifying", "installing"].includes(state.phase);
  const open = state.visible && ["notes", "connecting", "downloading", "verifying", "installing", "restart-required", "failed", "cancelled"].includes(state.phase);
  const status = state.phase === "connecting" ? t("update.fidelity.connecting")
    : state.phase === "downloading" ? state.total
      ? t("update.fidelity.bytes").replace("{received}", mb(state.received)).replace("{total}", mb(state.total))
      : t("update.fidelity.bytesUnknown").replace("{received}", mb(state.received))
    : state.phase === "verifying" ? t("update.fidelity.verifying")
    : state.phase === "installing" ? t("update.fidelity.installing")
    : state.phase === "cancelled" ? t("update.fidelity.cancelled") : "";
  const failureText = state.reason === "network" ? t("update.fidelity.networkError")
    : state.reason === "signature" ? t("update.fidelity.signatureError")
    : state.reason === "http" ? t("update.fidelity.httpError")
    : state.reason === "install" ? t("update.fidelity.installError") : t("update.fidelity.unknownError");

  return <>
    {state.phase === "checking" && <span className="sr-only" role="status" aria-live="polite">{t("update.fidelity.checking")}</span>}
    {state.phase === "available" && <div className="t3-update-fidelity-toast" role="status">
      <span className="t3-update-fidelity-toast-icon" aria-hidden="true">↓</span>
      <div><strong>{t("update.fidelity.availableToast").replace("{version}", version)}</strong>
        <p>{t("update.fidelity.youHave").replace("{version}", currentVersion)}</p>
        <div className="t3-update-fidelity-toast-actions">
          <button type="button" onClick={() => {
            if (metadata?.body) { clearTimer(autoTimer); dispatch({ type: "notes" }); }
            else void startDownload(false);
          }}>{metadata?.body ? t("update.fidelity.seeNotes") : t("update.fidelity.downloadInstall")}</button>
          <button type="button" onClick={dismiss}>{t("settings.phase6.updateLater")}</button>
        </div>
      </div>
      <button type="button" className="t3-update-fidelity-toast-close" aria-label={t("common.close")} onClick={dismiss}>×</button>
    </div>}
    {!state.visible && state.phase !== "none" && <button type="button" className="t3-update-fidelity-toast" onClick={() => dispatch({ type: "show" })}>
      <span className="t3-update-fidelity-toast-icon" aria-hidden="true">↓</span>
      <span>{active ? t("update.fidelity.downloading").replace("{version}", version) : state.phase === "restart-required" ? t("update.fidelity.readyTitle") : state.phase === "cancelled" ? t("update.fidelity.cancelled") : t("update.fidelity.failedTitle")}{state.percent !== null && active ? ` · ${state.percent}%` : ""}</span>
    </button>}
    <UpdateDialog.Root open={open} onOpenChange={(next) => { if (!next) { if (state.phase === "notes") dispatch({ type: "available" }); else if (state.phase === "failed" || state.phase === "cancelled") dismiss(); else dispatch({ type: "hide" }); } }}>
      <UpdateDialog.Portal>
        <UpdateDialog.Overlay className="t3-update-fidelity-scrim" />
        <UpdateDialog.Content className="t3-update-fidelity-dialog">
          {state.phase === "notes" && <>
            <UpdateDialog.Title>{t("update.fidelity.availableTitle").replace("{version}", version)}</UpdateDialog.Title>
            <UpdateDialog.Description>{t("update.fidelity.availableMeta").replace("{version}", currentVersion).replace("{date}", releaseDate)}</UpdateDialog.Description>
            <ReleaseNotes content={metadata?.body ?? ""} />
            <div className="t3-update-fidelity-foot">
              <button type="button" onClick={dismiss}>{t("settings.phase6.updateLater")}</button>
              <button type="button" className="primary" onClick={() => void startDownload(false)}>{t("update.fidelity.downloadInstall")}</button>
            </div>
          </>}
          {active && <>
            <UpdateDialog.Title>{t("update.fidelity.downloading").replace("{version}", version)}</UpdateDialog.Title>
            <UpdateDialog.Description>{t("update.fidelity.useWhileDownloading")}</UpdateDialog.Description>
            <div className="t3-update-fidelity-progress-label" role="status" aria-live="polite"><strong>{status}</strong><span>{state.percent === null ? "—" : `${state.percent}%`}</span></div>
            <div className="t3-update-fidelity-progress" role="progressbar" aria-valuenow={state.percent ?? undefined} aria-valuemin={0} aria-valuemax={100} aria-label={status}>
              <span className={state.percent === null ? "indeterminate" : ""} style={state.percent === null ? undefined : { width: `${state.percent}%` }} />
            </div>
            {state.phase === "downloading" && state.speed !== null && <p className="t3-update-fidelity-rate">{t("update.fidelity.rate").replace("{speed}", mb(state.speed))}{state.etaSeconds !== null ? ` · ${t("update.fidelity.eta").replace("{seconds}", String(state.etaSeconds))}` : ""}</p>}
            <div className="t3-update-fidelity-foot">
              {state.phase === "connecting" || state.phase === "downloading" ? <button type="button" onClick={cancel}>{t("update.fidelity.cancel")}</button> : null}
              <button type="button" onClick={() => dispatch({ type: "hide" })}>{t("update.fidelity.hide")}</button>
            </div>
          </>}
          {state.phase === "restart-required" && <>
            <span className="t3-update-fidelity-state-icon success" aria-hidden="true">✓</span>
            <UpdateDialog.Title>{t("update.fidelity.readyTitle")}</UpdateDialog.Title>
            <UpdateDialog.Description>{t("update.fidelity.readyDescription").replace("{version}", version)}</UpdateDialog.Description>
            <div className="t3-update-fidelity-info">{t("update.fidelity.readyHint")}</div>
            <div className="t3-update-fidelity-foot">
              <button type="button" onClick={() => dispatch({ type: "hide" })}>{t("settings.phase6.updateLater")}</button>
              <button type="button" className="primary" onClick={reloadApp}>{t("settings.phase6.updateRestart")}</button>
            </div>
          </>}
          {(state.phase === "failed" || state.phase === "cancelled") && <>
            <span className="t3-update-fidelity-state-icon error" aria-hidden="true">!</span>
            <UpdateDialog.Title>{state.phase === "failed" ? t("update.fidelity.failedTitle") : t("update.fidelity.cancelled")}</UpdateDialog.Title>
            <UpdateDialog.Description>{state.phase === "failed" && state.total
              ? t("update.fidelity.failedAt").replace("{received}", mb(state.received)).replace("{total}", mb(state.total)).replace("{version}", currentVersion)
              : t("update.fidelity.failedDescription").replace("{version}", currentVersion)}</UpdateDialog.Description>
            {state.phase === "cancelled" && <p role="status" aria-live="polite">{t("update.fidelity.cancelled")}</p>}
            {state.phase === "failed" && <><p className="t3-update-fidelity-failure" role="status" aria-live="polite">{failureText}</p>
              <p className="t3-update-fidelity-hint">{t("update.fidelity.proxyHint")}</p>
              {retryDelay !== null && <p>{t("update.fidelity.retryScheduled").replace("{seconds}", String(retryDelay))}</p>}
              <details className="t3-update-fidelity-error"><summary>{t("update.fidelity.details")}</summary><p>{state.details}</p>
                <button type="button" onClick={() => void navigator.clipboard?.writeText(state.details)}>{t("startup.fidelity.copyDetails")}</button>
              </details></>}
            {manualOpenError && <p role="alert">{t("update.fidelity.manualOpenFailed")}</p>}
            <div className="t3-update-fidelity-foot">
              <button type="button" onClick={() => dispatch({ type: "hide" })}>{t("update.fidelity.hide")}</button>
              <button type="button" onClick={() => void openExternal("download", () => setManualOpenError(true))}>{t("update.fidelity.downloadManually")}</button>
              <button type="button" className="primary" onClick={() => void startDownload(true)}>{t("update.fidelity.tryAgain")}</button>
            </div>
          </>}
        </UpdateDialog.Content>
      </UpdateDialog.Portal>
    </UpdateDialog.Root>
  </>;
};

export default AutoUpdater;
