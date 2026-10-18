import { isSameWallet } from "@/lib/utils";
import { calculateTotalProfit } from "./charts-profit";
import { getBlacklistCoins, getStableCoins } from "./configuration";
import { executeWrite, executeWriteWork, getDatabase } from "./database";
import type { AssetType } from "./datafetch/types";
import type { PortfolioSourceResult, PortfolioSourceStatus } from "./portfolio-baseline";
import { normalizeSourceStatuses } from "./source-status";
import { calculateRebalance, getRebalanceProfile, type RebalanceProfile } from "./rebalance";

export type AlertKind = "total_value_target" | "asset_value_target" | "asset_price_target" | "asset_price_move" | "allocation_deviation" | "period_pnl" | "portfolio_value_change";
export type AlertWindow = "24h" | "7d" | "30d";
export type AlertComparator = "gte" | "lte";
export type AlertRule = {
  id: number;
  kind: AlertKind;
  assetType: AssetType | null;
  symbol: string | null;
  comparator: AlertComparator;
  threshold: number;
  window: AlertWindow | null;
  enabled: boolean;
  cooldownSeconds: number;
  lastTriggeredAt: string | null;
  lastValue: number | null;
  armed: boolean;
};
export type AlertAsset = {
  assetType: AssetType;
  symbol: string;
  wallet: string;
  amount?: number;
  value: number;
  price: number;
};
export type AlertSnapshot = {
  at: string;
  assets: AlertAsset[];
  stablecoinSymbols?: string[];
  pnl?: Partial<Record<AlertWindow, number>>;
  portfolioChange?: Partial<Record<AlertWindow, number>>;
  staleAssetKeys?: string[];
  hasStaleSources?: boolean;
};
export type AlertPrices = Partial<Record<AlertWindow, Record<string, number>>>;
export type TriggeredAlert = {
  ruleId: number;
  kind: AlertKind;
  title: string;
  message: string;
  symbol?: string | null;
  value: number;
  at: string;
};
export type AlertHistory = {
  id: number;
  ruleId: number | null;
  kind: AlertKind;
  title: string;
  message: string;
  symbol?: string | null;
  value: number;
  triggeredAt: string;
  acknowledgedAt: string | null;
};
type RuleRow = {
  id: number; kind: AlertKind; asset_type: AssetType | null; symbol: string | null;
  comparator: AlertComparator; threshold: number; window: AlertWindow | null;
  enabled: number; cooldown_seconds: number; last_triggered_at: string | null;
  last_value: number | null; armed: number;
};
type HistoryRow = {
  id: number; rule_id: number | null; kind: AlertKind; title: string; message: string;
  symbol?: string | null;
  value: number; triggered_at: string; acknowledged_at: string | null;
};

export const ALERT_SOURCE_STATUS_STORAGE_KEY = "track3-refresh-source-statuses";
export const ALERTS_CHANGED_EVENT = "track3-alerts-changed";
const windows: AlertWindow[] = ["24h", "7d", "30d"];
const windowMs: Record<AlertWindow, number> = { "24h": 86400000, "7d": 7 * 86400000, "30d": 30 * 86400000 };
const kinds: AlertKind[] = ["total_value_target", "asset_value_target", "asset_price_target", "asset_price_move", "allocation_deviation", "period_pnl", "portfolio_value_change"];
const keyOf = (asset: { assetType: AssetType; symbol: string }) => `${asset.assetType}:${asset.symbol.toUpperCase()}`;
const emitChanged = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT));
};

export function validateAlertRule(rule: AlertRule): void {
  if (!kinds.includes(rule.kind) || !["gte", "lte"].includes(rule.comparator)) throw new Error("Invalid alert rule");
  if (!Number.isFinite(rule.threshold) ||
    (rule.threshold < 0 && !["asset_price_move", "period_pnl", "portfolio_value_change"].includes(rule.kind))) throw new Error("Invalid threshold");
  if (!Number.isInteger(rule.cooldownSeconds) || rule.cooldownSeconds < 0) throw new Error("Invalid cooldown");
  const needsAsset = ["asset_value_target", "asset_price_target", "asset_price_move", "allocation_deviation"].includes(rule.kind);
  if (needsAsset
    ? !(rule.symbol?.trim() && ["crypto", "stock"].includes(rule.assetType ?? ""))
    : rule.symbol !== null || rule.assetType !== null) throw new Error("Invalid asset");
  const needsWindow = rule.kind === "asset_price_move" || rule.kind === "period_pnl" || rule.kind === "portfolio_value_change";
  if (needsWindow !== (rule.window !== null && windows.includes(rule.window as AlertWindow))) throw new Error("Invalid window");
}

export async function listAlertRules(): Promise<AlertRule[]> {
  const rows = await (await getDatabase()).select<RuleRow[]>("SELECT * FROM alert_rules ORDER BY id DESC");
  return rows.map((row) => ({
    id: row.id, kind: row.kind, assetType: row.asset_type, symbol: row.symbol,
    comparator: row.comparator, threshold: row.threshold, window: row.window,
    enabled: row.enabled === 1, cooldownSeconds: row.cooldown_seconds,
    lastTriggeredAt: row.last_triggered_at, lastValue: row.last_value, armed: row.armed === 1,
  }));
}

export async function saveAlertRule(rule: AlertRule): Promise<void> {
  validateAlertRule(rule);
  const values = [
    rule.kind, rule.assetType, rule.symbol?.trim().toUpperCase() ?? null, rule.comparator,
    rule.threshold, rule.window, Number(rule.enabled), rule.cooldownSeconds,
  ];
  if (rule.id > 0) {
    await executeWrite(
      "UPDATE alert_rules SET kind=?, asset_type=?, symbol=?, comparator=?, threshold=?, window=?, enabled=?, cooldown_seconds=?, armed=1, last_triggered_at=NULL, last_value=NULL WHERE id=?",
      [...values, rule.id],
    );
  } else {
    await executeWrite(
      "INSERT INTO alert_rules (kind, asset_type, symbol, comparator, threshold, window, enabled, cooldown_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      values,
    );
  }
  emitChanged();
}

export async function setAlertRuleEnabled(id: number, enabled: boolean): Promise<void> {
  await executeWrite("UPDATE alert_rules SET enabled=? WHERE id=?", [Number(enabled), id]);
  emitChanged();
}

export async function deleteAlertRule(id: number): Promise<void> {
  await executeWrite("DELETE FROM alert_rules WHERE id=?", [id]);
  emitChanged();
}

export async function listAlertHistory(): Promise<AlertHistory[]> {
  const rows = await (await getDatabase()).select<HistoryRow[]>(
    "SELECT * FROM alert_history ORDER BY triggered_at DESC, id DESC LIMIT 200",
  );
  return rows.map((row) => ({
    id: row.id, ruleId: row.rule_id, kind: row.kind, title: row.title,
    message: row.message, symbol: row.symbol, value: row.value, triggeredAt: row.triggered_at,
    acknowledgedAt: row.acknowledged_at,
  }));
}

export async function countUnreadAlerts(): Promise<number> {
  const rows = await (await getDatabase()).select<Array<{ count: number }>>(
    "SELECT COUNT(*) AS count FROM alert_history WHERE acknowledged_at IS NULL",
  );
  return rows[0]?.count ?? 0;
}

export async function acknowledgeAlert(id: number): Promise<void> {
  await executeWrite("UPDATE alert_history SET acknowledged_at=? WHERE id=? AND acknowledged_at IS NULL", [new Date().toISOString(), id]);
  emitChanged();
}

export async function acknowledgeAllAlerts(): Promise<void> {
  await executeWrite("UPDATE alert_history SET acknowledged_at=? WHERE acknowledged_at IS NULL", [new Date().toISOString()]);
  emitChanged();
}

export async function clearAlertHistory(): Promise<void> {
  await executeWrite("DELETE FROM alert_history");
  emitChanged();
}

export function measureRule(
  rule: AlertRule,
  latestSnapshots: AlertSnapshot[],
  prices: AlertPrices,
  targets?: RebalanceProfile,
): { value?: number; status: "ready" | "data-stale" | "unavailable"; rearmed: boolean } {
  const latest = latestSnapshots[0];
  if (!latest) return { status: "unavailable", rearmed: false };
  const assetKey = rule.assetType && rule.symbol ? `${rule.assetType}:${rule.symbol.toUpperCase()}` : "";
  const assetStale = !!latest.staleAssetKeys?.includes(assetKey);
  const portfolioStale = !!latest.hasStaleSources;
  const stale = rule.symbol === "*" || rule.kind === "total_value_target" || rule.kind === "period_pnl" || rule.kind === "portfolio_value_change" || rule.kind === "allocation_deviation"
    ? portfolioStale : assetStale;
  if (stale) return { status: "data-stale", rearmed: false };

  let value: number | undefined;
  const members = latest.assets.filter((asset) => keyOf(asset) === assetKey);
  if (rule.kind === "total_value_target") value = latest.assets.reduce((sum, asset) => sum + asset.value, 0);
  if (rule.kind === "asset_value_target") value = members.reduce((sum, asset) => sum + asset.value, 0);
  if (rule.kind === "asset_price_target") {
    const amount = members.reduce((sum, asset) => sum + (asset.amount ?? (asset.price ? asset.value / asset.price : 0)), 0);
    value = amount > 0 ? members.reduce((sum, asset) => sum + asset.value, 0) / amount : members[0]?.price;
  }
  if (rule.kind === "asset_price_move" && rule.window) {
    const amount = members.reduce((sum, asset) => sum + (asset.amount ?? (asset.price ? asset.value / asset.price : 0)), 0);
    const currentPrice = amount > 0 ? members.reduce((sum, asset) => sum + asset.value, 0) / amount : members[0]?.price;
    const previousPrice = prices[rule.window]?.[assetKey];
    if (currentPrice !== undefined && previousPrice && previousPrice > 0) value = Math.round((currentPrice / previousPrice - 1) * 1e8) / 1e6;
  }
  if (rule.kind === "period_pnl" && rule.window) value = latest.pnl?.[rule.window];
  if (rule.kind === "portfolio_value_change" && rule.window) value = latest.portfolioChange?.[rule.window];
  if (rule.kind === "allocation_deviation" && targets) {
    const result = calculateRebalance(
      latest.assets.map((asset) => ({
        symbol: asset.symbol, assetType: asset.assetType,
        amount: asset.amount ?? (asset.price ? asset.value / asset.price : 0),
        value: asset.value, price: asset.price,
      })),
      targets.targets,
      { tolerancePercent: targets.tolerancePercent, stablecoinSymbols: latest.stablecoinSymbols },
    );
    if (rule.symbol === "*") {
      value = Math.max(0, ...result.rows.filter((row) => row.kind === "asset" && row.assetType === rule.assetType)
        .map((row) => Math.abs(row.deviationPercent)));
    } else {
      const row = result.rows.find((row) => row.kind === "asset" && `${row.assetType}:${row.symbol.toUpperCase()}` === assetKey);
      if (row) value = Math.abs(row.deviationPercent);
    }
  }
  if (value === undefined || !Number.isFinite(value)) return { status: "unavailable", rearmed: false };
  const band = Math.max(0.01, Math.abs(rule.threshold) * 0.01);
  const rearmed = !rule.armed && (
    rule.comparator === "gte" ? value < rule.threshold - band : value > rule.threshold + band
  );
  return { value, status: "ready", rearmed };
}

export function evaluate(
  rules: AlertRule[],
  latestSnapshots: AlertSnapshot[],
  prices: AlertPrices,
  targets: RebalanceProfile | undefined,
  now: Date,
): TriggeredAlert[] {
  return rules.flatMap((rule) => {
    if (!rule.enabled) return [];
    const measurement = measureRule(rule, latestSnapshots, prices, targets);
    const value = measurement.value;
    if (measurement.status !== "ready" || value === undefined || !rule.armed) return [];
    if (rule.comparator === "gte" ? value + 1e-9 < rule.threshold : value - 1e-9 > rule.threshold) return [];
    if (rule.lastTriggeredAt && now.getTime() - Date.parse(rule.lastTriggeredAt) < rule.cooldownSeconds * 1000) return [];
    const title = rule.kind === "total_value_target" ? "Portfolio goal reached"
      : rule.kind === "asset_value_target" ? `${rule.symbol} value target reached`
      : rule.kind === "asset_price_target" ? `${rule.symbol} price target reached`
      : rule.kind === "asset_price_move" ? `${rule.symbol} price moved`
      : rule.kind === "allocation_deviation" ? `${rule.symbol === "*" ? "Any asset" : rule.symbol} allocation deviated`
      : rule.kind === "portfolio_value_change" ? "Portfolio value changed"
      : "Period P&L threshold reached";
    return [{
      ruleId: rule.id, kind: rule.kind, title, symbol: rule.symbol,
      message: `${title}: ${value.toFixed(2)} (${rule.comparator === "gte" ? "at least" : "at most"} ${rule.threshold.toFixed(2)})`,
      value, at: now.toISOString(),
    }];
  });
}

export async function recordAlerts(alerts: TriggeredAlert[]): Promise<TriggeredAlert[]> {
  const recorded = await executeWriteWork(async (db) => {
    const saved: TriggeredAlert[] = [];
    for (const alert of alerts) {
      const updated = await db.execute(
        "UPDATE alert_rules SET armed=0, last_triggered_at=?, last_value=? WHERE id=? AND enabled=1 AND armed=1 AND (last_triggered_at IS NULL OR unixepoch(?) - unixepoch(last_triggered_at) >= cooldown_seconds)",
        [alert.at, alert.value, alert.ruleId, alert.at],
      );
      if (updated.rowsAffected === 0) continue;
      await db.execute(
        "INSERT INTO alert_history (rule_id, kind, title, message, symbol, value, triggered_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [alert.ruleId, alert.kind, alert.title, alert.message, alert.symbol ?? null, alert.value, alert.at],
      );
      saved.push(alert);
    }
    return saved;
  });
  if (recorded.length) emitChanged();
  return recorded;
}

export async function loadAlertEvaluationData(
  sourceResults?: PortfolioSourceResult[],
  sourceStatuses?: PortfolioSourceStatus[],
  now = new Date(),
  pnlWindows: AlertWindow[] = [],
): Promise<{ snapshots: AlertSnapshot[]; prices: AlertPrices; targets?: RebalanceProfile; excludedSymbols: string[] }> {
  const db = await getDatabase();
  const selectAssets = "SELECT asset_type AS assetType, symbol, wallet, amount, value, price, createdAt AS at FROM assets_v2 WHERE uuid = ";
  const [rawLatestRows, blacklist, stablecoinSymbols] = await Promise.all([
    db.select<Array<AlertAsset & { at: string }>>(
      selectAssets + "(SELECT uuid FROM assets_v2 ORDER BY createdAt DESC, id DESC LIMIT 1)",
    ),
    getBlacklistCoins(),
    getStableCoins(),
  ]);
  const excluded = new Set(blacklist.map((symbol) => symbol.toUpperCase()));
  const latestRows = rawLatestRows.filter((asset) => !excluded.has(asset.symbol.toUpperCase()));
  const snapshots: AlertSnapshot[] = rawLatestRows.length
    ? [{ at: rawLatestRows[0].at, assets: latestRows, stablecoinSymbols: stablecoinSymbols.length ? stablecoinSymbols : undefined }]
    : [];
  const statuses = sourceStatuses ?? readStoredSourceStatuses();
  if (snapshots[0]) {
    const oldSnapshot = now.getTime() - Date.parse(snapshots[0].at) > 86400000;
    snapshots[0].hasStaleSources = oldSnapshot || statuses.some((source) => source.status === "stale" || source.status === "failed");
    snapshots[0].staleAssetKeys = oldSnapshot || (!sourceResults?.length && snapshots[0].hasStaleSources)
      ? latestRows.map(keyOf)
      : sourceResults
      ? latestRows.filter((asset) => sourceResults.some((source) =>
          source.status === "stale" && source.walletIdentities.some((identity) => isSameWallet(identity, asset.wallet)),
        )).map(keyOf)
      : [];
  }
  const prices: AlertPrices = {};
  const currentTotal = latestRows.reduce((sum, asset) => sum + asset.value, 0);
  for (const window of windows) {
    const cutoffMs = now.getTime() - windowMs[window];
    const rows = await db.select<Array<AlertAsset & { at: string }>>(
      selectAssets + "(SELECT uuid FROM assets_v2 WHERE createdAt <= ? ORDER BY createdAt DESC, id DESC LIMIT 1)",
      [new Date(cutoffMs).toISOString()],
    );
    if (!rows.length || Date.parse(rows[0].at) < cutoffMs - windowMs[window] / 4) continue;
    const previousTotal = rows.filter((asset) => !excluded.has(asset.symbol.toUpperCase()))
      .reduce((sum, asset) => sum + asset.value, 0);
    if (snapshots[0] && previousTotal > 0) {
      snapshots[0].portfolioChange ??= {};
      snapshots[0].portfolioChange[window] = Math.round((currentTotal / previousTotal - 1) * 1e8) / 1e6;
    }
    const grouped = new Map<string, { value: number; amount: number }>();
    for (const asset of rows) {
      const key = keyOf(asset);
      const previous = grouped.get(key) ?? { value: 0, amount: 0 };
      previous.value += asset.value;
      previous.amount += asset.amount ?? 0;
      grouped.set(key, previous);
    }
    prices[window] = Object.fromEntries([...grouped].filter(([, item]) => item.amount > 0)
      .map(([key, item]) => [key, item.value / item.amount]));
  }
  if (snapshots[0] && !snapshots[0].hasStaleSources && pnlWindows.length) {
    const pnl: Partial<Record<AlertWindow, number>> = {};
    for (const window of [...new Set(pnlWindows)]) {
      const result = await calculateTotalProfit({
        start: new Date(now.getTime() - windowMs[window]), end: now,
      });
      if (result.lastRecordDate) pnl[window] = result.total;
    }
    snapshots[0].pnl = pnl;
  }
  const targets = await getRebalanceProfile();
  return { snapshots, prices, targets, excludedSymbols: blacklist };
}

function readStoredSourceStatuses(): PortfolioSourceStatus[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ALERT_SOURCE_STATUS_STORAGE_KEY) ?? "[]");
    return normalizeSourceStatuses(value);
  } catch {
    return [];
  }
}

export async function processAlerts(
  sourceResults?: PortfolioSourceResult[],
  sourceStatuses?: PortfolioSourceStatus[],
  now = new Date(),
): Promise<TriggeredAlert[]> {
  const rules = await listAlertRules();
  if (!rules.some((rule) => rule.enabled)) return [];
  const pnlWindows = rules.filter((rule) => rule.enabled && rule.kind === "period_pnl" && rule.window)
    .map((rule) => rule.window as AlertWindow);
  const { snapshots, prices, targets } = await loadAlertEvaluationData(sourceResults, sourceStatuses, now, pnlWindows);
  if (!snapshots.length) return [];
  const triggered = evaluate(rules, snapshots, prices, targets, now);
  await executeWriteWork(async (db) => {
    for (const rule of rules) {
      const measurement = measureRule(rule, snapshots, prices, targets);
      if (measurement.status !== "ready") continue;
      if (measurement.rearmed) {
        await db.execute("UPDATE alert_rules SET armed=1, last_value=? WHERE id=?", [measurement.value, rule.id]);
      } else if (measurement.value !== rule.lastValue && !triggered.some((alert) => alert.ruleId === rule.id)) {
        await db.execute("UPDATE alert_rules SET last_value=? WHERE id=?", [measurement.value, rule.id]);
      }
    }
  });
  return recordAlerts(triggered);
}
