import { useSyncExternalStore } from "react";
import { refreshRetryScheduler } from "@/middlelayers/refresh-retry-scheduler";
import { Switch } from "@/components/ui/switch";

export function AutoRetrySetting({ t, switchComponent: Toggle = Switch }: {
  t: (key: string) => string;
  switchComponent?: typeof Switch;
}) {
  const { enabled } = useSyncExternalStore(refreshRetryScheduler.subscribe, refreshRetryScheduler.status);
  return <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
    <div className="min-w-0">
      <label htmlFor="auto-retry-failed-sources" className="text-sm font-medium text-foreground">{t("refresh.autoRetry.setting")}</label>
      <p className="text-xs text-muted-foreground">{t("refresh.autoRetry.description")}</p>
    </div>
    <Toggle id="auto-retry-failed-sources" checked={enabled} onCheckedChange={(value) => refreshRetryScheduler.setEnabled(value)} />
  </div>;
}
