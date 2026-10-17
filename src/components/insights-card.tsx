import { useCallback, useEffect, useState } from "react";
import { ExclamationTriangleIcon, InfoCircledIcon, Cross2Icon, ReloadIcon } from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  dismissInsight, formatInsight, INSIGHTS_CHANGED_EVENT, loadInsightCard, refreshInsights,
  type InsightCard as StoredInsightCard,
} from "@/middlelayers/insights-service";
import type { InsightSeverity } from "@/middlelayers/insights";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import { storePendingAssistantQuestion } from "@/middlelayers/ai/pending-question";

function SeverityIcon({ severity }: { severity: InsightSeverity }) {
  return severity === "info"
    ? <InfoCircledIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
    : <ExclamationTriangleIcon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${
      severity === "critical" ? "text-destructive" : "text-amber-600 dark:text-amber-400"
    }`} />;
}

export default function InsightsCard({ currency }: { currency?: CurrencyRateDetail }) {
  const { t, locale } = useTranslation();
  const [card, setCard] = useState<StoredInsightCard>();
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const reload = useCallback(async () => {
    try {
      const loaded = await loadInsightCard();
      setCard(loaded);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const onChanged = () => { void reload(); };
    window.addEventListener(INSIGHTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(INSIGHTS_CHANGED_EVENT, onChanged);
  }, [reload]);

  const visible = card?.insights.filter((insight) =>
    !card.dismissedIds.includes(insight.id) && !card.repeatedIds?.includes(insight.id)) ?? [];
  const summaryRepeatsInsight = visible.some((insight) =>
    card?.summary?.includes(formatInsight(insight, t, locale, currency)) ||
    card?.summary?.includes(formatInsight(insight, t, locale)));
  const regenerate = async () => {
    setRegenerating(true);
    setSummaryError(false);
    try {
      const refreshed = await refreshInsights(undefined, locale, true);
      await reload();
      setSummaryError(refreshed === false);
    } catch {
      setError(true);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Card className="min-h-[104px]" role="region" aria-label={t("insights.title")}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-4 pb-2 pt-4 sm:px-6">
        <CardTitle className="text-base">{t("insights.title")}</CardTitle>
        <Button size="sm" variant="ghost" onClick={() => void regenerate()} disabled={regenerating}
          aria-label={t("insights.regenerate")} className="h-8 gap-1.5 px-2 text-xs">
          <ReloadIcon aria-hidden="true" className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {t("insights.regenerate")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4 sm:px-6">
        {error && <p role="alert" className="text-sm text-destructive">{t("insights.error")}</p>}
        {summaryError && <p role="alert" className="text-sm text-destructive">{t("insights.summaryError")}</p>}
        {loading && !card && <p aria-live="polite" className="text-sm text-muted-foreground">{t("insights.loading")}</p>}
        {!loading && !error && visible.length === 0 && <p className="text-sm text-muted-foreground">{t("insights.empty")}</p>}
        {card?.summary && card.summaryLocale === locale && card.summarySnapshotUuid === card.snapshotUuid &&
          visible.length > 0 && !summaryRepeatsInsight && (
          <p className="whitespace-pre-line border-b pb-3 text-sm text-muted-foreground">{card.summary}</p>
        )}
        {card && visible.length > 0 && (card.summaryNeedsRefresh || (card.summary && card.summaryLocale !== locale)) &&
          <p className="text-xs text-muted-foreground">{t("insights.summaryNeedsRefresh")}</p>}
        {visible.map((insight) => {
          const text = formatInsight(insight, t, locale, currency);
          return (
            <div key={insight.id} className="flex min-w-0 flex-wrap items-start gap-2 border-t border-border/50 pt-2 first:border-t-0 first:pt-0">
              <SeverityIcon severity={insight.severity} />
              <span className="sr-only">{t(`insights.severity.${insight.severity}`)}</span>
              <p id={`insight-${insight.id.replace(/[^a-zA-Z0-9-]/g, "-")}`}
                className="min-w-[12rem] flex-1 break-words text-sm leading-5">{text}</p>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                  <a href="#/assistant" onClick={() => {
                    try {
                      storePendingAssistantQuestion({ question: t("insights.askQuestion").replace("{insight}", text) });
                    } catch { /* The link still opens the assistant. */ }
                  }} aria-describedby={`insight-${insight.id.replace(/[^a-zA-Z0-9-]/g, "-")}`}>{t("insights.ask")}</a>
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t("insights.dismiss")}
                  aria-describedby={`insight-${insight.id.replace(/[^a-zA-Z0-9-]/g, "-")}`}
                  onClick={() => {
                    setCard((current) => current && { ...current, dismissedIds: [...current.dismissedIds, insight.id],
                      summary: undefined, summaryLocale: undefined, summarySnapshotUuid: undefined,
                      summaryNeedsRefresh: Boolean(current.summary) || current.summaryNeedsRefresh });
                    void dismissInsight(insight.id).catch(() => setError(true));
                  }}>
                  <Cross2Icon aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
