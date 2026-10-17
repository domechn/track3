import type { AssetType } from "./datafetch/types";

export type CostBasisMethod = "FIFO" | "LIFO" | "HIFO" | "AVERAGE";
export type CostBasisEvent = {
  id: string;
  date: string;
  type: "buy" | "sell" | "airdrop" | "swap-in" | "swap-out" | "transfer-in" | "transfer-out" | "deposit" | "withdraw";
  assetType: AssetType;
  symbol: string;
  wallet: string;
  amount: number;
  price: number;
  fee?: number;
  transferId?: string;
  possibleTransfer?: boolean;
};
export type CostBasisLot = {
  id: string;
  assetType: AssetType;
  symbol: string;
  acquiredAt: string;
  amount: number;
  costBasis: number;
};
export type RealizedGain = {
  eventId: string;
  lotId: string;
  assetType: AssetType;
  symbol: string;
  acquiredAt: string;
  disposedAt: string;
  amount: number;
  proceeds: number;
  costBasis: number;
  gainLoss: number;
  term: "short" | "long";
  method: CostBasisMethod;
};
export type CostBasisWarning = {
  code: "missing-lots" | "invalid-event" | "unmatched-transfer" | "possible-transfer" | "unknown-basis" | "unknown-disposal";
  eventId: string;
  date: string;
  assetType: AssetType;
  symbol: string;
  amount: number;
};
export type CostBasisResult = {
  disposals: RealizedGain[];
  openLots: CostBasisLot[];
  unrealized: (CostBasisLot & {
    marketValue: number;
    gainLoss: number;
  })[];
  warnings: CostBasisWarning[];
};

function matchesTransferAmount(sent: number, received: number): boolean {
  return sent > 0 && received > 0 && received <= sent && received >= sent * 0.99;
}

function sortableTimestamp(date: string): number {
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

const lotOrders = new WeakMap<CostBasisLot, number>();

function lotBefore(a: CostBasisLot, b: CostBasisLot, method: CostBasisMethod): boolean {
  if (method === "HIFO") {
    const priceDifference = b.costBasis / b.amount - a.costBasis / a.amount;
    if (priceDifference !== 0) return priceDifference < 0;
  }
  const dateDifference = Date.parse(a.acquiredAt) - Date.parse(b.acquiredAt);
  if (dateDifference !== 0) return method === "LIFO" ? dateDifference > 0 : dateDifference < 0;
  return method === "LIFO" ? lotOrders.get(a)! > lotOrders.get(b)! : lotOrders.get(a)! < lotOrders.get(b)!;
}

function pushLot(heap: CostBasisLot[], lot: CostBasisLot, method: CostBasisMethod): void {
  let index = heap.length;
  heap.push(lot);
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (!lotBefore(heap[index], heap[parent], method)) break;
    [heap[index], heap[parent]] = [heap[parent], heap[index]];
    index = parent;
  }
}

function popLot(heap: CostBasisLot[], method: CostBasisMethod): CostBasisLot {
  const first = heap[0];
  const last = heap.pop()!;
  if (heap.length > 0) {
    heap[0] = last;
    let index = 0;
    while (index * 2 + 1 < heap.length) {
      const left = index * 2 + 1;
      const right = left + 1;
      const child = right < heap.length && lotBefore(heap[right], heap[left], method) ? right : left;
      if (!lotBefore(heap[child], heap[index], method)) break;
      [heap[index], heap[child]] = [heap[child], heap[index]];
      index = child;
    }
  }
  return first;
}

export function calculateCostBasis(
  events: readonly CostBasisEvent[],
  options: { method: CostBasisMethod; holdingPeriodDays?: number; prices?: Record<string, number> },
): CostBasisResult {
  const disposals: RealizedGain[] = [];
  const warnings: CostBasisWarning[] = [];
  const lots = new Map<string, { all: CostBasisLot[]; heap: CostBasisLot[]; averageAmount: number; averageCost: number }>();
  const originalAmounts = new WeakMap<CostBasisLot, number>();
  const ordered = events
    .map((value, index) => ({ value, index }))
    .sort((a, b) => (sortableTimestamp(a.value.date) - sortableTimestamp(b.value.date)) || a.index - b.index);
  const transfers = new Map<string, { inbound: CostBasisEvent[]; outbound: CostBasisEvent[] }>();
  for (const event of events) {
    if (!event.transferId) continue;
    const pair = transfers.get(event.transferId) ?? { inbound: [], outbound: [] };
    if (event.type === "transfer-in") pair.inbound.push(event);
    if (event.type === "transfer-out") pair.outbound.push(event);
    transfers.set(event.transferId, pair);
  }
  const validTransfers = new Map(
    [...transfers.entries()]
      .filter(([, pair]) =>
        pair.inbound.length === 1 && pair.outbound.length === 1 &&
        pair.inbound[0].assetType === pair.outbound[0].assetType &&
        pair.inbound[0].symbol.trim().toUpperCase() === pair.outbound[0].symbol.trim().toUpperCase() &&
        pair.inbound[0].wallet !== pair.outbound[0].wallet &&
        matchesTransferAmount(pair.outbound[0].amount, pair.inbound[0].amount),
      )
      .map(([id, pair]) => [id, pair.outbound[0].amount - pair.inbound[0].amount] as const),
  );

  for (const { value: event, index } of ordered) {
    const symbol = event.symbol.trim().toUpperCase();
    const warning = (code: CostBasisWarning["code"], amount = event.amount) =>
      warnings.push({ code, eventId: event.id, date: event.date, assetType: event.assetType, symbol, amount });
    if (
      !symbol || !Number.isFinite(Date.parse(event.date)) ||
      !Number.isFinite(event.amount) || event.amount <= 0 ||
      !Number.isFinite(event.price) || event.price < 0 ||
      !Number.isFinite(event.fee ?? 0) || (event.fee ?? 0) < 0
    ) {
      warning("invalid-event");
      continue;
    }
    const key = `${event.assetType}:${symbol}`;
    const assetLots = lots.get(key) ?? { all: [], heap: [], averageAmount: 0, averageCost: 0 };
    lots.set(key, assetLots);
    if (event.possibleTransfer && event.type === "sell") warning("possible-transfer");
    if (event.type === "transfer-in" || event.type === "transfer-out") {
      if (!event.transferId || !validTransfers.has(event.transferId)) {
        warning("unmatched-transfer");
        continue;
      }
      if (event.type === "transfer-in") continue;
    }
    if (event.type === "deposit") {
      warning("unknown-basis");
      continue;
    }
    if (event.type === "withdraw") {
      warning("unknown-disposal");
    }
    if (!["buy", "swap-in", "airdrop", "sell", "swap-out", "withdraw", "transfer-out"].includes(event.type)) {
      warning("invalid-event");
      continue;
    }
    if (event.type === "buy" || event.type === "swap-in" || event.type === "airdrop") {
      const costBasis = event.type === "airdrop" ? 0 : event.amount * event.price + (event.fee ?? 0);
      const lot = {
        id: event.id, assetType: event.assetType, symbol,
        acquiredAt: event.date, amount: event.amount, costBasis,
      };
      lotOrders.set(lot, index);
      originalAmounts.set(lot, event.amount);
      assetLots.all.push(lot);
      pushLot(assetLots.heap, lot, options.method);
      if (options.method === "AVERAGE") {
        assetLots.averageAmount += event.amount;
        assetLots.averageCost += costBasis;
      }
      continue;
    }
    const taxable = event.type === "sell" || event.type === "swap-out";
    let remaining = event.type === "transfer-out" ? validTransfers.get(event.transferId!)! : event.amount;
    let tolerance = event.amount * Number.EPSILON * 8;
    while (remaining > tolerance && assetLots.heap.length > 0) {
      const lot = popLot(assetLots.heap, options.method);
      tolerance = Math.max(tolerance, Math.max(event.amount, originalAmounts.get(lot)!) * 1e-12);
      const amount = Math.min(remaining, lot.amount);
      const costBasis = options.method === "AVERAGE"
        ? assetLots.averageCost * amount / assetLots.averageAmount
        : lot.costBasis * amount / lot.amount;
      if (taxable) {
        const proceeds = (event.amount * event.price - (event.fee ?? 0)) * amount / event.amount;
        const daysHeld = (Date.parse(event.date) - Date.parse(lot.acquiredAt)) / 86_400_000;
        disposals.push({
          eventId: event.id, lotId: lot.id, assetType: event.assetType, symbol,
          acquiredAt: lot.acquiredAt, disposedAt: event.date, amount,
          proceeds, costBasis, gainLoss: proceeds - costBasis,
          term: daysHeld > (options.holdingPeriodDays ?? 365) ? "long" : "short",
          method: options.method,
        });
      }
      lot.amount -= amount;
      lot.costBasis -= costBasis;
      if (options.method === "AVERAGE") {
        assetLots.averageAmount -= amount;
        assetLots.averageCost -= costBasis;
      }
      if (lot.amount <= originalAmounts.get(lot)! * 1e-12) lot.amount = 0;
      if (lot.amount > 0) pushLot(assetLots.heap, lot, options.method);
      remaining -= amount;
    }
    if (remaining > tolerance) warning("missing-lots", remaining);
  }
  const openLots: CostBasisLot[] = [];
  const unrealized: CostBasisResult["unrealized"] = [];
  for (const [key, pool] of lots) {
    const price = options.prices?.[key];
    for (const lot of pool.all) {
      if (lot.amount <= 0) continue;
      if (options.method === "AVERAGE") lot.costBasis = lot.amount * pool.averageCost / pool.averageAmount;
      openLots.push(lot);
      if (price === undefined || !Number.isFinite(price) || price < 0) continue;
      unrealized.push({
        ...lot, marketValue: lot.amount * price, gainLoss: lot.amount * price - lot.costBasis,
      });
    }
  }
  return { disposals, openLots, unrealized, warnings };
}

export function fromStoredTransactions(
  transactions: readonly {
    id: number; uuid: string; assetType: AssetType; symbol: string; wallet: string;
    amount: number; price: number; txnType: string; txnCreatedAt: string;
  }[],
): CostBasisEvent[] {
  const events: CostBasisEvent[] = transactions.map((transaction) => ({
    id: String(transaction.id),
    date: transaction.txnCreatedAt,
    type: transaction.txnType as CostBasisEvent["type"],
    assetType: transaction.assetType ?? "crypto",
    symbol: transaction.symbol,
    wallet: transaction.wallet,
    amount: transaction.amount,
    price: transaction.price,
  }));
  const byAsset = new Map<string, { event: CostBasisEvent; uuid: string }[]>();
  transactions.forEach((transaction, index) => {
    const key = `${transaction.assetType ?? "crypto"}:${transaction.symbol.trim().toUpperCase()}`;
    const group = byAsset.get(key) ?? [];
    group.push({ event: events[index], uuid: transaction.uuid });
    byAsset.set(key, group);
  });
  for (const assetEvents of byAsset.values()) {
    assetEvents.sort((a, b) => sortableTimestamp(a.event.date) - sortableTimestamp(b.event.date));
    const pendingWithdrawals: CostBasisEvent[] = [];
    for (const { event } of assetEvents) {
      if (event.type === "withdraw") pendingWithdrawals.push(event);
      if (event.type !== "deposit") continue;
      const index = pendingWithdrawals.findIndex((out) =>
        out.wallet !== event.wallet && matchesTransferAmount(out.amount, event.amount) &&
        Date.parse(event.date) - Date.parse(out.date) <= 7 * 86_400_000,
      );
      if (index < 0) continue;
      const out = pendingWithdrawals.splice(index, 1)[0];
      out.type = "transfer-out";
      event.type = "transfer-in";
      out.transferId = event.transferId = `${out.id}:${event.id}`;
    }

    const bySnapshot = new Map<string, CostBasisEvent[]>();
    for (const { event, uuid } of assetEvents) {
      const group = bySnapshot.get(uuid) ?? [];
      group.push(event);
      bySnapshot.set(uuid, group);
    }
    const snapshots = [...bySnapshot.values()];
    for (const [index, group] of snapshots.entries()) {
      for (const out of group.filter((event) => event.type === "sell")) {
        const opposite = group.filter((event) =>
          (event.type === "buy" || event.type === "transfer-in") && event.wallet !== out.wallet,
        );
        const incoming = opposite.find((event) =>
          event.type === "buy" && matchesTransferAmount(out.amount, event.amount),
        );
        if (incoming) {
          out.type = "transfer-out";
          incoming.type = "transfer-in";
          out.transferId = incoming.transferId = `${out.id}:${incoming.id}`;
        } else if (opposite.length > 0) {
          out.possibleTransfer = true;
        }
      }
      const next = snapshots[index + 1] ?? [];
      for (const out of group.filter((event) => event.type === "sell")) {
        if (next.some((incoming) =>
          incoming.type === "buy" && incoming.wallet !== out.wallet &&
          matchesTransferAmount(out.amount, incoming.amount),
        )) out.possibleTransfer = true;
      }
    }
  }
  return events;
}
