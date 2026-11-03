import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ExclamationTriangleIcon, EyeClosedIcon, EyeOpenIcon, InfoCircledIcon, LockClosedIcon } from "@radix-ui/react-icons";
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

type Props = {
  t: (key: string, fallback?: string) => string;
  mobile?: boolean;
  recordsStamp?: boolean;
  ConfirmDialog?: typeof ConfirmDeleteDialog;
};

export function SyncStatusIndicatorView({ t, mobile = false, recordsStamp = false, ConfirmDialog = ConfirmDeleteDialog }: Props) {
  const status = useSyncExternalStore(syncRuntime.subscribe, syncRuntime.status);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [disableError, setDisableError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
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
  const progressCompleted = status.sync.progress
    ? Math.min(status.sync.progress.completed, status.sync.progress.total) : 0;

  async function unlock() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await syncRuntime.unlock(passphrase);
      setError(result === "ok" ? "" : mobile && result === "passphrase"
        ? t("fidelity.startup.syncWrongPassphrase") : t(`sync.connection.${result}`));
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
        {busy ? t("common.loading") : statusLabel}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={statusLabel} title={muted ? t("sync.status.skipped") : undefined}
            data-synced={syncedAt ? "true" : undefined}
            className={muted
              ? "t3-topbar-sync-button flex h-9 w-9 touch:h-11 touch:w-11 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              : "t3-topbar-sync-button flex min-h-9 touch:min-h-11 items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"}>
            {muted ? <LockClosedIcon aria-hidden="true" /> : <>
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${phase === "error" || phase === "unreadable" ? "bg-destructive" : phase === "conflict" ? "bg-amber-500" : phase === "syncing" ? "bg-primary animate-pulse motion-reduce:animate-none" : "bg-muted-foreground"}`} />
              {mobile && <svg className="fd-sync-cloud-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M5.3 14.5h9a3.4 3.4 0 0 0 .2-6.8 4.8 4.8 0 0 0-9.1-1.2 4 4 0 0 0-.1 8z" />
              </svg>}
              {statusLabel}
            </>}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" collisionPadding={16}
          // Radix Escape was intermittent with focused content in the widened card; nested confirmations handle their own Escape.
          onKeyDown={(event) => {
            if (event.key === "Escape" && !document.querySelector('[role="alertdialog"]')) setOpen(false);
          }}
          onInteractOutside={(event) => {
            if (document.querySelector('[role="alertdialog"]')) event.preventDefault();
          }}
          data-locked={mobile && locked}
          className={`t3-sync-popover max-h-[min(85vh,760px)] w-[calc(100vw-2rem)] max-w-[520px] overflow-y-auto space-y-3 text-sm ${mobile ? "ios-d3-sync-popover" : ""}`}>
          {!(mobile && locked) && <h2 className="text-base font-semibold">{t("sync.status.details")}</h2>}
          {status.mode === "unreadable" ? <>
            <p role="alert" className="text-destructive">{t("sync.unreadable")}</p>
            <a href="#/settings/sync" className="text-primary underline">{t("sync.reenter")}</a>
          </> : locked && mobile ? (
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
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function SyncStatusIndicator({ recordsStamp = false }: { recordsStamp?: boolean }) {
  const { t } = useTranslation();
  return <SyncStatusIndicatorView t={t} recordsStamp={recordsStamp} />;
}
