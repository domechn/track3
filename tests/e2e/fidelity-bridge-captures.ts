import type { Page } from "@playwright/test";
import { installTauriBridge as installBaseBridge } from "./tauri-bridge";
import { fidelityRecordsFixture } from "./fidelity-records-captures";

type RecordsFixture = "history" | "history-large" | "history-single" | "history-empty" | "cost";
type FidelityOptions = {
  fidelityRecords: RecordsFixture;
  seedLockedSync?: boolean;
  slowFidelityHistory?: boolean;
  failFidelityEditLog?: boolean;
  failFidelityHistoryList?: boolean;
};
type Statement = { query: string; values?: (string | number | null)[] };

function insertRows(table: string, columns: string[], rows: (string | number | null)[][]): Statement[] {
  const size = Math.floor(900 / columns.length);
  const statements: Statement[] = [];
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    statements.push({
      query: `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${chunk.map(() => `(${columns.map(() => "?").join(",")})`).join(",")}`,
      values: chunk.flat(),
    });
  }
  return statements;
}

function fixtureStatements(mode: RecordsFixture): Statement[] {
  const fixture = fidelityRecordsFixture;
  const statements: Statement[] = [
    { query: `INSERT INTO alert_history (kind, title, message, value, triggered_at)
      VALUES ('total_value_target', 'Portfolio target', 'Target reached', 763809.27, '2026-10-31T09:41:00.000Z'),
        ('total_value_target', 'Portfolio target', 'Target reached', 762276.11, '2026-10-30T08:53:00.000Z')` },
    { query: "DELETE FROM transactions" }, { query: "DELETE FROM assets_v2" },
  ];
  if (mode === "cost") {
    statements.push(...insertRows("assets_v2", ["uuid", "createdAt", "wallet", "asset_type", "symbol", "amount", "value", "price"],
      fixture.cost.holdings.map((holding) => ["fidelity-latest", "2026-10-31T09:41:00.000Z", "fidelity-holding",
        holding.type === "stable" ? "crypto" : holding.type, holding.symbol, holding.amount, holding.value, holding.price])));
    statements.push(...insertRows("transactions", ["uuid", "assetID", "asset_type", "wallet", "symbol", "amount", "price", "txnType", "txnCreatedAt"],
      fixture.cost.transactions.map((transaction) => [`fidelity-${transaction.id}`, 1,
        fixture.cost.holdings.find((holding) => holding.symbol === transaction.symbol)?.type === "stock" ? "stock" : "crypto",
        transaction.source, transaction.symbol, transaction.amount, transaction.price ?? 0, transaction.type,
        `${transaction.date}T${transaction.time}:00.000Z`])));
    statements.push({ query: "INSERT INTO configuration (id, data) VALUES (6, '50')" });
  } else if (mode === "history-single") {
    statements.push({ query: `INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
      VALUES ('fidelity-only', '2026-10-31T09:41:00.000Z', 'Wallet', 'crypto', 'BTC', 1, 50000, 50000)` });
  } else if (mode === "history" || mode === "history-large") {
    const holdings = fixture.cost.holdings;
    const sourceAssets = fixture.history.sources.flatMap((source) =>
      Object.entries(source.pos).map(([symbol, amount]) => ({ source: source.name, symbol, amount })));
    const assets: (string | number | null)[][] = [];
    let detailUuid = "";
    for (const [index, row] of fixture.history.rows.entries()) {
      const match = row.date.match(/^(\d+) Oct (\d{2}:\d{2})/);
      if (!match) throw new Error(`Invalid fidelity history date: ${row.date}`);
      const day = Number(match[1]);
      const uuid = `fidelity-oct-${String(50 - index).padStart(2, "0")}`;
      const createdAt = `2026-10-${String(day).padStart(2, "0")}T${match[2]}:00.000Z`;
      const detailed = day === 28 && match[2] === "08:51";
      const undoDetail = day === 28 && match[2] === "21:46";
      if (detailed) detailUuid = uuid;
      const designDetail = detailed ? fixture.history.detail : undoDetail ? fixture.history.undoDetail : null;
      let used = 0;
      for (const [assetIndex, asset] of sourceAssets.entries()) {
        const holding = holdings.find((item) => item.symbol === asset.symbol)!;
        const detail = designDetail?.find((item) => item.symbol === asset.symbol);
        const amount = detail ? asset.amount * detail.amount / holding.amount : asset.amount;
        const value = assetIndex === sourceAssets.length - 1 ? Math.round((row.total - used) * 100) / 100
          : detail ? Math.round(detail.value * asset.amount / holding.amount * 100) / 100
            : Math.round(row.total * holding.value / 763809.27 * asset.amount / holding.amount * 100) / 100;
        used += value;
        assets.push([uuid, createdAt, asset.source, holding.type === "stable" ? "crypto" : holding.type,
          asset.symbol, amount, value, detail ? detail.price : value / amount]);
      }
    }
    if (mode === "history-large") {
      for (let index = 0; index < 60; index++) assets.push(["fidelity-oct-45", "2026-10-28T08:51:00.000Z", "extra source", "crypto",
        `EXTRA${String(index).padStart(2, "0")}`, 1, 1, 1]);
    }
    for (let index = 0; index < 1234; index++) {
      const createdAt = new Date(Date.UTC(2026, 8, 30) - index * 86_400_000).toISOString();
      assets.push([`fidelity-old-${String(index).padStart(4, "0")}`, createdAt, "BTC", "crypto", "BTC", 1, 700000, 700000]);
    }
    statements.push(...insertRows("assets_v2", ["uuid", "createdAt", "wallet", "asset_type", "symbol", "amount", "value", "price"], assets));
    statements.push({ query: `INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
      VALUES (?, (SELECT id FROM assets_v2 WHERE uuid = ? AND symbol = 'AAPL' LIMIT 1), 'stock',
        'Interactive Brokers', 'AAPL', 150, 238, 'buy', '2026-10-28T08:51:00.000Z')`, values: [detailUuid, detailUuid] });
    statements.push({ query: `INSERT INTO snapshot_edit_log
      (snapshot_uuid, edited_at, origin, target, action, asset_type, symbol, wallet, old_value, new_value)
      VALUES (?, '2026-10-28T11:20:00.000Z', 'local', 'asset', 'restore', 'crypto', 'USDC', 'OKX', NULL,
        '{"amount":39850,"value":39853.99,"price":1.0001}')`, values: [detailUuid] });
    statements.push({ query: `INSERT INTO snapshot_edit_log
      (snapshot_uuid, edited_at, origin, target, action, asset_type, symbol, wallet, old_value, new_value)
      VALUES (?, '2026-10-28T11:20:00.000Z', 'local', 'transaction', 'price', 'stock', 'AAPL',
        'Interactive Brokers', '236.31', '238.00')`, values: [detailUuid] });
    for (const [date, missing] of [
      ["22 Oct 21:37", [{ wallet: "0x4f…a91c", kind: "wallet", provider: "Ethereum", category: "network" }]],
      ["5 Oct 18:53", [{ wallet: "Interactive Brokers", kind: "cex", provider: "Interactive Brokers", category: "network" }]],
    ] as const) {
      const index = fixture.history.rows.findIndex((row) => row.date.startsWith(date));
      if (index < 0) throw new Error(`Missing partial snapshot fixture: ${date}`);
      const uuid = `fidelity-oct-${String(50 - index).padStart(2, "0")}`;
      statements.push({ query: `INSERT INTO snapshot_partial (uuid, sources_total, missing, fill, created_at)
        VALUES (?, 5, ?, 'last_known', ?)`, values: [uuid, JSON.stringify(missing), `2026-10-${date.slice(0, 2)}T${date.slice(7)}:00.000Z`] });
    }
    statements.push({ query: "INSERT INTO configuration (id, data) VALUES (6, '50')" });
  }
  return statements;
}

export async function installTauriBridge(page: Page, options: FidelityOptions) {
  const { fidelityRecords, seedLockedSync = false, slowFidelityHistory = false,
    failFidelityEditLog = false, failFidelityHistoryList = false } = options;
  await installBaseBridge(page, { seedLockedSync });
  if (slowFidelityHistory || failFidelityEditLog || failFidelityHistoryList) {
    await page.addInitScript(({ slow, failEdits, failList }) => {
      let internals = (window as any).__TAURI_INTERNALS__;
      const wrap = (value: typeof internals) => {
        const invoke = value.invoke;
        let historyQueries = 0;
        value.invoke = async (command: string, args: { query?: string }, invokeOptions: unknown) => {
          if (command === "plugin:sql|select") {
            if (failEdits && /SELECT id, edited_at, origin, target/.test(args.query ?? "")) throw new Error("Edit log unavailable");
            if (failList && /WITH page AS/.test(args.query ?? "")) throw new Error("History unavailable");
            if (slow && /WITH page AS/.test(args.query ?? "") && historyQueries++ > 0)
              await new Promise((resolve) => setTimeout(resolve, 3000));
          }
          return invoke(command, args, invokeOptions);
        };
      };
      if (internals) wrap(internals);
      else Object.defineProperty(window, "__TAURI_INTERNALS__", {
        configurable: true, get: () => internals,
        set: (value) => { internals = value; wrap(value); },
      });
    }, { slow: slowFidelityHistory, failEdits: failFidelityEditLog, failList: failFidelityHistoryList });
  }
  await page.goto("/");
  const statements = fixtureStatements(fidelityRecords);
  await page.evaluate(async (queries) => {
    const invoke = (window as any).__TAURI_INTERNALS__.invoke;
    for (const { query, values } of queries) await invoke("plugin:sql|execute", { db: "sqlite:e2e.db", query, values: values ?? [] });
  }, statements);
}

export async function seedFidelityCompletedSync(page: Page) {
  await page.evaluate(async () => {
    const modulePath = "/src/middlelayers/sync/runtime.ts";
    const { syncRuntime } = await import(modulePath);
    (syncRuntime as unknown as {
      publish: (mode: "ready", sync: { phase: "idle"; lastSync: number }) => void;
    }).publish("ready", { phase: "idle", lastSync: Date.parse("2026-10-31T09:41:00.000Z") });
  });
}
