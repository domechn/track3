import AssetLabel from "@/components/common/asset-label";
import { useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  measureRule, type AlertHistory, type AlertKind, type AlertPrices,
  type AlertRule, type AlertSnapshot, type AlertWindow,
} from "@/middlelayers/alerts";
import type { AlertDraft } from "@/middlelayers/ui-state/alert-draft";
import { alertDraftFromRule, alertRuleFromDraft } from "@/middlelayers/ui-state/alert-draft";
import { alertTemplateDraft, alertTemplates } from "@/components/goals-alert-templates";
import { BellIcon, TargetIcon } from "@radix-ui/react-icons";
import EmptyState from "@/components/empty-state";
import { AttributionPager, useAttributionPage } from "@/components/attribution-pager";
import type { RebalanceProfile } from "@/middlelayers/rebalance";
import { useTranslation } from "@/mobile/i18n";
import { ConfirmSheet, ModalPage } from "@/mobile/components/mobile/overlays";
import PlanIcon from "@/mobile/components/plan-icon";
import { planAssetName } from "@/mobile/components/plan-asset-name";
import { alertSentence } from "@/components/finance-visuals";
import "./plan-fidelity.css";
import { useChartHitArea } from "@/components/chart-tooltip";

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
  onOpenEditor: (rule?: AlertRule, draft?: AlertDraft) => void;
  onCloseEditor: () => void;
  onSave: () => Promise<void>;
  onToggle: (rule: AlertRule, enabled: boolean) => void;
  onDelete: (rule: AlertRule) => void;
  onAck: (alert: AlertHistory) => void;
  onAckAll: () => void;
  onClear: () => void;
  onAdvanced?: () => void;
};

const digits = (d: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const usd = (n: number, d = 2) => `$${digits(d).format(Math.abs(n))}`;
const signedUsd = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${usd(n)}`;
const pct = (n: number) => `${digits(1).format(n)}%`;
const signed = (n: number, unit: string) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${digits(1).format(Math.abs(n))}${unit}`;
const hour = (at?: string) => at ? new Date(at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "–";
const kindIds: AlertKind[] = [
  "total_value_target", "asset_value_target", "asset_price_target", "asset_price_move",
  "allocation_deviation", "period_pnl", "portfolio_value_change",
];
const kindExamples = [
  { asset: null, comparator: "reachesOrExceeds", comparatorNote: "twoOptions", threshold: "$800,000", unit: "usDollars", window: null, cooldown: "24h" },
  { asset: "BTC", comparator: "reachesOrExceeds", comparatorNote: "twoOptions", threshold: "$250,000", unit: "usDollars", window: null, cooldown: "24h" },
  { asset: "BTC", comparator: "goesAboveLower", comparatorNote: "twoOptions", threshold: "$70,000", unit: "usDollarsUnit", window: null, cooldown: "24h" },
  { asset: "SOL", comparator: "risesMore", comparatorNote: "threeOptions", threshold: "10%", unit: "percentWord", window: "7d", cooldown: "24h" },
  { asset: "BTC", comparator: "differsMore", comparatorNote: "fixed", threshold: "2.0 pts", unit: "pointsWord", window: null, cooldown: "24h" },
  { asset: null, comparator: "isAtLeastLower", comparatorNote: "twoOptions", threshold: "+$40,000", unit: "usDollars", window: "30d", cooldown: "7d" },
  { asset: null, comparator: "fallsMore", comparatorNote: "twoOptions", threshold: "5%", unit: "percentWord", window: "24h", cooldown: "24h" },
];
const unitLabel = (kind: AlertKind) => kind === "asset_price_move" || kind === "portfolio_value_change" ? "%" :
  kind === "allocation_deviation" ? "pts" : "$";

export default function GoalsFidelity({
  rules, history, unreadCount, snapshots, prices, targets, loading, error, status, draft,
  editorOpen, onDraft, onOpenEditor, onCloseEditor, onSave, onToggle, onDelete, onAck, onAckAll, onClear, onAdvanced,
}: Props) {
  const { t, locale } = useTranslation();
  const chart = useChartHitArea();
  const windowName = (window: AlertWindow | null) => t(window === "7d" ? "fidelity.goals.sevenDays" :
    window === "30d" ? "fidelity.goals.thirtyDays" : "fidelity.goals.day");
  const cooldownName = (minutes: number) => {
    if (minutes === 60) return t("fidelity.goals.oneHour");
    if (minutes === 360) return t("fidelity.goals.sixHours");
    if (minutes === 1440) return windowName("24h");
    if (minutes === 10080) return windowName("7d");
    const [count, key] = minutes > 0 && minutes % 1440 === 0
      ? [minutes / 1440, "fidelity.goals.customDays"]
      : minutes > 0 && minutes % 60 === 0
        ? [minutes / 60, "fidelity.goals.customHours"]
        : [minutes, "fidelity.goals.customMinutes"];
    return t(key).replace("{count}", String(count));
  };
  const cooldownShort = (minutes: number) => {
    const [count, unit] = minutes >= 10080 && minutes % 1440 === 0
      ? [minutes / 1440, "days"] : minutes > 0 && minutes % 60 === 0
        ? [minutes / 60, "hours"] : [minutes, "minutes"];
    return t(`fidelity.goals.shortCooldown.${unit}`).replace("{count}", String(count));
  };
  const location = useLocation();
  const navigate = useNavigate();
  const screen = new URLSearchParams(location.search).get("view") === "kinds" ? "kinds" : "list";
  const [deleteRule, setDeleteRule] = useState<AlertRule | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const orderedRules = [...rules].sort((a, b) => a.id - b.id);
  const rulePaging = useAttributionPage(orderedRules, orderedRules.map((rule) => rule.id).join(","), 20);
  const historyPaging = useAttributionPage(history, history.map((alert) => alert.id).join(","), 20);
  const lastAt = snapshots[0]?.at;
  const lastTime = hour(lastAt);
  const onCount = rules.filter((rule) => rule.enabled).length;
  const unacknowledged = history.filter((alert) => !alert.acknowledgedAt);
  const [unreadHeading, rulesHeading] = t("fidelity.goals.headerSubtitle")
    .replace("{unread}", String(unreadCount)).replace("{on}", String(onCount))
    .replace("{all}", String(rules.length)).split(" · ", 2);
  const currentNow = Date.now();
  const when = (at: string) => {
    const day = new Date(at);
    return day.toDateString() === new Date(currentNow).toDateString()
      ? `${t("fidelity.goals.today")} ${hour(at)}`
      : `${locale === "zh"
        ? day.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
        : `${day.getDate()} ${day.toLocaleDateString("en-US", { month: "short" })}`} ${hour(at)}`;
  };
  const titleFor = (rule: AlertRule) => {
    const symbol = rule.symbol ?? "";
    if (rule.kind === "total_value_target") return t("fidelity.goals.portfolioValue");
    if (rule.kind === "asset_value_target") return t("fidelity.goals.assetValue").replace("{symbol}", symbol);
    if (rule.kind === "asset_price_target") return t("fidelity.goals.assetPrice").replace("{symbol}", symbol);
    if (rule.kind === "asset_price_move") return t("fidelity.goals.assetMoveLocalized").replace("{symbol}", symbol)
      .replace("{window}", t(`fidelity.goals.shortWindow.${rule.window ?? "24h"}`));
    if (rule.kind === "allocation_deviation") return t("fidelity.goals.assetAllocation")
      .replace("{symbol}", symbol === "*" ? t("fidelity.goals.anyAsset") : symbol);
    if (rule.kind === "period_pnl") return t("fidelity.goals.periodPnl").replace("{window}",
      locale === "zh" ? t(`fidelity.goals.shortWindow.${rule.window ?? "24h"}`) : (rule.window ?? "").toUpperCase());
    return t(rule.comparator === "lte" ? "fidelity.goals.portfolioDrop" : "fidelity.goals.portfolioRise");
  };
  const kindFor = (kind: AlertKind) => t(`fidelity.goals.kind.${kind}`);
  const descriptionFor = (rule: AlertRule) => {
    const threshold = rule.threshold;
    if (rule.kind === "total_value_target" || rule.kind === "asset_value_target")
      return t(rule.comparator === "lte" ? "fidelity.goals.ruleSummary.valueBelow" : "fidelity.goals.ruleSummary.reaches")
        .replace("{value}", usd(threshold, 0));
    if (rule.kind === "asset_price_target")
      return t(rule.comparator === "gte" ? "fidelity.goals.ruleSummary.priceAbove" : "fidelity.goals.ruleSummary.priceBelow")
        .replace("{value}", usd(threshold, 0));
    if (rule.kind === "asset_price_move")
      return t(rule.comparator === "gte" ? "fidelity.goals.ruleSummary.risesMore" : "fidelity.goals.ruleSummary.fallsMore")
        .replace("{value}", digits(0).format(Math.abs(threshold))).replace("{window}", windowName(rule.window));
    if (rule.kind === "allocation_deviation")
      return t("fidelity.goals.ruleSummary.offTarget").replace("{value}", digits(1).format(threshold));
    if (rule.kind === "period_pnl")
      return t("fidelity.goals.ruleSummary.isAtLeast").replace("{value}", usd(threshold, 0))
        .replace("{window}", windowName(rule.window));
    return t(rule.comparator === "gte" ? "fidelity.goals.ruleSummary.risesMore" : "fidelity.goals.ruleSummary.fallsMore")
      .replace("{value}", digits(0).format(Math.abs(threshold))).replace("{window}", windowName(rule.window));
  };
  const progressFor = (rule: AlertRule, value?: number) => {
    if (value === undefined || !rule.enabled) return 0;
    if (rule.threshold === 0) return rule.comparator === "gte" ? value >= 0 ? 100 : 0 : value <= 0 ? 100 : 0;
    const towardIncreasing = rule.comparator === "gte" && rule.threshold > 0 ||
      rule.comparator === "lte" && rule.threshold < 0;
    const reached = rule.comparator === "gte" ? value >= rule.threshold : value <= rule.threshold;
    const ratio = towardIncreasing ? value / rule.threshold : rule.threshold / value;
    return Math.max(0, reached ? Math.max(100, ratio * 100) : ratio * 100);
  };
  const closest = orderedRules.map((rule) => {
    const measure = measureRule(rule, snapshots, prices, targets);
    return { rule, value: measure.value, progress: progressFor(rule, measure.value) };
  }).filter((entry) => entry.rule.enabled && Number.isFinite(entry.progress) && entry.progress < 100)
    .sort((a, b) => b.progress - a.progress)[0];
  const moveKind = draft.kind === "asset_price_move" || draft.kind === "portfolio_value_change";
  const negativeThreshold = draft.threshold.startsWith("-");
  const wasEditorOpen = useRef(editorOpen);
  const editorReopened = editorOpen && !wasEditorOpen.current;
  wasEditorOpen.current = editorOpen;
  const initialMoveSign = useRef({ id: draft.id, kind: draft.kind, comparator: draft.comparator, negative: negativeThreshold });
  if (editorReopened || initialMoveSign.current.id !== draft.id || initialMoveSign.current.kind !== draft.kind) {
    initialMoveSign.current = { id: draft.id, kind: draft.kind, comparator: draft.comparator, negative: negativeThreshold };
  }
  const moveSign = useRef({ id: draft.id, kind: draft.kind, comparator: draft.comparator, negative: negativeThreshold });
  if (editorReopened || moveSign.current.id !== draft.id || moveSign.current.kind !== draft.kind || moveSign.current.comparator !== draft.comparator) {
    moveSign.current = { id: draft.id, kind: draft.kind, comparator: draft.comparator, negative: negativeThreshold };
  }
  const thresholdMagnitude = negativeThreshold ? draft.threshold.slice(1) : draft.threshold;
  const invalidThreshold = !draft.threshold || (moveKind && Number(thresholdMagnitude) <= 0);
  const openAdd = () => { setInvalid(false); onOpenEditor(); };
  const openEdit = (rule: AlertRule) => { setInvalid(false); onOpenEditor(rule); };
  const save = async () => {
    const missingAsset = ["asset_value_target", "asset_price_target", "asset_price_move", "allocation_deviation"].includes(draft.kind) && !draft.symbol.trim();
    const badThreshold = !Number.isFinite(Number(draft.threshold)) || invalidThreshold;
    if (missingAsset || badThreshold) { setInvalid(true); return; }
    await onSave();
  };
  let previewMove: string | undefined;
  let previewText = t("fidelity.goals.previewIncomplete");
  try {
    const previewRule = alertRuleFromDraft(draft);
    previewText = alertSentence(previewRule, t);
    if (draft.kind === "allocation_deviation") previewText = t("fidelity.goals.previewAllocation")
      .replace("{symbol}", draft.symbol === "*" ? t("fidelity.goals.anyAsset") : draft.symbol)
      .replace("{comparator}", t(draft.comparator === "gte" ? "goals.atLeast" : "goals.atMost").toLowerCase())
      .replace("{threshold}", draft.threshold);
    if (draft.kind === "asset_price_move" && draft.comparator === "gte") {
      const measured = measureRule(previewRule, snapshots, prices, targets);
      if (measured.value !== undefined) {
        previewMove = signed(measured.value, "%");
        const cooldownMinutes = Number(draft.cooldownMinutes);
        previewText = t(measured.value < previewRule.threshold ? "fidelity.goals.previewMoveBelow"
          : cooldownMinutes < 60 || cooldownMinutes % 60 !== 0 ? "fidelity.goals.previewMoveLiveMinutes"
            : cooldownMinutes >= 10080 && cooldownMinutes % 1440 === 0 ? "fidelity.goals.previewMoveLiveDays"
              : cooldownMinutes === 60 ? "fidelity.goals.previewMoveLive"
                : "fidelity.goals.previewMoveLivePlural").replace("{symbol}", draft.symbol)
          .replace("{threshold}", draft.threshold).replace("{window}", windowName(draft.window))
          .replace("{current}", previewMove)
          .replace("{cooldown}", String(cooldownMinutes < 60 || cooldownMinutes % 60 !== 0 ? cooldownMinutes
            : cooldownMinutes >= 10080 && cooldownMinutes % 1440 === 0 ? cooldownMinutes / 1440 : cooldownMinutes / 60));
      }
    }
  } catch { /* Incomplete drafts use the incomplete preview. */ }
  const comparatorLabel = (comparator: "gte" | "lte") => t(comparator === "gte"
    ? draft.kind === "asset_price_move" || draft.kind === "portfolio_value_change" ? "fidelity.goals.risesMore"
      : draft.kind === "asset_price_target" ? "fidelity.goals.goesAbove" : "fidelity.goals.reachesOrExceeds"
    : draft.kind === "asset_price_move" || draft.kind === "portfolio_value_change" ? "fidelity.goals.fallsMore"
      : draft.kind === "asset_price_target" ? "fidelity.goals.goesBelow" : "fidelity.goals.fallsToOrBelow");
  const selectedAsset = snapshots[0]?.assets.find((asset) => asset.assetType === draft.assetType && asset.symbol === draft.symbol);
  const cooldownOptions: [string, string][] = [
    ["60", t("fidelity.goals.oneHour")], ["360", t("fidelity.goals.sixHours")],
    ["1440", windowName("24h")], ["10080", windowName("7d")],
  ];
  if (draft.cooldownMinutes && !cooldownOptions.some(([value]) => value === draft.cooldownMinutes)) {
    cooldownOptions.push([draft.cooldownMinutes, cooldownName(Number(draft.cooldownMinutes))]);
  }
  const edit = editorOpen && <ModalPage title={draft.id ? t("fidelity.goals.editRule") : t("fidelity.goals.addRule")} onDismiss={onCloseEditor}>
    <div className="pf-editor">
      <div className="pf-editor-head"><button onClick={onCloseEditor}><PlanIcon name="back" />{t("fidelity.goals.rules")}</button>
        <b>{t(draft.id ? "fidelity.goals.editRule" : "fidelity.goals.addRule")}</b><span /></div>
      <div className="pf-editor-body">
        {invalid && <div className="pf-banner pf-error" role="alert"><PlanIcon name="alert" />
          <div><b>{t("fidelity.goals.fieldsAttention")}</b><span>{t("fidelity.goals.fieldsRequired")}</span></div></div>}
        <label className="pf-editor-field">{t("fidelity.goals.kind")}
          <span className="pf-select"><span aria-hidden="true">{kindFor(draft.kind)}</span>
          <select aria-label={t("fidelity.goals.kind")} value={draft.kind} onChange={(event) => onDraft({ ...draft, kind: event.target.value as AlertKind,
            window: event.target.value === "asset_price_move" ? "7d" : draft.window,
            threshold: event.target.value === "asset_price_move" || event.target.value === "portfolio_value_change"
              ? draft.threshold && draft.comparator === "lte" && !draft.threshold.startsWith("-")
                ? `-${draft.threshold}` : draft.threshold : draft.threshold,
            cooldownMinutes: event.target.value === "asset_price_move" ? "1440" : draft.cooldownMinutes })}>
            {kindIds.map((kind) => <option key={kind} value={kind}>{kindFor(kind)}</option>)}</select></span></label>
        {["asset_value_target", "asset_price_target", "asset_price_move", "allocation_deviation"].includes(draft.kind) &&
          <label className="pf-editor-field">{t("fidelity.goals.asset")}
            <span className={`pf-select ${invalid && !draft.symbol.trim() ? "pf-invalid" : ""}`}>
              {draft.kind === "allocation_deviation" && draft.symbol === "*" ?
                <span className="pf-select-asset" aria-hidden="true"><b>{t(draft.assetType === "stock"
                  ? "fidelity.goals.anyStockAsset" : "fidelity.goals.anyCryptoAsset")}</b></span>
                : selectedAsset ? <span className="pf-select-asset" aria-hidden="true"><b>{selectedAsset.symbol}</b>
                <span>{planAssetName(selectedAsset)} · {usd(selectedAsset.price)}</span></span>
                : <span className="pf-select-placeholder" aria-hidden="true">{t("fidelity.goals.chooseAsset")}</span>}
            <select aria-label={t("fidelity.goals.asset")}
              value={draft.symbol ? `${draft.assetType}:${draft.symbol}` : ""} onChange={(event) => {
                if (event.target.value.endsWith(":*")) {
                  onDraft({ ...draft, assetType: event.target.value.startsWith("stock:") ? "stock" : "crypto", symbol: "*" });
                  return;
                }
                const asset = snapshots[0]?.assets.find((item) => `${item.assetType}:${item.symbol}` === event.target.value);
                onDraft({ ...draft, assetType: asset?.assetType ?? draft.assetType, symbol: asset?.symbol ?? "" });
              }}>
              <option value="">{t("fidelity.goals.chooseAsset")}</option>
              {draft.kind === "allocation_deviation" && <>
                <option value="crypto:*">{t("fidelity.goals.anyCryptoAsset")}</option>
                <option value="stock:*">{t("fidelity.goals.anyStockAsset")}</option>
              </>}
              {draft.symbol && draft.symbol !== "*" && !selectedAsset && <option value={`${draft.assetType}:${draft.symbol}`}>{draft.symbol}</option>}
              {snapshots[0]?.assets.map((asset) => <option key={`${asset.assetType}:${asset.symbol}`} value={`${asset.assetType}:${asset.symbol}`}>
                {asset.symbol} {planAssetName(asset)} · {usd(asset.price)}</option>)}
            </select></span>
            {invalid && !draft.symbol.trim() && <small className="pf-field-error"><PlanIcon name="alert" />{t("fidelity.goals.chooseAssetError")}</small>}
          </label>}
        <label className="pf-editor-field">{t("fidelity.goals.comparator")}
          <span className="pf-select"><span aria-hidden="true">{comparatorLabel(draft.comparator)}</span>
          <select aria-label={t("fidelity.goals.comparator")} value={draft.comparator}
            onChange={(event) => {
              const comparator = event.target.value as "gte" | "lte";
              const negative = comparator === initialMoveSign.current.comparator
                ? initialMoveSign.current.negative : comparator === "lte";
              if (moveKind) moveSign.current = { id: draft.id, kind: draft.kind, comparator, negative };
              onDraft({ ...draft, comparator, threshold: moveKind && thresholdMagnitude
                ? `${negative ? "-" : ""}${thresholdMagnitude}` : draft.threshold });
            }}>
            <option value="gte">{comparatorLabel("gte")}</option>
            <option value="lte">{comparatorLabel("lte")}</option>
          </select></span></label>
        <label className="pf-editor-field">{t("fidelity.goals.threshold")}
          <span className={`pf-editor-number ${invalid && invalidThreshold ? "pf-invalid" : ""}`}>
            {unitLabel(draft.kind) === "$" && "$"}
            <input aria-label={t("fidelity.goals.threshold")} type="number" placeholder={moveKind ? "0" : undefined}
              value={moveKind ? thresholdMagnitude : draft.threshold}
              onChange={(event) => {
                const entered = event.currentTarget.value;
                const magnitude = entered.startsWith("-") ? entered.slice(1) : entered;
                onDraft({ ...draft, threshold: moveKind && magnitude && moveSign.current.negative ? `-${magnitude}` : magnitude });
              }} />
            {unitLabel(draft.kind) !== "$" && <span>{unitLabel(draft.kind)}</span>}</span>
          {invalid && invalidThreshold && <small className="pf-field-error"><PlanIcon name="alert" />{t("fidelity.goals.thresholdError")}</small>}
        </label>
        {["asset_price_move", "period_pnl", "portfolio_value_change"].includes(draft.kind) &&
          <div className="pf-editor-field">{t("fidelity.goals.window")}<div className="pf-segment">
            {(["24h", "7d", "30d"] as const).map((window) => <button key={window}
              aria-pressed={draft.window === window} className={draft.window === window ? "active" : ""}
              onClick={() => onDraft({ ...draft, window })}>{windowName(window)}</button>)}</div></div>}
        <label className="pf-editor-field">{t("fidelity.goals.cooldown")}
          <span className="pf-select"><span aria-hidden="true">{cooldownOptions.find(([value]) => value === draft.cooldownMinutes)?.[1] ?? t("fidelity.goals.chooseCooldown")}</span>
          <select aria-label={t("fidelity.goals.cooldown")} value={draft.cooldownMinutes}
            onChange={(event) => onDraft({ ...draft, cooldownMinutes: event.currentTarget.value })}>
            {cooldownOptions.map(([value, label]) =>
              <option key={value} value={value}>{label}</option>)}</select></span></label>
        <div className={`pf-preview ${invalid ? "pf-dim" : ""}`}><span>{t("fidelity.goals.preview")}</span>
          <p>{invalid ? t("fidelity.goals.previewIncomplete") : previewMove
            ? highlightPreview(previewText, [draft.symbol, `${draft.threshold}%`, windowName(draft.window)], previewMove)
            : previewText}</p></div>
        {status && <p role="status">{status}</p>}
      </div>
      <div className="pf-editor-footer">
        {draft.id > 0 && <button className="pf-editor-delete" onClick={() => {
          const rule = rules.find((item) => item.id === draft.id); if (rule) setDeleteRule(rule);
        }}><PlanIcon name="trash" />{t("common.delete")}</button>}
        <span />
        <button onClick={onCloseEditor}>{t("common.cancel")}</button>
        <button className="pf-primary" onClick={() => void save()}>{t(draft.id ? "fidelity.goals.saveChanges" : "fidelity.goals.addRule")}</button>
      </div>
    </div>
  </ModalPage>;
  const deleteOverlay = deleteRule && <ConfirmSheet title={t("fidelity.goals.deleteTitle").replace("{rule}", titleFor(deleteRule))} onDismiss={() => setDeleteRule(null)}>
    <div className="pf-delete"><div className="pf-grabber" /><h2>{t("fidelity.goals.deleteTitle").replace("{rule}", titleFor(deleteRule))}</h2>
      <p>{t("fidelity.goals.deleteHelp").replace("{count}", String(history.filter((alert) => alert.ruleId === deleteRule.id).length))}</p>
      <button className="pf-danger" onClick={() => { onDelete(deleteRule); setDeleteRule(null); onCloseEditor(); }}><PlanIcon name="trash" />{t("fidelity.goals.deleteRule")}</button>
      <button onClick={() => setDeleteRule(null)}>{t("common.cancel")}</button></div>
  </ConfirmSheet>;
  const clearOverlay = clearOpen && <ConfirmSheet title={t("goals.clearHistory")} onDismiss={() => setClearOpen(false)}>
    <div className="pf-delete"><div className="pf-grabber" /><h2>{t("goals.clearHistory")}</h2><p>{t("goals.clearConfirm")}</p>
      <button className="pf-danger" onClick={() => { onClear(); setClearOpen(false); }}>{t("goals.clearHistory")}</button>
      <button onClick={() => setClearOpen(false)}>{t("common.cancel")}</button></div>
  </ConfirmSheet>;

  return <div className="pf-page pf-goals" data-testid="goals-phone">
    {screen === "kinds" ? <>
      <header className="pf-head"><button className="pf-crumb" onClick={() => navigate("/goals")}>{t("fidelity.nav.goals")}</button>
        <h1>{t("fidelity.goals.ruleKinds")}</h1><p>{t("fidelity.goals.kindsSubtitle")}</p></header>
      <div className="pf-banner pf-info"><PlanIcon name="info" /><div><b>{t("fidelity.goals.howRun")}</b>
        <span>{t("fidelity.goals.howRunText")}</span></div></div>
      {kindIds.map((kind, index) => {
        const example = kindExamples[index];
        const row = (label: string, value: string, hint?: string) =>
          <div className="pf-kind-row" key={label}><span>{label}</span><div className={value === t("fidelity.goals.notUsed") ? "pf-unused" : ""}>
            {value}{hint && <small>{hint}</small>}</div></div>;
        const notUsed = t("fidelity.goals.notUsed");
        return <section className="pf-card pf-kind-card" key={kind}><h2>{kindFor(kind)}</h2>
          <p>{t(`fidelity.goals.what.${kind}`)}</p>
          {row(t("fidelity.goals.kind"), kindFor(kind))}
          {row(t("fidelity.goals.asset"), example.asset ?? notUsed)}
          {row(t("fidelity.goals.comparator"), t(`fidelity.goals.${example.comparator}`), t(`fidelity.goals.${example.comparatorNote}`))}
          {row(t("fidelity.goals.threshold"), example.threshold, t(`fidelity.goals.${example.unit}`))}
          {row(t("fidelity.goals.window"), example.window ? windowName(example.window as AlertWindow) : notUsed,
            example.window ? t("fidelity.goals.windowOptions") : undefined)}
          {row(t("fidelity.goals.cooldown"), windowName(example.cooldown as AlertWindow), t("fidelity.goals.cooldownOptions"))}
        </section>;
      })}
    </> : <>
      <header className="pf-head"><h1>{t("fidelity.nav.goals")}</h1>
        <p>{rules.length ? <><b>{unreadHeading}</b> · {rulesHeading}</>
          : t("fidelity.goals.emptySubtitle")}</p>
        <button className="pf-add" onClick={openAdd}><PlanIcon name="plus" />{t("fidelity.goals.addRule")}</button>
      </header>
      {error && <p role="alert">{error}</p>}
      <section className="pf-card pf-summary" data-testid="goals-summary">
        {kpi(t("fidelity.goals.rulesOn"), rules.length
          ? t("fidelity.goals.rulesRatio").replace("{on}", String(onCount)).replace("{all}", String(rules.length)) : "0", rules.length
          ? t("fidelity.goals.switchedOff").replace("{count}", String(rules.length - onCount))
          : t("fidelity.goals.noneAdded"), rules.length ? "" : "pf-zero")}
        {kpi(t("fidelity.goals.unreadAlerts"), String(unreadCount), unreadCount
          ? unacknowledged.slice(0, 2).map((alert) => {
            const rule = rules.find((item) => item.id === alert.ruleId);
            return rule ? titleFor(rule) : alertText(alert, t, locale).title;
          }).join(t("fidelity.goals.listSeparator"))
          : t("fidelity.goals.nothingTriggered"), unreadCount ? "pf-warning" : "pf-zero")}
        {kpi(t("fidelity.goals.closest"), closest ? pct(closest.progress) : "–", closest && closest.value !== undefined
          ? t("fidelity.goals.closestToGo").replace("{rule}", titleFor(closest.rule))
            .replace("{remaining}", `${unitLabel(closest.rule.kind) === "$"
              ? usd(Math.abs(closest.rule.threshold - closest.value))
              : `${digits(1).format(Math.abs(closest.rule.threshold - closest.value))}${unitLabel(closest.rule.kind) === "%" ? "" : " "}${unitLabel(closest.rule.kind)}`}`)
          : t("fidelity.goals.needsRule"), closest ? "" : "pf-zero")}
        {kpi(t("fidelity.goals.lastCheck"), lastTime, t("fidelity.goals.todayRefresh"),
          lastAt && rules.length ? "" : "pf-zero")}
      </section>
      <section data-chart-group="" className={`pf-card pf-rules-list${rules.length > 7 ? " pf-scroll-list" : ""}`}><div className="pf-card-head"><h2 aria-label={t("fidelity.goals.rules")}><button className="pf-heading-action"
        aria-label={t("fidelity.goals.options")} aria-expanded={setupOpen}
        aria-controls="pf-rules-links" onClick={() => setSetupOpen(!setupOpen)}>
        {t("fidelity.goals.rules")}</button></h2>
        <small>{rules.length ? t("fidelity.goals.rulesMeta").replace("{on}", String(onCount))
          .replace("{off}", String(rules.length - onCount)).replace("{time}", lastTime)
          : `0 ${t("fidelity.goals.rulesLower")}`}</small>
        </div>
        {setupOpen && <div className="pf-rules-links" id="pf-rules-links">
          <button onClick={() => { setSetupOpen(false); navigate("/goals?view=kinds"); }}>{t("fidelity.goals.ruleKinds")}</button>
          {onAdvanced && <button onClick={() => { setSetupOpen(false); onAdvanced(); }}>{t("fidelity.goals.advanced")}</button>}
        </div>}
        {loading ? <div role="status">{t("goals.loading")}</div> : rules.length ? rulePaging.rows.map((rule, index) => {
          const measured = measureRule(rule, snapshots, prices, targets);
          const progress = progressFor(rule, measured.value);
          const cooldownMinutes = Number(alertDraftFromRule(rule).cooldownMinutes);
          const triggered = history.some((alert) => alert.ruleId === rule.id && !alert.acknowledgedAt);
          const assetValue = snapshots[0]?.assets.find((asset) => asset.assetType === rule.assetType && asset.symbol === rule.symbol)?.value ?? 0;
          const portfolioValue = snapshots[0]?.assets.reduce((sum, asset) => sum + asset.value, 0) ?? 0;
          const targetShare = targets?.targets.find((target) => target.kind === "asset" && target.assetType === rule.assetType && target.symbol === rule.symbol)?.percent ?? 0;
          const drift = portfolioValue > 0 ? assetValue / portfolioValue * 100 - targetShare : 0;
          const currentText = measured.value === undefined ? t("goals.unavailable") :
            rule.kind === "asset_price_target"
              ? t(rule.comparator === "gte" ? "fidelity.goals.current.priceTarget" : "fidelity.goals.current.priceBelow")
                .replace("{value}", usd(measured.value))
                .replace("{needed}", pct(Math.abs((rule.threshold / measured.value - 1) * 100)))
              : rule.kind === "asset_price_move"
                ? t("fidelity.goals.current.move").replace("{move}", signed(measured.value, "%"))
                  .replace("{window}", t(`fidelity.goals.shortWindow.${rule.window ?? "24h"}`)).replace("{over}", digits(1).format(Math.max(0,
                    rule.comparator === "lte" ? rule.threshold - measured.value : measured.value - rule.threshold)))
              : rule.kind === "allocation_deviation" && rule.symbol === "*"
                ? t("fidelity.goals.current.anyAllocation").replace("{drift}", digits(1).format(measured.value))
              : rule.kind === "allocation_deviation"
                ? t("fidelity.goals.current.allocation").replace("{drift}", signed(drift, " pts"))
                  .replace("{target}", pct(targetShare)).replace("{over}", digits(1).format(Math.max(0, Math.abs(drift) - rule.threshold)))
              : rule.kind === "portfolio_value_change"
                ? t(rule.comparator === "gte" ? "fidelity.goals.current.portfolioRise" : "fidelity.goals.current.portfolioMove")
                  .replace("{move}", signed(measured.value, "%"))
                  .replace("{window}", t(`fidelity.goals.shortWindow.${rule.window ?? "24h"}`)).replace("{threshold}", pct(Math.abs(rule.threshold)))
              : t(rule.comparator === "lte" ? "fidelity.goals.current.valueBelow" : "fidelity.goals.current.value")
                .replace("{value}", rule.kind === "period_pnl" ? signedUsd(measured.value) : usd(measured.value))
                .replace("{remaining}", usd(Math.abs(rule.threshold - measured.value)));
          return <div className={`pf-goal-row ${rule.enabled ? "" : "pf-off"}`} key={rule.id}>
            <div className="pf-goal-name"><AssetLabel kind={rule.symbol ? rule.assetType === "stock" ? "stock" : "coin" : "custom"}
              symbol={rule.symbol ?? ""} name={titleFor(rule)} size={20} secondary={descriptionFor(rule)} /></div>
            <label className="pf-goal-switch"><span className="sr-only">{t("goals.enableRule").replace("{kind}", t(`goals.kind.${rule.kind}`))}</span>
              <input type="checkbox" role="switch" aria-label={t("goals.enableRule").replace("{kind}", t(`goals.kind.${rule.kind}`))}
                checked={rule.enabled} onChange={(event) => onToggle(rule, event.currentTarget.checked)} /></label>
            <div className="pf-goal-progress"><div className="pf-progress-line" role="button"
              {...chart.markProps(index, `${titleFor(rule)}: ${pct(progress)}, ${measured.value === undefined ? t("goals.unavailable") : digits(2).format(measured.value)}`,
                <><div>{titleFor(rule)}</div><div>{pct(progress)}</div><div>{currentText}</div></>)}>
              <span role="progressbar"
              aria-label={t("goals.progress").replace("{kind}", t(`goals.kind.${rule.kind}`))}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(Math.min(100, progress).toFixed(1))}>
              <i className={triggered ? "pf-amber" : ""}
              style={{ width: `${Math.min(100, progress)}%` }} /></span><b>{progress >= 100 ? "100%+" : pct(progress)}</b></div>
              <small>{currentText}</small></div>
            <div className="pf-goal-kind">{kindFor(rule.kind)}<small>{t("fidelity.goals.cooldownShort")
              .replace("{duration}", cooldownShort(cooldownMinutes))}</small></div>
            <span className="t3-tag pf-goal-status" data-tone={!rule.enabled ? "neutral" : triggered ? "warning" : "accent"}>
              {t(!rule.enabled ? "fidelity.goals.off" : triggered ? "fidelity.goals.triggered" : "fidelity.goals.watching")}</span>
            <div className="pf-goal-actions"><button aria-label={t("fidelity.goals.editNamed").replace("{rule}", titleFor(rule))} onClick={() => openEdit(rule)}><PlanIcon name="edit" /></button>
              <button aria-label={t("fidelity.goals.deleteNamed").replace("{rule}", titleFor(rule))} onClick={() => setDeleteRule(rule)}><PlanIcon name="trash" /></button></div>
          </div>;
        }) : <EmptyState icon={TargetIcon} title={t("goals.empty.title")} hint={t("goals.empty.hint")} className="pf-empty">
          <button className="pf-add" onClick={openAdd}><PlanIcon name="plus" />{t("goals.newRule")}</button>
          <div className="t3-empty-state-chips">{alertTemplates.map((template) => <button key={template}
            onClick={() => { setInvalid(false); onOpenEditor(undefined, alertTemplateDraft(template, snapshots[0])); }}>{t(`goals.template.${template}`)}</button>)}</div>
        </EmptyState>}
        <AttributionPager count={rules.length} {...rulePaging} t={t} ariaLabel={t("goals.rules")} />
      </section>
      <section className={`pf-card pf-history${history.length > 5 ? " pf-scroll-list" : ""}`}><div className="pf-card-head"><h2>{t("fidelity.goals.triggered")}</h2>
        {!!unreadCount && <span className="pf-badge">{unreadCount}</span>}
        <div className="pf-history-actions"><button onClick={onAckAll} disabled={!unreadCount}>{t("goals.ackAll")}</button>
          <button onClick={() => setClearOpen(true)} disabled={!history.length}>{t("fidelity.goals.clear")}</button></div></div>
        {history.length ? <>
          <div className="pf-history-list">{historyPaging.rows.map((alert) => {
            const text = alertText(alert, t, locale, rules.find((rule) => rule.id === alert.ruleId),
              { snapshots, prices, targets });
            return <div className={`pf-alert-row ${alert.acknowledgedAt ? "" : "pf-unread"}`} key={alert.id}>
              <i className="pf-alert-dot" /><div><b>{text.title}</b><small>{text.message}</small>
                <small>{when(alert.triggeredAt)}{alert.ruleId === null ? t("fidelity.goals.ruleDeleted") : ""}</small></div>
              <div className="pf-alert-action">{alert.acknowledgedAt ? <span><PlanIcon name="check" />{t("fidelity.goals.read")}</span>
                : <button onClick={() => onAck(alert)}>{t("goals.ack")}</button>}</div>
            </div>;
          })}</div><AttributionPager count={history.length} {...historyPaging} t={t} ariaLabel={t("goals.history")} />
          <div className="pf-foot"><PlanIcon name="info" />{t("fidelity.goals.ackNote")}</div>
        </> : <EmptyState icon={BellIcon} title={t("goals.noHistory")} hint={t("goals.history.empty.hint")} className="pf-empty" />}
      </section>
    </>}
    {edit}{deleteOverlay}{clearOverlay}{chart.tooltip}
  </div>;
}

function alertText(alert: AlertHistory, t: (key: string) => string, locale: string, rule?: AlertRule,
  context?: { snapshots: AlertSnapshot[]; prices: AlertPrices; targets?: RebalanceProfile }) {
  const kind = t(`goals.kind.${alert.kind}`);
  let title = t(alert.symbol ? "fidelity.goals.historyTitleAsset" : "fidelity.goals.historyTitle")
    .replace("{kind}", kind).replace("{symbol}", alert.symbol ?? "");
  const match = /\((at least|at most) (-?\d+(?:\.\d+)?)\)$/.exec(alert.message);
  // Old deleted rules have no structured threshold; linked rules do.
  const threshold = match ? Number(match[2]) : rule?.kind === alert.kind ? rule.threshold : undefined;
  const comparator = match?.[1] === "at most" ? "lte" : match?.[1] === "at least" ? "gte" : rule?.comparator;
  if (threshold !== undefined && Number.isFinite(threshold)) {
    if (alert.kind === "total_value_target") {
      title = t("fidelity.goals.history.portfolioReached").replace("{threshold}", usd(threshold, 0));
    } else if (alert.kind === "asset_value_target" || alert.kind === "asset_price_target") {
      const key = alert.kind === "asset_value_target" ? "assetValue" : "assetPrice";
      title = t(`fidelity.goals.history.${key}.${comparator === "gte" ? "above" : "below"}`)
        .replace("{symbol}", alert.symbol ?? "")
        .replace("{threshold}", usd(threshold, 0));
    } else if (alert.kind === "asset_price_move" && rule?.window && Math.abs(rule.threshold - threshold) < 1e-6) {
      title = t(comparator === "gte" ? "fidelity.goals.history.moveAbove" : "fidelity.goals.history.moveBelow")
        .replace("{symbol}", alert.symbol ?? "")
        .replace("{window}", t(`fidelity.goals.shortWindow.${rule.window}`))
        .replace("{threshold}", new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(threshold));
    }
  }
  if (alert.kind === "allocation_deviation")
    title = t("fidelity.goals.history.allocation").replace("{symbol}",
      alert.symbol === "*" ? t("fidelity.goals.anyAsset") : alert.symbol ?? "");
  const amount = alert.kind === "asset_price_move" || alert.kind === "portfolio_value_change"
    ? `${digits(2).format(alert.value)}%`
    : alert.kind === "allocation_deviation" ? `${digits(2).format(alert.value)}${t("fidelity.goals.history.pointsUnit")}`
      : alert.kind === "period_pnl" ? signedUsd(alert.value) : usd(alert.value);
  const date = new Date(alert.triggeredAt);
  const refreshDate = locale === "zh"
    ? date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
    : `${date.getDate()} ${date.toLocaleDateString("en-US", { month: "short" })}`;
  let message = threshold !== undefined && (alert.kind === "total_value_target" || alert.kind === "asset_price_target")
    ? t("fidelity.goals.history.refreshValue").replace("{value}", amount).replace("{date}", refreshDate)
    : t("fidelity.goals.historyMessage").replace("{title}", title).replace("{value}", amount);
  const latest = context?.snapshots[0];
  const recent = latest && Math.abs(Date.parse(alert.triggeredAt) - Date.parse(latest.at)) <= 60_000;
  if (recent && rule && threshold !== undefined && Math.abs(rule.threshold - threshold) < 1e-6) {
    const asset = latest.assets.find((item) => item.assetType === rule.assetType && item.symbol === rule.symbol);
    if (alert.kind === "asset_price_move" && rule.window && asset) {
      const before = context?.prices[rule.window]?.[`${rule.assetType}:${rule.symbol}`];
      if (before && digits(1).format((asset.price / before - 1) * 100) === digits(1).format(alert.value)) {
        const window = t(rule.window === "7d" ? "fidelity.goals.sevenDays" :
          rule.window === "30d" ? "fidelity.goals.thirtyDays" : "fidelity.goals.day");
        message = t("fidelity.goals.history.moveDetail").replace("{move}", signed(alert.value, "%"))
          .replace("{window}", window).replace("{from}", usd(before)).replace("{to}", usd(asset.price));
      }
    } else if (alert.kind === "allocation_deviation" && asset) {
      const portfolioValue = latest.assets.reduce((sum, item) => sum + item.value, 0);
      const target = context?.targets?.targets.find((item) =>
        item.kind === "asset" && item.assetType === rule.assetType && item.symbol === rule.symbol);
      if (portfolioValue > 0 && target) {
        const current = asset.value / portfolioValue * 100;
        const drift = current - target.percent;
        if (digits(1).format(Math.abs(drift)) === digits(1).format(alert.value)) {
          message = t("fidelity.goals.history.allocationDetail").replace("{symbol}", alert.symbol ?? "")
            .replace("{current}", pct(current)).replace("{target}", pct(target.percent))
            .replace("{drift}", signed(drift, t("fidelity.goals.history.pointsUnit")))
            .replace("{limit}", digits(1).format(threshold));
        }
      }
    }
  }
  return { title, message };
}

function kpi(label: string, value: string, note: string, tone = "") {
  return <div className="pf-kpi"><span>{label}</span><strong className={tone}>{value}</strong><small>{note}</small></div>;
}

function highlightPreview(text: string, emphasis: string[], current: string): ReactNode[] {
  const tokens = [...emphasis.filter(Boolean).map((value) => ({ value, current: false })), { value: current, current: true }];
  const parts: ReactNode[] = [];
  let remaining = text;
  while (remaining) {
    const next = tokens.map((token) => ({ ...token, at: remaining.indexOf(token.value) }))
      .filter((token) => token.at >= 0).sort((a, b) => a.at - b.at || b.value.length - a.value.length)[0];
    if (!next) { parts.push(remaining); break; }
    if (next.at > 0) parts.push(remaining.slice(0, next.at));
    parts.push(next.current ? <span className="pf-preview-current" key={parts.length}>{next.value}</span>
      : <b key={parts.length}>{next.value}</b>);
    remaining = remaining.slice(next.at + next.value.length);
  }
  return parts;
}
