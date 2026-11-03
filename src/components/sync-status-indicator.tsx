import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CopyIcon, LockClosedIcon } from "@radix-ui/react-icons";
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
import { serializeSyncDiagnostics } from "@/middlelayers/sync/diagnostics";

type Props = {
  t: (key: string, fallback?: string) => string;
  mobile?: boolean;
  overviewFidelity?: boolean;
  ConfirmDialog?: typeof ConfirmDeleteDialog;
};

export function SyncStatusIndicatorView({ t, mobile = false, overviewFidelity = false, ConfirmDialog = ConfirmDeleteDialog }: Props) {
  const status = useSyncExternalStore(syncRuntime.subscribe, syncRuntime.status);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [disableError, setDisableError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryExportOpen, setRecoveryExportOpen] = useState(false);
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
  const muted = status.mode === "locked" && status.skipped;
  const phase = status.mode === "unreadable" ? "unreadable" :
    status.mode === "locked" ? (muted ? "skipped" : "locked") :
      status.sync.phase === "idle" && report?.conflicts.length ? "conflict" : status.sync.phase;
  const changed = !!report && (report.pulled > 0 || report.pushed > 0 || report.conflicts.length > 0 || report.errors.length > 0);
  const counts = report && t("sync.status.counts")
    .replace("{pulled}", String(report.pulled))
    .replace("{pushed}", String(report.pushed))
    .replace("{conflicts}", String(report.conflicts.length))
    .replace("{errors}", String(report.errors.length));
  const locked = status.mode === "locked";
  const fidelityLocked = locked && overviewFidelity && !mobile && window.innerWidth >= 1400;
  const progressCompleted = status.sync.progress
    ? Math.min(status.sync.progress.completed, status.sync.progress.total) : 0;
  const fidelityReady = overviewFidelity && status.mode === "ready" && status.sync.phase === "idle" &&
    !!report && !report.conflicts.length && !report.errors.length && status.sync.lastSync !== undefined;
  const settings = fidelityReady ? syncRuntime.getSettings() : undefined;
  const destination = settings?.endpoint.includes("r2.cloudflarestorage.com")
    ? t("overview.fidelity.cloudflareDestination") : t("overview.fidelity.s3Destination");
  const syncedTime = status.sync.lastSync !== undefined
    ? new Date(status.sync.lastSync).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
  const deviceNames = report?.devices?.map((device) => device.name || device.id.slice(0, 8)) ?? [];

  async function unlock() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await syncRuntime.unlock(passphrase);
      setError(result === "ok" ? "" : result === "passphrase" && fidelityLocked
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

  return (
    <div className={mobile ? "ios-d3-sync-indicator t3-topbar-sync" : "desktop-sync-status-indicator t3-topbar-sync"}>
      <span role="status" aria-live="polite" className="sr-only">
        {busy ? t("common.loading") : t(`sync.status.${phase}`)}
      </span>
      {fidelityLocked && open && createPortal(<div className="t3-sync-lock-scrim" aria-hidden="true" />, document.body)}
      {recoveryExportOpen && createPortal(<div className="t3-sync-recovery-fullscrim" aria-hidden="true" />, document.body)}
      <Dialog open={recoveryExportOpen} onOpenChange={setRecoveryExportOpen}>
        <DialogContent className="t3-sync-recovery-dialog">
          <DialogHeader>
            <DialogTitle>{t("sync.fidelity.saveRecoveryFileTitle")}</DialogTitle>
            <DialogDescription className="sr-only">{t("sync.recovery.scope")}</DialogDescription>
          </DialogHeader>
          <SyncRecoveryExport t={t} />
        </DialogContent>
      </Dialog>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={t(`sync.status.${phase}`)} title={muted ? t("sync.status.skipped") : undefined}
            className={muted
              ? "t3-topbar-sync-button flex h-9 w-9 touch:h-11 touch:w-11 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              : "t3-topbar-sync-button flex min-h-9 touch:min-h-11 items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"}>
            {muted ? <LockClosedIcon aria-hidden="true" /> : <>
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${phase === "error" || phase === "unreadable" ? "bg-destructive" : phase === "conflict" ? "bg-amber-500" : fidelityReady ? "bg-positive" : phase === "syncing" ? "bg-primary animate-pulse motion-reduce:animate-none" : "bg-muted-foreground"}`} />
              {fidelityReady ? t("overview.fidelity.syncedAt").replace("{time}", syncedTime) : t(`sync.status.${phase}`)}
              {fidelityReady && <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5.5 18h12a4 4 0 0 0 .5-7.97A6.5 6.5 0 0 0 5.37 9.1 4.5 4.5 0 0 0 5.5 18Z" />
              </svg>}
            </>}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" sideOffset={fidelityReady ? 8 : 0} collisionPadding={16}
          // Radix Escape was intermittent with focused content in the widened card; nested confirmations handle their own Escape.
          onKeyDown={(event) => {
            if (event.key === "Escape" && !document.querySelector('[role="alertdialog"]')) setOpen(false);
          }}
          onInteractOutside={(event) => {
            if (fidelityLocked || document.querySelector('[role="alertdialog"]')) event.preventDefault();
          }}
          className={`t3-sync-popover max-h-[min(85vh,760px)] w-[calc(100vw-2rem)] max-w-[520px] overflow-y-auto space-y-3 text-sm ${mobile ? "ios-d3-sync-popover" : ""} ${fidelityLocked ? "t3-sync-lock-dialog" : ""}`}>
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
          </div> : <>
          {!fidelityLocked && <h2 className="text-base font-semibold">{t("sync.status.details")}</h2>}
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
          ) : locked ? (
            <div className="space-y-2">
              <Label htmlFor="sync-status-passphrase">{t("sync.passphrase.label")}</Label>
              <Input id="sync-status-passphrase" type="password" autoComplete="off"
                aria-invalid={!!error} aria-describedby={error ? "sync-status-passphrase-error" : undefined}
                value={passphrase} onChange={(event) => setPassphrase(event.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => void unlock()}>{t("sync.unlock")}</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                  syncRuntime.skip();
                  setOpen(false);
                }}>{t("sync.status.skip")}</Button>
              </div>
              {error && <p id="sync-status-passphrase-error" role="alert" className="text-destructive">{error}</p>}
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
            {status.sync.phase === "syncing" ? <>
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
                ? <p className="text-destructive">{t("sync.status.retryStopped")}</p>
                : report?.errors.length && status.sync.phase === "error"
                  ? <p className="text-destructive">{t("sync.status.errorsPresent")}</p>
                  : null}
              {status.sync.error && status.sync.error !== "sync" &&
                <p className="text-destructive">{t(`sync.connection.${status.sync.error}`)}</p>}
              {status.sync.phase === "idle" && !report && <p>{t("sync.status.never")}</p>}
              {status.sync.phase === "idle" && report && !changed && <p>{t("sync.status.upToDate")}</p>}
              {report && changed && (status.sync.phase === "idle" || report.errors.length > 0) && <p>{counts}</p>}
              {status.sync.phase === "error" && status.sync.lastSync === undefined && <p>{t("sync.status.never")}</p>}
              {status.sync.lastSync !== undefined && <p className="text-muted-foreground">
                {t(status.sync.phase === "error" ? "sync.status.last" : "sync.status.lastSynced")
                  .replace("{time}", new Date(status.sync.lastSync).toLocaleString())}
              </p>}
              {report?.conflicts.length ? <p className="text-amber-600 dark:text-amber-400">
                {t("sync.status.conflictSummary").replace("{count}", String(report.conflicts.length))}
              </p> : null}
            </>}
            <Button size="sm" variant="outline" disabled={status.sync.phase === "syncing"}
              onClick={() => void syncRuntime.syncNow()}>{t("sync.now")}</Button>
            <SyncDetails report={report} diagnostics={status.sync.diagnostics} t={t} ConfirmDialog={ConfirmDialog} />
          </>}
          </>}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function SyncStatusIndicator({ overviewFidelity = false }: { overviewFidelity?: boolean }) {
  const { t } = useTranslation();
  return <SyncStatusIndicatorView t={t} overviewFidelity={overviewFidelity} />;
}
