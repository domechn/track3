import type { AssetModel, TDateRange, TransactionModel } from "./types";
import type { AssetType } from "./datafetch/types";
import { getAssetIdentity, getAssetType } from "./datafetch/utils/coins";
import { fromStoredTransactions } from "./cost-basis";

export type ProfitSnapshot = {
  createdAt: string;
  assets: AssetModel[];
  transactions: TransactionModel[];
};

type Coin = {
  symbol: string;
  assetType: AssetType;
  value: number;
  percentage?: number | null;
  buyAmount: number;
  sellAmount: number;
  costAvgPrice: number;
  sellAvgPrice: number;
  unrecordedChange: number;
  cost: number;
  buyCost: number;
  sellValue: number;
  openingAmount: number;
};

type Position = { symbol: string; assetType: AssetType; amount: number; value: number; zeroPrice: number };
const identity = getAssetIdentity;

function positions(assets: AssetModel[]): Map<string, Position> {
  const result = new Map<string, Position>();
  for (const asset of assets) {
    const key = identity(asset);
    const value = result.get(key) ?? { symbol: asset.symbol, assetType: getAssetType(asset), amount: 0, value: 0, zeroPrice: 0 };
    value.amount += asset.amount;
    value.value += asset.value;
    if (asset.amount === 0 && asset.price > 0) value.zeroPrice = asset.price;
    result.set(key, value);
  }
  return result;
}

export function calculateSnapshotProfit(
  snapshots: ProfitSnapshot[],
  range: TDateRange,
  transferContext: TransactionModel[] = snapshots.flatMap((snapshot) => snapshot.transactions),
) {
  const ordered = snapshots.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const transferEvents = fromStoredTransactions(transferContext.map((txn) => ({
    ...txn, assetType: getAssetType(txn),
  })));
  const paired = new Set(transferEvents.filter((event) =>
    event.type === "transfer-in" || event.type === "transfer-out").map((event) => Number(event.id)));
  const outgoing = new Map(transferEvents.filter((event) =>
    event.type === "transfer-out" && event.transferId).map((event) => [event.transferId!, event]));
  const byTransactionId = new Map(transferContext.map((txn) => [String(txn.id), txn]));
  const transferMarketEffects = new Map<number, number>();
  for (const incoming of transferEvents.filter((event) => event.type === "transfer-in" && event.transferId)) {
    const out = outgoing.get(incoming.transferId!);
    const bought = byTransactionId.get(incoming.id);
    const sold = out && byTransactionId.get(out.id);
    if (out && bought && sold && bought.uuid !== sold.uuid) {
      transferMarketEffects.set(Number(incoming.id), incoming.amount * (incoming.price - out.price));
    }
  }
  const coins = new Map<string, Coin>();
  const unknown = new Map<string, { symbol: string; assetType: AssetType; intervals: string[]; months: number }>();
  const unknownMonths = new Map<string, Set<string>>();
  let before = new Map<string, Position>();
  let hasPrior = false;
  let hasInterval = false;
  let lastRecordDate: Date | undefined;
  let deposits = 0;
  let trades = 0;
  let transfersIn = 0;
  for (const snapshot of ordered) {
    const time = new Date(snapshot.createdAt).getTime();
    const after = positions(snapshot.assets);
    if (time < range.start.getTime()) {
      before = after;
      hasPrior = true;
      continue;
    }
    if (time > range.end.getTime()) break;
    hasInterval ||= hasPrior;
    lastRecordDate = new Date(snapshot.createdAt);
    const txns = new Map<string, TransactionModel[]>();
    for (const txn of snapshot.transactions) {
      const key = identity(txn);
      txns.set(key, [...(txns.get(key) ?? []), txn]);
    }
    for (const key of new Set([...before.keys(), ...after.keys(), ...txns.keys()])) {
      const old = before.get(key);
      const next = after.get(key);
      const transactions = txns.get(key) ?? [];
      const source = next ?? old ?? transactions[0];
      if (!source) continue;
      const q0 = old?.amount ?? 0;
      const q1 = next?.amount ?? 0;
      if (q0 === 0 && q1 === 0 && transactions.length === 0) continue;
      const p0 = q0 ? (old?.value ?? 0) / q0 : 0;
      const disposalPrice = transactions.find((txn) => txn.txnType === "sell" || txn.txnType === "withdraw")?.price;
      const p1 = q1 ? (next?.value ?? 0) / q1 : (next?.zeroPrice || disposalPrice || p0);
      const openingPrice = q0 ? p0 : p1;
      const coin = coins.get(key) ?? {
        symbol: source.symbol, assetType: getAssetType(source), value: 0,
        buyAmount: hasPrior ? q0 : 0, sellAmount: 0,
        costAvgPrice: 0, sellAvgPrice: 0, unrecordedChange: 0,
        cost: hasPrior ? (old?.value ?? 0) : 0, buyCost: 0, sellValue: 0, openingAmount: 0,
      };
      let signedQuantity = 0;
      let execution = 0;
      for (const txn of transactions) {
        const signed = (txn.txnType === "sell" || txn.txnType === "withdraw" ? -1 : 1) * txn.amount;
        signedQuantity += signed;
        execution += signed * (p1 - txn.price);
        execution += transferMarketEffects.get(txn.id) ?? 0;
        if (!paired.has(txn.id) && (txn.txnType === "buy" || txn.txnType === "deposit")) {
          coin.buyAmount += txn.amount;
          coin.cost += txn.amount * txn.price;
          coin.buyCost += txn.amount * txn.price;
        }
        if (!paired.has(txn.id) && txn.txnType === "sell") {
          coin.sellAmount += txn.amount;
          coin.sellValue += txn.amount * txn.price;
        }
        if (!paired.has(txn.id)) {
          if (txn.txnType === "buy" || txn.txnType === "deposit") deposits += txn.amount * txn.price;
          if (txn.txnType === "buy" || txn.txnType === "sell") trades += signed * txn.price;
          if (txn.txnType === "deposit") transfersIn += txn.amount * txn.price;
        }
      }
      if (!hasPrior) {
        const openingQuantity = Math.max(0, q1 - Math.max(0, signedQuantity));
        coin.buyAmount += openingQuantity;
        coin.cost += openingQuantity * p1;
        coin.openingAmount += openingQuantity;
      }
      const residualQuantity = q0 === 0 && q1 === 0 ? 0 : q1 - q0 - signedQuantity;
      if (hasPrior && Math.abs(residualQuantity) > 1e-12 * Math.max(1, Math.abs(q0), Math.abs(q1), Math.abs(signedQuantity))) {
        coin.unrecordedChange += residualQuantity * p1;
      }
      const unpairedWithdrawal = transactions.some((txn) => txn.txnType === "withdraw" && !paired.has(txn.id));
      if (unpairedWithdrawal) {
        const affected = unknown.get(key) ?? { symbol: source.symbol, assetType: getAssetType(source), intervals: [], months: 0 };
        affected.intervals.push(snapshot.createdAt);
        const month = `${new Date(snapshot.createdAt).getFullYear()}-${new Date(snapshot.createdAt).getMonth()}`;
        const months = unknownMonths.get(key) ?? new Set<string>();
        months.add(month);
        unknownMonths.set(key, months);
        affected.months = months.size;
        unknown.set(key, affected);
      } else {
        coin.value += q0 * (p1 - openingPrice) + execution;
      }
      coins.set(key, coin);
    }
    before = after;
    hasPrior = true;
  }
  const values = [...coins.values()].filter((coin) => coin.buyAmount > coin.openingAmount || coin.sellAmount || coin.value || coin.unrecordedChange || (hasInterval && coin.openingAmount));
  for (const coin of values) {
    coin.costAvgPrice = coin.buyAmount ? coin.cost / coin.buyAmount : 0;
    coin.sellAvgPrice = coin.sellAmount ? coin.sellValue / coin.sellAmount : 0;
    coin.percentage = unknown.has(identity(coin)) ? null
      : coin.cost ? coin.value / coin.cost * 100 : coin.value ? undefined : 0;
  }
  const knownTotal = values.length || unknown.size ? values.reduce((sum, coin) => sum + coin.value, 0) : null;
  const total = unknown.size ? null : knownTotal ?? 0;
  const cost = values.reduce((sum, coin) => sum + coin.cost, 0);
  return {
    total,
    knownTotal,
    unknownCoins: [...unknown.values()],
    unrecordedChange: values.reduce((sum, coin) => sum + coin.unrecordedChange, 0),
    deposits,
    trades,
    transfersIn,
    percentage: total === null ? null : cost ? total / cost * 100 : total ? undefined : 0,
    coins: values.map(({ cost: realSpentValue, buyCost: _buyCost, sellValue: _sellValue, openingAmount: _openingAmount, ...coin }) =>
      ({ ...coin, ...(unknown.has(identity(coin)) ? { isUnknown: true as const } : {}), realSpentValue })),
    lastRecordDate,
  };
}
