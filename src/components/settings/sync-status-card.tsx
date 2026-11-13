import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncActionButton } from "@/components/settings/sync-action-button";
import { ReloadIcon } from "@radix-ui/react-icons";
import { SyncDetails } from "@/components/sync-details";
import type { Locale } from "@/i18n";
import type { RuntimeStatus } from "@/middlelayers/sync/runtime";
import type { SyncStatus } from "@/middlelayers/sync/scheduler";

type Props = {
  status: RuntimeStatus;
  busy: string | undefined;
  onSyncNow: () => void;
  t: (key: string) => string;
  locale: Locale;
};

// Objects a finished round left behind: parked ones plus errors that did not stop the round.
export function syncSkippedCount(sync: SyncStatus): number {
  return sync.phase === "idle" && sync.partial && sync.report
    ? (sync.report.skipped ?? 0) + sync.report.errors.length : 0;
}

export function syncSkippedLabel(count: number, t: (key: string) => string, prefix: "sync.status" | "sync.control" = "sync.status"): string {
  return t(`${prefix}.${count === 1 ? "partialOne" : "partial"}`).replace("{count}", count.toLocaleString());
}

export function syncRetryNote(sync: SyncStatus, t: (key: string) => string): string | undefined {
  if (sync.phase !== "error") return undefined;
  if (sync.retryStopped) {
    // The first failed round is not a retry.
    const attempts = (sync.failures ?? 0) - 1;
    return attempts < 1 ? undefined
      : t(attempts === 1 ? "sync.status.retryPausedOne" : "sync.status.retryPaused").replace("{count}", String(attempts));
  }
  return sync.nextRetryAt === undefined ? undefined
    : t("sync.status.nextRetryAt").replace("{time}", new Date(sync.nextRetryAt).toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }));
}

export function SyncStatusCard({ status, busy, onSyncNow, t, locale }: Props) {
  if (status.mode !== "ready" && status.mode !== "locked") return null;
  const sync = status.sync;
  const skipped = syncSkippedCount(sync);
  const retryNote = syncRetryNote(sync, t);
  const state = status.mode === "locked" ? t("sync.status.locked")
    : sync.phase === "error" ? t("sync.status.error")
      : sync.phase === "syncing" ? t("sync.status.syncing")
        : skipped ? syncSkippedLabel(skipped, t)
          : t("sync.status.connected");

  return <Card className="t3-sync-status">
    <CardHeader><CardTitle>{t("sync.status.cardTitle")}</CardTitle></CardHeader>
    <CardContent>
      <dl className="t3-sync-status-rows">
        <div><dt>{t("sync.status.state")}</dt><dd>{state}</dd></div>
        <div><dt>{t("sync.status.lastSuccessful")}</dt><dd>{sync.lastSync
          ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", {
            day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
          }).format(sync.lastSync) : t("sync.status.never")}</dd></div>
        {sync.report && <>
          <div><dt>{t("sync.status.uploaded")}</dt><dd>{sync.report.pushed.toLocaleString()}</dd></div>
          <div><dt>{t("sync.status.downloaded")}</dt><dd>{sync.report.pulled.toLocaleString()}</dd></div>
        </>}
      </dl>
      {retryNote && <p className="mb-3 text-sm text-muted-foreground">{retryNote}</p>}
      <SyncActionButton disabled={!!busy || status.mode !== "ready"} pending={busy === "now"}
        pendingLabel={t("sync.pending.now")} onClick={onSyncNow}><ReloadIcon aria-hidden="true" />{t("sync.now")}</SyncActionButton>
      {sync.report && sync.diagnostics && <SyncDetails report={sync.report} diagnostics={sync.diagnostics} t={t} />}
    </CardContent>
  </Card>;
}
