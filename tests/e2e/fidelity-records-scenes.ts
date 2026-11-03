import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

type Fixture = {
  snaps: { id: string; d: number; time: string; rows: { sym: string; qty: number; price: number; value: number }[];
    edited: boolean; issue: { n?: number } | null }[];
  tx: { id: string; d: string; time: string; sym: string; type: string; qty: number; price: number | null; src: string }[];
};

const fixture = JSON.parse(readFileSync(resolve("docs/ui/fidelity/records-fixture.json"), "utf8")) as Fixture;
const sql = (value: string | number | null) => value === null ? "NULL" : typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;

export async function executeSceneSql(page: Page, query: string, values: unknown[] = []) {
  return page.evaluate(([statement, args]) => (window as any).__e2eInvoke("plugin:sql|execute", {
    query: statement, values: args,
  }), [query, values] as const);
}

export async function installFidelityRecords(page: Page, options: { empty?: boolean; slowHistory?: boolean; lockedSync?: boolean } = {}) {
  await installTauriBridge(page, { emptyPortfolio: options.empty, seedLockedSync: options.lockedSync });
  if (options.slowHistory) {
    await page.addInitScript(() => {
      const invoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any, ...rest: any[]) => {
        if (cmd === "plugin:sql|select" && /WITH page AS/i.test(args.query)) {
          await new Promise((done) => setTimeout(done, 2000));
        }
        return invoke(cmd, args, ...rest);
      };
    });
  }
  await executeSceneSql(page, `INSERT INTO alert_history (kind, title, message, symbol, value, triggered_at)
    VALUES ('asset_price_target', 'BTC alert', 'BTC moved', 'BTC', 1, '2026-10-31T08:00:00.000Z'),
    ('asset_price_target', 'ETH alert', 'ETH moved', 'ETH', 1, '2026-10-31T08:01:00.000Z')`);
  if (options.empty) return;
  await executeSceneSql(page, "DELETE FROM transactions");
  await executeSceneSql(page, "DELETE FROM assets_v2");
  await executeSceneSql(page, "DELETE FROM snapshot_edit_log");
  const assets: string[] = [];
  const partials: string[] = [];
  const edits: string[] = [];
  const transactions: string[] = [];
  for (const snap of fixture.snaps) {
    const timestamp = `2026-10-${String(snap.d).padStart(2, "0")}T${snap.time}:00.000Z`;
    for (const asset of snap.rows) {
      assets.push(`(${[snap.id, timestamp, "fidelity-wallet", ["AAPL", "NVDA"].includes(asset.sym) ? "stock" : "crypto", asset.sym,
        asset.qty, asset.value / 100, asset.price].map(sql).join(",")})`);
    }
    if (snap.issue?.n === 4) {
      const missing = JSON.stringify([{ wallet: "fidelity-wallet", kind: "wallet", provider: "Interactive Brokers",
        category: "network", lastSuccessAt: new Date(Date.parse(timestamp) - 86_400_000).toISOString() }]);
      partials.push(`(${[snap.id, 5, missing, "last_known", timestamp].map(sql).join(",")})`);
    }
    if (snap.edited) {
      edits.push(`(${[snap.id, "2026-10-28T11:20:00.000Z", "local", "transaction", "price", "stock", "AAPL",
        "ibkr", "236.31", "238.00"].map(sql).join(",")})`);
      edits.push(`(${[snap.id, "2026-10-28T11:21:00.000Z", "import", "snapshot", "replace", null, null,
        null, JSON.stringify({ assets: 8, transactions: 1, total: 752602 }),
        JSON.stringify({ assets: 8, transactions: 1, total: 752642.71 })].map(sql).join(",")})`);
    }
  }
  for (let index = 0; index < 1233; index++) {
    const timestamp = new Date(Date.UTC(2026, 8, 30) - index * 3_600_000).toISOString();
    assets.push(`(${[`fidelity-old-${index}`, timestamp, "fidelity-wallet", "crypto", "BTC", 1, 700000, 700000].map(sql).join(",")})`);
  }
  for (const tx of fixture.tx) {
    const values = [tx.id === "a3" ? "2026-10-28-m" : `fidelity-tx-${tx.id}`, 1,
      ["AAPL", "NVDA"].includes(tx.sym) ? "stock" : "crypto",
      tx.src, tx.sym, tx.qty, tx.price ?? 0, tx.type, `${tx.d}T${tx.time}:00.000Z`].map(sql);
    if (tx.id === "a3") values[1] = "(SELECT id FROM assets_v2 WHERE uuid = '2026-10-28-m' AND symbol = 'AAPL' LIMIT 1)";
    transactions.push(`(${values.join(",")})`);
  }
  await executeSceneSql(page, `INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
    VALUES ${assets.join(",")}`);
  if (partials.length) await executeSceneSql(page, `INSERT INTO snapshot_partial (uuid, sources_total, missing, fill, created_at)
    VALUES ${partials.join(",")}`);
  if (edits.length) await executeSceneSql(page, `INSERT INTO snapshot_edit_log
    (snapshot_uuid, edited_at, origin, target, action, asset_type, symbol, wallet, old_value, new_value)
    VALUES ${edits.join(",")}`);
  await executeSceneSql(page, `INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
    VALUES ${transactions.join(",")}`);
  await executeSceneSql(page, "INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '2000')");
}
