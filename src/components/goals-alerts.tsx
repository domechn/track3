import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n";
import {
  ALERTS_CHANGED_EVENT, acknowledgeAlert, acknowledgeAllAlerts, clearAlertHistory,
  deleteAlertRule, listAlertHistory, listAlertRules, loadAlertEvaluationData,
  measureRule, saveAlertRule, setAlertRuleEnabled, validateAlertRule,
  type AlertComparator, type AlertHistory, type AlertKind, type AlertPrices,
  type AlertRule, type AlertSnapshot, type AlertWindow,
} from "@/middlelayers/alerts";
import { enableSystemNotifications, systemNotificationsEnabled } from "@/middlelayers/alert-notifications";
import { formatAlert } from "@/middlelayers/alert-notifications";
import type { RebalanceProfile } from "@/middlelayers/rebalance";
import type { AssetType } from "@/middlelayers/datafetch/types";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { Button } from "./ui/button";
import ConfirmDeleteDialog from "./common/confirm-delete-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";

type Draft = {
  id: number; kind: AlertKind; assetType: AssetType; symbol: string;
  comparator: AlertComparator; threshold: string; window: AlertWindow;
  cooldownMinutes: string;
};
const emptyDraft: Draft = {
  id: 0, kind: "total_value_target", assetType: "crypto", symbol: "",
  comparator: "gte", threshold: "", window: "24h", cooldownMinutes: "60",
};
const needsAsset = (kind: AlertKind) => ["asset_value_target", "asset_price_move", "allocation_deviation"].includes(kind);
const needsWindow = (kind: AlertKind) => kind === "asset_price_move" || kind === "period_pnl";
const templates: AlertKind[] = ["total_value_target", "asset_value_target", "asset_price_move", "allocation_deviation", "period_pnl"];

export default function GoalsAlerts() {
  const { t } = useTranslation();
  const dataChangedVersion = useDataChangedVersion();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [snapshots, setSnapshots] = useState<AlertSnapshot[]>([]);
  const [prices, setPrices] = useState<AlertPrices>({});
  const [targets, setTargets] = useState<RebalanceProfile>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  async function reload() {
    try {
      const [nextRules, nextHistory] = await Promise.all([listAlertRules(), listAlertHistory()]);
      const pnlWindows = nextRules.filter((rule) => rule.enabled && rule.kind === "period_pnl" && rule.window)
        .map((rule) => rule.window as AlertWindow);
      const evaluation = await loadAlertEvaluationData(undefined, undefined, new Date(), pnlWindows);
      setRules(nextRules);
      setHistory(nextHistory);
      setSnapshots(evaluation.snapshots);
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
    const rule: AlertRule = {
      id: draft.id, kind: draft.kind,
      assetType: needsAsset(draft.kind) ? draft.assetType : null,
      symbol: needsAsset(draft.kind) ? draft.symbol.trim() : null,
      comparator: draft.comparator,
      threshold: draft.threshold.trim() ? Number(draft.threshold) : Number.NaN,
      window: needsWindow(draft.kind) ? draft.window : null,
      enabled: true,
      cooldownSeconds: draft.cooldownMinutes.trim() ? Number(draft.cooldownMinutes) * 60 : Number.NaN,
      lastTriggeredAt: null, lastValue: null, armed: true,
    };
    validateAlertRule(rule);
    return rule;
  }

  async function save() {
    try {
      await saveAlertRule(toRule());
      setDraft(emptyDraft);
      setStatus(t("goals.saved"));
      await reload();
    } catch (cause) {
      setStatus(cause instanceof Error && cause.message.startsWith("Invalid")
        ? t("goals.validation") : t("goals.saveError"));
    }
  }

  function edit(rule: AlertRule) {
    setDraft({
      id: rule.id, kind: rule.kind, assetType: rule.assetType ?? "crypto",
      symbol: rule.symbol ?? "", comparator: rule.comparator,
      threshold: String(rule.threshold), window: rule.window ?? "24h",
      cooldownMinutes: String(rule.cooldownSeconds / 60),
    });
    setStatus("");
    document.getElementById("goal-rule-editor")?.scrollIntoView?.({ behavior: "smooth" });
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

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("goals.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("goals.subtitle")}</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Card>
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
      <Card id="goal-rule-editor">
        <CardHeader className="pb-3"><CardTitle className="text-base">{t(draft.id ? "goals.editRule" : "goals.newRule")}</CardTitle></CardHeader>
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
                <Input value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} />
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
                onChange={(e) => setDraft({ ...draft, threshold: e.target.value })} />
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
                onChange={(e) => setDraft({ ...draft, cooldownMinutes: e.target.value })} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">{t("goals.units")}</p>
          <div className="flex gap-2">
            <Button onClick={() => void save()}>{t("goals.saveRule")}</Button>
            {draft.id > 0 && <Button variant="outline" onClick={() => setDraft(emptyDraft)}>{t("common.cancel")}</Button>}
          </div>
          {status && <p role="status" className="text-sm">{status}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">{t("goals.rules")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading ? <p className="text-sm text-muted-foreground">{t("goals.loading")}</p>
            : rules.length === 0 ? <p className="text-sm text-muted-foreground">{t("goals.empty")}</p>
              : rules.map((rule) => {
                const measurement = measureRule(rule, snapshots, prices, targets);
                const isGoal = rule.kind === "total_value_target" || rule.kind === "asset_value_target";
                const progress = isGoal && measurement.value !== undefined
                  ? Math.max(0, Math.min(100, rule.comparator === "gte"
                    ? rule.threshold > 0 ? measurement.value / rule.threshold * 100 : 100
                    : measurement.value <= rule.threshold ? 100 : rule.threshold / measurement.value * 100)) : 0;
                return <div key={rule.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{t(`goals.kind.${rule.kind}`)} {rule.symbol ?? ""}</div>
                      <div className="text-xs text-muted-foreground">
                        {t(rule.comparator === "gte" ? "goals.atLeast" : "goals.atMost")} {rule.threshold}
                        {rule.window ? ` · ${rule.window}` : ""}
                        {measurement.status === "data-stale" ? ` · ${t("goals.dataStale")}` :
                          measurement.status === "unavailable" ? ` · ${t("goals.unavailable")}` :
                            ` · ${t("goals.current")}: ${measurement.value?.toFixed(2)}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={rule.enabled} aria-label={t("goals.enableRule").replace("{kind}", t(`goals.kind.${rule.kind}`))}
                          onChange={(e) => void mutate(() => setAlertRuleEnabled(rule.id, e.target.checked))} />
                        {t("goals.enabled")}
                      </label>
                      <Button size="sm" variant="outline" onClick={() => edit(rule)}>{t("goals.edit")}</Button>
                      <ConfirmDeleteDialog
                        trigger={<Button size="sm" variant="ghost">{t("common.delete")}</Button>}
                        title={t("common.delete")}
                        description={t("goals.deleteConfirm")}
                        cancelLabel={t("common.cancel")}
                        actions={[{ label: t("common.delete"), onClick: () => void mutate(() => deleteAlertRule(rule.id)) }]}
                      />
                    </div>
                  </div>
                  {isGoal && measurement.status === "ready" && <Progress value={progress}
                    aria-label={t("goals.progress").replace("{kind}", t(`goals.kind.${rule.kind}`))} />}
                </div>;
              })}
        </CardContent>
      </Card>
      <Card>
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
            {history.map((alert) => <li key={alert.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{formatAlert(alert, t).title}</p>
                <p className="break-words text-xs text-muted-foreground">{formatAlert(alert, t).message}</p>
                <time className="text-xs text-muted-foreground" dateTime={alert.triggeredAt}>{new Date(alert.triggeredAt).toLocaleString()}</time>
              </div>
              {!alert.acknowledgedAt && <Button size="sm" variant="outline" onClick={() => void mutate(() => acknowledgeAlert(alert.id))}>{t("goals.ack")}</Button>}
            </li>)}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
