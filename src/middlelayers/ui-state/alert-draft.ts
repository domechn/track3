import { validateAlertRule, type AlertComparator, type AlertKind, type AlertRule, type AlertWindow } from "@/middlelayers/alerts";
import type { AssetType } from "@/middlelayers/datafetch/types";

export type AlertDraft = {
  id: number; kind: AlertKind; assetType: AssetType; symbol: string;
  comparator: AlertComparator; threshold: string; window: AlertWindow;
  cooldownMinutes: string;
};
export const needsAsset = (kind: AlertKind) => ["asset_value_target", "asset_price_target", "asset_price_move", "allocation_deviation"].includes(kind);
export const needsWindow = (kind: AlertKind) => kind === "asset_price_move" || kind === "period_pnl" || kind === "portfolio_value_change";

export function alertRuleFromDraft(draft: AlertDraft): AlertRule {
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

export function alertDraftFromRule(rule: AlertRule): AlertDraft {
  return {
    id: rule.id, kind: rule.kind, assetType: rule.assetType ?? "crypto",
    symbol: rule.symbol ?? "", comparator: rule.comparator,
    threshold: String(rule.threshold), window: rule.window ?? "24h",
    cooldownMinutes: String(rule.cooldownSeconds / 60),
  };
}
