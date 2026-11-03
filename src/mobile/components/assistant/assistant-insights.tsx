import { useCallback, useEffect, useState } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { FidelityIcon } from "@/mobile/components/fidelity-icon";
import { useTranslation } from "@/mobile/i18n";
import { queryLastRefreshAt, queryLatestAssets, queryTotalValue } from "@/middlelayers/charts-assets";
import { calculateRebalance, getRebalanceProfile } from "@/middlelayers/rebalance";
import { dismissInsight, formatInsight, INSIGHTS_CHANGED_EVENT, loadInsightCard, refreshInsights, type InsightCard } from "@/middlelayers/insights-service";
import type { Insight } from "@/middlelayers/insights";
import type { Asset, CurrencyRateDetail } from "@/middlelayers/types";

type Context = {
  assets: Asset[];
  targets?: Awaited<ReturnType<typeof getRebalanceProfile>>;
  refreshedAt?: string;
  weeklyChange?: number;
};

export default function AssistantInsights({ currency, onAsk }: {
  currency?: CurrencyRateDetail;
  onAsk?: (question: string) => void;
}) {
  const { t, locale } = useTranslation();
  const [card, setCard] = useState<InsightCard>();
  const [context, setContext] = useState<Context>({ assets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      const [nextCard, assets, targets, refreshedAt] = await Promise.all([
        loadInsightCard(), queryLatestAssets(), getRebalanceProfile(), queryLastRefreshAt(),
      ]);
      let weeklyChange: number | undefined;
      if (refreshedAt) {
        const instant = new Date(refreshedAt);
        if (Number.isFinite(instant.getTime())) {
          const previous = new Date(instant.getTime() - 7 * 86_400_000);
          const before = await queryTotalValue({
            start: new Date(previous.getTime() - 3_600_000),
            end: new Date(previous.getTime() + 3_600_000),
          });
          const now = assets.reduce((sum, asset) => sum + asset.value, 0);
          if (before.totalValue > 0 && !before.partial) weeklyChange = now - before.totalValue;
        }
      }
      setCard(nextCard);
      setContext({ assets, targets, refreshedAt, weeklyChange });
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const changed = () => { void load(); };
    window.addEventListener(INSIGHTS_CHANGED_EVENT, changed);
    return () => window.removeEventListener(INSIGHTS_CHANGED_EVENT, changed);
  }, [load]);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshInsights(undefined, locale, true);
      await load();
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  };
  const visible = card?.insights.filter((insight) =>
    !card.dismissedIds.includes(insight.id) && !card.repeatedIds?.includes(insight.id)) ?? [];
  const money = (value: number, decimals = 2) => new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    style: "currency", currency: currency?.currency ?? "USD", minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(value * (currency?.rate ?? 1));
  const number = (value: number) => new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
  }).format(value);
  const total = context.assets.reduce((sum, asset) => sum + asset.value, 0);
  const formattedInsight = (insight: Insight) => formatInsight(insight,
    (key) => insight.messageKey === "insights.newAsset" && key === "insights.newAsset"
      ? t("insights.newAssetSymbol") : t(key), locale,
    currency && { ...currency, currency: currency.symbol });
  const content = (insight: Insight): { title: string; body: string; action: string; question: string } => {
    const symbol = String(insight.data.symbol ?? "");
    if (insight.id === "mover:percent:7d" && insight.messageKey === "insights.mover" && total > 0) {
      const asset = context.assets.find((row) => row.symbol === symbol);
      const target = context.targets?.targets.find((row) => row.kind === "asset" && row.symbol === symbol);
      if (asset && target?.kind === "asset") {
        const share = asset.value / total * 100;
        return {
          title: t("fidelity.assistant.insightMoverTitle").replace("{symbol}", symbol)
            .replace("{percent}", `${Number(insight.data.changePercent) >= 0 ? "+" : ""}${number(Number(insight.data.changePercent))}`),
          body: t("fidelity.assistant.insightMoverBody").replace("{share}", number(share))
            .replace("{deviation}", number(share - target.percent)).replace("{target}", number(target.percent)),
          action: t("fidelity.assistant.askAbout").replace("{symbol}", symbol),
          question: t("insights.askQuestion").replace("{insight}", formattedInsight(insight)),
        };
      }
    }
    if (insight.messageKey === "insights.drift" && context.targets && total > 0) {
      const target = context.targets.targets.find((row) => row.kind === "asset" && row.symbol === symbol);
      if (target?.kind === "asset") {
        const deviation = Math.abs(Number(insight.data.deviationPercent));
        const result = calculateRebalance(context.assets, context.targets.targets, { tolerancePercent: context.targets.tolerancePercent });
        const buy = result.rows.find((row) => row.kind === "asset" && row.symbol === symbol)?.tradeValue;
        const stableSale = result.rows.filter((row) => ["USDT", "USDC"].includes(row.symbol) && row.tradeValue < 0)
          .sort((a, b) => a.tradeValue - b.tradeValue)[0];
        return {
          title: t("fidelity.assistant.insightDriftTitle").replace("{symbol}", symbol).replace("{deviation}", number(deviation)),
          body: buy && buy > 0 && stableSale
            ? t("fidelity.assistant.insightDriftBody").replace("{amount}", money(buy)).replace("{target}", number(target.percent))
              .replace("{symbol}", symbol).replace("{stable}", stableSale.symbol)
            : t("fidelity.assistant.insightDriftBodySimple").replace("{target}", number(target.percent)),
          action: t("fidelity.assistant.quick.planRebalance"),
          question: t("fidelity.assistant.promptPlanRebalance"),
        };
      }
    }
    if (insight.messageKey === "insights.goalNear") {
      const value = Number(insight.data.value);
      const threshold = Number(insight.data.threshold);
      if (Number.isFinite(value) && Number.isFinite(threshold) && threshold > value) {
        return {
          title: t("fidelity.assistant.insightGoalTitle").replace("{percent}", number(value / threshold * 100))
            .replace("{threshold}", money(threshold, 0)),
          body: context.weeklyChange !== undefined
            ? t("fidelity.assistant.insightGoalBody").replace("{value}", money(value)).replace("{remaining}", money(threshold - value))
              .replace("{change}", money(context.weeklyChange))
            : t("fidelity.assistant.insightGoalBodySimple").replace("{value}", money(value)).replace("{remaining}", money(threshold - value)),
          action: t("fidelity.assistant.whatWouldItTake"),
          question: t("fidelity.assistant.promptGoal").replace("{threshold}", money(threshold, 0)),
        };
      }
    }
    const text = formattedInsight(insight);
    return { title: text, body: "", action: t("insights.ask"),
      question: t("insights.askQuestion").replace("{insight}", text) };
  };
  return <section className="fidelity-assistant-insights assistant-insights-card" aria-label={t("fidelity.assistant.insightsTitle")}>
    <header>
      <h3>{t("fidelity.assistant.insightsTitle")}</h3>
      <div className="fidelity-assistant-insights-meta">
        {context.refreshedAt && <span><FidelityIcon name="clock" />
          {t("fidelity.assistant.dataRefreshed").replace("{time}",
            new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { hour: "2-digit", minute: "2-digit" })
              .format(new Date(context.refreshedAt)))}</span>}
        <button type="button" onClick={() => void refresh()} disabled={refreshing}>
          <FidelityIcon name="refresh" />{t("fidelity.assistant.refresh")}
        </button>
      </div>
    </header>
    {loading && <p>{t("insights.loading")}</p>}
    {error && <p role="alert">{t("insights.error")}</p>}
    {!loading && !error && visible.length === 0 && <p>{t("insights.empty")}</p>}
    {visible.map((insight) => {
      const row = content(insight);
      const titleId = `fidelity-insight-${insight.id.replace(/[^a-zA-Z0-9-]/g, "-")}`;
      return <div className="fidelity-assistant-insight" key={insight.id}>
        <strong id={titleId}>{row.title}</strong>
        {row.body && <p>{row.body}</p>}
        <div className="fidelity-assistant-insight-actions">
          <button type="button" onClick={() => onAsk?.(row.question)} disabled={!onAsk}>{row.action}</button>
          <button type="button" aria-label={t("insights.dismiss")} aria-describedby={titleId}
            onClick={() => {
              setCard((current) => current && { ...current, dismissedIds: [...current.dismissedIds, insight.id] });
              void dismissInsight(insight.id).catch(() => setError(true));
            }}><Cross2Icon aria-hidden="true" /></button>
        </div>
      </div>;
    })}
  </section>;
}
