import type { AssetModel, TransactionModel } from "./types";
import type { AssetType } from "./datafetch/types";
import { fromStoredTransactions } from "./cost-basis";
import { calculateSnapshotProfit } from "./charts-interval-profit";

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

type Holding = { symbol: string; assetType: AssetType; wallet: string; amount: number; value: number; price: number };
const zero = (): AttributionAmounts => ({ priceEffect: 0, flowEffect: 0, residual: 0, totalChange: 0 });
const keyOf = (item: { symbol: string; assetType: AssetType; wallet: string }) =>
  JSON.stringify([item.assetType, item.symbol.trim().toUpperCase(), item.wallet]);

function holdings(snapshot: AttributionSnapshot, blacklist: Set<string>): Map<string, Holding> {
  const result = new Map<string, Holding>();
  for (const asset of snapshot.assets) {
    if (blacklist.has(asset.symbol.trim().toUpperCase())) continue;
    const identity = { assetType: asset.assetType ?? "crypto", symbol: asset.symbol.trim().toUpperCase(), wallet: asset.wallet ?? "" };
    const key = keyOf(identity);
    const current = result.get(key) ?? { ...identity, amount: 0, value: 0, price: 0 };
    current.amount += asset.amount;
    current.value += asset.value;
    if (asset.amount === 0 && Number.isFinite(asset.price) && asset.price > 0) {
      current.price = asset.price;
    }
    result.set(key, current);
  }
  return result;
}

/**
 * For each adjacent snapshot and wallet/asset: value change = known P&L + recorded
 * transaction value + residual. Known P&L uses opening quantity and each transaction's
 * own price. Unrecorded quantity changes remain in residual, and an unpaired withdrawal
 * removes only its coin's interval from known P&L.
 * Blacklisted symbols are excluded from both endpoint values and every component.
 * USD results are converted with the current base-currency rate by the caller; historical
 * FX moves are unavailable in these USD snapshots and are not presented as market profit.
 */
export function attributeSnapshots(
  snapshots: AttributionSnapshot[],
  blacklist: string[] = [],
  transferContext?: TransactionModel[],
): AttributionResult {
  const ordered = snapshots.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (ordered.length < 2) return { entries: [], totals: zero(), startValue: 0, endValue: 0 };
  const excluded = new Set(blacklist.map((symbol) => symbol.trim().toUpperCase()));
  const entries = new Map<string, AttributionEntry>();
  const transactions = transferContext ?? ordered.flatMap((snapshot) => snapshot.transactions.map((txn) => ({
    ...txn, txnCreatedAt: snapshot.createdAt,
  })));
  const storedById = new Map(transactions.map((txn) => [String(txn.id), txn]));
  const transferEvents = fromStoredTransactions(transactions);
  const pairedWithdrawals = new Set(transferEvents.filter((event) => event.type === "transfer-out")
    .map((event) => Number(event.id)));
  const outgoing = new Map(transferEvents.filter((event) =>
    event.type === "transfer-out" && event.transferId
  ).map((event) => [event.transferId!, event]));
  const transferMarketEffects = new Map<string, number>();
  for (const incoming of transferEvents.filter((event) =>
    event.type === "transfer-in" && event.transferId
  )) {
    const out = outgoing.get(incoming.transferId!);
    const storedIn = storedById.get(incoming.id);
    const storedOut = out && storedById.get(out.id);
    if (!out || !storedIn || !storedOut || storedIn.uuid === storedOut.uuid) continue;
    const key = `${storedIn.uuid}:${keyOf(storedIn)}`;
    transferMarketEffects.set(key, (transferMarketEffects.get(key) ?? 0) +
      incoming.amount * (incoming.price - out.price));
  }
  const first = holdings(ordered[0], excluded);
  let before = first;

  for (let index = 1; index < ordered.length; index++) {
    const after = holdings(ordered[index], excluded);
    const transactionQuantities = new Map<string, number>();
    const transactionValues = new Map<string, number>();
    const transactionHoldings = new Map<string, Holding>();
    const unknownCoins = new Set<string>();
    for (const txn of ordered[index].transactions) {
      if (excluded.has(txn.symbol.trim().toUpperCase())) continue;
      const key = keyOf({ assetType: txn.assetType ?? "crypto", symbol: txn.symbol, wallet: txn.wallet ?? "" });
      transactionHoldings.set(key, {
        symbol: txn.symbol.trim().toUpperCase(), assetType: txn.assetType ?? "crypto",
        wallet: txn.wallet ?? "", amount: 0, value: 0, price: 0,
      });
      const signed = (txn.txnType === "sell" || txn.txnType === "withdraw" ? -1 : 1) * txn.amount;
      transactionQuantities.set(key, (transactionQuantities.get(key) ?? 0) + signed);
      transactionValues.set(key, (transactionValues.get(key) ?? 0) + signed * txn.price);
      if (txn.txnType === "withdraw" && !pairedWithdrawals.has(txn.id)) {
        unknownCoins.add(JSON.stringify([txn.assetType ?? "crypto", txn.symbol.trim().toUpperCase()]));
      }
    }
    for (const key of new Set([...before.keys(), ...after.keys(), ...transactionQuantities.keys()])) {
      const old = before.get(key);
      const next = after.get(key);
      const q0 = old?.amount ?? 0;
      const q1 = next?.amount ?? 0;
      const v0 = old?.value ?? 0;
      const v1 = next?.value ?? 0;
      const p0 = q0 !== 0 ? v0 / q0 : q1 !== 0 ? v1 / q1 : 0;
      const p1 = q1 !== 0 ? v1 / q1 : next?.price || p0;
      const recordedQ = transactionQuantities.get(key) ?? 0;
      const recordedValue = transactionValues.get(key) ?? 0;
      const transferMarketEffect = transferMarketEffects.get(
        `${ordered[index].transactions[0]?.uuid}:${key}`,
      ) ?? 0;
      const identity = next ?? old ?? transactionHoldings.get(key)!;
      const unknown = unknownCoins.has(JSON.stringify([identity.assetType, identity.symbol]));
      const priceEffect = unknown ? 0 : q0 * (p1 - p0) + recordedQ * p1 - recordedValue + transferMarketEffect;
      const flowEffect = recordedValue - transferMarketEffect;
      const totalChange = v1 - v0;
      const residual = totalChange - priceEffect - flowEffect;
      const entry = entries.get(key) ?? { symbol: identity.symbol, assetType: identity.assetType, wallet: identity.wallet, ...zero() };
      entry.priceEffect += priceEffect;
      entry.flowEffect += flowEffect;
      entry.residual += residual;
      entry.totalChange += totalChange;
      entries.set(key, entry);
    }
    before = after;
  }

  // Coin and portfolio P&L use the same interval calculation as month and year cards.
  const included = (symbol: string) => !excluded.has(symbol.trim().toUpperCase());
  const profit = calculateSnapshotProfit(
    ordered.map((snapshot) => ({
      ...snapshot,
      assets: snapshot.assets.filter((asset) => included(asset.symbol)),
      transactions: snapshot.transactions.filter((txn) => included(txn.symbol)),
    })),
    { start: new Date(ordered[0].createdAt), end: new Date(ordered.at(-1)!.createdAt) },
    transactions.filter((txn) => included(txn.symbol)),
  );
  const coinKey = (item: { assetType: AssetType; symbol: string }) =>
    JSON.stringify([item.assetType, item.symbol.trim().toUpperCase()]);
  const expected = new Map(profit.coins.map((coin) => [coinKey(coin), coin.value ?? 0]));
  const actual = new Map<string, { value: number; wallets: AttributionEntry[] }>();
  for (const entry of entries.values()) {
    const key = coinKey(entry);
    const group = actual.get(key);
    actual.set(key, { value: (group?.value ?? 0) + entry.priceEffect, wallets: [...(group?.wallets ?? []), entry] });
  }
  for (const key of new Set([...expected.keys(), ...actual.keys()])) {
    const desired = expected.get(key) ?? 0;
    const group = actual.get(key);
    if (group) {
      const correction = desired - group.value;
      const weight = group.wallets.reduce((sum, wallet) => sum + Math.abs(wallet.priceEffect), 0);
      let remaining = correction;
      group.wallets.forEach((wallet, index) => {
        const share = index === group.wallets.length - 1 ? remaining
          : correction * (weight ? Math.abs(wallet.priceEffect) / weight : 1 / group.wallets.length);
        wallet.priceEffect += share;
        wallet.residual -= share;
        remaining -= share;
      });
    } else if (desired !== 0) {
      const coin = profit.coins.find((item) => coinKey(item) === key)!;
      const entry = {
        symbol: coin.symbol, assetType: coin.assetType, wallet: "",
        priceEffect: desired, flowEffect: 0, residual: -desired, totalChange: 0,
      };
      entries.set(keyOf(entry), entry);
    }
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
