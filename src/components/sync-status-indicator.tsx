import { useEffect, useState, useSyncExternalStore } from "react";
import { LockClosedIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";
import { SyncDetails } from "@/components/sync-details";
import { useTranslation } from "@/i18n";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import { SyncRecoveryUnlock } from "@/components/settings/sync-recovery";
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
  ConfirmDialog?: typeof ConfirmDeleteDialog;
};

export function SyncStatusIndicatorView({ t, mobile = false, ConfirmDialog = ConfirmDeleteDialog }: Props) {
  const status = useSyncExternalStore(syncRuntime.subscribe, syncRuntime.status);
  const wide = useWideDesktop() && !mobile;
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [disableError, setDisableError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
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
  const progressCompleted = status.sync.progress
    ? Math.min(status.sync.progress.completed, status.sync.progress.total) : 0;
  const displayLabel = wide && phase === "idle" && status.sync.lastSync !== undefined
    ? t("fidelity.settingsB.sync.syncedAt").replace("{time}", new Date(status.sync.lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }))
    : wide && status.sync.retryStopped ? t("fidelity.settingsB.sync.pop.stopped")
    : wide && phase === "error" ? t("fidelity.settingsB.sync.pop.failedTitle")
    : t(`sync.status.${phase}`);
  const elapsedSeconds = status.sync.startedAt === undefined ? 0 : Math.max(0, Math.floor((now - status.sync.startedAt) / 1000));
  const remaining = status.sync.progress ? Math.max(0, status.sync.progress.total - progressCompleted) : 0;
  const speed = elapsedSeconds > 0 ? progressCompleted / elapsedSeconds : 0;
  const minutesLeft = speed > 0 ? Math.round(remaining / speed / 60) : 0;
  const uploadTime = status.sync.lastSync === undefined ? undefined
    : new Date(status.sync.lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const syncSettings = wide && status.mode === "ready" && typeof syncRuntime.getSettings === "function"
    ? syncRuntime.getSettings() : undefined;
  const remoteLabel = `${syncSettings?.endpoint?.includes(".r2.cloudflarestorage.com") ? "Cloudflare R2 · " : ""}${syncSettings?.bucket || "—"}`;

  async function unlock() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await syncRuntime.unlock(passphrase);
      setError(result === "ok" ? "" : t(`sync.connection.${result}`));
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
        {busy ? t("common.loading") : displayLabel}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={displayLabel} title={muted ? t("sync.status.skipped") : undefined}
            className={muted
              ? "t3-topbar-sync-button flex h-9 w-9 touch:h-11 touch:w-11 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              : "t3-topbar-sync-button flex min-h-9 touch:min-h-11 items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"}>
            {muted ? <LockClosedIcon aria-hidden="true" /> : <>
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${phase === "error" || phase === "unreadable" ? "bg-destructive" : phase === "conflict" ? "bg-amber-500" : phase === "syncing" ? "bg-primary animate-pulse motion-reduce:animate-none" : "bg-muted-foreground"}`} />
              {displayLabel}
            </>}
          </button>
        </PopoverTrigger>
        {wide && open && <div className="t3-b-sync-scrim" aria-hidden="true" onClick={() => setOpen(false)} />}
        <PopoverContent align="end" side="bottom" sideOffset={wide ? -10 : 4} collisionPadding={16}
          // Radix Escape was intermittent with focused content in the widened card; nested confirmations handle their own Escape.
          onKeyDown={(event) => {
            if (event.key === "Escape" && !document.querySelector('[role="alertdialog"]')) setOpen(false);
          }}
          onInteractOutside={(event) => {
            if (document.querySelector('[role="alertdialog"]')) event.preventDefault();
          }}
          className={`t3-sync-popover max-h-[min(85vh,760px)] w-[calc(100vw-2rem)] max-w-[520px] overflow-y-auto space-y-3 text-sm ${mobile ? "ios-d3-sync-popover" : ""} ${wide ? "t3-b-sync-popover" : ""}`}>
          {wide && status.mode === "ready" ? <div className="t3-b-sync-pop-content">
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
          </div> : <>
          <h2 className="text-base font-semibold">{t("sync.status.details")}</h2>
          {status.mode === "unreadable" ? <>
            <p role="alert" className="text-destructive">{t("sync.unreadable")}</p>
            <a href="#/settings/sync" className="text-primary underline">{t("sync.reenter")}</a>
          </> : locked ? (
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

export default function SyncStatusIndicator() {
  const { t } = useTranslation();
  return <SyncStatusIndicatorView t={t} />;
}
