import { format } from "date-fns";
import { COST_BASIS_SETTINGS_KEY, REBALANCE_OPTIONS_KEY } from "@/middlelayers/ai/actions/page-settings";
import type { RebalanceOptions } from "@/middlelayers/rebalance";

const assistantDateRangeKey = "track3-assistant-date-range";
const assistantComparisonDatesKey = "track3-assistant-comparison-dates";
const currentDateRangeKey = "track3-current-date-range";
const currentComparisonDatesKey = "track3-current-comparison-dates";
const costBasisKey = COST_BASIS_SETTINGS_KEY;
const rebalanceKey = REBALANCE_OPTIONS_KEY;

export type DateRangePreference = { from: string; to: string };
export type ComparisonDatesPreference = { base: string; head: string };
export type CostBasisPreference = { from: string; to: string; holdingPeriodDays: number };

export const getCurrentDateRange = (): string | null => localStorage.getItem(currentDateRangeKey);
export const clearCurrentDateRange = (): void => localStorage.removeItem(currentDateRangeKey);
export function setCurrentDateRange(from: Date, to: Date): void {
  localStorage.setItem(currentDateRangeKey, JSON.stringify({
    from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd"),
  }));
}
export const getCurrentComparisonDates = (): string | null => localStorage.getItem(currentComparisonDatesKey);
export const clearCurrentComparisonDates = (): void => localStorage.removeItem(currentComparisonDatesKey);
export function setCurrentComparisonDates(base: string, head: string): void {
  localStorage.setItem(currentComparisonDatesKey, JSON.stringify({ base, head }));
}

export function readAssistantDateRange(): unknown {
  const raw = localStorage.getItem(assistantDateRangeKey);
  if (!raw) return undefined;
  return JSON.parse(raw);
}
export const setAssistantDateRange = (args: Record<string, unknown>): void => localStorage.setItem(assistantDateRangeKey, JSON.stringify(args));
export const clearAssistantDateRange = (): void => localStorage.removeItem(assistantDateRangeKey);
export function readAssistantComparisonDates(): unknown {
  const raw = localStorage.getItem(assistantComparisonDatesKey);
  if (!raw) return undefined;
  return JSON.parse(raw);
}
export const setAssistantComparisonDates = (args: Record<string, unknown>): void => localStorage.setItem(assistantComparisonDatesKey, JSON.stringify(args));
export const clearAssistantComparisonDates = (): void => localStorage.removeItem(assistantComparisonDatesKey);

export function readCostBasisSettings(): Record<string, unknown> {
  const stored = JSON.parse(localStorage.getItem(costBasisKey) ?? "{}") as Record<string, unknown>;
  return stored;
}
export function readCostBasisSettingsForAssistant(): Record<string, unknown> {
  try {
    const value = readCostBasisSettings();
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
export function setCostBasisSettingsFromPage({ from, to, holdingPeriodDays }: CostBasisPreference): void {
  localStorage.setItem(costBasisKey, JSON.stringify({ from, to, holdingPeriodDays }));
}
export function setCostBasisSettingsFromAssistant(next: Record<string, unknown>): void {
  localStorage.setItem(costBasisKey, JSON.stringify({
    holdingPeriodDays: next.holdingPeriodDays, from: next.from, to: next.to,
  }));
}
export const clearCostBasisSettings = (): void => localStorage.removeItem(costBasisKey);

export function readRebalanceOptions(): Partial<RebalanceOptions> {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(rebalanceKey) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Partial<RebalanceOptions> : {};
  } catch { return {}; }
}
export function setRebalanceOptions({ mode, injectedCash, minimumTradeValue, ignoreBelowValue, stablecoinsAsCash }: Pick<RebalanceOptions, "mode" | "injectedCash" | "minimumTradeValue" | "ignoreBelowValue" | "stablecoinsAsCash">): void {
  sessionStorage.setItem(rebalanceKey, JSON.stringify({ mode, injectedCash, minimumTradeValue, ignoreBelowValue, stablecoinsAsCash: stablecoinsAsCash === false ? false : undefined }));
}
export function mergeRebalanceOptions(args: Record<string, unknown>): void {
  sessionStorage.setItem(rebalanceKey, JSON.stringify({ ...readRebalanceOptions(), ...args }));
}
export const getRebalanceOptionsRaw = (): string | null => sessionStorage.getItem(rebalanceKey);
export const clearRebalanceOptions = (): void => sessionStorage.removeItem(rebalanceKey);
