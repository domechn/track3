import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/i18n";
import {
  ALERTS_CHANGED_EVENT, acknowledgeAlert, acknowledgeAllAlerts, clearAlertHistory,
  countUnreadAlerts, deleteAlertRule, listAlertHistory, listAlertRules, loadAlertEvaluationData,
  measureRule, saveAlertRule, setAlertRuleEnabled,
  type AlertComparator, type AlertHistory, type AlertKind, type AlertPrices,
  type AlertRule, type AlertSnapshot, type AlertWindow,
} from "@/middlelayers/alerts";
import { enableSystemNotifications, systemNotificationsEnabled } from "@/middlelayers/alert-notifications";
import { formatAlert } from "@/middlelayers/alert-notifications";
import type { RebalanceProfile } from "@/middlelayers/rebalance";
import type { AssetType } from "@/middlelayers/datafetch/types";
import { alertRuleFromDraft, alertDraftFromRule, needsAsset, needsWindow, type AlertDraft } from "@/middlelayers/ui-state/alert-draft";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { Button } from "./ui/button";
import AISetupCard from "./common/ai-setup-card";
import { FinanceChartSkeleton, GoalChart } from "./finance-charts";
import { alertSentence, goalEtaDays } from "./finance-visuals";
import { queryPNLChartValue } from "@/middlelayers/charts-timeseries";
import { BarChartIcon, ClockIcon, DashboardIcon, MagicWandIcon, MixIcon, PieChartIcon } from "@radix-ui/react-icons";
import ConfirmDeleteDialog from "./common/confirm-delete-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

const emptyDraft: AlertDraft = {
  id: 0, kind: "total_value_target", assetType: "crypto", symbol: "",
  comparator: "gte", threshold: "", window: "24h", cooldownMinutes: "60",
};
const templates: AlertKind[] = ["total_value_target", "asset_value_target", "asset_price_target", "asset_price_move", "allocation_deviation", "period_pnl", "portfolio_value_change"];
const ruleIcons = {
  total_value_target: DashboardIcon,
  asset_value_target: PieChartIcon,
  asset_price_target: MagicWandIcon,
  asset_price_move: BarChartIcon,
  allocation_deviation: MixIcon,
  period_pnl: ClockIcon,
  portfolio_value_change: ClockIcon,
};
const historySeverity = (kind: AlertKind) =>
  kind === "period_pnl" || kind === "portfolio_value_change" ? "high" : kind === "allocation_deviation" || kind === "asset_price_move" ? "medium" : "low";

export default function GoalsAlerts() {
  const { t, locale } = useTranslation();
  const dataChangedVersion = useDataChangedVersion();
  const [draft, setDraft] = useState<AlertDraft>(emptyDraft);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [snapshots, setSnapshots] = useState<AlertSnapshot[]>([]);
  const [portfolioValues, setPortfolioValues] = useState<Array<{ date: string; value: number }>>([]);
  const [prices, setPrices] = useState<AlertPrices>({});
  const [targets, setTargets] = useState<RebalanceProfile>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [validationField, setValidationField] = useState<"threshold" | "cooldown" | "symbol" | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [manualOpen, setManualOpen] = useState(true);
  const manualInitialized = useRef(false);
  const newRuleButton = useRef<HTMLButtonElement>(null);
  const editorTrigger = useRef<HTMLButtonElement | null>(null);

  async function reload() {
    try {
      const [nextRules, nextHistory, nextUnreadCount] = await Promise.all([listAlertRules(), listAlertHistory(), countUnreadAlerts()]);
      const pnlWindows = nextRules.filter((rule) => rule.enabled && rule.kind === "period_pnl" && rule.window)
        .map((rule) => rule.window as AlertWindow);
      const evaluation = await loadAlertEvaluationData(undefined, undefined, new Date(), pnlWindows);
      const series = await queryPNLChartValue(
        { start: new Date(0), end: new Date() }, 80, evaluation.excludedSymbols,
      ).catch(() => []);
      setRules(nextRules);
      if (!manualInitialized.current) {
        setManualOpen(nextRules.length === 0);
        manualInitialized.current = true;
      }
      setHistory(nextHistory);
      setUnreadCount(nextUnreadCount);
      setSnapshots(evaluation.snapshots);
      setPortfolioValues(series.map((point) => ({ date: new Date(point.timestamp).toISOString().slice(0, 10), value: point.totalValue })));
      setPrices(evaluation.prices);
      setTargets(evaluation.targets);
      setError("");
    } catch {
      setError(t("goals.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    const onChanged = () => { void reload(); };
    window.addEventListener(ALERTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(ALERTS_CHANGED_EVENT, onChanged);
  }, [dataChangedVersion]);

  useEffect(() => {
    void systemNotificationsEnabled().then(setNotificationsEnabled);
  }, []);

  function toRule(): AlertRule {
    return alertRuleFromDraft(draft);
  }

  async function save() {
    try {
      await saveAlertRule(toRule());
      setDraft(emptyDraft);
      setValidationField(null);
      setStatus(t("goals.saved"));
      setManualOpen(false);
      if (rules.length === 0) newRuleButton.current?.focus();
      await reload();
    } catch (cause) {
      setValidationField(cause instanceof Error
        ? cause.message === "Invalid threshold" ? "threshold"
          : cause.message === "Invalid cooldown" ? "cooldown"
            : cause.message === "Invalid asset" ? "symbol" : null : null);
      setStatus(cause instanceof Error && cause.message.startsWith("Invalid")
        ? t("goals.validation") : t("goals.saveError"));
    }
  }

  function openEditor(nextDraft: AlertDraft, trigger: HTMLButtonElement) {
    editorTrigger.current = trigger;
    setDraft(nextDraft);
    setStatus("");
    setManualOpen(true);
    if (rules.length === 0) requestAnimationFrame(() => document.getElementById("goal-rule-editor")?.scrollIntoView?.({ behavior: "smooth" }));
  }

  function edit(rule: AlertRule, trigger: HTMLButtonElement) {
    openEditor(alertDraftFromRule(rule), trigger);
  }

  async function mutate(action: () => Promise<unknown>) {
    try {
      await action();
      await reload();
      setStatus("");
    } catch {
      setStatus(t("goals.saveError"));
    }
  }

  const editor = (
    <Card id="goal-rule-editor" className="border-0 shadow-none">
      <CardHeader className="pb-3">
        {rules.length > 0
          ? <DialogTitle asChild><CardTitle className="text-base">{t(draft.id ? "goals.editRule" : "goals.newRule")}</CardTitle></DialogTitle>
          : <CardTitle className="text-base">{t(draft.id ? "goals.editRule" : "goals.newRule")}</CardTitle>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2" aria-label={t("goals.templates")}>
          {templates.map((kind) => (
            <Button key={kind} size="sm" variant={draft.kind === kind ? "default" : "outline"}
              onClick={() => setDraft({ ...emptyDraft, kind })}>{t(`goals.kind.${kind}`)}</Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span>{t("goals.kind")}</span>
            <select className="h-10 w-full rounded-md border bg-background px-3" value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as AlertKind })}>
              {templates.map((kind) => <option key={kind} value={kind}>{t(`goals.kind.${kind}`)}</option>)}
            </select>
          </label>
          {needsAsset(draft.kind) && <>
            <label className="space-y-1 text-sm">
              <span>{t("goals.assetType")}</span>
              <select className="h-10 w-full rounded-md border bg-background px-3" value={draft.assetType}
                onChange={(e) => setDraft({ ...draft, assetType: e.target.value as AssetType })}>
                <option value="crypto">{t("rebalance.crypto")}</option><option value="stock">{t("rebalance.stock")}</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("goals.symbol")}</span>
              <Input value={draft.symbol} aria-invalid={validationField === "symbol"}
                aria-describedby={validationField === "symbol" ? "goal-rule-status" : undefined}
                onChange={(e) => { setValidationField(null); setDraft({ ...draft, symbol: e.target.value }); }} />
            </label>
          </>}
          <label className="space-y-1 text-sm">
            <span>{t("goals.comparator")}</span>
            <select className="h-10 w-full rounded-md border bg-background px-3" value={draft.comparator}
              onChange={(e) => setDraft({ ...draft, comparator: e.target.value as AlertComparator })}>
              <option value="gte">{t("goals.atLeast")}</option><option value="lte">{t("goals.atMost")}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>{t("goals.threshold")}</span>
            <Input type="number" min={needsWindow(draft.kind) ? undefined : "0"} step="any" value={draft.threshold}
              aria-invalid={validationField === "threshold"}
              aria-describedby={validationField === "threshold" ? "goal-rule-status" : undefined}
              onChange={(e) => { setValidationField(null); setDraft({ ...draft, threshold: e.target.value }); }} />
          </label>
          {needsWindow(draft.kind) && <label className="space-y-1 text-sm">
            <span>{t("goals.window")}</span>
            <select className="h-10 w-full rounded-md border bg-background px-3" value={draft.window}
              onChange={(e) => setDraft({ ...draft, window: e.target.value as AlertWindow })}>
              <option value="24h">24h</option><option value="7d">7d</option><option value="30d">30d</option>
            </select>
          </label>}
          <label className="space-y-1 text-sm">
            <span>{t("goals.cooldown")}</span>
            <Input type="number" min="0" step="1" value={draft.cooldownMinutes}
              aria-invalid={validationField === "cooldown"}
              aria-describedby={validationField === "cooldown" ? "goal-rule-status" : undefined}
              onChange={(e) => { setValidationField(null); setDraft({ ...draft, cooldownMinutes: e.target.value }); }} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{t("goals.units")}</p>
        <div className="flex gap-2">
          <Button onClick={() => void save()}>{t("goals.saveRule")}</Button>
          <Button variant="outline" onClick={() => { setDraft(emptyDraft); setManualOpen(false); }}>{t("common.cancel")}</Button>
        </div>
        {validationField && status && <p id="goal-rule-status" role="alert" className="text-sm text-destructive">{status}</p>}
        {!validationField && status && <p role="status" className="text-sm">{status}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="t3-manage-goals mx-auto gap-4 pb-8">
      <div className="t3-goals-heading">
        <div>
        <h1 className="text-2xl font-semibold">{t("goals.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("goals.subtitle")}</p>
        </div>
        <Button ref={newRuleButton} type="button" onClick={(event) => openEditor(emptyDraft, event.currentTarget)}>{t("goals.newRule")}</Button>
      </div>
      <div className="t3-goals-summary" data-testid="goals-summary">
        <div><span>{t("goals.summary.active")}</span><strong>{rules.filter((rule) => rule.enabled).length} / {rules.length}</strong></div>
        <div><span>{t("goals.summary.unread")}</span><strong>{unreadCount}</strong></div>
        <div><span>{t("goals.summary.recentTriggered")}</span><strong>{history.length}</strong></div>
        <div><span>{t("goals.summary.lastCheck")}</span><strong>{snapshots[0] ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(snapshots[0].at)) : "—"}</strong></div>
      </div>
      <AISetupCard page="goals"
        summary={rules.length ? rules.map((rule) => `${rule.id}: ${rule.kind} ${rule.symbol ?? ""} ${rule.comparator} ${rule.threshold} ${rule.window ?? ""} ${rule.enabled ? "enabled" : "disabled"}`).join("; ") : "No alert rules"}
        suggestions={["goals.ai.drop", "goals.ai.btc", "goals.ai.deviation"].map((key) => t(key))} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!manualOpen && status && <p role="status" className="text-sm">{status}</p>}
      <Card className="t3-goals-notifications">
        <CardHeader className="pb-3"><CardTitle className="text-base">{t("goals.notifications")}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-muted-foreground">{t("goals.notificationExplanation")}</p>
          <Button variant="outline" onClick={async () => {
            const allowed = await enableSystemNotifications();
            setNotificationsEnabled(allowed);
            setStatus(t(allowed ? "goals.notificationEnabled" : "goals.notificationFallback"));
          }}>{notificationsEnabled ? t("goals.notificationEnabled") : t("goals.enableNotifications")}</Button>
        </CardContent>
      </Card>
      {rules.length === 0
        ? <details open={manualOpen} onToggle={(event) => setManualOpen(event.currentTarget.open)}
          className="t3-goals-editor rounded-lg border bg-card">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium">{t("aiSetup.manual")}</summary>
          {editor}
        </details>
        : <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogContent className="t3-goals-drawer" onCloseAutoFocus={(event) => {
            event.preventDefault();
            (editorTrigger.current ?? newRuleButton.current)?.focus();
          }}>
            <DialogDescription className="sr-only">{t("goals.units")}</DialogDescription>
            {editor}
          </DialogContent>
        </Dialog>}
      {loading ? <FinanceChartSkeleton /> : <GoalChart rules={rules} snapshots={snapshots} portfolioValues={portfolioValues} />}
      <Card className="t3-goals-rules">
        <CardHeader className="pb-3"><CardTitle className="text-base">{t("goals.rules")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading ? <p className="text-sm text-muted-foreground">{t("goals.loading")}</p>
            : rules.length === 0 ? <p className="text-sm text-muted-foreground">{t("goals.empty")}</p>
              : rules.map((rule) => {
                const RuleIcon = ruleIcons[rule.kind];
                const measurement = measureRule(rule, snapshots, prices, targets);
                const isGoal = rule.kind === "total_value_target" || rule.kind === "asset_value_target";
                const progress = isGoal && measurement.value !== undefined
                  ? Math.max(0, Math.min(100, rule.comparator === "gte"
                    ? rule.threshold > 0 ? measurement.value / rule.threshold * 100 : 100
                    : measurement.value <= rule.threshold ? 100 : rule.threshold / measurement.value * 100)) : 0;
                const eta = rule.kind === "total_value_target" && rule.comparator === "gte"
                  ? goalEtaDays(portfolioValues, rule.threshold) : null;
                return <div key={rule.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <RuleIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                      <div className="font-medium text-sm">{alertSentence(rule, t)}</div>
                      <div className="text-xs text-muted-foreground">
                        {measurement.status === "data-stale" ? t("goals.dataStale") :
                          measurement.status === "unavailable" ? t("goals.unavailable") :
                            `${t("goals.current")}: ${measurement.value?.toFixed(2)}`}
                      </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${rule.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {t(rule.enabled ? "goals.enabled" : "finance.paused")}
                      </span>
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={rule.enabled} aria-label={t("goals.enableRule").replace("{kind}", t(`goals.kind.${rule.kind}`))}
                          onChange={(e) => void mutate(() => setAlertRuleEnabled(rule.id, e.target.checked))} />
                        {t("goals.enabled")}
                      </label>
                      <Button size="sm" variant="outline" onClick={(event) => edit(rule, event.currentTarget)}>{t("goals.edit")}</Button>
                      <ConfirmDeleteDialog
                        trigger={<Button size="sm" variant="ghost">{t("common.delete")}</Button>}
                        title={t("common.delete")}
                        description={t("goals.deleteConfirm")}
                        cancelLabel={t("common.cancel")}
                        actions={[{ label: t("common.delete"), onClick: () => void mutate(() => deleteAlertRule(rule.id)) }]}
                      />
                    </div>
                  </div>
                  {isGoal && measurement.status === "ready" && <div className="flex items-center gap-3">
                    <div role="img" aria-label={t("goals.progress").replace("{kind}", t(`goals.kind.${rule.kind}`)) + `: ${progress.toFixed(0)}%`}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-muted">
                      <span className="text-xs font-semibold">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Progress value={progress} aria-label={t("goals.progress").replace("{kind}", t(`goals.kind.${rule.kind}`))} />
                      <p className="pt-1 text-xs text-muted-foreground">{measurement.value?.toLocaleString()} / {rule.threshold.toLocaleString()} USD · {eta === null
                        ? t("finance.etaUnavailable")
                        : eta === 0 ? t("finance.goalReached")
                          : t("finance.etaDays").replace("{days}", String(eta))}</p>
                    </div>
                  </div>}
                </div>;
              })}
        </CardContent>
      </Card>
      <Card className="t3-goals-history">
        <CardHeader className="pb-3"><CardTitle className="text-base">{t("goals.history")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!history.some((alert) => !alert.acknowledgedAt)}
              onClick={() => void mutate(acknowledgeAllAlerts)}>{t("goals.ackAll")}</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button size="sm" variant="outline" disabled={!history.length}>{t("goals.clearHistory")}</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("goals.clearHistory")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("goals.clearConfirm")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void mutate(clearAlertHistory)}>{t("goals.clearHistory")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {!loading && !history.length && <p className="text-sm text-muted-foreground">{t("goals.noHistory")}</p>}
          <ol className="space-y-2">
            {history.map((alert) => {
              const severity = historySeverity(alert.kind);
              const HistoryIcon = ruleIcons[alert.kind];
              return <li key={alert.id} data-severity={severity} className={`flex flex-wrap items-center justify-between gap-2 rounded-md border border-l-4 p-3 ${
                severity === "high" ? "border-l-rose-500" : severity === "medium" ? "border-l-amber-500" : "border-l-primary/50"
              }`}>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium"><HistoryIcon aria-hidden className={`h-3.5 w-3.5 ${
                  severity === "high" ? "text-rose-500" : severity === "medium" ? "text-amber-500" : "text-primary"
                }`} />{formatAlert(alert, t).title}</p>
                <p className="break-words text-xs text-muted-foreground">{formatAlert(alert, t).message}</p>
                <time className="text-xs text-muted-foreground" dateTime={alert.triggeredAt}>{new Date(alert.triggeredAt).toLocaleString()}</time>
              </div>
              {!alert.acknowledgedAt && <Button size="sm" variant="outline" onClick={() => void mutate(() => acknowledgeAlert(alert.id))}>{t("goals.ack")}</Button>}
            </li>;
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
