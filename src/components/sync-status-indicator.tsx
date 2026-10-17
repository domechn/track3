import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from "@/i18n";
import { syncRuntime } from "@/middlelayers/sync/runtime";

export default function SyncStatusIndicator() {
  const { t } = useTranslation();
  const status = useSyncExternalStore(syncRuntime.subscribe, syncRuntime.status);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status.mode === "locked") setOpen(true);
  }, [status.mode]);

  if (status.mode === "loading" || status.mode === "disabled") return null;

  const report = status.sync.report;
  const phase = status.mode === "unreadable" ? "unreadable" : status.mode === "locked" ? "locked" :
    status.sync.phase === "idle" && report?.conflicts.length ? "conflict" : status.sync.phase;
  const counts = t("sync.status.counts")
    .replace("{pulled}", String(report?.pulled ?? 0))
    .replace("{pushed}", String(report?.pushed ?? 0))
    .replace("{conflicts}", String(report?.conflicts.length ?? 0))
    .replace("{errors}", String(report?.errors.length ?? 0));

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

  return (
    <div className="fixed bottom-14 right-4 z-50">
      <span role="status" aria-live="polite" className="sr-only">
        {busy ? t("common.loading") : t(`sync.status.${phase}`)}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={t(`sync.status.${phase}`)}
            className="flex min-h-9 touch:min-h-11 items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs text-foreground shadow-sm backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${phase === "error" || phase === "unreadable" ? "bg-destructive" : phase === "conflict" ? "bg-amber-500" : phase === "syncing" ? "bg-primary animate-pulse motion-reduce:animate-none" : "bg-muted-foreground"}`} />
            {t(`sync.status.${phase}`)}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" collisionPadding={16}
          className="w-[calc(100vw-2rem)] max-w-72 space-y-3 text-sm">
          <h2 className="font-semibold">{t("sync.status.details")}</h2>
          {status.mode === "unreadable" ? (
            <>
              <p role="alert" className="text-destructive">{t("sync.unreadable")}</p>
              <a href="#/settings/sync" className="text-primary underline">{t("sync.reenter")}</a>
            </>
          ) : status.mode === "locked" ? (
            <div className="space-y-2">
              <Label htmlFor="sync-status-passphrase">{t("sync.passphrase.label")}</Label>
              <Input id="sync-status-passphrase" type="password" autoComplete="off"
                aria-invalid={!!error} aria-describedby={error ? "sync-status-passphrase-error" : undefined}
                value={passphrase} onChange={(event) => setPassphrase(event.target.value)} />
              <Button size="sm" disabled={busy} onClick={() => void unlock()}>{t("sync.unlock")}</Button>
              {error && <p id="sync-status-passphrase-error" role="alert" className="text-destructive">{error}</p>}
            </div>
          ) : (
            <>
              <p>{counts}</p>
              {status.sync.lastSync && <p className="text-muted-foreground">
                {t("sync.status.last").replace("{time}", new Date(status.sync.lastSync).toLocaleString())}
              </p>}
              {report?.conflicts.length ? <p className="text-amber-600 dark:text-amber-400">
                {t("sync.status.conflictSummary").replace("{count}", String(report.conflicts.length))}
              </p> : null}
              {status.sync.retryStopped
                ? <p className="text-destructive">{t("sync.status.retryStopped")}</p>
                : report?.errors.length
                  ? <p className="text-destructive">{t("sync.status.errorsPresent")}</p>
                  : null}
              {status.sync.error && status.sync.error !== "sync" &&
                <p className="text-destructive">{t(`sync.connection.${status.sync.error}`)}</p>}
              <Button size="sm" variant="outline" disabled={phase === "syncing"} onClick={() => void syncRuntime.syncNow()}>{t("sync.now")}</Button>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
