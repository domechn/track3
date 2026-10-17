import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import {
  addToBlacklist, getBlacklistCoins, removeFromBlacklist, getQuoteColor,
  saveQuoteColor, queryPreferCurrency, savePreferCurrency, listAllCurrencyRates,
  saveCostBasisMethod,
} from "@/middlelayers/configuration";
import { queryAllDataDates, queryLatestAssets } from "@/middlelayers/charts";
import { loadCostBasisReport, exportCostBasisReport } from "@/middlelayers/cost-basis-data";
import { getCostBasisMethod } from "@/middlelayers/configuration";
import { getRebalanceProfile, saveRebalanceProfile, deleteRebalanceProfile, validateProfile, normalizeTargets, loadRebalanceHoldings, calculateRebalance, suggestionsToCsv } from "@/middlelayers/rebalance";
import type { RebalanceProfile } from "@/middlelayers/rebalance";
import {
  listAlertRules, saveAlertRule, validateAlertRule, setAlertRuleEnabled, deleteAlertRule,
  listAlertHistory, acknowledgeAlert, acknowledgeAllAlerts, clearAlertHistory,
} from "@/middlelayers/alerts";
import type { AlertRule } from "@/middlelayers/alerts";
import { redactForExport, redactSecrets } from "@/middlelayers/security/redact";
import en from "@/i18n/locales/en.json";
import zh from "@/i18n/locales/zh.json";
import { localeLocalStorageKey } from "@/i18n";
import type { PendingAction } from "./lifecycle";
import { ASSISTANT_APP_ACTION_EVENT, COST_BASIS_SETTINGS_KEY, REBALANCE_OPTIONS_KEY } from "./page-settings";
export { ASSISTANT_APP_ACTION_EVENT, COST_BASIS_SETTINGS_KEY, REBALANCE_OPTIONS_KEY } from "./page-settings";

export const actionNames = [
  "blacklist_add", "blacklist_remove", "set_date_range", "set_comparison_dates",
  "export_report", "save_rebalance_targets", "create_alert", "set_alert_enabled",
  "delete_alert", "set_base_currency", "set_quote_color",
  "set_cost_basis_settings", "edit_alert", "acknowledge_alert", "acknowledge_all_alerts",
  "clear_alert_history", "set_rebalance_options", "apply_rebalance_preset", "export_rebalance",
  "delete_rebalance_targets",
] as const;
export type ActionName = typeof actionNames[number];
export type ActionDefinition = {
  name: ActionName;
  risk: PendingAction["risk"];
  validate: (raw: unknown) => Record<string, unknown>;
  preview: (raw: unknown) => Promise<PendingAction["preview"]>;
  execute: (raw: unknown) => Promise<string>;
};
export const DATE_RANGE_KEY = "track3-assistant-date-range";
export const COMPARISON_DATES_KEY = "track3-assistant-comparison-dates";
export const CURRENT_DATE_RANGE_KEY = "track3-current-date-range";
export const CURRENT_COMPARISON_DATES_KEY = "track3-current-comparison-dates";
const symbol = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9._-]{1,30}$/.test(value) &&
  redactForExport({ symbol: value }).symbol === value;
const day = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const integer = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value);
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
function fields(value: unknown, required: string[], optional: string[] = []): asserts value is Record<string, unknown> {
  if (!record(value) || JSON.stringify(value).length > 16_384 ||
    required.some((key) => !(key in value)) ||
    Object.keys(value).some((key) => ![...required, ...optional].includes(key))) {
    throw new Error("Invalid action arguments");
  }
}
function validTarget(target: unknown): boolean {
  if (!record(target)) return false;
  if (target.kind === "cash") return Object.keys(target).length === 2 && finite(target.percent);
  if (target.kind === "type") return Object.keys(target).length === 3 &&
    ["crypto", "stock"].includes(String(target.assetType)) && finite(target.percent);
  return target.kind === "asset" && Object.keys(target).length === 4 &&
    ["crypto", "stock"].includes(String(target.assetType)) && symbol(target.symbol) && finite(target.percent);
}

export function validateActionArgs(name: string, raw: unknown): Record<string, unknown> {
  if (!(actionNames as readonly string[]).includes(name)) throw new Error(`Unknown action: ${name}`);
  if (!record(raw)) throw new Error("Invalid action arguments");
  const args = raw;
  switch (name as ActionName) {
    case "blacklist_add":
    case "blacklist_remove":
      fields(args, ["symbol"]);
      if (!symbol(args.symbol)) throw new Error("Invalid coin symbol");
      return { symbol: String(args.symbol).toUpperCase() };
    case "set_date_range":
    case "set_comparison_dates": {
      const keys = name === "set_date_range" ? ["from", "to"] : ["base", "head"];
      fields(args, keys);
      if (!day(args[keys[0]]) || !day(args[keys[1]]) || String(args[keys[0]]) > String(args[keys[1]])) {
        throw new Error("Invalid date range");
      }
      return args;
    }
    case "export_report":
      fields(args, ["report", "format"], ["from", "to"]);
      if (!["portfolio_snapshot", "realized_gains", "markdown_summary"].includes(String(args.report)) ||
        !["csv", "json", "md"].includes(String(args.format)) ||
        (args.report === "markdown_summary" ? args.format !== "md" : args.format === "md") ||
        (args.from !== undefined && !day(args.from)) || (args.to !== undefined && !day(args.to)) ||
        (args.from && args.to && String(args.from) > String(args.to)) ||
        (args.report !== "realized_gains" && (args.from !== undefined || args.to !== undefined))) throw new Error("Invalid export request");
      return args;
    case "save_rebalance_targets":
      fields(args, ["targets", "tolerancePercent"]);
      if (!Array.isArray(args.targets) || args.targets.length > 100 || !args.targets.every(validTarget)) throw new Error("Invalid rebalance targets");
      validateProfile(args as RebalanceProfile);
      return args;
    case "create_alert":
    case "edit_alert": {
      fields(args, name === "edit_alert" ? ["id"] : ["kind", "comparator", "threshold"],
        name === "edit_alert" ? ["kind", "comparator", "threshold", "assetType", "symbol", "window", "enabled", "cooldownSeconds"] :
          ["assetType", "symbol", "window", "enabled", "cooldownSeconds"]);
      if (name === "edit_alert" && (!integer(args.id) || Number(args.id) <= 0)) throw new Error("Invalid alert selection");
      if ((name === "create_alert" || args.threshold !== undefined) && !finite(args.threshold) ||
        (name === "create_alert" || args.comparator !== undefined) && !["gte", "lte"].includes(String(args.comparator)) ||
        (name === "edit_alert" && Object.keys(args).length === 1) ||
        (args.assetType !== undefined && args.assetType !== null && !["crypto", "stock"].includes(String(args.assetType))) ||
        (args.symbol !== undefined && args.symbol !== null && !symbol(args.symbol) &&
          !(args.symbol === "*" && (name === "edit_alert" || args.kind === "allocation_deviation"))) ||
        (args.window !== undefined && args.window !== null && !["24h", "7d", "30d"].includes(String(args.window))) ||
        (args.enabled !== undefined && typeof args.enabled !== "boolean") ||
        (args.cooldownSeconds !== undefined && (!integer(args.cooldownSeconds) || Number(args.cooldownSeconds) < 0))) {
        throw new Error("Invalid alert rule");
      }
      if (name === "create_alert") validateAlertRule(makeAlertRule(args));
      return args;
    }
    case "set_alert_enabled":
      fields(args, ["id", "enabled"]);
      if (!integer(args.id) || Number(args.id) <= 0 || typeof args.enabled !== "boolean") throw new Error("Invalid alert selection");
      return args;
    case "delete_alert":
    case "acknowledge_alert":
      fields(args, ["id"]);
      if (!integer(args.id) || Number(args.id) <= 0) throw new Error("Invalid alert selection");
      return args;
    case "acknowledge_all_alerts":
    case "clear_alert_history":
    case "delete_rebalance_targets":
      fields(args, []);
      return args;
    case "set_cost_basis_settings":
      fields(args, [], ["method", "holdingPeriodDays", "from", "to"]);
      if (!Object.keys(args).length ||
        (args.method !== undefined && !["FIFO", "LIFO", "HIFO", "AVERAGE"].includes(String(args.method))) ||
        (args.holdingPeriodDays !== undefined && (!integer(args.holdingPeriodDays) || Number(args.holdingPeriodDays) < 1)) ||
        (args.from !== undefined && args.from !== "" && !day(args.from)) ||
        (args.to !== undefined && args.to !== "" && !day(args.to)) ||
        (args.from && args.to && String(args.from) > String(args.to))) throw new Error("Invalid cost basis settings");
      return args;
    case "set_rebalance_options":
      fields(args, [], ["mode", "injectedCash", "minimumTradeValue", "ignoreBelowValue"]);
      if (!Object.keys(args).length ||
        (args.mode !== undefined && !["full", "buys"].includes(String(args.mode))) ||
        ["injectedCash", "minimumTradeValue", "ignoreBelowValue"].some((key) =>
          args[key] !== undefined && (!finite(args[key]) || Number(args[key]) < 0))) throw new Error("Invalid rebalance options");
      return args;
    case "apply_rebalance_preset":
      fields(args, ["preset"]);
      if (!["equal_weight", "current_holdings"].includes(String(args.preset))) throw new Error("Invalid rebalance preset");
      return args;
    case "export_rebalance":
      fields(args, []);
      return args;
    case "set_base_currency":
      fields(args, ["currency"]);
      if (typeof args.currency !== "string" || !/^[A-Za-z]{3}$/.test(args.currency)) throw new Error("Invalid currency");
      return { currency: args.currency.toUpperCase() };
    case "set_quote_color":
      fields(args, ["value"]);
      if (!["green-up-red-down", "red-up-green-down"].includes(String(args.value))) throw new Error("Invalid quote color");
      return args;
  }
}

function makeAlertRule(args: Record<string, unknown>): AlertRule {
  return {
    id: (args.id ?? 0) as number, kind: args.kind as AlertRule["kind"], comparator: args.comparator as AlertRule["comparator"],
    threshold: args.threshold as number, assetType: (args.assetType ?? null) as AlertRule["assetType"],
    symbol: (args.symbol ?? null) as string | null, window: (args.window ?? null) as AlertRule["window"],
    enabled: args.enabled !== false, cooldownSeconds: (args.cooldownSeconds ?? 3600) as number,
    lastTriggeredAt: null, lastValue: null, armed: true,
  };
}

export const proposeActionTool = {
  name: "propose_action",
  description: "Propose for confirmation; never executes. Args: blacklist_add/remove {symbol}; set_date_range {from,to}; set_comparison_dates {base,head}; export_report {report,format,from?,to?}; save_rebalance_targets {targets,tolerancePercent}, asset target exactly {kind,assetType,symbol,percent}; create_alert {kind,comparator,threshold,assetType?,symbol?,window?,enabled?,cooldownSeconds?}; edit_alert {id,changed fields}; set_alert_enabled {id,enabled}; delete_alert/acknowledge_alert {id}; set_base_currency {currency}; set_quote_color {value}; set_cost_basis_settings {method?,holdingPeriodDays?,from?,to?}; set_rebalance_options {mode?,injectedCash?,minimumTradeValue?,ignoreBelowValue?}; apply_rebalance_preset {preset}; export_rebalance/delete_rebalance_targets/clear_alert_history/acknowledge_all_alerts {}.",
  parameters: {
    type: "object", additionalProperties: false, required: ["action", "args"],
    properties: {
      action: { type: "string", enum: actionNames },
      args: { type: "object", description: "Arguments for the selected registered action." },
    },
  },
};

export async function prepareAction(name: string, raw: unknown, toolCallId: string, secrets: readonly string[] = []): Promise<PendingAction> {
  let args = validateActionArgs(name, raw);
  let editedRule: AlertRule | undefined;
  if (name === "edit_alert") {
    const previous = (await listAlertRules()).find((rule) => rule.id === args.id);
    if (!previous) throw new Error("Alert rule not found");
    const changedKind = args.kind !== undefined && args.kind !== previous.kind;
    const kind = (args.kind ?? previous.kind) as AlertRule["kind"];
    const usesAsset = ["asset_value_target", "asset_price_target", "asset_price_move", "allocation_deviation"].includes(kind);
    const usesWindow = ["asset_price_move", "period_pnl", "portfolio_value_change"].includes(kind);
    const merged = {
      ...previous, ...args, kind,
      assetType: args.assetType !== undefined ? args.assetType : changedKind && !usesAsset ? null : previous.assetType,
      symbol: args.symbol !== undefined ? args.symbol : changedKind && !usesAsset ? null : previous.symbol,
      window: args.window !== undefined ? args.window : changedKind && !usesWindow ? null : previous.window,
    };
    editedRule = makeAlertRule(merged);
    if (editedRule.symbol === "*" && editedRule.kind !== "allocation_deviation") throw new Error("Invalid alert rule");
    validateAlertRule(editedRule);
    args = {
      id: editedRule.id, kind: editedRule.kind, comparator: editedRule.comparator,
      threshold: editedRule.threshold, assetType: editedRule.assetType,
      symbol: editedRule.symbol, window: editedRule.window, enabled: editedRule.enabled,
      cooldownSeconds: editedRule.cooldownSeconds,
    };
  }
  if (JSON.stringify(redactForExport(args, secrets)) !== JSON.stringify(args)) {
    throw new Error("Action arguments contain a secret");
  }
  const action = name as ActionName;
  let before = "";
  let after = "";
  if (action === "blacklist_add" || action === "blacklist_remove") {
    const list = await getBlacklistCoins();
    before = list.join(", ") || "assistant.action.preview.empty";
    after = action === "blacklist_add"
      ? [...new Set([...list, String(args.symbol)])].join(", ")
      : list.filter((entry) => entry !== args.symbol).join(", ") || "assistant.action.preview.empty";
  } else if (action === "save_rebalance_targets") {
    before = JSON.stringify((await getRebalanceProfile()) ?? null);
    after = JSON.stringify(args);
  } else if (action === "delete_rebalance_targets") {
    before = JSON.stringify((await getRebalanceProfile()) ?? null);
    after = "assistant.action.preview.deleted";
  } else if (action === "apply_rebalance_preset") {
    const draft = await rebalancePreset(args.preset as "equal_weight" | "current_holdings");
    before = JSON.stringify((await getRebalanceProfile()) ?? null);
    after = JSON.stringify(draft);
  } else if (action === "set_rebalance_options") {
    before = sessionStorage.getItem(REBALANCE_OPTIONS_KEY) ?? "{}";
    after = JSON.stringify({ ...readStored(REBALANCE_OPTIONS_KEY, sessionStorage), ...args });
  } else if (action === "export_rebalance") {
    before = "assistant.action.preview.noFile";
    after = "track3-rebalance.csv";
  } else if (action === "set_cost_basis_settings") {
    const current: Record<string, unknown> = { method: await getCostBasisMethod(), ...readStored(COST_BASIS_SETTINGS_KEY) };
    const next: Record<string, unknown> = { ...current, ...args };
    if (next.from && next.to && String(next.from) > String(next.to)) throw new Error("Invalid date range");
    before = JSON.stringify(current);
    after = JSON.stringify(next);
  } else if (action === "export_report" && args.report === "realized_gains") {
    const settings = readStored(COST_BASIS_SETTINGS_KEY);
    before = JSON.stringify({ method: await getCostBasisMethod(), ...settings });
    after = JSON.stringify({
      report: args.report, format: args.format,
      from: args.from ?? settings.from, to: args.to ?? settings.to,
    });
  } else if (action === "create_alert") {
    before = "{}";
    after = JSON.stringify(args);
  } else if (action === "set_alert_enabled" || action === "delete_alert" || action === "edit_alert") {
    const rule = editedRule ?? (await listAlertRules()).find((item) => item.id === args.id);
    if (!rule) throw new Error("Alert rule not found");
    before = JSON.stringify(editedRule ? (await listAlertRules()).find((item) => item.id === args.id) : rule);
    after = action === "delete_alert" ? "assistant.action.preview.deleted" :
      JSON.stringify(editedRule ?? { ...rule, enabled: args.enabled });
  } else if (action === "acknowledge_alert") {
    const alert = (await listAlertHistory()).find((item) => item.id === args.id);
    if (!alert) throw new Error("Alert history entry not found");
    before = JSON.stringify(alert);
    after = JSON.stringify({ ...alert, acknowledgedAt: "now" });
  } else if (action === "acknowledge_all_alerts" || action === "clear_alert_history") {
    const history = await listAlertHistory();
    before = JSON.stringify(history.map((item) => ({ id: item.id, acknowledgedAt: item.acknowledgedAt })));
    after = action === "clear_alert_history" ? "assistant.action.preview.deleted" :
      `assistant.action.preview.acknowledgedAll:${history.filter((item) => !item.acknowledgedAt).length}`;
  } else if (action === "set_base_currency") {
    const rates = await listAllCurrencyRates();
    if (!rates.some((rate) => rate.currency === args.currency)) throw new Error("Currency not available");
    before = (await queryPreferCurrency()).currency;
    after = String(args.currency);
  } else if (action === "set_quote_color") {
    before = await getQuoteColor();
    after = String(args.value);
  } else if (action === "set_date_range" || action === "set_comparison_dates") {
    if (action === "set_comparison_dates") {
      const dates = new Set((await queryAllDataDates()).map((entry) => entry.date));
      if (!dates.has(String(args.base)) || !dates.has(String(args.head))) throw new Error("Comparison dates have no snapshots");
    }
    before = localStorage.getItem(action === "set_date_range" ? CURRENT_DATE_RANGE_KEY : CURRENT_COMPARISON_DATES_KEY) ?? "assistant.action.preview.current";
    after = JSON.stringify(args);
  } else {
    before = "assistant.action.preview.noFile";
    after = `${String(args.report)} ${String(args.format)}`;
  }
  const now = Date.now();
  return {
    kind: "pending_action", id: crypto.randomUUID(), toolCallId, name: action,
    args, preview: {
      before: redactSecrets(before, secrets), after: redactSecrets(after, secrets),
    },
    risk: actionRegistry[action].risk,
    status: "pending", createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 5 * 60_000).toISOString(),
  };
}

function readStored(key: string, storage: Storage = localStorage): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? "{}");
    return record(value) ? value : {};
  } catch {
    return {};
  }
}

async function rebalancePreset(preset: "equal_weight" | "current_holdings"): Promise<RebalanceProfile> {
  const currency = await queryPreferCurrency();
  const { holdings } = await loadRebalanceHoldings(currency);
  const active = holdings.filter((item) => item.amount > 0 && item.value > 0);
  if (!active.length) throw new Error("No holdings available for rebalance preset");
  return {
    targets: normalizeTargets(active.map((item) => ({
      kind: "asset" as const, assetType: item.assetType, symbol: item.symbol,
      percent: preset === "equal_weight" ? 1 : item.value,
    }))),
    tolerancePercent: (await getRebalanceProfile())?.tolerancePercent ?? 0,
  };
}

function notifyApp(): void {
  window.dispatchEvent(new Event(ASSISTANT_APP_ACTION_EVENT));
}
function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
async function exportPortfolio(report: "portfolio_snapshot" | "markdown_summary", format: "csv" | "json" | "md"): Promise<string> {
  const assets = redactForExport(await queryLatestAssets());
  const rate = await queryPreferCurrency();
  const filePath = await save({
    defaultPath: `track3-${report.replace("_", "-")}.${format}`,
    filters: [{ name: report, extensions: [format] }],
  });
  if (!filePath) return "assistant.action.result.canceled";
  const total = assets.reduce((sum, asset) => sum + asset.value * rate.rate, 0);
  const content = format === "json"
    ? JSON.stringify({ currency: rate.currency, total, assets }, null, 2)
    : format === "md"
      ? `# Portfolio summary\n\nTotal: ${total.toFixed(2)} ${rate.currency}\n\n` +
        assets.map((asset) => `- ${asset.symbol}: ${(asset.value * rate.rate).toFixed(2)} ${rate.currency}`).join("\n")
      : ["symbol,assetType,amount,value,price",
        ...assets.map((asset) => [asset.symbol, asset.assetType, asset.amount, asset.value * rate.rate, asset.price * rate.rate].map(csvCell).join(","))].join("\r\n");
  await writeTextFile(filePath, redactSecrets(content));
  return "assistant.action.result.exported";
}

export async function executeAction(name: string, raw: unknown): Promise<string> {
  const args = validateActionArgs(name, raw);
  switch (name as ActionName) {
    case "blacklist_add": await addToBlacklist(String(args.symbol)); return "assistant.action.result.done";
    case "blacklist_remove": await removeFromBlacklist(String(args.symbol)); return "assistant.action.result.done";
    case "set_date_range":
      localStorage.setItem(DATE_RANGE_KEY, JSON.stringify(args)); notifyApp(); return "assistant.action.result.done";
    case "set_comparison_dates":
      localStorage.setItem(COMPARISON_DATES_KEY, JSON.stringify(args)); notifyApp(); return "assistant.action.result.done";
    case "export_report":
      if (args.report === "realized_gains") {
        const settings = readStored(COST_BASIS_SETTINGS_KEY);
        const report = await loadCostBasisReport({
          method: await getCostBasisMethod(),
          from: (args.from ?? settings.from) as string | undefined,
          to: (args.to ?? settings.to) as string | undefined,
          holdingPeriodDays: settings.holdingPeriodDays as number | undefined,
        });
        return await exportCostBasisReport(report, args.format as "csv" | "json") ? "assistant.action.result.exported" : "assistant.action.result.canceled";
      }
      return exportPortfolio(args.report as "portfolio_snapshot" | "markdown_summary", args.format as "csv" | "json" | "md");
    case "save_rebalance_targets":
      await saveRebalanceProfile(args as RebalanceProfile); notifyApp(); return "assistant.action.result.done";
    case "delete_rebalance_targets":
      await deleteRebalanceProfile(); notifyApp(); return "assistant.action.result.done";
    case "apply_rebalance_preset":
      await saveRebalanceProfile(await rebalancePreset(args.preset as "equal_weight" | "current_holdings"));
      notifyApp(); return "assistant.action.result.done";
    case "set_rebalance_options":
      sessionStorage.setItem(REBALANCE_OPTIONS_KEY, JSON.stringify({ ...readStored(REBALANCE_OPTIONS_KEY, sessionStorage), ...args }));
      notifyApp(); return "assistant.action.result.done";
    case "export_rebalance": {
      const profile = await getRebalanceProfile();
      if (!profile) throw new Error("No rebalance targets to export");
      const currency = await queryPreferCurrency();
      const { holdings, stablecoinSymbols } = await loadRebalanceHoldings(currency);
      const options = readStored(REBALANCE_OPTIONS_KEY, sessionStorage);
      const result = calculateRebalance(holdings, profile.targets, { ...options, tolerancePercent: profile.tolerancePercent, stablecoinSymbols });
      const filePath = await save({ defaultPath: "track3-rebalance.csv", filters: [{ name: "track3-rebalance", extensions: ["csv"] }] });
      if (!filePath) return "assistant.action.result.canceled";
      const dictionary: Record<string, string> = localStorage.getItem(localeLocalStorageKey) === "zh" ? zh : en;
      await writeTextFile(filePath, suggestionsToCsv(result, currency.currency, (key) => dictionary[key] ?? en[key as keyof typeof en] ?? key));
      return "assistant.action.result.exported";
    }
    case "set_cost_basis_settings": {
      const current: Record<string, unknown> = { method: await getCostBasisMethod(), ...readStored(COST_BASIS_SETTINGS_KEY) };
      const next: Record<string, unknown> = { ...current, ...args };
      if (next.from && next.to && String(next.from) > String(next.to)) throw new Error("Invalid date range");
      if (args.method !== undefined) await saveCostBasisMethod(args.method as "FIFO" | "LIFO" | "HIFO" | "AVERAGE");
      localStorage.setItem(COST_BASIS_SETTINGS_KEY, JSON.stringify({
        holdingPeriodDays: next.holdingPeriodDays, from: next.from, to: next.to,
      }));
      notifyApp(); return "assistant.action.result.done";
    }
    case "create_alert":
      await saveAlertRule(makeAlertRule(args)); return "assistant.action.result.done";
    case "edit_alert":
      {
        const previous = (await listAlertRules()).find((rule) => rule.id === args.id);
        if (!previous) throw new Error("Alert rule not found");
        await saveAlertRule(makeAlertRule({ ...previous, ...args }));
        return "assistant.action.result.done";
      }
    case "acknowledge_alert":
      if (!(await listAlertHistory()).some((item) => item.id === args.id)) throw new Error("Alert history entry not found");
      await acknowledgeAlert(args.id as number); return "assistant.action.result.done";
    case "acknowledge_all_alerts":
      await acknowledgeAllAlerts(); return "assistant.action.result.done";
    case "clear_alert_history":
      await clearAlertHistory(); return "assistant.action.result.done";
    case "set_alert_enabled":
      if (!(await listAlertRules()).some((rule) => rule.id === args.id)) throw new Error("Alert rule not found");
      await setAlertRuleEnabled(args.id as number, args.enabled as boolean); return "assistant.action.result.done";
    case "delete_alert":
      if (!(await listAlertRules()).some((rule) => rule.id === args.id)) throw new Error("Alert rule not found");
      await deleteAlertRule(args.id as number); return "assistant.action.result.done";
    case "set_base_currency":
      if (!(await listAllCurrencyRates()).some((rate) => rate.currency === args.currency)) throw new Error("Currency not available");
      await savePreferCurrency(String(args.currency)); notifyApp(); return "assistant.action.result.done";
    case "set_quote_color":
      await saveQuoteColor(args.value as "green-up-red-down" | "red-up-green-down"); notifyApp(); return "assistant.action.result.done";
  }
}
export async function executePreparedAction(action: PendingAction): Promise<string> {
  const fresh = await prepareAction(action.name, action.args, action.toolCallId);
  if (fresh.preview.before !== action.preview.before) {
    throw new Error("App state changed since the action preview");
  }
  return actionRegistry[action.name as ActionName].execute(action.args);
}
const risks: Record<ActionName, PendingAction["risk"]> = {
  blacklist_add: "low", blacklist_remove: "low", set_date_range: "low",
  set_comparison_dates: "low", export_report: "medium", save_rebalance_targets: "medium",
  create_alert: "low", set_alert_enabled: "low", delete_alert: "high",
  set_base_currency: "low", set_quote_color: "low",
  set_cost_basis_settings: "low", edit_alert: "medium", acknowledge_alert: "low",
  acknowledge_all_alerts: "low", clear_alert_history: "high", set_rebalance_options: "low",
  apply_rebalance_preset: "medium", export_rebalance: "medium", delete_rebalance_targets: "high",
};
export const actionRegistry = Object.fromEntries(actionNames.map((name) => [name, {
  name,
  risk: risks[name],
  validate: (raw: unknown) => validateActionArgs(name, raw),
  preview: async (raw: unknown) => (await prepareAction(name, raw, "preview")).preview,
  execute: (raw: unknown) => executeAction(name, raw),
}])) as Record<ActionName, ActionDefinition>;
