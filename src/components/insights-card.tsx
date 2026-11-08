import { useCallback, useEffect, useState } from "react";
import { ExclamationTriangleIcon, InfoCircledIcon, Cross2Icon, ReloadIcon, GearIcon } from "@radix-ui/react-icons";
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
import type { RebalanceHolding } from "@/middlelayers/rebalance";
import { queryHistoricalPage } from "@/middlelayers/charts-history";
import { queryLastRefreshAt } from "@/middlelayers/charts-assets";

type AssistantInsightData = {
  holdings: RebalanceHolding[];
  total: number;
  previousTotal?: number;
  refreshedAt: string;
  targets: { symbol: string; percent: number }[];
  trades: Array<{ symbol: string; tradeValue: number }>;
};

import { loadAIConfig } from "@/middlelayers/configuration";

function SeverityIcon({ severity }: { severity: InsightSeverity }) {
  return severity === "info"
    ? <InfoCircledIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
    : <ExclamationTriangleIcon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${
      severity === "critical" ? "text-destructive" : "text-amber-600 dark:text-amber-400"
    }`} />;
}

export default function InsightsCard({ currency, assistantView = false, onPickPrompt, overviewFidelity = false }: {
  currency?: CurrencyRateDetail;
  assistantView?: boolean;
  onPickPrompt?: (prompt: string) => void;
  overviewFidelity?: boolean;
}) {
  const { t, locale } = useTranslation();
  const [card, setCard] = useState<StoredInsightCard>();
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [assistantData, setAssistantData] = useState<AssistantInsightData>();
  const [aiConfigured, setAiConfigured] = useState<boolean>();
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
  useEffect(() => {
    if (!assistantView) return;
    let cancelled = false;
    void (async () => {
      const { calculateRebalance, getRebalanceProfile, loadRebalanceHoldings } = await import("@/middlelayers/rebalance");
      const refreshedAt = await queryLastRefreshAt();
      if (!refreshedAt) return;
      const referenceDate = new Date(Date.parse(refreshedAt) - 7 * 86400000);
      const baseCurrency = currency ?? { currency: "USD", rate: 1, alias: "USD", symbol: "$" };
      const [portfolio, previous, profile] = await Promise.all([
        loadRebalanceHoldings(baseCurrency),
        queryHistoricalPage({ start: new Date(0), end: referenceDate }, 1, 0),
        getRebalanceProfile(),
      ]);
      const holdings = portfolio.holdings;
      if (!cancelled) setAssistantData({
        holdings, total: holdings.reduce((sum, row) => sum + row.value, 0),
        previousTotal: previous.rows[0] ? previous.rows[0].total * baseCurrency.rate : undefined, refreshedAt,
        trades: profile ? calculateRebalance(holdings, profile.targets, { stablecoinSymbols: portfolio.stablecoinSymbols, partialSnapshot: portfolio.partialSnapshot }).rows : [],
        targets: profile?.targets.flatMap((target) => target.kind === "asset"
          ? [{ symbol: target.symbol, percent: target.percent }] : []) ?? [],
      });
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [assistantView, currency]);
  useEffect(() => {
    if (!overviewFidelity) return;
    let active = true;
    void loadAIConfig().then(() => { if (active) setAiConfigured(true); })
      .catch(() => { if (active) setAiConfigured(false); });
    return () => { active = false; };
  }, [overviewFidelity]);

  const visible = card?.insights.filter((insight) =>
    !card.dismissedIds.includes(insight.id) && !card.repeatedIds?.includes(insight.id)) ?? [];
  const summaryRepeatsInsight = visible.some((insight) =>
    card?.summary?.includes(formatInsight(insight, t, locale, currency)) ||
    card?.summary?.includes(formatInsight(insight, t, locale)));
  const currentSummary = card?.summary && card.summaryLocale === locale &&
    card.summarySnapshotUuid === card.snapshotUuid && !card.summaryNeedsRefresh &&
    visible.length > 0 && !summaryRepeatsInsight ? card.summary : undefined;
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

  if (assistantView && card && assistantData && visible.length > 0) {
    const number = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US",
      { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const money = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US",
      { style: "currency", currency: currency?.currency ?? "USD" });
    const wholeMoney = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US",
      { style: "currency", currency: currency?.currency ?? "USD", maximumFractionDigits: 0 });
    const bySymbol = (symbol: string) => assistantData.holdings.find((holding) => holding.symbol === symbol);
    const targetOf = (symbol: string) => assistantData.targets.find((target) => target.symbol === symbol)?.percent;
    const toDisplay = (value: number) => money.format(value);
    const rows = visible.flatMap((insight) => {
      if (insight.messageKey === "insights.mover" && insight.data.window === "7d") {
        const symbol = String(insight.data.symbol);
        const holding = bySymbol(symbol);
        const target = targetOf(symbol);
        if (!holding || target === undefined || !Number.isFinite(Number(insight.data.changePercent))) return [];
        const share = holding.value / assistantData.total * 100;
        const title = t("fidelity.assistant.insightMoverTitle")
          .replace("{symbol}", symbol).replace("{change}", number.format(Number(insight.data.changePercent)));
        return [{
          id: insight.id, title,
          description: t("fidelity.assistant.insightMoverDescription")
            .replace("{share}", number.format(share))
            .replace("{difference}", number.format(Math.abs(share - target)))
            .replace("{direction}", t(share >= target ? "fidelity.assistant.above" : "fidelity.assistant.below"))
            .replace("{target}", number.format(target)),
          action: t("fidelity.assistant.askAbout").replace("{symbol}", symbol),
          prompt: t("insights.askQuestion").replace("{insight}", title),
        }];
      }
      if (insight.messageKey === "insights.drift") {
        const symbol = String(insight.data.symbol);
        const target = targetOf(symbol);
        const holding = bySymbol(symbol);
        if (!holding || target === undefined) return [];
        const difference = target - holding.value / assistantData.total * 100;
        const buy = assistantData.trades.find((row) => row.symbol === symbol)?.tradeValue ?? 0;
        const seller = assistantData.trades.filter((row) => row.tradeValue < 0)
          .sort((a, b) => a.tradeValue - b.tradeValue)[0]?.symbol;
        const title = t("fidelity.assistant.insightDriftTitle")
          .replace("{symbol}", symbol).replace("{difference}", number.format(Math.abs(difference)))
          .replace("{direction}", t(difference >= 0 ? "fidelity.assistant.under" : "fidelity.assistant.over"));
        return [{
          id: insight.id, title,
          description: t("fidelity.assistant.insightDriftDescription")
            .replace("{amount}", toDisplay(Math.abs(buy)))
            .replace("{symbol}", symbol)
            .replace("{target}", number.format(target))
            .replace("{seller}", seller ?? t("fidelity.assistant.otherHoldings")),
          action: t("fidelity.assistant.prompt.rebalance"),
          prompt: t("fidelity.assistant.prompt.rebalance"),
        }];
      }
      if (insight.messageKey === "insights.goalNear") {
        const threshold = Number(insight.data.threshold);
        if (!Number.isFinite(threshold) || threshold <= 0) return [];
        const value = assistantData.total;
        const gain = assistantData.previousTotal === undefined ? undefined : value - assistantData.previousTotal;
        const title = t("fidelity.assistant.insightGoalTitle")
          .replace("{progress}", number.format(value / (threshold * (currency?.rate ?? 1)) * 100))
          .replace("{threshold}", wholeMoney.format(threshold * (currency?.rate ?? 1)));
        return [{
          id: insight.id, title,
          description: t(gain === undefined ? "fidelity.assistant.insightGoalNoHistory" : "fidelity.assistant.insightGoalDescription")
            .replace("{value}", toDisplay(value)).replace("{remaining}", toDisplay(threshold * (currency?.rate ?? 1) - value))
            .replace("{gain}", toDisplay(gain ?? 0)),
          action: t("fidelity.assistant.goalAction"),
          prompt: t("fidelity.assistant.goalQuestion").replace("{threshold}", wholeMoney.format(threshold * (currency?.rate ?? 1))),
        }];
      }
      const text = formatInsight(insight, t, locale, currency);
      return [{ id: insight.id, title: text, description: "", action: t("insights.ask"), prompt: t("insights.askQuestion").replace("{insight}", text) }];
    });
    const ask = (prompt: string) => {
      if (onPickPrompt) onPickPrompt(prompt);
      else try { storePendingAssistantQuestion({ question: prompt }); } catch { /* The saved card stays readable. */ }
    };
    return <Card className="t3-insights-card t3-assistant-insights-card" role="region" aria-label={t("insights.title")}>
      <CardHeader>
        <CardTitle>{t("fidelity.assistant.insightsToday")}</CardTitle>
        <span>{t("fidelity.assistant.insightsUpdated").replace("{time}", new Date(assistantData.refreshedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }))}</span>
        <Button size="sm" variant="ghost" onClick={() => void regenerate()} disabled={regenerating}>
          <ReloadIcon aria-hidden="true" className="h-3.5 w-3.5" />{t("fidelity.assistant.refresh")}
        </Button>
      </CardHeader>
      <CardContent>
        {rows.map((row) => <div key={row.id} className="t3-assistant-insight-row">
          <div><b>{row.title}</b><small>{row.description}</small></div>
          <Button size="sm" variant="outline" onClick={() => ask(row.prompt)}>{row.action}</Button>
        </div>)}
      </CardContent>
    </Card>;
  }

  if (overviewFidelity && !loading && aiConfigured === false && !visible.length) {
    return <Card className="t3-insights-card t3-insights-off" role="region" aria-label={t("overview.fidelity.aiInsights")}>
      <header><h2>{t("overview.fidelity.aiInsights")}</h2><span>{t("overview.fidelity.off")}</span></header>
      <div className="t3-insights-off-frame"><div>
        <h3>{t("overview.fidelity.insightsOff")}</h3>
        <p>{t("overview.fidelity.insightsOffDescription")}</p>
        <a href="#/settings/assistant"><GearIcon aria-hidden="true" />{t("overview.fidelity.openAiSettings")}</a>
      </div></div>
      <p>{t("overview.fidelity.insightsOffPath")}</p>
    </Card>;
  }

  if (overviewFidelity && currentSummary) {
    const summaryLines = currentSummary.split("\n").filter(Boolean);
    return <Card className="t3-insights-card t3-insights-summary" role="region" aria-label={t("overview.fidelity.aiInsights")}>
      <header>
        <h2>{t("overview.fidelity.aiInsights")}</h2>
        <span className="t3-tag" data-tone="accent">{t("overview.fidelity.pro")}</span>
      </header>
      <div className="t3-insights-summary-lines">
        {summaryLines.slice(0, showAll ? undefined : 3).map((line, index) => {
          const separator = line.indexOf(" — ");
          return <div key={index}>
            {separator >= 0
              ? <><h3>{line.slice(0, separator)}</h3><p>{line.slice(separator + 3)}</p></>
              : <p>{line}</p>}
          </div>;
        })}
      </div>
      {summaryLines.length > 3 && <button type="button" className="t3-insights-more"
        aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
        {showAll ? t("overview.design.showFewer") : t("insights.showAll").replace("{count}", String(summaryLines.length))}
      </button>}
      <footer className="t3-insights-summary-footer">
      <a href="#/assistant" onClick={() => {
        try {
          storePendingAssistantQuestion({ question: t("insights.askQuestion").replace("{insight}", currentSummary) });
        } catch { /* The link still opens the assistant. */ }
      }}>{t("insights.ask")}</a>
      <Button size="sm" variant="ghost" onClick={() => void regenerate()} disabled={regenerating}
        aria-label={t("insights.regenerate")} className="h-8 gap-1.5 px-2 text-xs">
        <ReloadIcon aria-hidden="true" className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
        {t("insights.regenerate")}
      </Button>
      </footer>
    </Card>;
  }

  return (
    <Card className="t3-insights-card min-h-[104px]" role="region" aria-label={t("insights.title")}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-[var(--card-pad)] pb-2 pt-[var(--card-pad)]">
        <CardTitle className="text-base">{t("insights.title")}</CardTitle>
        {!overviewFidelity && <Button size="sm" variant="ghost" onClick={() => void regenerate()} disabled={regenerating}
          aria-label={t("insights.regenerate")} className="h-8 gap-1.5 px-2 text-xs">
          <ReloadIcon aria-hidden="true" className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {t("insights.regenerate")}
        </Button>}
      </CardHeader>
      <CardContent className={`${overviewFidelity ? "t3-overview-insights-content " : ""}space-y-2 px-[var(--card-pad)] pb-[var(--card-pad)]`}>
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
        {visible.slice(0, overviewFidelity && !showAll ? 3 : undefined).map((insight) => {
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
        {overviewFidelity && visible.length > 3 && <button type="button" className="t3-insights-more"
          aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
          {showAll ? t("overview.design.showFewer") : t("insights.showAll").replace("{count}", String(visible.length))}
        </button>}
      </CardContent>
      {overviewFidelity && <div className="t3-insights-footer"><Button size="sm" variant="ghost"
        onClick={() => void regenerate()} disabled={regenerating} aria-label={t("insights.regenerate")}
        className="h-8 gap-1.5 px-2 text-xs">
        <ReloadIcon aria-hidden="true" className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
        {t("insights.regenerate")}
      </Button></div>}
    </Card>
  );
}
