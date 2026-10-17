import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import type { PendingAction } from "@/middlelayers/ai/actions/lifecycle";
import { Link } from "react-router-dom";

const fieldKeys: Record<string, string> = {
  method: "assistant.action.field.method",
  holdingPeriodDays: "cost.holdingDays",
  from: "cost.from",
  to: "cost.to",
  targets: "rebalance.targets",
  tolerancePercent: "rebalance.tolerance",
  mode: "rebalance.mode",
  injectedCash: "assistant.action.field.injectedCash",
  minimumTradeValue: "assistant.action.field.minimumTrade",
  ignoreBelowValue: "assistant.action.field.ignoreBelow",
  threshold: "goals.threshold",
  comparator: "goals.comparator",
  cooldownSeconds: "assistant.action.field.cooldownSeconds",
  enabled: "goals.enabled",
  symbol: "goals.symbol",
  assetType: "goals.assetType",
  window: "goals.window",
  kind: "goals.kind",
  id: "assistant.action.field.id",
  report: "assistant.action.field.report",
  format: "assistant.action.field.format",
  preset: "assistant.action.field.preset",
  acknowledgedAt: "assistant.action.field.acknowledged",
};
function parsedRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

const actionPage: Record<string, { route: string; key: string }> = {
  set_cost_basis_settings: { route: "/cost-basis", key: "aiSetup.page.cost-basis" },
  save_rebalance_targets: { route: "/rebalance", key: "aiSetup.page.rebalance" },
  delete_rebalance_targets: { route: "/rebalance", key: "aiSetup.page.rebalance" },
  set_rebalance_options: { route: "/rebalance", key: "aiSetup.page.rebalance" },
  apply_rebalance_preset: { route: "/rebalance", key: "aiSetup.page.rebalance" },
  export_rebalance: { route: "/rebalance", key: "aiSetup.page.rebalance" },
  create_alert: { route: "/goals", key: "aiSetup.page.goals" },
  edit_alert: { route: "/goals", key: "aiSetup.page.goals" },
  set_alert_enabled: { route: "/goals", key: "aiSetup.page.goals" },
  delete_alert: { route: "/goals", key: "aiSetup.page.goals" },
  acknowledge_alert: { route: "/goals", key: "aiSetup.page.goals" },
  acknowledge_all_alerts: { route: "/goals", key: "aiSetup.page.goals" },
  clear_alert_history: { route: "/goals", key: "aiSetup.page.goals" },
};

export default function ActionCard({
  action, onDecide, canDecide = true,
}: {
  action: PendingAction;
  onDecide?: (id: string, decision: "approve" | "reject") => void;
  canDecide?: boolean;
}) {
  const { t } = useTranslation();
  const [expired, setExpired] = useState(() => Date.now() >= Date.parse(action.expiresAt));
  useEffect(() => {
    const remaining = Date.parse(action.expiresAt) - Date.now();
    setExpired(remaining <= 0);
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setExpired(true), remaining);
    return () => window.clearTimeout(timer);
  }, [action.expiresAt]);
  const pending = action.status === "pending" && !expired;
  const status = action.status === "pending" && expired ? "expired" : action.status;
  const preview = (value: string) => value.startsWith("assistant.action.preview.acknowledgedAll:")
    ? t("assistant.action.preview.acknowledgedAll").replace("{count}", value.split(":")[1])
    : value.startsWith("assistant.action.") ? t(value, value) : value;
  const readable = (value: string) => {
    try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return preview(value); }
  };
  const before = parsedRecord(action.preview.before);
  const after = parsedRecord(action.preview.after);
  const changes = after && (before || action.preview.before === "null")
    ? Object.entries(after).filter(([key, value]) => JSON.stringify(before?.[key]) !== JSON.stringify(value))
    : [];
  const formatValue = (value: unknown): string => {
    if (value === undefined || value === null) return "—";
    if (Array.isArray(value)) return value.map((item) => {
      if (!item || typeof item !== "object") return String(item);
      const target = item as Record<string, unknown>;
      const label = target.kind === "cash" ? t("assistant.action.field.cash")
        : target.kind === "asset" ? String(target.symbol)
          : t(`rebalance.${String(target.assetType)}`);
      return `${label} ${String(target.percent)}%`;
    }).join(", ");
    if (typeof value === "boolean") return t(value ? "goals.enabled" : "finance.paused");
    if (typeof value === "object") return JSON.stringify(value);
    if (value === "now") return t("assistant.action.field.now");
    return String(value);
  };
  const shownValue = (field: string, value: unknown, kind: unknown) => {
    if (field !== "threshold" || typeof value !== "number") return formatValue(value);
    if (kind === "portfolio_value_change" || kind === "asset_price_move" || kind === "allocation_deviation") return `${formatValue(value)}%`;
    if (kind === "period_pnl") return `${value < 0 ? "-" : ""}$${formatValue(Math.abs(value))}`;
    return formatValue(value);
  };
  const page = actionPage[action.name] ?? (action.name === "export_report" && action.args.report === "realized_gains"
    ? { route: "/cost-basis", key: "aiSetup.page.cost-basis" } : undefined);

  return (
    <section aria-label={t("assistant.action.confirmation")} className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
      <h3 className="font-semibold">{t(`assistant.action.name.${action.name}`)}</h3>
      <p className="text-xs text-muted-foreground">{t("assistant.action.risk")}: {t(`assistant.action.risk.${action.risk}`)}</p>
      <dl className="mt-2 grid gap-1 text-xs">
        {changes.length ? changes.map(([field, value]) => <div key={field} className="grid grid-cols-[minmax(90px,auto)_1fr] gap-2 rounded bg-background/70 px-2 py-1">
          <dt className="font-medium">{fieldKeys[field] ? t(fieldKeys[field]) : field}</dt>
          <dd className="break-words">{shownValue(field, before?.[field], before?.kind)} → {shownValue(field, value, after?.kind)}</dd>
        </div>) : <>
          <div><dt className="font-medium">{t("assistant.action.before")}: </dt><dd className="whitespace-pre-wrap break-words">{readable(action.preview.before)}</dd></div>
          <div><dt className="font-medium">{t("assistant.action.after")}: </dt><dd className="whitespace-pre-wrap break-words">{readable(action.preview.after)}</dd></div>
        </>}
      </dl>
      <p className="mt-2 text-xs font-medium">{t("assistant.action.arguments")}</p>
      <pre className="mt-1 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 text-xs">{JSON.stringify(action.args, null, 2)}</pre>
      {pending ? (
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" onClick={() => onDecide?.(action.id, "approve")} disabled={!canDecide || !onDecide}>{t("assistant.action.approve")}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onDecide?.(action.id, "reject")} disabled={!canDecide || !onDecide}>{t("assistant.action.reject")}</Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p role="status" className="text-xs">{t(`assistant.action.status.${status}`)}{action.result ? `: ${preview(action.result)}` : ""}</p>
          {status === "approved" && page && <Link className="text-xs font-medium text-primary underline underline-offset-2" to={page.route}>
            {t("aiSetup.openPage").replace("{page}", t(page.key))}
          </Link>}
        </div>
      )}
    </section>
  );
}
