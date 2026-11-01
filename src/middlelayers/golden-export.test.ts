// Regenerate only from 0.9.4: UPDATE_GOLDEN=1 corepack yarn vitest run src/middlelayers/golden-export.test.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hourlyHistory } from "@/test/history-fixtures";
import type { ExportData } from "./datamanager";

const state = vi.hoisted(() => ({
  db: undefined as SqlJsDatabase | undefined,
  files: new Map<string, string>(),
  dirs: new Set<string>(),
}));

function query(sql: string, values: unknown[] = []): Record<string, unknown>[] {
  const stmt = state.db!.prepare(sql);
  stmt.bind(values as (string | number | null)[]);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

const writeDb = {
  select: async (sql: string, values?: unknown[]) => query(sql, values),
  execute: async (sql: string, values?: unknown[]) => {
    state.db!.run(sql, values as (string | number | null)[]);
    return { rowsAffected: state.db!.getRowsModified() };
  },
};

vi.mock("./database", () => ({
  selectFromDatabaseWithSql: async (sql: string, values: unknown[]) => query(sql, values),
  selectFromDatabase: async (
    table: string, where: Record<string, unknown>, limit = 0,
    orderBy: Record<string, string> = {}, plainWhere?: string, extra: unknown[] = [],
  ) => {
    const terms = Object.keys(where).filter((key) => where[key] !== undefined).map((key) => `${key} = ?`);
    if (plainWhere) terms.push(plainWhere);
    const order = Object.entries(orderBy).map(([key, direction]) => `${key} ${direction}`).join(", ");
    return query(`SELECT * FROM ${table} WHERE ${terms.join(" AND ") || "1=1"}${order ? ` ORDER BY ${order}` : ""}${limit > 0 ? ` LIMIT ${limit}` : ""}`,
      [...Object.values(where).filter((value) => value !== undefined), ...extra]);
  },
  executeWriteWork: async (operation: (db: typeof writeDb) => Promise<unknown>) => operation(writeDb),
  saveModelsInWriteWork: async (
    db: typeof writeDb, table: string, models: Record<string, unknown>[], conflict: string,
  ) => {
    if (!models.length) return [];
    const keys = Object.keys(models[0]).filter((key) => models[0][key] !== undefined);
    const values = models.flatMap((model) => keys.map((key) => model[key]));
    return db.select(`INSERT OR ${conflict} INTO ${table} (${keys.join(",")}) VALUES ${models.map(() => `(${keys.map(() => "?").join(",")})`).join(",")} RETURNING *`, values);
  },
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: async (path: string, text: string) => { state.files.set(path, text); },
  readTextFile: async (path: string) => state.files.get(path),
  stat: async (path: string) => ({ size: state.files.get(path)?.length ?? 0 }),
  exists: async (path: string) => state.files.has(path) || state.dirs.has(path),
  mkdir: async (path: string) => { state.dirs.add(path); },
  readDir: async (path: string) => [...state.files.keys()].filter((file) => file.startsWith(`${path}/`))
    .map((file) => ({ name: file.slice(path.length + 1), isFile: true, isSymlink: false })),
  rename: async (from: string, to: string) => {
    state.files.set(to, state.files.get(from)!);
    state.files.delete(from);
  },
  remove: async (path: string) => { state.files.delete(path); },
}));
vi.mock("@/utils/app", () => ({
  getClientID: async () => "golden-client",
  getVersion: async () => "0.9.4",
}));
vi.mock("./configuration", () => ({
  exportConfigurationString: async () => undefined,
}));
vi.mock("./charts", async () => ({
  queryHistoricalData: (await import("./charts-history")).queryHistoricalData,
}));

import { DATA_MANAGER } from "./datamanager";
import { writeBackupV2 } from "./backup-v2";

const golden = (name: string) => resolve(`tests/golden/${name}`);
function capture(name: string, actual: string) {
  if (process.env.UPDATE_GOLDEN === "1") {
    mkdirSync(resolve("tests/golden"), { recursive: true });
    writeFileSync(golden(name), actual);
  }
  expect(actual).toBe(readFileSync(golden(name), "utf8"));
}

async function freshDatabase() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  for (const name of [
    "configuration", "assets_v2", "currency_rates", "asset_prices",
    "transactions", "chat_sessions", "cloud_sync", "rebalance_profiles",
    "alerts", "history_snapshots", "sync_state",
    "snapshot_partial",
  ]) db.run(readFileSync(resolve(`src-tauri/migrations/init/${name}_up.sql`), "utf8"));
  state.db = db;
  return db;
}

describe("0.9.4 export and backup formats", () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-04-16T13:00:00.000Z"));
    state.files.clear();
    state.dirs.clear();
    const db = await freshDatabase();
    const insert = db.prepare("INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, ?, 'crypto', ?, ?, ?, ?)");
    for (const snapshot of hourlyHistory(2, 2)) {
      for (const asset of snapshot.assets) {
        insert.run([snapshot.id, snapshot.createdAt, "wallet-golden", asset.symbol, asset.amount, asset.value, asset.price]);
      }
    }
    insert.free();
    db.run(`INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt, createdAt, updatedAt)
      VALUES ('snapshot-000001', 3, 'crypto', 'wallet-golden', 'ASSET0', 1, 2, 'buy',
      '2022-01-01T01:00:00.000Z', '2022-01-01T01:00:00.000Z', '2022-01-01T01:00:00.000Z')`);
  });

  it("exports the complete JSON and imports the committed file into fresh tables", async () => {
    await DATA_MANAGER.exportHistoricalData("/export.json", false);
    const text = state.files.get("/export.json")!;
    capture("export-0.9.4.json", text);
    const expected = JSON.parse(readFileSync(golden("export-0.9.4.json"), "utf8")) as ExportData;
    expect(JSON.parse(text)).toStrictEqual(expected);
    const originalAssets = query("SELECT * FROM assets_v2 ORDER BY id");
    const originalTransactions = query("SELECT * FROM transactions ORDER BY id");
    await freshDatabase();
    await DATA_MANAGER.importHistoricalData("REPLACE", expected);
    const byIdentity = (rows: Record<string, unknown>[]) => rows
      .map(({ id: _id, ...row }) => row)
      .sort((a, b) => `${a.uuid}:${a.symbol}`.localeCompare(`${b.uuid}:${b.symbol}`));
    expect(byIdentity(query("SELECT * FROM assets_v2 ORDER BY id"))).toStrictEqual(byIdentity(originalAssets));
    expect(query("SELECT * FROM transactions ORDER BY id")).toStrictEqual(originalTransactions);
  });

  it("pins backup v2 metadata and exact part bytes for the exported rows", async () => {
    await DATA_MANAGER.exportHistoricalData("/export.json", false);
    const records = (JSON.parse(state.files.get("/export.json")!) as ExportData).historicalData;
    await writeBackupV2("/backup", "golden-client", "0.9.4", records);
    const metadata = state.files.get("/backup/track3-backup/golden-client/metadata.json")!;
    capture("backup-v2-0.9.4.json", metadata);
    const parts = [...state.files.entries()].filter(([path]) => path.includes("/data/")).sort();
    expect(parts).toHaveLength(1);
    capture("backup-v2-part-0.9.4.json", parts[0][1]);
  });

  it("exports an optional partial marker inside its history record and restores it", async () => {
    state.db!.run(`INSERT INTO snapshot_partial (uuid, sources_total, missing, fill, created_at)
      VALUES ('snapshot-000001', 2, '[{"wallet":"ddf7fe606e048ac89f8a8c62bf23c4be","kind":"exchange","provider":"OKX","category":"network"}]',
      'last_known', '2024-04-16T13:00:00.000Z')`);
    await DATA_MANAGER.exportHistoricalData("/partial.json", false);
    const text = state.files.get("/partial.json")!;
    const data = JSON.parse(text) as ExportData;
    expect(data.historicalData.find((row) => row.assets[0]?.uuid === "snapshot-000001")?.partial?.missing[0].provider).toBe("OKX");
    capture("export-partial.json", text);
    await freshDatabase();
    await DATA_MANAGER.importHistoricalData("REPLACE", data);
    expect(query("SELECT sources_total, fill FROM snapshot_partial WHERE uuid='snapshot-000001'"))
      .toEqual([{ sources_total: 2, fill: "last_known" }]);
  });
});
