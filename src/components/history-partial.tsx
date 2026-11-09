import type { HistoricalPageRow } from "@/middlelayers/charts-history";
import type { PartialSnapshot } from "@/middlelayers/snapshot-partial";

type Translate = (key: string) => string;

export function HistoryPartialPill({ row, t }: { row: HistoricalPageRow; t: Translate }) {
  if (row.sourcesTotal === undefined) return null;
  const ready = Math.max(0, row.sourcesTotal - (row.missingCount ?? 0));
  return <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs text-foreground">
    <span>{t("history.partial.label")}</span>
    <span className="text-muted-foreground">
      {t("history.partial.count").replace("{ready}", String(ready)).replace("{total}", String(row.sourcesTotal))}
    </span>
  </span>;
}

export function HistoryPartialDetails({ partial, t, locale }: {
  partial?: PartialSnapshot;
  t: Translate;
  locale: string;
}) {
  if (!partial) return null;
  const sourceLines = new Map(partial.missing.map((source) => [
    [source.provider, source.category, source.lastSuccessAt ?? ""].join("\u0000"), source,
  ] as const));
  return <section className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm" aria-label={t("history.partial.label")}>
    <p className="font-medium">{t("history.partial.detail")}</p>
    <ul className="mt-2 space-y-1">
      {[...sourceLines].map(([key, source]) => {
        const time = source.lastSuccessAt
          ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
            year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          }).format(new Date(source.lastSuccessAt)) : null;
        return <li key={key}>
          {source.provider} · {t(`refresh.reason.${source.category}`)} · {time
            ? t("history.partial.carriedFrom").replace("{time}", time)
            : t("history.partial.unknownTime")}
        </li>;
      })}
    </ul>
  </section>;
}
