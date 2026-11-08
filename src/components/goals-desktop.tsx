import { useState } from "react";
import type { AlertHistory, AlertKind, AlertPrices, AlertRule, AlertSnapshot, AlertWindow } from "@/middlelayers/alerts";
import { measureRule } from "@/middlelayers/alerts";
import type { RebalanceProfile } from "@/middlelayers/rebalance";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import { alertDraftFromRule, alertRuleFromDraft, needsAsset, needsWindow, type AlertDraft } from "@/middlelayers/ui-state/alert-draft";
import { useTranslation } from "@/i18n";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import FidelityRail from "./fidelity-rail";
import FidelityIcon from "./fidelity-icon";
import { useDarkTheme } from "./common/theme";
import { useWindowSize } from "@/utils/hook";
import { BellIcon, TargetIcon } from "@radix-ui/react-icons";
import EmptyState from "./empty-state";
import { AttributionPager, useAttributionPage } from "./attribution-pager";
import { alertTemplateDraft, alertTemplates } from "./goals-alert-templates";
import "./rebalance-desktop.css";
import "./goals-desktop.css";
import { useChartHitArea } from "./chart-tooltip";

const kinds: AlertKind[] = ["total_value_target", "asset_value_target", "asset_price_target", "asset_price_move", "allocation_deviation", "period_pnl", "portfolio_value_change"];
const fixed = (value: number, digits = 1) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const sign = (value: number) => value > 0 ? "+" : value < 0 ? "−" : "";
const percent = (value: number) => `${sign(value)}${fixed(Math.abs(value))}%`;
const time = (at?: string) => at ? new Date(at).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }) : "–";
const windowName = (value: AlertWindow | null, t: Translate) => t(`goals.fidelity.window.${value ?? "30d"}`);
const windowShort = (value: AlertWindow | null) => value === "24h" ? "24h" : value === "7d" ? "7d" : "30d";
type Translate = ReturnType<typeof useTranslation>["t"];
const cooldownLabel = (minutes: number) => minutes === 0 ? "0m" : minutes >= 10080 && minutes % 1440 === 0 ? `${minutes / 1440}d`
  : minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`;

function ruleTitle(rule: AlertRule, t: Translate): string {
  switch (rule.kind) {
    case "total_value_target": return t("goals.fidelity.title.total");
    case "asset_value_target": return t("goals.fidelity.title.value").replace("{asset}", rule.symbol ?? "");
    case "asset_price_target": return t("goals.fidelity.title.price").replace("{asset}", rule.symbol ?? "");
    case "asset_price_move": return t("goals.fidelity.title.move").replace("{asset}", rule.symbol ?? "").replace("{window}", windowShort(rule.window));
    case "allocation_deviation": return t("goals.fidelity.title.allocation").replace("{asset}", rule.symbol ?? "");
    case "period_pnl": return t("goals.fidelity.title.pnl").replace("{window}", windowShort(rule.window).toUpperCase());
    case "portfolio_value_change": return t(rule.comparator === "lte" ? "goals.fidelity.title.drop" : "goals.fidelity.title.rise");
  }
}
function ruleDescription(rule: AlertRule, t: Translate, money: (value: number, digits?: number) => string): string {
  if (rule.kind === "total_value_target" || rule.kind === "asset_value_target") return t("goals.fidelity.description.reaches").replace("{value}", money(rule.threshold, 0));
  if (rule.kind === "asset_price_target") return t(rule.comparator === "gte" ? "goals.fidelity.description.above" : "goals.fidelity.description.below").replace("{value}", money(rule.threshold, 0));
  if (rule.kind === "asset_price_move") return t(rule.comparator === "gte" ? "goals.fidelity.description.rises" : "goals.fidelity.description.falls").replace("{value}", fixed(rule.threshold, 0)).replace("{window}", windowName(rule.window, t));
  if (rule.kind === "allocation_deviation") return t("goals.fidelity.description.allocation").replace("{value}", fixed(rule.threshold));
  if (rule.kind === "period_pnl") return t("goals.fidelity.description.pnl").replace("{value}", `${sign(rule.threshold)}${money(rule.threshold, 0)}`).replace("{window}", windowName(rule.window, t));
  return t(rule.comparator === "lte" ? "goals.fidelity.description.drop" : "goals.fidelity.description.rise").replace("{value}", fixed(Math.abs(rule.threshold), 0)).replace("{window}", windowName(rule.window, t));
}
function kindName(kind: AlertKind, t: Translate): string {
  return t(`goals.fidelity.kindName.${kind}`);
}
function previewParts(message: string, highlights: string[], emphasis: string) {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = message.split(new RegExp(`(${[...highlights, emphasis].map(escape).join("|")})`, "g"));
  return parts.map((part, index) => part === emphasis ? <em key={index}>{part}</em>
    : highlights.includes(part) ? <b key={index}>{part}</b> : part);
}
type Props = {
  rules: AlertRule[];
  history: AlertHistory[];
  unreadCount: number;
  snapshots: AlertSnapshot[];
  prices: AlertPrices;
  targets?: RebalanceProfile;
  loading: boolean;
  error: string;
  status: string;
  draft: AlertDraft;
  editorOpen: boolean;
  onDraft: (draft: AlertDraft) => void;
  onEditorOpen: (open: boolean) => void;
  onEditorCloseFocus: () => void;
  onEdit: (rule: AlertRule, trigger: HTMLButtonElement) => void;
  onAdd: (trigger: HTMLButtonElement, draft?: AlertDraft) => void;
  onSave: () => void;
  onToggle: (rule: AlertRule, enabled: boolean) => void;
  onDelete: (rule: AlertRule) => void;
  onAcknowledge: (id: number) => void;
  onAcknowledgeAll: () => void;
  onClear: () => void;
  onEnableNotifications: () => void;
  notificationsEnabled: boolean;
  isProUser?: boolean;
  currencySymbol?: string;
};

export default function GoalsDesktop(props: Props) {
  const { t, locale } = useTranslation();
  const chart = useChartHitArea();
  const rules = [...props.rules].sort((a, b) => a.id - b.id);
  const history = [...props.history].sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt) || a.id - b.id);
  const rulePaging = useAttributionPage(rules, rules.map((rule) => rule.id).join(","), 20);
  const historyPaging = useAttributionPage(history, history.map((alert) => alert.id).join(","), 20);
  const money = (value: number, digits = 2) => `${props.currencySymbol ?? "$"}${fixed(Math.abs(value), digits)}`;
  const pts = (value: string) => t("goals.fidelity.pts").replace("{value}", value);
  const [deleteRule, setDeleteRule] = useState<AlertRule | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const latest = props.snapshots[0];
  const measurements = rules.map((rule) => measureRule(rule, props.snapshots, props.prices, props.targets));
  const currentTotal = latest?.assets.reduce((sum, asset) => sum + asset.value, 0) ?? 0;
  const candidate = rules.map((rule, index) => ({
    rule, value: measurements[index].value, ready: measurements[index].status === "ready",
    progress: rule.threshold !== 0 && measurements[index].value !== undefined
      ? (rule.comparator === "gte" || rule.threshold < 0 ? measurements[index].value! / rule.threshold : rule.threshold / measurements[index].value!) * 100 : 0,
  })).filter((item) => item.rule.enabled && item.ready && item.progress < 100 && item.progress >= 0)
    .sort((a, b) => b.progress - a.progress)[0];
  const onCount = rules.filter((rule) => rule.enabled).length;
  const unread = history.filter((alert) => !alert.acknowledgedAt);
  const assetError = attempted && needsAsset(props.draft.kind) && !props.draft.symbol.trim();
  const thresholdNumber = Number(props.draft.threshold);
  const thresholdError = attempted && (!props.draft.threshold.trim() || !Number.isFinite(thresholdNumber) ||
    (props.draft.kind === "asset_price_move" && thresholdNumber <= 0));
  const assets = latest?.assets.filter((asset, index, arr) => arr.findIndex((other) => other.symbol === asset.symbol && other.assetType === asset.assetType) === index) ?? [];
  const editRule = rules.find((rule) => rule.id === props.draft.id);
  let previewRule: AlertRule | null = null;
  if (editRule) {
    try { previewRule = alertRuleFromDraft(props.draft); } catch { /* Preview waits for a valid draft. */ }
  }
  const editMeasurement = previewRule ? measureRule(previewRule, props.snapshots, props.prices, props.targets) : null;
  const crosses = editMeasurement?.value !== undefined &&
    (props.draft.comparator === "gte" ? editMeasurement.value >= thresholdNumber : editMeasurement.value <= thresholdNumber);
  const previewCooldown = ({
    "60": t("goals.fidelity.cooldownPreview.oneHour"),
    "360": t("goals.fidelity.cooldownPreview.sixHour"),
    "1440": t("goals.fidelity.cooldownPreview.24Hour"),
    "10080": t("goals.fidelity.cooldownPreview.sevenDay"),
  } as Record<string, string>)[props.draft.cooldownMinutes] ?? cooldownLabel(Number(props.draft.cooldownMinutes));
  const preview = editMeasurement?.value !== undefined && props.draft.kind === "asset_price_move"
    ? t(crosses ? "goals.fidelity.previewMeasuredFiring" : "goals.fidelity.previewMeasured").replace("{asset}", props.draft.symbol)
      .replace("{comparison}", t(props.draft.comparator === "gte" ? "goals.fidelity.comparator.rises" : "goals.fidelity.comparator.fallsTo"))
      .replace("{threshold}", `${props.draft.threshold}%`).replace("{window}", windowName(props.draft.window, t))
      .replace("{current}", percent(editMeasurement.value))
      .replace("{outcome}", t(crosses ? "goals.fidelity.previewWouldFire" : "goals.fidelity.previewWouldNotFire"))
      .replace("{cooldown}", crosses ? previewCooldown : cooldownLabel(Number(props.draft.cooldownMinutes)))
    : "";
  const submit = () => {
    setAttempted(true);
    if (!props.draft.threshold.trim() || !Number.isFinite(thresholdNumber) ||
      (props.draft.kind === "asset_price_move" && thresholdNumber <= 0) ||
      (needsAsset(props.draft.kind) && !props.draft.symbol.trim())) return;
    props.onSave();
  };
  const openAdd = (button: HTMLButtonElement, draft?: AlertDraft) => {
    setAttempted(false);
    props.onAdd(button, draft);
  };
  const openEdit = (rule: AlertRule, button: HTMLButtonElement) => {
    setAttempted(false);
    props.onEdit(rule, button);
  };
  const closeEditor = () => { setAttempted(false); props.onEditorOpen(false); };
  const describeProgress = (rule: AlertRule, value?: number, progress?: number) => {
    if (value === undefined) return t("goals.unavailable");
    if (rule.kind === "total_value_target" || rule.kind === "asset_value_target") return t("goals.fidelity.progress.value").replace("{current}", money(value)).replace("{remaining}", money(rule.threshold - value));
    if (rule.kind === "asset_price_target") return t("goals.fidelity.progress.price").replace("{current}", money(value)).replace("{needed}", fixed((rule.threshold / value - 1) * 100));
    if (rule.kind === "asset_price_move") return t("goals.fidelity.progress.move").replace("{change}", percent(value)).replace("{window}", windowShort(rule.window)).replace("{over}", fixed(value - rule.threshold));
    if (rule.kind === "allocation_deviation") {
      const target = props.targets?.targets.find((item) => item.kind === "asset" && item.symbol === rule.symbol);
      const assetValue = latest?.assets.filter((item) => item.symbol === rule.symbol).reduce((sum, item) => sum + item.value, 0) ?? 0;
      const current = currentTotal ? assetValue / currentTotal * 100 : 0;
      return t("goals.fidelity.progress.allocation").replace("{drift}", `${sign(current - (target?.percent ?? 0))}${fixed(Math.abs(current - (target?.percent ?? 0)))}`).replace("{target}", fixed(target?.percent ?? 0)).replace("{over}", fixed(value - rule.threshold));
    }
    if (rule.kind === "period_pnl") return t("goals.fidelity.progress.pnl").replace("{current}", `${sign(value)}${money(value)}`).replace("{remaining}", money(rule.threshold - value));
    return t("goals.fidelity.progress.change").replace("{change}", percent(value)).replace("{window}", windowShort(rule.window)).replace("{threshold}", percent(rule.threshold));
  };
  const dayLabel = (at: string) => {
    const date = new Date(at);
    return date.toDateString() === new Date().toDateString() ? t("goals.fidelity.today") : `${date.getDate()} ${date.toLocaleString(locale, { month: "short" })}`;
  };
  const dateLabel = (at: string) => `${dayLabel(at)} ${time(at)}`;
  const historyText = (alert: AlertHistory) => {
    const rule = rules.find((item) => item.id === alert.ruleId);
    const stored = alert.message.match(/\((at least|at most) (-?\d+(?:\.\d+)?)\)$/);
    const threshold = stored ? Number(stored[2]) : rule?.threshold;
    const comparator = stored ? stored[1] === "at most" ? "lte" : "gte" : rule?.comparator ?? "gte";
    const asset = alert.symbol ?? rule?.symbol ?? "";
    const day = dayLabel(alert.triggeredAt);
    if (alert.kind === "total_value_target" || alert.kind === "asset_value_target" || alert.kind === "asset_price_target") {
      const title = threshold === undefined ? kindName(alert.kind, t)
        : t(`goals.fidelity.historyTitle.${alert.kind}.${comparator}`).replace("{asset}", asset).replace("{threshold}", money(threshold, 0));
      const message = t("goals.fidelity.historyValueOnRefresh").replace("{value}", money(alert.value)).replace("{day}", day);
      return { title, message };
    }
    if (alert.kind === "asset_price_move") {
      const title = threshold === undefined ? kindName(alert.kind, t)
        : t(`goals.fidelity.historyTitle.move.${comparator}`)
          .replace("{rule}", rule ? ruleTitle(rule, t) : asset)
          .replace("{threshold}", `${fixed(threshold, 0)}%`);
      const window = rule?.window ? windowName(rule.window, t) : "";
      const pastPrice = rule?.window && rule.assetType && props.prices[rule.window]?.[`${rule.assetType}:${asset}`];
      const currentPrice = latest?.assets.find((item) => item.assetType === rule?.assetType && item.symbol === asset)?.price;
      const priceRange = alert.triggeredAt === latest?.at && pastPrice && currentPrice
        ? t("goals.fidelity.historyRange").replace("{from}", money(pastPrice)).replace("{to}", money(currentPrice)) : "";
      const message = window ? t("goals.fidelity.historyMove").replace("{value}", percent(alert.value))
        .replace("{window}", window).replace("{range}", priceRange)
        : t("goals.fidelity.historyOther").replace("{value}", percent(alert.value)).replace("{day}", day);
      return { title, message };
    }
    if (alert.kind === "allocation_deviation") {
      const title = t("goals.fidelity.historyTitle.allocation").replace("{asset}", asset);
      const target = props.targets?.targets.find((item) => item.kind === "asset" && item.assetType === rule?.assetType && item.symbol === asset);
      const assetValue = latest?.assets.filter((item) => item.assetType === rule?.assetType && item.symbol === asset)
        .reduce((sum, item) => sum + item.value, 0);
      const share = alert.triggeredAt === latest?.at && target && assetValue !== undefined && currentTotal
        ? assetValue / currentTotal * 100 : undefined;
      const message = threshold === undefined && share === undefined ? t("goals.fidelity.historyAllocationNoLimit")
        .replace("{asset}", asset).replace("{value}", fixed(alert.value)).replace("{day}", day)
        : share === undefined || !target ? t("goals.fidelity.historyAllocationShort")
        .replace("{asset}", asset).replace("{value}", fixed(alert.value))
        .replace("{limit}", threshold === undefined ? "–" : fixed(threshold))
        : t("goals.fidelity.historyAllocation").replace("{asset}", asset)
          .replace("{share}", `${fixed(share)}%`).replace("{target}", `${fixed(target.percent)}%`)
          .replace("{drift}", `${sign(share - target.percent)}${fixed(Math.abs(share - target.percent))}`)
          .replace("{limit}", threshold === undefined ? "–" : fixed(threshold));
      return { title, message };
    }
    const value = alert.kind === "period_pnl" ? `${sign(alert.value)}${money(Math.abs(alert.value))}` : percent(alert.value);
    return { title: rule ? ruleTitle(rule, t) : kindName(alert.kind, t),
      message: t("goals.fidelity.historyOther").replace("{value}", value).replace("{day}", day) };
  };

  return <div className="t3-fidelity-page t3-fidelity-goals">
    <FidelityRail isProUser={props.isProUser} />
    <header className="t3-fidelity-head"><div><h1>{t("goals.fidelity.title")}</h1>
      <p>{rules.length ? <><b>{t("goals.fidelity.unread").replace("{count}", String(props.unreadCount))}</b> · {t("goals.fidelity.subtitle").replace("{count}", String(onCount)).replace("{total}", String(rules.length))}</> : t("goals.fidelity.emptySubtitle")}</p></div>
      <a className="t3-fidelity-kinds-link" href="#/goals/kinds">{t("goals.fidelity.ruleKinds")}</a>
      <button className="t3-fidelity-primary" onClick={(event) => openAdd(event.currentTarget)}><FidelityIcon name="plus" />{t("goals.fidelity.addRule")}</button>
    </header>
    {props.error && <p role="alert" className="t3-fidelity-error">{props.error}</p>}
    {!props.editorOpen && props.status && <p role="status" className="t3-fidelity-status">{props.status}</p>}
    <div className="t3-fidelity-grid">
      <section className="t3-fidelity-card t3-fidelity-kpis" data-testid="goals-summary">
        <div><span>{t("goals.fidelity.rulesOn")}</span><strong data-tone={rules.length ? undefined : "zero"}>{rules.length ? t("goals.fidelity.ofCount").replace("{count}", String(onCount)).replace("{total}", String(rules.length)) : "0"}</strong><small>{rules.length ? t("goals.fidelity.switchedOff").replace("{count}", String(rules.length - onCount)) : t("goals.fidelity.noneAdded")}</small></div>
        <div><span>{t("goals.summary.unread")}</span><strong data-tone={props.unreadCount ? "warning" : "zero"}>{props.unreadCount}</strong><small>{props.unreadCount ? unread.map((alert) => rules.find((rule) => rule.id === alert.ruleId)).filter((rule): rule is AlertRule => !!rule).map((rule) => ruleTitle(rule, t)).join(", ") : t("goals.fidelity.nothingTriggered")}</small></div>
        <div><span>{t("goals.fidelity.closest")}</span><strong data-tone={!candidate ? "zero" : undefined}>{candidate ? `${fixed(candidate.progress)}%` : "–"}</strong>
          <small>{candidate ? t("goals.fidelity.closestHint").replace("{rule}", ruleTitle(candidate.rule, t)).replace("{remaining}",
            candidate.rule.kind === "asset_price_move" || candidate.rule.kind === "portfolio_value_change" || candidate.rule.kind === "allocation_deviation"
              ? pts(fixed(Math.abs(candidate.rule.threshold - (candidate.value ?? 0)))) : money(candidate.rule.threshold - (candidate.value ?? 0))) : t("goals.fidelity.needsRule")}</small></div>
        <div><span>{t("goals.summary.lastCheck")}</span><strong data-tone={rules.length ? undefined : "zero"}>{time(latest?.at)}</strong><small>{latest ? t("goals.fidelity.lastCheckCadence").replace("{day}", dayLabel(latest.at)) : t("goals.unavailable")}</small></div>
      </section>
      <section className="t3-fidelity-card t3-fidelity-goal-rules">
        <div className="t3-fidelity-card-head"><h2>{t("goals.rules")}</h2><span>{rules.length ? t("goals.fidelity.rulesHint").replace("{on}", String(onCount)).replace("{off}", String(rules.length - onCount)).replace("{time}", time(latest?.at)) : t("goals.fidelity.zeroRules")}</span></div>
        {props.loading ? <div className="t3-fidelity-empty" role="status">{t("goals.loading")}</div> : rules.length ? <>
          <div className="t3-fidelity-rule-list" data-chart-group="">
          <div className="t3-fidelity-goal-row t3-fidelity-table-head"><span /><span>{t("goals.fidelity.column.rule")}</span><span>{t("goals.fidelity.column.progress")}</span><span>{t("goals.fidelity.kind")}</span><span>{t("goals.fidelity.column.status")}</span><span /></div>
          {rulePaging.rows.map((rule, index) => {
            const measurement = measurements[rules.indexOf(rule)];
            const raw = rule.threshold !== 0 && measurement.value !== undefined
              ? rule.kind === "portfolio_value_change" && rule.comparator === "lte" && measurement.value > rule.threshold ? 0
                : (rule.comparator === "gte" ? measurement.value / rule.threshold : rule.threshold / measurement.value) * 100 : 0;
            const triggered = history.some((alert) => alert.ruleId === rule.id && !alert.acknowledgedAt);
            return <div className={`t3-fidelity-goal-row ${rule.enabled ? "" : "off"}`} key={rule.id}>
              <label className="t3-fidelity-goal-switch"><input type="checkbox" checked={rule.enabled}
                aria-label={t("goals.enableRule").replace("{kind}", t(`goals.kind.${rule.kind}`))}
                onChange={(event) => props.onToggle(rule, event.target.checked)} /></label>
              <div className="t3-fidelity-goal-name"><b>{ruleTitle(rule, t)}</b><small>{ruleDescription(rule, t, money)}</small></div>
              <div className="t3-fidelity-goal-progress"><div><i role="button"
                {...chart.markProps(index, `${ruleTitle(rule, t)}: ${fixed(raw, 2)}%, ${measurement.value === undefined ? t("goals.unavailable") : fixed(measurement.value, 2)}`,
                  <><div>{ruleTitle(rule, t)}</div><div>{fixed(raw, 2)}%</div><div>{measurement.value === undefined ? t("goals.unavailable") : fixed(measurement.value, 2)}</div></>)}>
                <u className={triggered ? "warn" : ""} style={{ width: `${Math.min(100, Math.max(0, raw))}%` }} /></i>
                <strong>{measurement.status === "ready" ? raw >= 100 ? "100%+" : `${fixed(raw)}%` : "–"}</strong></div>
                <small>{describeProgress(rule, measurement.value, raw)}</small></div>
              <div className="t3-fidelity-goal-kind">{kindName(rule.kind, t)}<small>{t("goals.fidelity.cooldownShort").replace("{window}", cooldownLabel(Number(alertDraftFromRule(rule).cooldownMinutes)))}</small></div>
              <div className={`t3-fidelity-pill ${!rule.enabled ? "" : triggered ? "warning" : "info"}`}>{t(!rule.enabled ? "goals.fidelity.status.off" : triggered ? "goals.fidelity.status.triggered" : "goals.fidelity.status.watching")}</div>
              <div className="t3-fidelity-goal-actions"><button aria-label={t("goals.fidelity.editAction")} onClick={(event) => openEdit(rule, event.currentTarget)}><FidelityIcon name="edit" /></button>
                <button aria-label={t("goals.fidelity.deleteAction")} onClick={() => setDeleteRule(rule)}><FidelityIcon name="trash" /></button></div>
            </div>;
          })}
          </div><AttributionPager count={rules.length} {...rulePaging} t={t} ariaLabel={t("goals.rules")} />
        </> : <EmptyState icon={TargetIcon} title={t("goals.empty.title")} hint={t("goals.empty.hint")} className="t3-fidelity-empty">
          <button className="primary" onClick={(event) => openAdd(event.currentTarget)}><FidelityIcon name="plus" />{t("goals.newRule")}</button>
          <div className="t3-empty-state-chips">{alertTemplates.map((template) => <button key={template}
            onClick={(event) => openAdd(event.currentTarget, alertTemplateDraft(template, latest))}>{t(`goals.template.${template}`)}</button>)}</div>
        </EmptyState>}
      </section>
      <section className="t3-fidelity-card t3-fidelity-triggered">
        <div className="t3-fidelity-card-head"><h2>{t("goals.fidelity.triggered")}</h2>
          {!!props.unreadCount && <span className="t3-fidelity-badge">{props.unreadCount}</span>}
          <span className="t3-fidelity-goal-history-actions"><button className="t3-fidelity-notifications" aria-label={t(props.notificationsEnabled ? "goals.notificationEnabled" : "goals.enableNotifications")}
            title={t(props.notificationsEnabled ? "goals.notificationEnabled" : "goals.enableNotifications")} aria-pressed={props.notificationsEnabled} onClick={props.onEnableNotifications}><FidelityIcon name="bell" /></button>
          <button disabled={!props.unreadCount} onClick={props.onAcknowledgeAll}>{t("goals.ackAll")}</button>
            <button disabled={!history.length} onClick={() => setClearOpen(true)}>{t("goals.fidelity.clear")}</button></span></div>
        {props.loading ? <div className="t3-fidelity-empty" role="status">{t("goals.loading")}</div> : history.length ? <><div className="t3-fidelity-history-list">{historyPaging.rows.map((alert) => {
          const text = historyText(alert);
          return <div key={alert.id} className={`t3-fidelity-history-row ${alert.acknowledgedAt ? "" : "unread"}`}>
          <i /><div><b>{text.title}</b><small>{text.message}</small><small>{dateLabel(alert.triggeredAt)}{alert.ruleId === null ? ` · ${t("goals.fidelity.ruleDeleted")}` : ""}</small></div>
          {alert.acknowledgedAt ? <span><FidelityIcon name="check" />{t("goals.fidelity.read")}</span> : <button onClick={() => props.onAcknowledge(alert.id)}>{t("goals.ack")}</button>}
        </div>})}</div><AttributionPager count={history.length} {...historyPaging} t={t} ariaLabel={t("goals.history")} />
        <div className="t3-fidelity-foot"><FidelityIcon name="info" />{t("goals.fidelity.historyFoot")}</div></>
          : <EmptyState icon={BellIcon} title={t("goals.noHistory")} hint={t("goals.history.empty.hint")} className="t3-fidelity-empty" />}
      </section>
    </div>
    <Dialog open={!!deleteRule} onOpenChange={(open) => { if (!open) setDeleteRule(null); }}>
      <DialogContent className="t3-fidelity-goal-delete"><DialogTitle>{t("goals.fidelity.deleteTitle").replace("{title}", deleteRule ? ruleTitle(deleteRule, t) : "")}</DialogTitle>
        <DialogDescription>{t("goals.fidelity.deleteHint").replace("{count}", String(history.filter((alert) => alert.ruleId === deleteRule?.id).length))}</DialogDescription>
        <div className="t3-fidelity-goal-delete-actions"><button onClick={() => setDeleteRule(null)}>{t("common.cancel")}</button><button className="danger" onClick={() => { if (deleteRule) props.onDelete(deleteRule); setDeleteRule(null); }}><FidelityIcon name="trash" />{t("goals.fidelity.deleteRule")}</button></div>
      </DialogContent>
    </Dialog>
    <Dialog open={clearOpen} onOpenChange={setClearOpen}><DialogContent><DialogTitle>{t("goals.clearHistory")}</DialogTitle>
      <DialogDescription>{t("goals.clearConfirm")}</DialogDescription><div className="t3-fidelity-goal-delete-actions"><button onClick={() => setClearOpen(false)}>{t("common.cancel")}</button><button className="danger" onClick={() => { props.onClear(); setClearOpen(false); }}>{t("goals.fidelity.clear")}</button></div>
    </DialogContent></Dialog>
    <Dialog open={props.editorOpen} onOpenChange={(open) => { if (!open) closeEditor(); }}>
      <DialogContent className="t3-goals-drawer t3-fidelity-goal-drawer" onCloseAutoFocus={(event) => { event.preventDefault(); props.onEditorCloseFocus(); }}>
        <div className="t3-fidelity-drawer-head"><div><DialogTitle>{props.draft.id ? t("goals.editRule") : t("goals.fidelity.addRule")}</DialogTitle>
          <DialogDescription>{props.draft.id && editRule ? ruleTitle(editRule, t) : t("goals.fidelity.editorSubtitle")}</DialogDescription></div>
          <button aria-label={t("common.close")} onClick={closeEditor}><FidelityIcon name="close" /></button></div>
        <div className="t3-fidelity-drawer-body">
          {props.status && <div className="t3-fidelity-banner" role="alert"><FidelityIcon name="alert" /><div><b>{props.status}</b></div></div>}
          {(assetError || thresholdError) && <div className="t3-fidelity-banner" role="alert"><FidelityIcon name="alert" /><div><b>{t("goals.fidelity.fieldsError").replace("{count}", String([assetError, thresholdError].filter(Boolean).length))}</b>
            <span>{t("goals.fidelity.fieldsHint")}</span></div></div>}
          <label className="t3-fidelity-drawer-field"><b>{t("goals.fidelity.kind")}</b><select aria-label={t("goals.fidelity.kind")} value={props.draft.kind} onChange={(event) => {
            const kind = event.target.value as AlertKind;
            props.onDraft({ ...props.draft, kind, symbol: "", threshold: "", window: kind === "asset_price_move" ? "7d" : "24h" });
            setAttempted(false);
          }}>{kinds.map((kind) => <option key={kind} value={kind}>{kindName(kind, t)}</option>)}</select><small>{t(`goals.fidelity.kindHint.${props.draft.kind}`)}</small></label>
          {needsAsset(props.draft.kind) && <label className="t3-fidelity-drawer-field"><b>{t("goals.fidelity.asset")}</b><span className="t3-fidelity-asset-select"><select aria-label={t("goals.fidelity.asset")} className={assetError ? "error" : ""} value={props.draft.symbol ? `${props.draft.assetType}:${props.draft.symbol}` : ""} onChange={(event) => {
            const asset = assets.find((item) => `${item.assetType}:${item.symbol}` === event.target.value);
            props.onDraft({ ...props.draft, assetType: asset?.assetType ?? props.draft.assetType, symbol: asset?.symbol ?? "" });
          }}>
            <option value="">{t("goals.fidelity.chooseAsset")}</option>{assets.map((asset) => <option key={`${asset.assetType}:${asset.symbol}`} value={`${asset.assetType}:${asset.symbol}`}>{asset.symbol} · {money(asset.price)}</option>)}
          </select>{props.draft.symbol && <span className="t3-fidelity-asset-select-value"><b>{props.draft.symbol}</b><span>{money(assets.find((asset) => asset.symbol === props.draft.symbol && asset.assetType === props.draft.assetType)?.price ?? 0)}</span></span>}</span>
          {assetError ? <small className="error"><FidelityIcon name="alert" />{t("goals.fidelity.assetError")}</small> : <small>{t("goals.fidelity.assetHint")}</small>}</label>}
          <label className="t3-fidelity-drawer-field"><b>{t("goals.fidelity.comparator")}</b><select aria-label={t("goals.fidelity.comparator")} value={props.draft.comparator} onChange={(event) => props.onDraft({ ...props.draft, comparator: event.target.value as "gte" | "lte" })}>
            <option value="gte">{t(props.draft.kind === "asset_price_move" ? "goals.fidelity.comparator.rises" : props.draft.kind === "asset_price_target" ? "goals.fidelity.comparator.above" : "goals.fidelity.comparator.reaches")}</option>
            <option value="lte">{t(props.draft.kind === "asset_price_move" ? "goals.fidelity.comparator.falls" : props.draft.kind === "asset_price_target" ? "goals.fidelity.comparator.below" : "goals.fidelity.comparator.fallsTo")}</option>
          </select></label>
          <label className="t3-fidelity-drawer-field"><b>{t("goals.threshold")}</b><span className={`t3-fidelity-threshold ${thresholdError ? "error" : ""}`}><input type="number" aria-label={t("goals.threshold")} value={props.draft.threshold} onChange={(event) => props.onDraft({ ...props.draft, threshold: event.target.value })} /><span>{["asset_price_move", "portfolio_value_change"].includes(props.draft.kind) ? "%" : props.draft.kind === "allocation_deviation" ? t("goals.fidelity.pointUnit") : props.currencySymbol ?? "$"}</span></span>
            {thresholdError ? <small className="error"><FidelityIcon name="alert" />{t("goals.fidelity.thresholdError")}</small> : <small>{t(`goals.fidelity.thresholdHint.${props.draft.kind}`)}</small>}</label>
          {needsWindow(props.draft.kind) && <div className="t3-fidelity-drawer-field"><b>{t("goals.window")}</b><div className="t3-fidelity-segmented">{(["24h", "7d", "30d"] as AlertWindow[]).map((value) =>
            <button key={value} className={props.draft.window === value ? "selected" : ""} onClick={() => props.onDraft({ ...props.draft, window: value })}>{windowName(value, t)}</button>)}</div>
            <small className="t3-fidelity-window-hint">{t("goals.fidelity.windowHint")}</small></div>}
          <label className="t3-fidelity-drawer-field"><b>{t("goals.fidelity.cooldown")}</b><select aria-label={t("goals.fidelity.cooldown")} value={props.draft.cooldownMinutes} onChange={(event) => props.onDraft({ ...props.draft, cooldownMinutes: event.target.value })}>
            {[["60", "oneHour"], ["360", "sixHours"], ["1440", "24h"], ["10080", "7d"]].map(([value, label]) => <option key={value} value={value}>{t(`goals.fidelity.window.${label}`)}</option>)}
            {!["60", "360", "1440", "10080"].includes(props.draft.cooldownMinutes) && <option value={props.draft.cooldownMinutes}>{cooldownLabel(Number(props.draft.cooldownMinutes))}</option>}</select>
            <small>{t("goals.fidelity.cooldownHint")}</small></label>
          <div className={`t3-fidelity-preview ${assetError || thresholdError ? "dim" : ""}`}><small>{t("goals.fidelity.preview")}</small><div>{assetError || thresholdError
            ? t("goals.fidelity.previewIncomplete")
            : preview && editMeasurement?.value !== undefined
              ? previewParts(preview, [props.draft.symbol, `${props.draft.threshold}%`, windowName(props.draft.window, t)], percent(editMeasurement.value))
              : t("goals.fidelity.previewReady")}</div></div>
        </div>
        <div className="t3-fidelity-drawer-foot">
          {props.draft.id > 0 && <button className="delete" onClick={() => { closeEditor(); if (editRule) setDeleteRule(editRule); }}><FidelityIcon name="trash" />{t("common.delete")}</button>}
          <span /><button onClick={closeEditor}>{t("common.cancel")}</button><button className="primary" onClick={submit}>{props.draft.id ? t("goals.fidelity.saveChanges") : t("goals.fidelity.addRule")}</button>
        </div>
      </DialogContent>
    </Dialog>
    {chart.tooltip}
  </div>;
}

const kindCards = [
  { kind: "total_value_target", asset: null, options: "two", threshold: "$800,000", unit: "usd", window: null, cooldown: "24h" },
  { kind: "asset_value_target", asset: "BTC", options: "two", threshold: "$250,000", unit: "usd", window: null, cooldown: "24h" },
  { kind: "asset_price_target", asset: "BTC", options: "two", threshold: "$70,000", unit: "usdPerUnit", window: null, cooldown: "24h" },
  { kind: "asset_price_move", asset: "SOL", options: "two", threshold: "10%", unit: "percent", window: "7d", cooldown: "24h" },
  { kind: "allocation_deviation", asset: "BTC", options: "two", threshold: "2.0", unit: "points", window: null, cooldown: "24h" },
  { kind: "period_pnl", asset: null, options: "two", threshold: "+$40,000", unit: "usd", window: "30d", cooldown: "7d" },
  { kind: "portfolio_value_change", asset: null, options: "two", threshold: "5%", unit: "percent", window: "24h", cooldown: "24h" },
] as const;
export function GoalsKinds({ currency, isProUser }: { currency?: CurrencyRateDetail; isProUser?: boolean }) {
  const { t } = useTranslation();
  const darkTheme = useDarkTheme();
  const wideDesktop = (useWindowSize().width ?? window.innerWidth) >= 1500;
  const unit = (kind: typeof kindCards[number]["unit"]) =>
    (kind === "usd" || kind === "usdPerUnit") && currency && currency.currency !== "USD"
      ? t(`goals.fidelity.kindUnit.${kind === "usd" ? "currency" : "currencyPerUnit"}`).replace("{currency}", currency.currency)
      : t(`goals.fidelity.kindUnit.${kind}`);
  return <div className="t3-fidelity-page t3-fidelity-kinds">
    {wideDesktop && darkTheme && <FidelityRail isProUser={isProUser} />}
    <header className="t3-fidelity-head"><div><a href="#/goals">{t("goals.fidelity.title")}</a><h1>{t("goals.fidelity.ruleKinds")}</h1><p>{t("goals.fidelity.kindsSubtitle")}</p></div></header>
    <div className="t3-fidelity-info"><FidelityIcon name="info" /><div><b>{t("goals.fidelity.howRulesRun")}</b><span>{t("goals.fidelity.kindsInfo")}</span></div></div>
    <div className="t3-fidelity-grid">{kindCards.map((card) => <section key={card.kind} className={`t3-fidelity-card t3-fidelity-kind-card ${kindCards.indexOf(card) < 4 ? "top" : "bottom"}`}>
      <h2>{kindName(card.kind, t)}</h2><p>{t(`goals.fidelity.kindWhat.${card.kind}`)}</p>
      {[
        [t("goals.fidelity.kind"), kindName(card.kind, t), ""],
        [t("goals.fidelity.asset"), card.asset ?? t("goals.fidelity.notUsed"), ""],
        [t("goals.fidelity.comparator"), t(`goals.fidelity.kindComparator.${card.kind}`), t(`goals.fidelity.kindOptions.${card.options}`)],
        [t("goals.threshold"), card.unit === "points" ? t("goals.fidelity.pts").replace("{value}", card.threshold) : card.threshold.replace("$", currency?.symbol ?? "$"), unit(card.unit)],
        [t("goals.window"), card.window ? t(`goals.fidelity.window.${card.window}`) : t("goals.fidelity.notUsed"), card.window ? t("goals.fidelity.windowOptions") : ""],
        [t("goals.fidelity.cooldown"), t(`goals.fidelity.window.${card.cooldown}`), t("goals.fidelity.cooldownOptions")],
      ].map(([label, value, hint]) => <div className="t3-fidelity-kind-row" key={label}><span>{label}</span><div className={value === t("goals.fidelity.notUsed") ? "not-used" : ""}>{value}{hint && <small>{hint}</small>}</div></div>)}
    </section>)}</div>
  </div>;
}
