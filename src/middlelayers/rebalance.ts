import { getStableCoins } from "./configuration";
import { queryLatestAssets } from "./charts";
import { executeWrite, getDatabase } from "./database";
import type { AssetType } from "./datafetch/types";
import type { CurrencyRateDetail } from "./types";
import { redactSecrets } from "./security/redact";

export type RebalanceTarget =
  | { kind: "asset"; assetType: AssetType; symbol: string; percent: number }
  | { kind: "type"; assetType: AssetType; percent: number }
  | { kind: "cash"; percent: number };

export type RebalanceProfile = {
  targets: RebalanceTarget[];
  tolerancePercent: number;
};

export type RebalanceHolding = {
  symbol: string;
  assetType: AssetType;
  amount: number;
  value: number;
  price: number;
};

export type RebalanceOptions = {
  mode?: "full" | "buys";
  injectedCash?: number;
  minimumTradeValue?: number;
  ignoreBelowValue?: number;
  tolerancePercent?: number;
  stablecoinSymbols?: string[];
};

export type RebalanceRow = {
  kind: "asset" | "cash";
  symbol: string;
  assetType?: AssetType;
  amount: number;
  value: number;
  price: number;
  currentPercent: number;
  targetPercent: number;
  deviationPercent: number;
  tradeValue: number;
  tradeQuantity: number | null;
  note?: "missing-price" | "below-threshold" | "cash-reserve";
};

export type RebalanceResult = {
  rows: RebalanceRow[];
  currentTotal: number;
  projectedTotal: number;
  warnings: ({ kind: "empty-type"; assetType: AssetType } | { kind: "missing-price-target" })[];
};

const DEFAULT_STABLECOINS = [
  "USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDD",
  "PYUSD", "USDP", "FRAX", "LUSD", "GUSD", "BUSD",
];

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);
const fromCents = (value: number) => value / 100;
const keyOf = (assetType: AssetType, symbol: string) => `${assetType}:${symbol.trim().toUpperCase()}`;

/** Normalize positive draft weights by largest remainder to 0.01%. */
export function normalizeTargets(targets: RebalanceTarget[]): RebalanceTarget[] {
  if (!targets.length || targets.some((target) => !Number.isFinite(target.percent) || target.percent < 0)) {
    throw new Error("Target weights must be non-negative numbers");
  }
  const sum = targets.reduce((total, target) => total + target.percent, 0);
  if (!Number.isFinite(sum) || sum <= 0) throw new Error("Target weights must be positive");
  const raw = targets.map((target) => target.percent / sum * 10000);
  const units = raw.map(Math.floor);
  const order = raw.map((share, index) => ({ index, fraction: share - units[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const remainder = 10000 - units.reduce((total, unit) => total + unit, 0);
  for (let i = 0; i < remainder; i++) units[order[i].index]++;
  return targets.map((target, index) => ({ ...target, percent: fromCents(units[index]) }));
}

export function validateProfile(profile: RebalanceProfile): void {
  if (!Array.isArray(profile.targets) || !profile.targets.length) throw new Error("At least one target is required");
  if (!Number.isFinite(profile.tolerancePercent) || profile.tolerancePercent < 0 || profile.tolerancePercent > 100) {
    throw new Error("Invalid tolerance");
  }
  const keys = new Set<string>();
  for (const target of profile.targets) {
    if (target.kind !== "asset" && target.kind !== "type" && target.kind !== "cash") {
      throw new Error("Invalid target kind");
    }
    if (target.kind !== "cash" && target.assetType !== "crypto" && target.assetType !== "stock") {
      throw new Error("Invalid asset type");
    }
    if (!Number.isFinite(target.percent) || target.percent < 0 || target.percent > 100) {
      throw new Error("Invalid target percentage");
    }
    if (target.kind === "asset" && typeof target.symbol !== "string") {
      throw new Error("Invalid asset symbol");
    }
    const key = target.kind === "asset"
      ? keyOf(target.assetType, target.symbol.trim())
      : target.kind === "type" ? `type:${target.assetType}` : "cash";
    if (target.kind === "asset" && !target.symbol.trim()) throw new Error("Asset symbol is required");
    if (keys.has(key)) throw new Error("Duplicate target");
    keys.add(key);
  }
  if (Math.abs(profile.targets.reduce((sum, target) => sum + target.percent, 0) - 100) > 0.000001) {
    throw new Error("Targets must sum to 100%");
  }
}

export async function getRebalanceProfile(): Promise<RebalanceProfile | undefined> {
  const db = await getDatabase();
  const rows = await db.select<Array<{ targets: string; tolerance_percent: number }>>(
    "SELECT targets, tolerance_percent FROM rebalance_profiles WHERE id = 1",
  );
  if (!rows[0]) return undefined;
  const profile = {
    targets: JSON.parse(rows[0].targets) as RebalanceTarget[],
    tolerancePercent: rows[0].tolerance_percent,
  };
  validateProfile(profile);
  return profile;
}

export async function saveRebalanceProfile(profile: RebalanceProfile): Promise<void> {
  validateProfile(profile);
  const targets = profile.targets.map((target) =>
    target.kind === "asset" ? { ...target, symbol: target.symbol.trim().toUpperCase() } : target,
  );
  await executeWrite(
    "INSERT INTO rebalance_profiles (id, targets, tolerance_percent) VALUES (1, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET targets = excluded.targets, tolerance_percent = excluded.tolerance_percent",
    [JSON.stringify(targets), profile.tolerancePercent],
  );
}

export async function deleteRebalanceProfile(): Promise<void> {
  await executeWrite("DELETE FROM rebalance_profiles WHERE id = 1");
}

/** Latest recorded holdings in the display currency; blacklist filtering is shared with charts. */
export async function loadRebalanceHoldings(currency: CurrencyRateDetail): Promise<{
  holdings: RebalanceHolding[];
  stablecoinSymbols: string[];
}> {
  const [assets, stablecoinSymbols] = await Promise.all([
    queryLatestAssets(), getStableCoins(),
  ]);
  const rate = currency.rate || 1;
  return {
    holdings: assets.map((asset) => ({
      symbol: asset.symbol.toUpperCase(),
      assetType: asset.assetType,
      amount: asset.amount,
      value: asset.value * rate,
      price: asset.price * rate,
    })),
    stablecoinSymbols: stablecoinSymbols.length ? stablecoinSymbols : DEFAULT_STABLECOINS,
  };
}

/**
 * Base-currency trades are rounded to 0.01 before allocation, so their signed sum
 * (including the CASH reserve row) equals injected cash exactly to that precision.
 * Quantities are indicative and rounded to 8 decimals; execution prices may differ.
 */
export function calculateRebalance(
  holdings: RebalanceHolding[],
  targets: RebalanceTarget[],
  options: RebalanceOptions = {},
): RebalanceResult {
  validateProfile({ targets, tolerancePercent: options.tolerancePercent ?? 0 });
  const injectedCash = options.injectedCash ?? 0;
  const minimumTradeValue = options.minimumTradeValue ?? 0;
  const ignoreBelowValue = options.ignoreBelowValue ?? 0;
  if ([injectedCash, minimumTradeValue, ignoreBelowValue].some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Cash and thresholds must be non-negative");
  }
  const stablecoins = new Set((options.stablecoinSymbols ?? DEFAULT_STABLECOINS).map((symbol) => symbol.toUpperCase()));
  const cashTarget = targets.find((target) => target.kind === "cash");
  const entries = new Map<string, RebalanceHolding>();
  for (const holding of holdings) {
    const key = keyOf(holding.assetType, holding.symbol);
    const previous = entries.get(key);
    if (previous) {
      previous.amount += holding.amount;
      previous.value += holding.value;
      if (holding.price <= 0) previous.price = 0;
    } else {
      entries.set(key, { ...holding, symbol: holding.symbol.toUpperCase() });
    }
  }
  for (const target of targets) {
    if (target.kind === "asset") {
      const key = keyOf(target.assetType, target.symbol);
      if (!entries.has(key)) {
        entries.set(key, { symbol: target.symbol.trim().toUpperCase(), assetType: target.assetType, amount: 0, value: 0, price: 0 });
      }
    }
  }
  const currentTotal = Array.from(entries.values()).reduce((sum, asset) => sum + asset.value, 0);
  const projectedTotal = currentTotal + injectedCash;
  const rows: RebalanceRow[] = Array.from(entries.values()).map((asset) => ({
    kind: "asset",
    symbol: asset.symbol,
    assetType: asset.assetType,
    amount: asset.amount,
    value: asset.value,
    price: asset.price,
    currentPercent: currentTotal > 0 ? asset.value / currentTotal * 100 : 0,
    targetPercent: 0,
    deviationPercent: 0,
    tradeValue: 0,
    tradeQuantity: asset.price > 0 && Number.isFinite(asset.price) ? 0 : null,
  }));
  const cash: RebalanceRow = {
    kind: "cash", symbol: "CASH", amount: injectedCash, value: injectedCash, price: 1,
    currentPercent: 0, targetPercent: 0, deviationPercent: 0,
    tradeValue: 0, tradeQuantity: 0, note: "cash-reserve",
  };
  const explicit = new Set<string>();
  for (const target of targets) {
    if (target.kind !== "asset") continue;
    const row = rows.find((item) => item.assetType === target.assetType && item.symbol === target.symbol.trim().toUpperCase());
    if (row) {
      row.targetPercent = target.percent;
      explicit.add(keyOf(target.assetType, target.symbol));
    }
  }
  const warnings: RebalanceResult["warnings"] = [];
  let stableSurplusCents = 0;
  for (const target of targets) {
    if (target.kind === "asset") continue;
    if (target.kind === "cash") {
      const members = rows.filter((row) => row.assetType === "crypto" && stablecoins.has(row.symbol)
        && !explicit.has(keyOf("crypto", row.symbol)));
      const stableValue = members.reduce((sum, row) => sum + row.value, 0);
      const cashGoal = projectedTotal * target.percent / 100;
      stableSurplusCents = Math.max(0, cents(stableValue - cashGoal));
      const stableTargetPercent = cashGoal > 0 ? target.percent * Math.min(1, stableValue / cashGoal) : 0;
      for (const member of members) {
        member.targetPercent += stableValue > 0 ? stableTargetPercent * member.value / stableValue : 0;
      }
      cash.targetPercent += target.percent - stableTargetPercent;
      continue;
    }
    const members = rows.filter((row) => row.assetType === target.assetType
          && !explicit.has(keyOf(row.assetType, row.symbol))
          && !(cashTarget && row.assetType === "crypto" && stablecoins.has(row.symbol)));
    if (!members.length) {
      warnings.push({ kind: "empty-type", assetType: target.assetType });
      continue;
    }
    const groupValue = members.reduce((sum, member) => sum + member.value, 0);
    for (const member of members) {
      member.targetPercent += target.percent * (groupValue > 0 ? member.value / groupValue : 1 / members.length);
    }
  }
  const tolerance = options.tolerancePercent ?? 0;
  const pauseSells = rows.some((row) => row.amount > 0 && row.targetPercent > 0
    && (row.price <= 0 || !Number.isFinite(row.price)));
  if (pauseSells) warnings.push({ kind: "missing-price-target" });
  let sellCents = 0;
  const desiredBuys = new Map<RebalanceRow, number>();
  for (const row of rows) {
    row.deviationPercent = row.currentPercent - row.targetPercent;
    if (row.price <= 0 || !Number.isFinite(row.price)) {
      row.note = "missing-price";
      row.tradeQuantity = null;
      if (row.amount > 0) continue;
    }
    const cashMember = cashTarget && row.assetType === "crypto" && stablecoins.has(row.symbol)
      && !explicit.has(keyOf("crypto", row.symbol));
    if (cashMember && (options.mode === "buys" || stableSurplusCents === 0)) continue;
    if (row.amount > 0 && row.assetType && !explicit.has(keyOf(row.assetType, row.symbol))
      && row.value < ignoreBelowValue) {
      row.note = "below-threshold";
      continue;
    }
    const projectedDeviation = projectedTotal > 0
      ? row.value / projectedTotal * 100 - row.targetPercent
      : row.deviationPercent;
    if (Math.abs(projectedDeviation) <= tolerance) continue;
    const change = cashMember
      ? Math.max(-stableSurplusCents, Math.min(0, cents(projectedTotal * row.targetPercent / 100 - row.value)))
      : cents(projectedTotal * row.targetPercent / 100 - row.value);
    if (Math.abs(change) < cents(minimumTradeValue)) continue;
    if (change < 0 && options.mode !== "buys" && !pauseSells) {
      row.tradeValue = fromCents(change);
      sellCents -= change;
      if (cashMember) stableSurplusCents += change;
    } else if (change > 0) {
      desiredBuys.set(row, change);
    }
  }
  cash.targetPercent = cashTarget ? cash.targetPercent : 0;
  cash.deviationPercent = cash.currentPercent - cash.targetPercent;
  const available = cents(injectedCash) + sellCents;
  const cashFloor = cents(projectedTotal * cash.targetPercent / 100);
  let buyBudget = Math.max(0, available - cashFloor);
  let demand = Array.from(desiredBuys.values()).reduce((sum, value) => sum + value, 0);
  const minimumCents = cents(minimumTradeValue);
  for (const [row, wanted] of desiredBuys) {
    if (buyBudget <= 0 || demand <= 0) break;
    const allocation = Math.min(wanted, Math.round(buyBudget * wanted / demand));
    demand -= wanted;
    if (allocation >= minimumCents && allocation > 0) {
      row.tradeValue = fromCents(allocation);
      buyBudget -= allocation;
    }
  }
  for (const row of rows) {
    if (row.tradeQuantity !== null) {
      row.tradeQuantity = Math.round(row.tradeValue / row.price * 1e8) / 1e8;
    }
  }
  const spent = rows.reduce((sum, row) => sum + cents(row.tradeValue), 0);
  const reserve = cents(injectedCash) - spent;
  if (reserve !== 0 || cash.targetPercent > 0) {
    cash.tradeValue = fromCents(reserve);
    cash.tradeQuantity = cash.tradeValue;
    rows.push(cash);
  }
  return { rows, currentTotal, projectedTotal, warnings };
}

export function suggestionsToCsv(
  result: RebalanceResult,
  currency: string,
  t: (key: string) => string,
): string {
  const headers = [
    t("rebalance.symbol"), t("rebalance.current"), t("rebalance.target"),
    t("rebalance.deviation"), t("rebalance.action"), `${t("rebalance.value")} (${currency})`,
    t("rebalance.quantity"), t("rebalance.note"),
  ];
  const note = (kind: RebalanceRow["note"]) =>
    kind === "missing-price" ? t("rebalance.missingPrice") :
    kind === "below-threshold" ? t("rebalance.belowThreshold") : "";
  const escape = (value: string, text: boolean) => {
    const safe = text && /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = result.rows.map((row) => [
    escape(row.symbol, true),
    escape(row.currentPercent.toFixed(2), false),
    escape(row.targetPercent.toFixed(2), false),
    escape(row.deviationPercent.toFixed(2), false),
    escape(row.kind === "cash" ? t("rebalance.cashReserveAmount")
      .replace("{amount}", row.tradeValue.toFixed(2)).replace("{currency}", currency) :
      row.tradeValue > 0 ? t("rebalance.buy") :
      row.tradeValue < 0 ? t("rebalance.sell") : t("rebalance.noTrade"), true),
    escape(row.tradeValue.toFixed(2), false),
    escape(row.tradeQuantity?.toFixed(8) ?? "", false),
    escape(note(row.note), true),
  ].join(","));
  return redactSecrets("\uFEFF" + [headers.map((header) => escape(header, true)).join(","), ...lines].join("\r\n"));
}
