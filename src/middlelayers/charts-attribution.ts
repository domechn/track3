import type { AssetModel, TransactionModel } from "./types";
import type { AssetType } from "./datafetch/types";

export type AttributionAmounts = { priceEffect: number; flowEffect: number; residual: number; totalChange: number };
export type AttributionEntry = AttributionAmounts & { symbol: string; assetType: AssetType; wallet: string };
export type AttributionResult = { entries: AttributionEntry[]; totals: AttributionAmounts; startValue: number; endValue: number };
export type AttributionGroup = AttributionAmounts & { key: string; label: string };
export type AttributionDimension = "coin" | "source" | "wallet" | "assetType";
export type WalletAlias = { alias: string; type: string };
export type AttributionSnapshot = {
  createdAt: string;
  assets: AssetModel[];
  transactions: TransactionModel[];
};

type Holding = { symbol: string; assetType: AssetType; wallet: string; amount: number; value: number };
const zero = (): AttributionAmounts => ({ priceEffect: 0, flowEffect: 0, residual: 0, totalChange: 0 });
const keyOf = (item: { symbol: string; assetType: AssetType; wallet: string }) =>
  JSON.stringify([item.assetType, item.symbol.trim().toUpperCase(), item.wallet]);

function holdings(snapshot: AttributionSnapshot, blacklist: Set<string>): Map<string, Holding> {
  const result = new Map<string, Holding>();
  for (const asset of snapshot.assets) {
    if (blacklist.has(asset.symbol.trim().toUpperCase())) continue;
    const identity = { assetType: asset.assetType ?? "crypto", symbol: asset.symbol.trim().toUpperCase(), wallet: asset.wallet ?? "" };
    const key = keyOf(identity);
    const current = result.get(key) ?? { ...identity, amount: 0, value: 0 };
    current.amount += asset.amount;
    current.value += asset.value;
    result.set(key, current);
  }
  return result;
}

/**
 * For each adjacent snapshot and wallet/asset: ΔV = q₀(p₁-p₀) + Δq_confirmed·p₁ + residual.
 * p is snapshot USD value / quantity. Transactions confirm observed signed quantity changes;
 * unmatched quantity and valuation errors remain residual. For a new asset p₀=p₁, and for
 * a disposal p₁=p₀, so the full change is flow when a matching transaction exists.
 * Each interval is summed, preserving the path and classifying stablecoin depegs as price.
 * Auto-recorded buy transactions for rewards and airdrops are quantity change, not market return.
 * Blacklisted symbols are excluded from both endpoint values and every component.
 * USD results are converted with the current base-currency rate by the caller; historical
 * FX moves are unavailable in these USD snapshots and are not presented as market profit.
 */
export function attributeSnapshots(snapshots: AttributionSnapshot[], blacklist: string[] = []): AttributionResult {
  const ordered = snapshots.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (ordered.length < 2) return { entries: [], totals: zero(), startValue: 0, endValue: 0 };
  const excluded = new Set(blacklist.map((symbol) => symbol.trim().toUpperCase()));
  const entries = new Map<string, AttributionEntry>();
  const first = holdings(ordered[0], excluded);
  let before = first;

  for (let index = 1; index < ordered.length; index++) {
    const after = holdings(ordered[index], excluded);
    const transactionQuantities = new Map<string, number>();
    for (const txn of ordered[index].transactions) {
      if (excluded.has(txn.symbol.trim().toUpperCase())) continue;
      const key = keyOf({ assetType: txn.assetType ?? "crypto", symbol: txn.symbol, wallet: txn.wallet ?? "" });
      const signed = (txn.txnType === "sell" || txn.txnType === "withdraw" ? -1 : 1) * txn.amount;
      transactionQuantities.set(key, (transactionQuantities.get(key) ?? 0) + signed);
    }
    for (const key of new Set([...before.keys(), ...after.keys()])) {
      const old = before.get(key);
      const next = after.get(key);
      const q0 = old?.amount ?? 0;
      const q1 = next?.amount ?? 0;
      const v0 = old?.value ?? 0;
      const v1 = next?.value ?? 0;
      const p0 = q0 !== 0 ? v0 / q0 : q1 !== 0 ? v1 / q1 : 0;
      const p1 = q1 !== 0 ? v1 / q1 : p0;
      const deltaQ = q1 - q0;
      const recordedQ = transactionQuantities.get(key) ?? 0;
      const confirmedQ = Math.sign(deltaQ) === Math.sign(recordedQ)
        ? Math.sign(deltaQ) * Math.min(Math.abs(deltaQ), Math.abs(recordedQ)) : 0;
      const priceEffect = q0 * (p1 - p0);
      const flowEffect = confirmedQ * p1;
      const totalChange = v1 - v0;
      const residual = totalChange - priceEffect - flowEffect;
      const identity = next ?? old!;
      const entry = entries.get(key) ?? { symbol: identity.symbol, assetType: identity.assetType, wallet: identity.wallet, ...zero() };
      entry.priceEffect += priceEffect;
      entry.flowEffect += flowEffect;
      entry.residual += residual;
      entry.totalChange += totalChange;
      entries.set(key, entry);
    }
    before = after;
  }

  const values = Array.from(entries.values());
  const totals = values.reduce((sum, entry) => ({
    priceEffect: sum.priceEffect + entry.priceEffect,
    flowEffect: sum.flowEffect + entry.flowEffect,
    residual: sum.residual + entry.residual,
    totalChange: sum.totalChange + entry.totalChange,
  }), zero());
  return {
    entries: values,
    totals,
    startValue: Array.from(first.values()).reduce((sum, item) => sum + item.value, 0),
    endValue: Array.from(before.values()).reduce((sum, item) => sum + item.value, 0),
  };
}

export function groupAttribution(entries: AttributionEntry[], dimension: AttributionDimension, aliases: Record<string, WalletAlias | undefined> = {}, stockLabel = "stock"): AttributionGroup[] {
  const groups = new Map<string, AttributionGroup>();
  for (const entry of entries) {
    const alias = aliases[entry.wallet];
    const [key, label] = dimension === "coin"
      ? [`${entry.assetType}:${entry.symbol}`, entry.assetType === "stock" ? `${entry.symbol} · ${stockLabel}` : entry.symbol]
      : dimension === "source"
        ? [alias?.type ?? "unknown", alias?.type ?? "unknown"]
        : dimension === "wallet"
          ? [entry.wallet, alias ? `${alias.alias} (${alias.type})` : "unknown"]
          : [entry.assetType, entry.assetType];
    const group = groups.get(key) ?? { key, label, ...zero() };
    group.priceEffect += entry.priceEffect;
    group.flowEffect += entry.flowEffect;
    group.residual += entry.residual;
    group.totalChange += entry.totalChange;
    groups.set(key, group);
  }
  return Array.from(groups.values()).sort((a, b) => Math.abs(b.totalChange) - Math.abs(a.totalChange) || a.label.localeCompare(b.label));
}
