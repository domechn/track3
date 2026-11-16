import { LIVE_TOTAL_REASONS } from "./use-live-total";

export function LiveTotalDetails({ error, lastAt, retryNow, t }: {
  error?: string;
  lastAt?: number;
  retryNow: () => void;
  t: (key: string) => string;
}) {
  const [kind, count] = (error ?? "unknown").split(":");
  const safeKind = (LIVE_TOTAL_REASONS as readonly string[]).includes(kind) && (kind !== "pricesMissing" || /^[1-9]\d*$/.test(count ?? "")) ? kind : "unknown";
  return <div className="space-y-2 text-sm">
    <p className="text-muted-foreground">
      {t(`realtime.error.${safeKind}`).replace("{count}", count ?? "")}
    </p>
    {lastAt !== undefined && <p className="text-xs text-muted-foreground">
      {t("realtime.lastSuccess").replace("{time}", new Date(lastAt).toLocaleTimeString())}
    </p>}
    <button type="button" onClick={retryNow}
      className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {t("realtime.retryNow")}
    </button>
  </div>;
}
