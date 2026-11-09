import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import md5 from "md5";
import type { Page } from "@playwright/test";
import { installTauriBridge as installBaseBridge } from "./tauri-bridge";

type Statement = [query: string, values: unknown[]];
type SeedDatabase = { run: (query: string, values?: unknown[]) => void };

type Source = { id: string; pos: Record<string, number> };
type Transaction = { id: string; d: string; time: string; sym: string; type: string; qty: number; price: number | null; src: string; edited?: boolean; imported?: string };
type FidelityData = {
  sources: Source[];
  prices: Record<string, number[]>;
  monthly: { ym: string; end: number; dep: number; pnl: number }[];
  monthlyMarket: Record<string, number>[];
  meta: Record<string, { type: string; amount: number }>;
  transactions: Transaction[];
  attribution: { symbol: string; start: number; quantity: number }[];
  ath: { value: number; date: string };
};

const data = JSON.parse(readFileSync(fileURLToPath(new URL("../../docs/ui/fidelity/desktop-data.json", import.meta.url)), "utf8")) as FidelityData;
const walletIdentities: Record<string, string> = {
  binance: "binance-fidelity-key",
  okx: "okex-fidelity-key",
  ledger: "bc1q-fidelity-ledger",
  onchain: "0x4fa91c",
  ibkr: "ibkr:fidelity-query",
};
const wallet = (source: string) => md5(walletIdentities[source]);

export function seedDesktopFidelity(db: SeedDatabase, state: "full" | "empty" | "nova" | "summary") {
  db.run("DELETE FROM assets_v2");
  db.run("DELETE FROM transactions");
  db.run("DELETE FROM alert_history");
  for (let index = 0; index < 2; index++) {
    db.run("INSERT INTO alert_history (kind, title, message, value, triggered_at) VALUES (?, ?, ?, ?, ?)",
      ["asset_price_target", "Fixture alert", "Fixture alert", index, "2026-10-31T09:41:00.000Z"]);
  }
  db.run("UPDATE configuration SET data = ? WHERE id = 11", [
    "btc:\n  addresses:\n    - address: bc1q-fidelity-ledger\n      alias: Ledger cold wallet\nerc20:\n  addresses:\n    - address: '0x4fa91c'\n      alias: 0x4f…a91c\nsol: {addresses: []}\ndoge: {addresses: []}\ntrc20: {addresses: []}\nton: {addresses: []}\nsui: {addresses: []}\n",
  ]);
  db.run("INSERT INTO configuration (id, data) VALUES (10, ?)", [
    "!ent:e2e:exchanges:\n  - name: binance\n    alias: Binance\n    initParams: {apiKey: fidelity-key, secret: fixture}\n  - name: okex\n    alias: OKX\n    initParams: {apiKey: fidelity-key, secret: fixture, password: fixture}\n",
  ]);
  db.run("INSERT INTO configuration (id, data) VALUES (20, ?)", [
    "!ent:e2e:brokers:\n  - name: ibkr\n    alias: Interactive Brokers\n    initParams: {token: fixture, queryId: fidelity-query}\n",
  ]);
  if (state === "nova") {
    db.run("UPDATE configuration SET data = ? WHERE id = 12", [
      "configs: {groupUSD: false}\nothers:\n  - symbol: NOVA\n    amount: 12000\n    price: {kind: manual, usd: 0.421, setAt: '2026-10-12T09:41:00.000Z'}\n",
    ]);
  }

  const addAsset = (uuid: string, at: string, source: string, symbol: string, amount: number, value: number) => {
    db.run(
      "INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [uuid, at, wallet(source), data.meta[symbol]?.type === "stock" ? "stock" : "crypto", symbol, amount, value, amount ? value / amount : 0],
    );
  };
  const addAggregate = (uuid: string, at: string, total: number, initial = false) => {
    let allocated = 0;
    const symbols = Object.keys(data.meta);
    for (const [index, symbol] of symbols.entries()) {
      const basis = initial
        ? data.attribution.find((row) => row.symbol === symbol)!.start / 310000
        : data.sources.reduce((sum, source) => sum + (source.pos[symbol] ?? 0) * data.prices[symbol][30], 0) / 763809.27;
      const value = index === symbols.length - 1 ? Math.round((total - allocated) * 100) / 100 : Math.round(total * basis * 100) / 100;
      allocated += value;
      addAsset(uuid, at, data.sources.find((source) => source.pos[symbol])!.id, symbol, data.meta[symbol].amount, value);
    }
  };
  if (state === "summary") {
    const startValues = Object.fromEntries(data.attribution.map((row) => [row.symbol, row.start]));
    const months = data.monthly;
    let deposits = 0;
    const market = Object.fromEntries(Object.keys(data.meta).map((symbol) => [symbol, 0]));
    const values = months.map((month, index) => {
      deposits += month.dep;
      for (const [symbol, change] of Object.entries(data.monthlyMarket[index])) market[symbol] += change;
      return Object.fromEntries(data.attribution.map((row) => [row.symbol,
        row.start + row.quantity * deposits / 265000 + market[row.symbol]]));
    });
    const amounts = months.map(() => ({} as Record<string, number>));
    const initialAmounts: Record<string, number> = {};
    for (const row of data.attribution) {
      let after = data.meta[row.symbol].amount;
      for (let index = months.length - 1; index >= 0; index--) {
        amounts[index][row.symbol] = after;
        const flow = row.quantity * months[index].dep / 265000;
        after *= 1 - flow / values[index][row.symbol];
      }
      initialAmounts[row.symbol] = after;
    }
    const addSummary = (uuid: string, at: string, valuesBySymbol: Record<string, number>, amountsBySymbol: Record<string, number>) => {
      for (const symbol of Object.keys(data.meta)) {
        for (const source of data.sources) {
          const sourceAmount = source.pos[symbol] ?? 0;
          if (!sourceAmount) continue;
          const share = sourceAmount / data.meta[symbol].amount;
          addAsset(uuid, at, source.id, symbol, amountsBySymbol[symbol] * share, valuesBySymbol[symbol] * share);
        }
      }
    };
    addSummary("fidelity-start", "2025-07-01T09:41:00.000Z", startValues, initialAmounts);
    for (const [index, month] of months.entries()) {
      const at = new Date(Date.UTC(Number(month.ym.slice(0, 4)), Number(month.ym.slice(5)), 0, 9, 41)).toISOString();
      const uuid = `fidelity-${month.ym}`;
      addSummary(uuid, at, values[index], amounts[index]);
      if (!month.dep) continue;
      for (const row of data.attribution) {
        const symbol = row.symbol;
        const before = index === 0 ? initialAmounts[symbol] : amounts[index - 1][symbol];
        const delta = amounts[index][symbol] - before;
        if (delta <= 0) continue;
        const price = values[index][symbol] / amounts[index][symbol];
        for (const source of data.sources) {
          const sourceAmount = source.pos[symbol] ?? 0;
          if (!sourceAmount) continue;
          const share = sourceAmount / data.meta[symbol].amount;
          db.run(
            "INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt) SELECT ?, id, ?, ?, ?, ?, ?, ?, ? FROM assets_v2 WHERE uuid = ? AND symbol = ? AND wallet = ? LIMIT 1",
            [uuid, data.meta[symbol].type === "stock" ? "stock" : "crypto", wallet(source.id), symbol, delta * share, price, "deposit", at, uuid, symbol, wallet(source.id)],
          );
        }
      }
    }
    const special = (uuid: string, at: string, total: number, priorIndex: number) => {
      const prior = values[priorIndex], priorTotal = Object.values(prior).reduce((sum, value) => sum + value, 0);
      addSummary(uuid, at, Object.fromEntries(Object.entries(prior).map(([symbol, value]) => [symbol, value * total / priorTotal])), amounts[priorIndex]);
    };
    special("fidelity-ath", "2026-03-19T09:41:00.000Z", data.ath.value, 7);
    special("fidelity-previous-high", "2026-01-27T09:41:00.000Z", 668200, 5);
    special("fidelity-low-since-ath", "2026-04-22T09:41:00.000Z", 681300, 8);
    return;
  }
  if (state === "full") {
    addAggregate("fidelity-start", "2025-07-01T09:41:00.000Z", 310000, true);
    for (const month of data.monthly) {
      if (month.ym === "2026-10") continue;
      const at = new Date(Date.UTC(Number(month.ym.slice(0, 4)), Number(month.ym.slice(5)), 0, 9, 41)).toISOString();
      addAggregate(`fidelity-${month.ym}`, at, month.end);
    }
    addAggregate("fidelity-ath", "2026-03-19T09:41:00.000Z", data.ath.value);
    addAggregate("fidelity-previous-high", "2026-01-27T09:41:00.000Z", 668200);
    addAggregate("fidelity-low-since-ath", "2026-04-22T09:41:00.000Z", 681300);
  }
  for (let day = state === "full" ? 0 : 30; day <= 30; day++) {
    const at = new Date(Date.UTC(2026, 9, day + 1, 9, 41)).toISOString();
    for (const source of data.sources) for (const [symbol, amount] of Object.entries(source.pos)) {
      addAsset(`fidelity-oct-${day + 1}`, at, source.id, symbol, amount, Math.round(amount * data.prices[symbol][day] * 100) / 100);
    }
  }
  if (state === "nova") {
    addAsset("fidelity-oct-31", "2026-10-31T09:41:00.000Z", "onchain", "NOVA", 12000, 5052);
  }
  if (state === "empty") return;

  for (const txn of data.transactions.filter((row) => state === "nova" ? row.sym === "NOVA" : row.sym !== "NOVA")) {
    const source = txn.src;
    db.run(
      "INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt) SELECT ?, id, ?, ?, ?, ?, ?, ?, ? FROM assets_v2 WHERE symbol = ? AND wallet = ? ORDER BY createdAt DESC LIMIT 1",
      [`fidelity-${txn.id}`, data.meta[txn.sym]?.type === "stock" ? "stock" : "crypto",
        wallet(source), txn.sym, txn.qty, txn.price ?? 0, txn.type,
        `${txn.d}T${txn.time}:00.000Z`, txn.sym, wallet(source)],
    );
  }
}

type FidelityOptions = {
  fidelityDesktop?: "full" | "empty" | "nova" | "summary";
  slowFidelity?: boolean;
  customPriceFixture?: boolean | "invalid";
};

export async function installTauriBridge(page: Page, options: FidelityOptions = {}) {
  const bridge = await installBaseBridge(page, { customPriceFixture: Boolean(options.customPriceFixture) });
  const statements: Statement[] = [];
  if (options.fidelityDesktop) {
    seedDesktopFidelity({ run: (query, values = []) => { statements.push([query, values]); } }, options.fidelityDesktop);
  }
  if (options.customPriceFixture === "invalid") {
    statements.push([
      "UPDATE configuration SET data = REPLACE(data, 'usd: 0.42', 'usd: -0.42') WHERE id = 12",
      [],
    ]);
  }
  await page.evaluate(async (operations) => {
    for (const [query, values] of operations) {
      await (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
    }
  }, statements);

  await page.addInitScript((slow) => {
    const tauri = (window as any).__TAURI_INTERNALS__;
    const base = tauri.invoke;
    tauri.invoke = async (cmd: string, args: { query?: string }, invokeOptions: unknown) => {
      if (slow && cmd === "plugin:sql|select" && /WITH snapshots AS/i.test(args.query ?? "")) {
        await new Promise(() => {});
      }
      const fail = (window as any).__fidelityFailNextTransactionEdit;
      if (fail && cmd === `update_local_transaction_${fail}`) {
        (window as any).__fidelityFailNextTransactionEdit = undefined;
        throw new Error("Simulated transaction update failure");
      }
      return base(cmd, args, invokeOptions);
    };
  }, options.slowFidelity ?? false);

  return {
    ...bridge,
    failNextTransactionEdit: (field: "price" | "type") =>
      page.evaluate((next) => { (window as any).__fidelityFailNextTransactionEdit = next; }, field),
    transactionValues: (symbol: string) => page.evaluate(
      (value) => (window as any).__e2eInvoke("plugin:sql|select", {
        query: "SELECT price, txnType FROM transactions WHERE symbol = ? ORDER BY txnCreatedAt DESC",
        values: [value],
      }) as Promise<Array<{ price: number; txnType: string }>>,
      symbol,
    ),
    keepTwoOctoberSnapshots: () => page.evaluate(() => (window as any).__e2eInvoke("plugin:sql|execute", {
      query: "DELETE FROM assets_v2 WHERE uuid NOT IN ('fidelity-oct-30', 'fidelity-oct-31')",
      values: [],
    })),
  };
}
