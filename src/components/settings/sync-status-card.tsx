import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncActionButton } from "@/components/settings/sync-action-button";
import { ReloadIcon } from "@radix-ui/react-icons";
import type { Locale } from "@/i18n";
import type { RuntimeStatus } from "@/middlelayers/sync/runtime";

type Props = {
  status: RuntimeStatus;
  busy: string | undefined;
  onSyncNow: () => void;
  t: (key: string) => string;
  locale: Locale;
};

export function SyncStatusCard({ status, busy, onSyncNow, t, locale }: Props) {
  if (status.mode !== "ready" && status.mode !== "locked") return null;
  const sync = status.sync;
  const state = status.mode === "locked" ? t("sync.status.locked")
    : sync.phase === "error" ? t("sync.status.error")
      : sync.phase === "syncing" ? t("sync.status.syncing")
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
      <SyncActionButton disabled={!!busy || status.mode !== "ready"} pending={busy === "now"}
        pendingLabel={t("sync.pending.now")} onClick={onSyncNow}><ReloadIcon aria-hidden="true" />{t("sync.now")}</SyncActionButton>
    </CardContent>
  </Card>;
}
