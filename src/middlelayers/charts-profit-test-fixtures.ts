// In-memory emulation of the assets_v2 / transactions SQL used by calculateTotalProfit.
// Snapshots are turned into transactions by the REAL generateTransactions() from charts-refresh.
import type { AssetModel, TransactionModel, WalletCoinUSD } from "@/middlelayers/types";
import type { generateTransactions } from "./charts-refresh";

export type Holding = { wallet: string; symbol: string; amount: number; price: number };
export type Snap = { at: string; holdings: Holding[] };

export const db = { assets: [] as AssetModel[], txns: [] as TransactionModel[] };

export function reset() {
  db.assets = [];
  db.txns = [];
  nextId = 1;
}

let nextId = 1;

export function load(
  snaps: Snap[],
  genTx: typeof generateTransactions,
  overrides: (t: TransactionModel) => void = () => {},
) {
  reset();
  let before: AssetModel[] = [];
  snaps.forEach((s, i) => {
    const uuid = `u${i}`;
    const after: WalletCoinUSD[] = s.holdings.map((h) => ({
      assetType: "crypto" as const,
      wallet: `md5:${h.wallet}`,
      symbol: h.symbol,
      amount: h.amount,
      price: h.price,
      usdValue: h.amount * h.price,
    }));
    const drafts = genTx(uuid, s.at, before, after);
    // mirrors generateRefreshAssets(): current assets + 0-amount rows for removed positions
    const afterIds = new Set(after.map((a) => `${a.wallet.slice(4)}:${a.symbol}`));
    const rows: AssetModel[] = [
      ...after.map((a) => ({
        id: nextId++, uuid, createdAt: s.at, assetType: "crypto" as const,
        symbol: a.symbol, amount: a.amount, value: a.usdValue, price: a.price, wallet: a.wallet.slice(4),
      })),
      ...drafts
        .filter((d) => d.txnType === "sell" && !afterIds.has(`${d.wallet}:${d.symbol}`))
        .map((d) => ({
          id: nextId++, uuid, createdAt: s.at, assetType: "crypto" as const,
          symbol: d.symbol, amount: 0, value: 0, price: d.price, wallet: d.wallet,
        })),
    ];
    db.assets.push(...rows);
    for (const d of drafts) {
      const asset = rows.find((r) => r.wallet === d.wallet && r.symbol === d.symbol)!;
      const t: TransactionModel = { ...d, id: nextId++, assetID: asset.id };
      overrides(t);
      db.txns.push(t);
    }
    before = rows;
  });
}

const inRange = (at: string, start?: Date, end?: Date) =>
  (!start || at >= start.toISOString()) && (!end || at <= end.toISOString());

function perSymbolExtreme(pick: "max" | "min", start?: Date, end?: Date, symbol?: string) {
  const rows = db.assets.filter((a) => inRange(a.createdAt, start, end) && (!symbol || a.symbol === symbol));
  const best = new Map<string, AssetModel>();
  for (const r of rows) {
    const k = `${r.assetType}:${r.symbol}`;
    const cur = best.get(k);
    if (!cur || (pick === "max" ? r.createdAt > cur.createdAt : r.createdAt < cur.createdAt)) best.set(k, r);
  }
  // SQL joins back on (uuid, asset_type, symbol): every wallet row of that snapshot
  return [...best.values()].flatMap((b) =>
    db.assets.filter((a) => a.uuid === b.uuid && a.symbol === b.symbol && a.assetType === b.assetType));
}

export const assetHandler = {
  listAssetsMaxCreatedAt: async (s?: Date, e?: Date, sym?: string) => perSymbolExtreme("max", s, e, sym),
  listAssetsMinCreatedAt: async (s?: Date, e?: Date, sym?: string) => perSymbolExtreme("min", s, e, sym),
};

export const txnHandler = {
  listTransactionsByDateRange: async (s: Date, e: Date, sym?: string) => {
    const rows = db.txns.filter((t) => inRange(t.txnCreatedAt, s, e) && (!sym || t.symbol === sym));
    const byUuid = new Map<string, TransactionModel[]>();
    rows.forEach((t) => byUuid.set(t.uuid, [...(byUuid.get(t.uuid) ?? []), t]));
    return [...byUuid.values()];
  },
};

