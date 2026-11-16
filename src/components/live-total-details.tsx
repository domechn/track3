import { useState } from "react";
import type { LiveMissingSymbol } from "@/middlelayers/charts-refresh";
import { LIVE_TOTAL_REASONS } from "./use-live-total";

export function LiveTotalDetails({ error, lastAt, retryNow, t, missingSymbols, dustSymbols, missingShare }: {
  error?: string;
  lastAt?: number;
  retryNow: () => void;
  t: (key: string) => string;
  missingSymbols?: LiveMissingSymbol[];
  dustSymbols?: LiveMissingSymbol[];
  missingShare?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [kind, count] = (error ?? "unknown").split(":");
  const safeKind = (LIVE_TOTAL_REASONS as readonly string[]).includes(kind) && (kind !== "pricesMissing" || /^[1-9]\d*$/.test(count ?? "")) ? kind : "unknown";
  const showMissing = safeKind === "pricesMissing" && missingSymbols && missingSymbols.length > 0;
  const moreCount = Math.max(0, (missingSymbols?.length ?? 0) - 5);
  const showToggle = showMissing && (moreCount > 0 || (dustSymbols?.length ?? 0) > 0);
  return <div className="space-y-2 text-sm">
    <p className="text-muted-foreground">
      {t(`realtime.error.${safeKind}`).replace("{count}", count ?? "")}
    </p>
    {showMissing && <>
      <div data-testid="live-missing-list" data-state={expanded ? "expanded" : "collapsed"}
        className={expanded ? "max-h-40 overflow-y-auto" : undefined}>
        <ul className="space-y-1">
          {(expanded ? missingSymbols : missingSymbols.slice(0, 5)).map((item) =>
            <li key={`${item.assetType}:${item.symbol}`} className="break-all">{item.symbol}</li>)}
        </ul>
        {expanded && !!dustSymbols?.length && <>
          <p className="mt-2 text-xs text-muted-foreground">{t("realtime.missing.dustHeading")}</p>
          <ul className="mt-1 space-y-1">
            {dustSymbols.map((item) =>
              <li key={`${item.assetType}:${item.symbol}`} className="break-all">{item.symbol}</li>)}
          </ul>
        </>}
      </div>
      {showToggle && <button type="button" onClick={() => setExpanded((value) => !value)}
        className="text-sm text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {expanded ? t("realtime.missing.showLess") : moreCount
          ? t("realtime.missing.more").replace("{count}", String(moreCount))
          : t("realtime.missing.showAll")}
      </button>}
      {missingShare !== undefined && <p className="text-xs text-muted-foreground">
        {t("realtime.missing.share").replace("{percent}",
          (missingShare * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }))}
      </p>}
    </>}
    {lastAt !== undefined && <p className="text-xs text-muted-foreground">
      {t("realtime.lastSuccess").replace("{time}", new Date(lastAt).toLocaleTimeString())}
    </p>}
    <button type="button" onClick={retryNow}
      className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {t("realtime.retryNow")}
    </button>
  </div>;
}
