import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ExclamationTriangleIcon, EyeClosedIcon, EyeOpenIcon, InfoCircledIcon, LockClosedIcon, ReloadIcon, CopyIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";
import { SyncDetails } from "@/components/sync-details";
import { useTranslation } from "@/i18n";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import { SyncRecoveryExport, SyncRecoveryUnlock } from "@/components/settings/sync-recovery";
import { serializeSyncDiagnostics, type SyncDiagnostics } from "@/middlelayers/sync/diagnostics";
import { useWideDesktop } from "@/components/use-wide-desktop";

function SyncWideDiagnostics({ diagnostics, stopped, t }: {
  diagnostics: SyncDiagnostics;
  stopped: boolean;
  t: Props["t"];
}) {
  const [expanded, setExpanded] = useState(!stopped);
  const put = diagnostics.requests.PUT;
  const failures = put.count - put.outcomes.ok.count;
  const total = Object.values(diagnostics.requests).reduce((sum, request) => sum + request.count, 0);
  const seconds = (ms: number) => ms === 0 ? t("fidelity.settingsB.sync.pop.notReached")
    : ms >= 60_000 ? `${Math.floor(ms / 60_000)} m ${Math.round(ms % 60_000 / 1000)} s`
      : `${(ms / 1000).toFixed(1)} s`;
  const errorGroups = [
    [t("fidelity.settingsB.sync.pop.networkTimeout"), diagnostics.timeouts],
    [t("fidelity.settingsB.sync.pop.otherRequestError"), put.outcomes.otherError.count],
  ] as const;
  const phaseRows = [
    [t("fidelity.settingsB.sync.pop.scanLocal"), diagnostics.phases.localScan],
    [t("sync.details.phase.keyDerivation"), diagnostics.phases.keyDerivation],
    [t("fidelity.settingsB.sync.pop.upload"), diagnostics.phases.push],
    [t("sync.details.phase.manifestWrite"), diagnostics.phases.manifestWrite],
  ] as const;
  return <>
    {stopped && <div className="t3-b-sync-pop-stop"><b>{t("fidelity.settingsB.sync.pop.stoppedWarning")}</b></div>}
    <div className="t3-b-sync-pop-error-groups">
      {errorGroups.filter(([, count]) => count > 0).map(([label, count]) =>
        <div key={label}><span aria-hidden="true">⚠</span><span>{label}</span><b>{count}</b></div>)}
    </div>
    <details className="t3-b-sync-pop-diagnostics" open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary>{t("sync.details.title")}</summary>
      <div>
        <h3>{t("sync.details.timings")}</h3>
        <div className="t3-b-sync-pop-measures">{phaseRows.map(([label, ms]) =>
          <div key={label}><span>{label}</span><b>{seconds(ms)}</b></div>)}</div>
        <h3>{t("sync.details.requests")}</h3>
        <div className="t3-b-sync-pop-measures">
          <div><span>{t("fidelity.settingsB.sync.pop.putSucceeded")}</span><b>{put.outcomes.ok.count.toLocaleString()}</b></div>
          <div><span>{t("fidelity.settingsB.sync.pop.putFailed")}</span><b>{failures.toLocaleString()}</b></div>
          <div><span>GET</span><b>{diagnostics.requests.GET.count.toLocaleString()}</b></div>
          <div><span>LIST</span><b>{diagnostics.requests.LIST.count.toLocaleString()}</b></div>
          <div><span>{t("fidelity.settingsB.sync.pop.total")}</span><b>{total.toLocaleString()}</b></div>
        </div>
        <h3>{t("sync.details.slowest")}</h3>
        <div className="t3-b-sync-pop-measures">
          {diagnostics.slowest.slice(0, 3).map((item, index) =>
            <div key={index}><span>{item.verb} {t(`sync.details.phase.${item.phase}`)}</span><b>{seconds(item.ms)}</b></div>)}
        </div>
      </div>
    </details>
  </>;
}


type Props = {
  t: (key: string, fallback?: string) => string;
  mobile?: boolean;
  recordsStamp?: boolean;
  overviewFidelity?: boolean;
  ConfirmDialog?: typeof ConfirmDeleteDialog;
};

export function SyncStatusIndicatorView({ t, mobile = false, recordsStamp = false, overviewFidelity = false, ConfirmDialog = ConfirmDeleteDialog }: Props) {
  const status = useSyncExternalStore(syncRuntime.subscribe, syncRuntime.status);
  const wide = useWideDesktop() && !mobile;
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [disableError, setDisableError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryExportOpen, setRecoveryExportOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const recoveryRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (status.mode === "locked" && syncRuntime.claimLockedPrompt()) setOpen(true);
  }, [status.mode]);

  useEffect(() => {
    if (status.sync.phase !== "syncing") return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status.sync.phase]);

  if (status.mode === "loading" || status.mode === "disabled") return null;

  const report = status.sync.report;
  const diagnostics = status.sync.diagnostics;
  const never = status.sync.phase === "idle" && status.sync.lastSync === undefined;
  const muted = status.mode === "locked" && status.skipped;
  const phase = status.mode === "unreadable" ? "unreadable" :
    status.mode === "locked" ? (muted ? "skipped" : "locked") :
      status.sync.phase === "idle" && report?.conflicts.length ? "conflict" : status.sync.phase;
  const syncedAt = recordsStamp && phase === "idle" && status.sync.lastSync !== undefined
    ? t("sync.status.syncedAt").replace("{time}", new Date(status.sync.lastSync).toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    })) : undefined;
  const statusLabel = syncedAt ?? t(`sync.status.${phase}`);
  const changed = !!report && (report.pulled > 0 || report.pushed > 0 || report.conflicts.length > 0 || report.errors.length > 0);
  const counts = report && t("sync.status.counts")
    .replace("{pulled}", String(report.pulled))
    .replace("{pushed}", String(report.pushed))
    .replace("{conflicts}", String(report.conflicts.length))
    .replace("{errors}", String(report.errors.length));
  const locked = status.mode === "locked";
  const fidelityLocked = locked && overviewFidelity && !mobile && window.innerWidth >= 1400;
  const fidelityReady = overviewFidelity && status.mode === "ready" && status.sync.phase === "idle" &&
    !!report && !report.conflicts.length && !report.errors.length && status.sync.lastSync !== undefined;
  const settings = fidelityReady ? syncRuntime.getSettings() : undefined;
  const destination = settings?.endpoint.includes("r2.cloudflarestorage.com")
    ? t("overview.fidelity.cloudflareDestination") : t("overview.fidelity.s3Destination");
  const syncedTime = status.sync.lastSync !== undefined
    ? new Date(status.sync.lastSync).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
  const deviceNames = report?.devices?.map((device) => device.name || device.id.slice(0, 8)) ?? [];
  const fidelitySheet = mobile && window.location.hash.startsWith("#/settings/sync");
  const compactLocked = fidelitySheet && muted;
  const progressCompleted = status.sync.progress
    ? Math.min(status.sync.progress.completed, status.sync.progress.total) : 0;
  const elapsedSeconds = status.sync.startedAt === undefined ? 0 : Math.max(0, Math.floor((now - status.sync.startedAt) / 1000));
  const displayLabel = wide && phase === "idle" && status.sync.lastSync !== undefined
    ? t("fidelity.settingsB.sync.syncedAt").replace("{time}", new Date(status.sync.lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }))
    : wide && status.sync.retryStopped ? t("fidelity.settingsB.sync.pop.stopped")
    : wide && phase === "error" ? t("fidelity.settingsB.sync.pop.failedTitle")
    : t(`sync.status.${phase}`);
  const remaining = status.sync.progress ? Math.max(0, status.sync.progress.total - progressCompleted) : 0;
  const speed = elapsedSeconds > 0 ? progressCompleted / elapsedSeconds : 0;
  const minutesLeft = speed > 0 ? Math.round(remaining / speed / 60) : 0;
  const uploadTime = status.sync.lastSync === undefined ? undefined
    : new Date(status.sync.lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const syncSettings = wide && status.mode === "ready" && typeof syncRuntime.getSettings === "function"
    ? syncRuntime.getSettings() : undefined;
  const remoteLabel = `${syncSettings?.endpoint?.includes(".r2.cloudflarestorage.com") ? "Cloudflare R2 · " : ""}${syncSettings?.bucket || "—"}`;
  const remainingItems = status.sync.progress ? Math.max(0, status.sync.progress.total - progressCompleted) : 0;
  const itemsPerSecond = elapsedSeconds > 0 ? progressCompleted / elapsedSeconds : 0;
  const remainingMinutes = itemsPerSecond > 0 ? Math.ceil(remainingItems / itemsPerSecond / 60) : undefined;
  const elapsedTime = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
  const mobileSyncSettings = mobile ? syncRuntime.getSettings() : undefined;
  const mobileRemoteLabel = mobileSyncSettings?.endpoint.includes(".r2.cloudflarestorage.com")
    ? `Cloudflare R2 · ${mobileSyncSettings.bucket}` : mobileSyncSettings?.bucket;
  const lastUpload = status.sync.lastSync === undefined ? undefined : new Date(status.sync.lastSync);
  const lastUploadText = lastUpload && `${lastUpload.toDateString() === new Date(now).toDateString() ? t("fidelity.b.sync.sheetToday")
    : lastUpload.toLocaleDateString()} ${lastUpload.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`;

  async function unlock() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await syncRuntime.unlock(passphrase);
      setError(result === "ok" ? "" : mobile && result === "passphrase"
        ? t("fidelity.startup.syncWrongPassphrase") : result === "passphrase" && fidelityLocked
          ? t("sync.fidelity.passphraseError") : t(`sync.connection.${result}`));
      if (result === "ok") {
        setPassphrase("");
        setOpen(false);
      }
    } catch {
      setError(t("sync.connection.network"));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    setDisableError("");
    try {
      await syncRuntime.disable(true);
      setError("");
      setOpen(false);
    } catch {
      setDisableError(t("sync.disableFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function copyDiagnostics(diagnostics: SyncDiagnostics) {
    try {
      await navigator.clipboard.writeText(serializeSyncDiagnostics(diagnostics));
      setCopyMessage(t("sync.details.copied"));
    } catch {
      setCopyMessage(t("sync.details.copyFailed"));
    }
  }

  return (
    <div className={mobile ? "ios-d3-sync-indicator t3-topbar-sync" : "desktop-sync-status-indicator t3-topbar-sync"}>
      <span role="status" aria-live="polite" className="sr-only">
        {busy ? t("common.loading") : wide ? displayLabel : statusLabel}
      </span>
      {fidelityLocked && open && createPortal(<div className="t3-sync-lock-scrim" aria-hidden="true" />, document.body)}
      {recoveryExportOpen && createPortal(<div className="t3-sync-recovery-fullscrim" aria-hidden="true" />, document.body)}
      <Dialog open={recoveryExportOpen} onOpenChange={setRecoveryExportOpen}>
        <DialogContent className="t3-sync-recovery-dialog"><DialogHeader><DialogTitle>{t("sync.fidelity.saveRecoveryFileTitle")}</DialogTitle>
          <DialogDescription className="sr-only">{t("sync.recovery.scope")}</DialogDescription></DialogHeader>
          <SyncRecoveryExport t={t} />
        </DialogContent>
      </Dialog>
      {fidelitySheet && open && createPortal(
        <div className="fidelity-sync-sheet-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />,
        document.body,
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={wide ? displayLabel : statusLabel} title={muted ? t("sync.status.skipped") : undefined}
            data-synced={syncedAt ? "true" : undefined}
            className={muted
              ? "t3-topbar-sync-button flex h-9 w-9 touch:h-11 touch:w-11 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              : "t3-topbar-sync-button flex min-h-9 touch:min-h-11 items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"}>
            {muted ? <LockClosedIcon aria-hidden="true" /> : <>
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${phase === "error" || phase === "unreadable" ? "bg-destructive" : phase === "conflict" ? "bg-amber-500" : fidelityReady ? "bg-positive" : phase === "syncing" ? "bg-primary animate-pulse motion-reduce:animate-none" : "bg-muted-foreground"}`} />
              {mobile && <svg className="fd-sync-cloud-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M5.3 14.5h9a3.4 3.4 0 0 0 .2-6.8 4.8 4.8 0 0 0-9.1-1.2 4 4 0 0 0-.1 8z" />
              </svg>}
              {fidelityReady ? t("overview.fidelity.syncedAt").replace("{time}", syncedTime) : wide ? displayLabel : statusLabel}
              {fidelityReady && <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5.5 18h12a4 4 0 0 0 .5-7.97A6.5 6.5 0 0 0 5.37 9.1 4.5 4.5 0 0 0 5.5 18Z" />
              </svg>}
            </>}
          </button>
        </PopoverTrigger>
        {wide && open && !fidelityReady && <div className="t3-b-sync-scrim" aria-hidden="true" onClick={() => setOpen(false)} />}
        <PopoverContent align="end" side="bottom" sideOffset={wide && !fidelityReady ? -10 : fidelityReady ? 8 : 0} collisionPadding={16}
          // Radix Escape was intermittent with focused content in the widened card; nested confirmations handle their own Escape.
          onKeyDown={(event) => {
            if (event.key === "Escape" && !document.querySelector('[role="alertdialog"]')) setOpen(false);
          }}
          onInteractOutside={(event) => {
            if (fidelityLocked || document.querySelector('[role="alertdialog"]')) event.preventDefault();
          }}
          data-locked={mobile && locked && !compactLocked}
          className={`t3-sync-popover max-h-[min(85vh,760px)] w-[calc(100vw-2rem)] max-w-[520px] overflow-y-auto space-y-3 text-sm ${mobile ? `ios-d3-sync-popover${fidelitySheet ? " is-fidelity-sheet" : ""}${compactLocked ? " is-locked" : status.sync.retryStopped && fidelitySheet ? " is-stopped" : status.sync.phase === "error" && fidelitySheet ? " is-error" : ""}` : ""} ${fidelityLocked ? "t3-sync-lock-dialog" : ""} ${wide && !fidelityReady ? "t3-b-sync-popover" : ""}`}>
          {fidelityReady ? <div className="t3-sync-fidelity">
            <header><h2>{t("overview.fidelity.backupSync")}</h2>
              <span>{t("overview.fidelity.upToDate")}</span></header>
            <dl>
              <div><dt>{t("overview.fidelity.lastUpload")}</dt><dd>{syncedTime} · {t("overview.fidelity.thisDevice")}</dd></div>
              <div><dt>{t("overview.fidelity.destination")}</dt><dd>{destination}</dd></div>
              <div><dt>{t("overview.fidelity.devices")}</dt><dd>{deviceNames.length
                ? `${deviceNames.length} · ${deviceNames.join(", ")}` : "—"}</dd></div>
              <div><dt>{t("overview.fidelity.waitingUpload")}</dt><dd>—</dd></div>
              <div><dt>{t("overview.fidelity.errors")}</dt><dd>{t("sync.details.none")}</dd></div>
            </dl>
            <p>{status.sync.diagnostics
              ? t("overview.fidelity.runTiming")
                .replace("{seconds}", String(Math.round(status.sync.diagnostics.wallMs / 1000)))
              : t("overview.fidelity.nextCheckOnActivity")}</p>
            <div className="t3-sync-fidelity-footer">
              <SyncDetails report={report} diagnostics={status.sync.diagnostics} t={t} ConfirmDialog={ConfirmDialog} />
              <button type="button" onClick={() => { setOpen(false); setRecoveryExportOpen(true); }}>
                {t("sync.fidelity.saveRecoveryFile")}
              </button>
              {status.sync.diagnostics && <button type="button" onClick={() => {
                void navigator.clipboard.writeText(serializeSyncDiagnostics(status.sync.diagnostics!))
                  .then(() => setCopyStatus(t("sync.details.copied")))
                  .catch(() => setCopyStatus(t("sync.details.copyFailed")));
              }}><CopyIcon aria-hidden="true" />{t("sync.details.copy")}</button>}
              <Button size="sm" variant="outline" onClick={() => void syncRuntime.syncNow()}>
                {t("sync.now")}</Button>
            </div>
            {copyStatus && <span role="status">{copyStatus}</span>}
          </div> : wide && status.mode === "ready" ? <>
          <div className="t3-b-sync-pop-content">
            <div className="t3-b-sync-pop-head">
              <h2>{status.sync.phase === "syncing" ? t("fidelity.settingsB.sync.pop.syncing")
                : status.sync.retryStopped ? t("fidelity.settingsB.sync.pop.stopped")
                  : status.sync.phase === "error" ? t("fidelity.settingsB.sync.pop.failedTitle")
                    : phase === "conflict" ? t("sync.status.conflictSummary").replace("{count}", String(report?.conflicts.length ?? 0))
                    : report ? t("fidelity.settingsB.sync.pop.upToDate") : t("fidelity.settingsB.sync.pop.sync")}</h2>
              <span className={`t3-b-sync-pop-badge ${status.sync.phase === "error" ? "negative" : phase === "conflict" ? "warning" : status.sync.phase === "syncing" ? "info" : report ? "positive" : ""}`}>
                {status.sync.phase === "syncing" ? t(status.sync.progress?.phase === "pull" ? "fidelity.settingsB.sync.pop.downloading" : "fidelity.settingsB.sync.pop.uploading")
                  : status.sync.retryStopped ? t("fidelity.settingsB.sync.pop.needsAttention")
                    : status.sync.phase === "error" ? t("fidelity.settingsB.sync.pop.retrying")
                      : phase === "conflict" ? t("fidelity.settingsB.sync.pop.needsAttention")
                      : report ? t("fidelity.settingsB.sync.pop.synced") : t("fidelity.settingsB.sync.pop.never")}
              </span>
            </div>
            {status.sync.phase === "syncing" ? <>
              {status.sync.progress && <div className="t3-b-sync-pop-progress">
                <b>{t(status.sync.progress.phase === "pull" ? "fidelity.settingsB.sync.pop.downloadingCount" : "fidelity.settingsB.sync.pop.uploadingCount")
                  .replace("{done}", progressCompleted.toLocaleString("en-US")).replace("{total}", status.sync.progress.total.toLocaleString("en-US"))}</b>
                <Progress value={progressCompleted} max={status.sync.progress.total} />
              </div>}
              <div className="t3-b-sync-pop-rows">
                <div><span>{t("fidelity.settingsB.sync.pop.elapsed")}</span><b>{String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:{String(elapsedSeconds % 60).padStart(2, "0")}</b></div>
                <div><span>{t("fidelity.settingsB.sync.pop.speed")}</span><b>{speed > 0 ? speed.toFixed(1) + " items/s" : "—"}</b></div>
                <div><span>{t("fidelity.settingsB.sync.pop.timeLeft")}</span><b>{minutesLeft > 0 ? t("fidelity.settingsB.sync.pop.aboutMinutes").replace("{minutes}", String(minutesLeft)) : "—"}</b></div>
                <div><span>{t("fidelity.settingsB.sync.pop.itemsLeft")}</span><b>{remaining.toLocaleString("en-US")}</b></div>
              </div>
            </> : status.sync.phase === "error" ? <>
              {status.sync.error && status.sync.error !== "sync" && <p className="t3-b-sync-pop-error">{t(`sync.connection.${status.sync.error}`)}</p>}
              {diagnostics
                ? <p className="t3-b-sync-pop-desc">{t("fidelity.settingsB.sync.pop.errorSummary")
                  .replace("{time}", uploadTime ?? "—")
                  .replace("{sent}", diagnostics.requests.PUT.outcomes.ok.count.toLocaleString())
                  .replace("{total}", diagnostics.entries.toLocaleString())}</p>
                : <>
                  <p className="t3-b-sync-pop-desc">{status.sync.retryStopped ? t("sync.status.retryStopped") : t("sync.status.errorsPresent")}</p>
                  {uploadTime && <p className="t3-b-sync-pop-desc">{t("fidelity.settingsB.sync.pop.lastUpload").replace("{time}", uploadTime)}</p>}
                </>}
              {diagnostics && <SyncWideDiagnostics diagnostics={diagnostics}
                stopped={!!status.sync.retryStopped} t={t} />}
            </> : report ? <>
              <p className="t3-b-sync-pop-desc">{uploadTime && t("fidelity.settingsB.sync.pop.lastUpload").replace("{time}", uploadTime)}</p>
              <div className="t3-b-sync-pop-rows">
                <div><span>{t("fidelity.settingsB.sync.pop.uploaded")}</span><b>{report.pushed.toLocaleString("en-US")} {t("fidelity.settingsB.sync.pop.items")}</b></div>
                <div><span>{t("fidelity.settingsB.sync.pop.downloaded")}</span><b>{report.pulled.toLocaleString("en-US")} {t("fidelity.settingsB.sync.pop.items")}</b></div>
                <div><span>{t("fidelity.settingsB.sync.pop.devices")}</span><b>{report.devices?.length ?? "—"}</b></div>
                <div><span>{t("fidelity.settingsB.sync.pop.remote")}</span><b>{remoteLabel}</b></div>
              </div>
            </> : <p className="t3-b-sync-pop-desc">{t("fidelity.settingsB.sync.pop.firstUpload")}</p>}
            <div className="t3-b-sync-pop-actions">
              {status.sync.phase !== "syncing" && <Button size="sm" variant={status.sync.phase === "error" ? "default" : report ? "outline" : "default"}
                onClick={() => void syncRuntime.syncNow()}>{t(status.sync.phase === "error" ? "fidelity.settingsB.sync.pop.retry" : "sync.now")}</Button>}
              {status.sync.phase === "error" && diagnostics
                ? <Button size="sm" variant="outline" onClick={() => void copyDiagnostics(diagnostics)}>{t("sync.details.copy")}</Button>
                : report || status.sync.diagnostics
                ? <SyncDetails report={report} diagnostics={status.sync.diagnostics} t={t} ConfirmDialog={ConfirmDialog} />
                : <a href="#/settings/sync" onClick={() => setOpen(false)}>{t("fidelity.settingsB.sync.pop.settings")}</a>}
            </div>
            {copyMessage && <p role="status" className="t3-b-sync-pop-desc">{copyMessage}</p>}
            {status.sync.phase === "error" && diagnostics && <SyncDetails report={report} diagnostics={diagnostics} t={t}
              summaryLabel={t("fidelity.settingsB.sync.pop.errorDetails")} ConfirmDialog={ConfirmDialog} />}
          </div>
          </> : <>
          {fidelitySheet && (!locked || compactLocked) ? <div className="fidelity-sync-sheet-head">
            <h2>{t(locked ? "fidelity.b.sync.sheetLocked" : status.sync.retryStopped ? "fidelity.b.sync.stopped" : phase === "error" || phase === "unreadable"
              ? "fidelity.b.sync.sheetFailed" : phase === "syncing" ? "fidelity.b.sync.syncing"
                : never ? "settings.tab.sync" : "fidelity.b.sync.sheetUpToDate")}</h2>
            <span className={`fidelity-sync-sheet-pill${locked ? " is-warning" : phase === "error" || phase === "unreadable"
              ? " is-error" : report && status.sync.phase === "idle" ? " is-positive" : ""}`}>
              {t(locked ? "fidelity.b.sync.sheetPassphraseNeeded" : status.sync.retryStopped
                ? "fidelity.b.sync.sheetNeedsAttention" : phase === "error" || phase === "unreadable"
                  ? "fidelity.b.sync.sheetRetrying"
                : phase === "syncing" ? status.sync.progress?.phase === "pull" ? "fidelity.b.sync.sheetDownloading" : "fidelity.b.sync.sheetUploading"
                  : never ? "fidelity.b.sync.sheetNever" : "fidelity.b.sync.synced")}
            </span>
          </div> : !(mobile && locked && !compactLocked) && <h2 className="text-base font-semibold">{t("sync.status.details")}</h2>}
          {status.mode === "unreadable" ? <>
            <p role="alert" className="text-destructive">{t("sync.unreadable")}</p>
            <a href="#/settings/sync" className="text-primary underline">{t("sync.reenter")}</a>
          </> : fidelityLocked ? (
            <div className="t3-sync-fidelity-locked">
              <LockClosedIcon className="t3-sync-fidelity-lock-icon" aria-hidden="true" />
              <h2>{t("sync.fidelity.lockedTitle")}</h2>
              <p className="t3-sync-fidelity-intro">{t("sync.fidelity.lockedDescription").replace("{destination}",
                syncRuntime.getSettings().endpoint.includes("r2.cloudflarestorage.com")
                  ? t("sync.fidelity.cloudflareDestination") : t("sync.fidelity.s3Destination"))}</p>
              <Label htmlFor="sync-status-passphrase">{t("sync.passphrase.label")}</Label>
              <div className="t3-sync-fidelity-input">
                <Input id="sync-status-passphrase" type={showPassword ? "text" : "password"} autoComplete="off"
                  aria-invalid={!!error} aria-describedby={error ? "sync-status-passphrase-error" : "sync-status-passphrase-hint"}
                  value={passphrase} onChange={(event) => setPassphrase(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") void unlock(); }} />
                <button type="button" aria-label={showPassword ? t("sync.fidelity.hidePassphrase") : t("sync.fidelity.showPassphrase")}
                  onClick={() => setShowPassword(!showPassword)}>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z"/><circle cx="10" cy="10" r="2.5"/></svg>
                </button>
              </div>
              {error ? <p id="sync-status-passphrase-error" role="alert" className="t3-sync-fidelity-error">{error}</p>
                : <p id="sync-status-passphrase-hint" className="t3-sync-fidelity-hint">{t("sync.fidelity.passphraseHint")}</p>}
              <button type="button" className="t3-sync-fidelity-forgot" onClick={() => setShowRecovery(!showRecovery)}>{t("sync.fidelity.forgot")}</button>
              {showRecovery && <div className="t3-sync-fidelity-recovery"><SyncRecoveryUnlock t={t} /></div>}
              <div className="t3-sync-fidelity-actions">
                <Button variant="ghost" disabled={busy} onClick={() => { syncRuntime.skip(); setOpen(false); }}>{t("sync.fidelity.continueWithout")}</Button>
                <Button disabled={busy} onClick={() => void unlock()}>{t("sync.fidelity.unlock")}</Button>
              </div>
            </div>
          ) : locked && mobile && !compactLocked ? (
            <div className="fd-sync-locked">
              <LockClosedIcon className="fd-sync-lock-icon" aria-hidden="true" />
              <h2>{t("fidelity.startup.syncLocked")}</h2>
              <p>{t("fidelity.startup.syncDescription")}</p>
              <Label htmlFor="sync-status-passphrase">{t("fidelity.startup.syncPassphrase")}</Label>
              <div className="fd-sync-passphrase">
                <Input id="sync-status-passphrase" type={showPassphrase ? "text" : "password"} autoComplete="off"
                  aria-invalid={!!error} aria-describedby={error ? "sync-status-passphrase-error" : undefined}
                  value={passphrase} onChange={(event) => setPassphrase(event.target.value)} />
                <button type="button" aria-label={t(showPassphrase ? "fidelity.startup.hidePassphrase" : "fidelity.startup.showPassphrase")}
                  onClick={() => setShowPassphrase((shown) => !shown)}>
                  {showPassphrase ? <EyeClosedIcon aria-hidden="true" /> : <EyeOpenIcon aria-hidden="true" />}
                </button>
              </div>
              {!error && <p className="fd-sync-passphrase-hint">{t("fidelity.startup.syncHint")}</p>}
              {error && <p id="sync-status-passphrase-error" role="alert" className="ios-d3-sync-unlock-error">
                <ExclamationTriangleIcon aria-hidden="true" />{error}</p>}
              <button type="button" className="fd-sync-forgot" onClick={() => recoveryRef.current?.scrollIntoView({ block: "start" })}>
                {t("fidelity.startup.forgotPassphrase")}</button>
              <Button className="fd-sync-unlock" disabled={busy} onClick={() => void unlock()}>{t("fidelity.startup.unlock")}</Button>
              <Button className="fd-sync-skip" disabled={busy} onClick={() => {
                syncRuntime.skip();
                setOpen(false);
              }}>{t("fidelity.startup.continueWithoutSync")}</Button>
              <div className="fd-sync-secondary" ref={recoveryRef}>
                <SyncRecoveryUnlock t={t} />
                {disableError && <p role="alert" className="text-destructive">{disableError}</p>}
                <ConfirmDialog
                  trigger={<Button size="sm" variant="link" disabled={busy}
                    className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left text-muted-foreground"
                  >{t("sync.status.turnOffDevice")}</Button>}
                  title={t("sync.status.turnOffTitle")}
                  description={t("sync.status.turnOffDescription")}
                  cancelLabel={t("common.cancel")}
                  actions={[{ label: t("sync.status.turnOffConfirm"), onClick: () => { void disable(); } }]}
                />
              </div>
            </div>
          ) : locked ? (
            <div className="space-y-2">
              {mobile && <p className="fidelity-sync-sheet-description">{t("fidelity.b.sync.sheetLockedBody")}</p>}
              <Label htmlFor="sync-status-passphrase" className={mobile ? "sr-only" : undefined}>{t("sync.passphrase.label")}</Label>
              <Input id="sync-status-passphrase" type="password" autoComplete="off"
                aria-invalid={!!error} aria-describedby={error ? "sync-status-passphrase-error" : undefined}
                value={passphrase} onChange={(event) => setPassphrase(event.target.value)} />
              <div className={mobile ? "fidelity-sync-sheet-actions" : "flex flex-wrap gap-2"}>
                <Button size="sm" className={mobile ? "is-primary" : undefined} disabled={busy} onClick={() => void unlock()}>{t("sync.unlock")}</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                  syncRuntime.skip();
                  setOpen(false);
                }}>{t("sync.status.skip")}</Button>
              </div>
              {error && <p id="sync-status-passphrase-error" role="alert" className={mobile ? "ios-d3-sync-unlock-error" : "text-destructive"}>
                {mobile && <InfoCircledIcon aria-hidden="true" />}{error}</p>}
              <SyncRecoveryUnlock t={t} />
              {disableError && <p role="alert" className="text-destructive">{disableError}</p>}
              <ConfirmDialog
                trigger={<Button size="sm" variant="link" disabled={busy}
                  className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left text-muted-foreground"
                >{t("sync.status.turnOffDevice")}</Button>}
                title={t("sync.status.turnOffTitle")}
                description={t("sync.status.turnOffDescription")}
                cancelLabel={t("common.cancel")}
                actions={[{ label: t("sync.status.turnOffConfirm"), onClick: () => { void disable(); } }]}
              />
            </div>
          ) : <>
            {fidelitySheet && status.sync.phase === "syncing" ? <>
              {status.sync.progress && status.sync.progress.total > 0 && <div className="fidelity-sync-sheet-progress">
                <p id="sync-progress-label">{t(status.sync.progress.phase === "push" ? "sync.status.uploading" : "sync.status.downloading")
                  .replace("{completed}", progressCompleted.toLocaleString("en-US"))
                  .replace("{total}", status.sync.progress.total.toLocaleString("en-US"))}</p>
                <Progress value={progressCompleted} max={status.sync.progress.total} aria-labelledby="sync-progress-label" />
              </div>}
              <dl className="fidelity-sync-sheet-progress-stats">
                <div><dt>{t("fidelity.b.sync.sheetElapsed")}</dt><dd>{elapsedTime}</dd></div>
                {itemsPerSecond > 0 && <div><dt>{t("fidelity.b.sync.sheetSpeed")}</dt>
                  <dd>{t("fidelity.b.sync.sheetItemsPerSecond").replace("{count}", itemsPerSecond.toFixed(1))}</dd></div>}
                {remainingMinutes !== undefined && <div><dt>{t("fidelity.b.sync.sheetTimeLeft")}</dt>
                  <dd>{t("fidelity.b.sync.sheetAboutMinutes").replace("{count}", String(remainingMinutes))}</dd></div>}
                {status.sync.progress && <div><dt>{t("fidelity.b.sync.sheetItemsLeft")}</dt>
                  <dd>{remainingItems.toLocaleString("en-US")}</dd></div>}
              </dl>
            </> : status.sync.phase === "syncing" ? <>
              <p>{t("sync.status.running")}</p>
              {status.sync.startedAt !== undefined && <p className="text-muted-foreground">
                {t("sync.status.started").replace("{time}", new Date(status.sync.startedAt).toLocaleString())}
                {" · "}{t("sync.status.elapsed").replace("{seconds}", String(Math.max(0, Math.floor((now - status.sync.startedAt) / 1000))))}
              </p>}
              {status.sync.progress && status.sync.progress.total > 0 && <div className="space-y-1.5">
                <p id="sync-progress-label">{t(status.sync.progress.phase === "push" ? "sync.status.uploading" : "sync.status.downloading")
                  .replace("{completed}", progressCompleted.toLocaleString("en-US"))
                  .replace("{total}", status.sync.progress.total.toLocaleString("en-US"))}</p>
                <Progress value={progressCompleted} max={status.sync.progress.total}
                  aria-labelledby="sync-progress-label" />
              </div>}
            </> : <>
              {status.sync.retryStopped
                ? <p className={fidelitySheet ? "fidelity-sync-sheet-stopped-warning" : "text-destructive"}>{t("sync.status.retryStopped")}</p>
                : report?.errors.length && status.sync.phase === "error"
                  ? <p className="text-destructive">{t("sync.status.errorsPresent")}</p>
                  : null}
              {status.sync.error && status.sync.error !== "sync" &&
                <p className="text-destructive">{t(`sync.connection.${status.sync.error}`)}</p>}
              {status.sync.phase === "idle" && (fidelitySheet ? never : !report) && (fidelitySheet
                ? <p className="fidelity-sync-sheet-description">{t("fidelity.b.sync.sheetNeverBody")}<span className="sr-only">{t("sync.status.never")}</span></p>
                : <p>{t("sync.status.never")}</p>)}
              {status.sync.phase === "idle" && report && !changed && !fidelitySheet && <p>{t("sync.status.upToDate")}</p>}
              {report && changed && (status.sync.phase === "idle" || report.errors.length > 0) && !fidelitySheet && <p>{counts}</p>}
              {status.sync.phase === "error" && status.sync.lastSync === undefined && <p>{t("sync.status.never")}</p>}
              {status.sync.lastSync !== undefined && (fidelitySheet
                ? <p className="fidelity-sync-sheet-description">{t("fidelity.b.sync.sheetLastUpload").replace("{time}", lastUploadText ?? "")}</p>
                : <p className="text-muted-foreground">
                  {t(status.sync.phase === "error" ? "sync.status.last" : "sync.status.lastSynced")
                    .replace("{time}", new Date(status.sync.lastSync).toLocaleString())}
                </p>)}
              {fidelitySheet && report && status.sync.phase === "idle" && !never && <dl className="fidelity-sync-sheet-stats">
                <div><dt>{t("fidelity.b.sync.sheetUploaded")}</dt><dd>{report.pushed} {t("fidelity.b.sync.sheetItems")}</dd></div>
                <div><dt>{t("fidelity.b.sync.sheetDownloaded")}</dt><dd>{report.pulled} {t("fidelity.b.sync.sheetItems")}</dd></div>
                {report.devices && <div><dt>{t("fidelity.b.sync.devices")}</dt><dd>{report.devices.length}</dd></div>}
                <div><dt>{t("fidelity.b.sync.sheetRemote")}</dt><dd>{mobileRemoteLabel}</dd></div>
              </dl>}
              {report?.conflicts.length && !fidelitySheet ? <p className="text-amber-600 dark:text-amber-400">
                {t("sync.status.conflictSummary").replace("{count}", String(report.conflicts.length))}
              </p> : null}
            </>}
            {(!fidelitySheet || status.sync.phase !== "syncing") && <div className={fidelitySheet ? "fidelity-sync-sheet-actions" : undefined}>
              <Button size="sm" variant={fidelitySheet && never ? "default" : "outline"}
                className={fidelitySheet && never ? "is-primary" : undefined} disabled={status.sync.phase === "syncing"}
                onClick={() => void syncRuntime.syncNow()}>{fidelitySheet && <ReloadIcon aria-hidden="true" />}
                {t(fidelitySheet && status.sync.phase === "error" ? "fidelity.b.sync.sheetRetryNow" : "sync.now")}</Button>
              {fidelitySheet && status.sync.phase === "idle" && !never
                ? <SyncDetails report={report} diagnostics={status.sync.diagnostics} t={t} ConfirmDialog={ConfirmDialog} />
                : fidelitySheet && <a href="#/settings/sync" onClick={() => setOpen(false)}>{t("settings.title")}</a>}
            </div>}
            {(!fidelitySheet || status.sync.phase !== "idle" || never) &&
              <SyncDetails report={fidelitySheet && never ? undefined : report} diagnostics={status.sync.diagnostics} t={t}
                ConfirmDialog={ConfirmDialog} defaultExpanded={fidelitySheet && status.sync.phase === "error" && !status.sync.retryStopped}
                showConflicts={!fidelitySheet || status.sync.phase !== "error"}
                errorLabel={fidelitySheet && status.sync.phase === "error" && status.sync.error
                  ? t(status.sync.error === "sync" ? "sync.status.errorsPresent" : `sync.connection.${status.sync.error}`) : undefined} />}
          </>}
          </>}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function SyncStatusIndicator({ recordsStamp = false, overviewFidelity = false }: { recordsStamp?: boolean; overviewFidelity?: boolean }) {
  const { t } = useTranslation();
  return <SyncStatusIndicatorView t={t} recordsStamp={recordsStamp} overviewFidelity={overviewFidelity} />;
}
