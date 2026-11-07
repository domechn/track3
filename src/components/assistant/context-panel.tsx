import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import type { AIConfig, CurrencyRateDetail } from "@/middlelayers/types";
import type { ChatSessionMeta } from "@/middlelayers/ai";
import { loadSession } from "@/middlelayers/ai";
import { getRebalanceProfile, loadRebalanceHoldings } from "@/middlelayers/rebalance";
import { queryHistoricalPage } from "@/middlelayers/charts";
import { listAlertRules, listAlertHistory } from "@/middlelayers/alerts";

export function useAssistantAttention(sessions: ChatSessionMeta[]): boolean {
  const [attention, setAttention] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const recent = sessions.filter((session) => Date.parse(session.updatedAt) + 5 * 60_000 > Date.now());
    void Promise.all([
      listAlertHistory().catch(() => []),
      Promise.all(recent.map((session) => loadSession(session.id).catch(() => null))),
    ]).then(([history, loaded]) => {
      if (cancelled) return;
      const unread = history.some((item) => !item.acknowledgedAt);
      const expirations = loaded.flatMap((session) => (session?.messages ?? []).flatMap((message) =>
        message.role === "assistant" ? message.blocks.flatMap((block) =>
          block.kind === "pending_action" && block.status === "pending" ? [Date.parse(block.expiresAt)] : []) : []));
      const refresh = () => {
        if (cancelled) return;
        const now = Date.now();
        const future = expirations.filter((expiry) => expiry > now);
        setAttention(unread || future.length > 0);
        if (future.length) timer = setTimeout(refresh, Math.min(...future) - now + 1);
      };
      refresh();
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessions]);
  return attention;
}

export default function AssistantContextPanel({ config, sessions, baseCurrency, onCollapse, collapseRef, controlsId = "assistant-context", translate }: {
  config: AIConfig; sessions: ChatSessionMeta[]; baseCurrency: CurrencyRateDetail;
  onCollapse?: () => void; collapseRef?: React.Ref<HTMLButtonElement>; controlsId?: string;
  translate?: (key: string) => string;
}) {
  const { t: desktopT } = useTranslation();
  const t = translate ?? desktopT;
  const usageCache = useRef(new Map<string, { updatedAt: string; input: number; output: number; requests: number }>());
  const [data, setData] = useState<{
    assets: number; total: number; snapshots: number; first: string; last: string;
    targets: number; targetTotal: number; rules: number; unread: number;
    requests: number; tokensIn: number; tokensOut: number;
  }>();
  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    void Promise.all([
      loadRebalanceHoldings(baseCurrency),
      getRebalanceProfile(),
      listAlertRules(),
      listAlertHistory(),
      queryHistoricalPage({ start: new Date(monthStart), end: new Date(nextMonth) }, 1, 0),
      Promise.all(sessions.filter((session) => session.updatedAt >= monthStart).map(async (session) => {
        const cached = usageCache.current.get(session.id);
        if (cached?.updatedAt === session.updatedAt) return cached;
        const loaded = await loadSession(session.id).catch(() => null);
        const usage = (loaded?.messages ?? []).filter((message) =>
          message.role === "assistant" && message.at && message.at >= monthStart && message.at < nextMonth && message.usage);
        const entry = {
          updatedAt: session.updatedAt,
          requests: usage.length,
          input: usage.reduce((sum, message) => sum + (message.role === "assistant" ? message.usage?.promptTokens ?? 0 : 0), 0),
          output: usage.reduce((sum, message) => sum + (message.role === "assistant" ? message.usage?.completionTokens ?? 0 : 0), 0),
        };
        usageCache.current.set(session.id, entry);
        return entry;
      })),
    ]).then(async ([portfolio, profile, rules, history, snapshots, usage]) => {
      const first = snapshots.totalCount > 0
        ? (await queryHistoricalPage({ start: new Date(monthStart), end: new Date(nextMonth) }, 1, snapshots.totalCount - 1)).rows[0]?.createdAt ?? ""
        : "";
      if (!cancelled) setData({
        assets: portfolio.holdings.length, total: portfolio.holdings.reduce((sum, holding) => sum + holding.value, 0),
        snapshots: snapshots.totalCount, first, last: snapshots.rows[0]?.createdAt ?? "",
        targets: profile?.targets.length ?? 0,
        targetTotal: profile?.targets.reduce((sum, target) => sum + target.percent, 0) ?? 0,
        rules: rules.length, unread: history.filter((item) => !item.acknowledgedAt).length,
        requests: usage.reduce((sum, item) => sum + item.requests, 0),
        tokensIn: usage.reduce((sum, item) => sum + item.input, 0),
        tokensOut: usage.reduce((sum, item) => sum + item.output, 0),
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sessions, baseCurrency]);
  const currency = new Intl.NumberFormat(undefined, { style: "currency", currency: baseCurrency.currency });
  const month = new Date().toLocaleDateString(undefined, { month: "short" });
  const cost = ((data?.tokensIn ?? 0) * (config.inputPricePerMillionTokens ?? config.pricePerMillionTokens ?? 0)
    + (data?.tokensOut ?? 0) * (config.outputPricePerMillionTokens ?? config.pricePerMillionTokens ?? 0)) / 1_000_000;
  return <aside className="t3-assistant-context">
      <div className="t3-assistant-context-heading"><h2>{t("fidelity.assistant.context")}</h2><span>{t("fidelity.assistant.contextHint")}</span>
        {onCollapse && <button ref={collapseRef} type="button" onClick={onCollapse}
          aria-label={t("assistant.panes.collapseContext")} aria-expanded="true" aria-controls={controlsId}
          title={`${t("assistant.panes.collapseContext")} (Ctrl/⌘+Shift+])`}
          className="t3-assistant-pane-toggle" data-testid="context-header-toggle">
          <ChevronRightIcon aria-hidden="true" />
        </button>}
      </div>
    <div className="t3-assistant-context-source"><b>{t("fidelity.assistant.holdings")}</b><small>{data ? `${data.assets} ${t("fidelity.assistant.assets")}, ${currency.format(data.total)}` : "—"}</small></div>
    <div className="t3-assistant-context-source"><b>{t("fidelity.assistant.snapshots")}</b><small>{data ? data.snapshots ? t("fidelity.assistant.snapshotRangeActual").replace("{count}", String(data.snapshots)).replace("{start}", String(new Date(data.first).getDate())).replace("{end}", String(new Date(data.last).getDate())).replace("{month}", month) : t("fidelity.assistant.snapshotEmpty") : "—"}</small></div>
    <div className="t3-assistant-context-source"><b>{t("fidelity.assistant.targets")}</b><small>{data ? `${data.targets} ${t("fidelity.assistant.targetsLower")} ${data.targetTotal.toFixed(1)}%` : "—"}</small></div>
    <div className="t3-assistant-context-source"><b>{t("fidelity.assistant.alertRules")}</b><small>{data ? `${data.rules} ${t("fidelity.assistant.rules")}, ${data.unread} ${t("fidelity.assistant.unread")}` : "—"}</small></div>
    <div className="t3-assistant-context-section">
      <div className="t3-assistant-context-heading"><h2>{t("fidelity.assistant.usageMonth")}</h2><span>1–{new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()} {month}</span></div>
      <div><span>{t("fidelity.assistant.requests")}</span><b>{data?.requests.toLocaleString() ?? "—"}</b></div>
      <div><span>{t("fidelity.assistant.tokensIn")}</span><b>{data?.tokensIn.toLocaleString() ?? "—"}</b></div>
      <div><span>{t("fidelity.assistant.tokensOut")}</span><b>{data?.tokensOut.toLocaleString() ?? "—"}</b></div>
      <div><span>{t("fidelity.assistant.estimatedCost")}</span><b>{data ? currency.format(cost * baseCurrency.rate) : "—"}</b></div>
      <p>{t("fidelity.assistant.usageNote").replace("{input}", (config.inputPricePerMillionTokens ?? config.pricePerMillionTokens ?? 0).toFixed(2)).replace("{output}", (config.outputPricePerMillionTokens ?? config.pricePerMillionTokens ?? 0).toFixed(2))}</p>
    </div>
    <div className="t3-assistant-context-section">
      <div><span>{t("fidelity.assistant.actions")}</span><b>{config.allowActions === false ? t("fidelity.assistant.off") : t("fidelity.assistant.askFirst")}</b></div>
      <div><span>{t("fidelity.assistant.dailyInsights")}</span><b>{config.proactiveInsightsSummary ? t("fidelity.assistant.on") : t("fidelity.assistant.off")}</b></div>
    </div>
    <div className="t3-assistant-context-section t3-assistant-context-tools">
      <div className="t3-assistant-context-heading"><h2>{t("fidelity.assistant.tools")}</h2><span>{t("fidelity.assistant.toolsHint")}</span></div>
      {["lookUp", "compare", "readTargets", "changeAlerts"].map((key) => <div key={key}><span>{t(`fidelity.assistant.tool.${key}`)}</span><b className={key === "changeAlerts" && config.allowActions !== false ? "t3-assistant-ask-first" : ""}>{t(key === "changeAlerts" ? config.allowActions === false ? "fidelity.assistant.off" : "fidelity.assistant.askFirstStatus" : "fidelity.assistant.allowed")}</b></div>)}
    </div>
    <Link to="/settings/assistant">{t("fidelity.assistant.settings")}<ChevronRightIcon aria-hidden="true" /></Link>
  </aside>;
}
