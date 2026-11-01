import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { describe, expect, it, vi } from "vitest";
import type { ExportData } from "@/middlelayers/datamanager";

const mode = process.env.TRACK3_COMPAT_MODE;
const fixture = (name: string) => resolve(`tests/compat/forward/${name}`);
const state = vi.hoisted(() => ({
  db: undefined as Database | undefined,
  files: new Map<string, string>(),
  dirs: new Set<string>(),
}));

function rows(sql: string, values: unknown[] = []): Record<string, unknown>[] {
  const statement = state.db!.prepare(sql);
  statement.bind(values as (string | number | null)[]);
  const result: Record<string, unknown>[] = [];
  while (statement.step()) result.push(statement.getAsObject());
  statement.free();
  return result;
}

const writeDb = {
  select: async (sql: string, values?: unknown[]) => rows(sql, values),
  execute: async (sql: string, values?: unknown[]) => {
    state.db!.run(sql, values as (string | number | null)[]);
    return { rowsAffected: state.db!.getRowsModified() };
  },
};
vi.mock("@/middlelayers/database", () => ({
  selectFromDatabaseWithSql: async (sql: string, values: unknown[]) => rows(sql, values),
  selectFromDatabase: async (
    table: string, where: Record<string, unknown>, limit = 0,
    orderBy: Record<string, string> = {}, plainWhere?: string, extra: unknown[] = [],
  ) => {
    const terms = Object.keys(where).filter((key) => where[key] !== undefined).map((key) => `${key} = ?`);
    if (plainWhere) terms.push(plainWhere);
    const order = Object.entries(orderBy).map(([key, direction]) => `${key} ${direction}`).join(", ");
    return rows(`SELECT * FROM ${table} WHERE ${terms.join(" AND ") || "1=1"}${order ? ` ORDER BY ${order}` : ""}${limit > 0 ? ` LIMIT ${limit}` : ""}`,
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
  readTextFile: async (path: string) => {
    const text = state.files.get(path);
    if (text === undefined) throw new Error(`Missing fixture: ${path}`);
    return text;
  },
  stat: async (path: string) => ({ size: state.files.get(path)?.length ?? 0 }),
  exists: async (path: string) => state.files.has(path) || state.dirs.has(path),
  mkdir: async (path: string) => { state.dirs.add(path); },
  readDir: async (path: string) => [
    ...[...state.dirs].filter((entry) => dirname(entry) === path).map((entry) => ({
      name: entry.slice(path.length + 1), isDirectory: true, isFile: false, isSymlink: false,
    })),
    ...[...state.files.keys()].filter((entry) => dirname(entry) === path).map((entry) => ({
      name: entry.slice(path.length + 1), isDirectory: false, isFile: true, isSymlink: false,
    })),
  ],
  rename: async (from: string, to: string) => {
    state.files.set(to, state.files.get(from)!);
    state.files.delete(from);
  },
  remove: async (path: string) => { state.files.delete(path); },
}));
vi.mock("@/utils/app", () => ({
  getClientID: async () => "compat-producer",
  getVersion: async () => JSON.parse(readFileSync("package.json", "utf8")).version,
}));
vi.mock("@/middlelayers/configuration", () => ({ exportConfigurationString: async () => undefined }));
vi.mock("@/middlelayers/charts", async () => ({
  queryHistoricalData: (await import("@/middlelayers/charts-history")).queryHistoricalData,
}));

import { DATA_MANAGER } from "@/middlelayers/datamanager";
import { importBackupV2, writeBackupV2 } from "@/middlelayers/backup-v2";
import { listBackupClients } from "@/middlelayers/backup-folder";

async function freshDb() {
  state.db?.close();
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  for (const name of ["configuration", "assets_v2", "asset_prices", "transactions", "history_snapshots"]) {
    db.run(readFileSync(resolve(`src-tauri/migrations/init/${name}_up.sql`), "utf8"));
  }
  if (mode !== "consume") db.run(readFileSync(resolve("src-tauri/migrations/init/snapshot_partial_up.sql"), "utf8"));
  state.db = db;
  return db;
}

function loadBackup(directory: string) {
  state.files.clear();
  state.dirs.clear();
  const walk = (path: string) => {
    state.dirs.add(`/backup${path.slice(directory.length)}`);
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(resolve(path, entry.name));
      else state.files.set(`/backup${resolve(path, entry.name).slice(directory.length)}`, readFileSync(resolve(path, entry.name), "utf8"));
    }
  };
  walk(directory);
}

describe.skipIf(!mode)("cross-version export and backup", () => {
  it.skipIf(mode !== "produce")("writes new-build export and backup fixtures", async () => {
    await freshDb();
    state.files.clear();
    state.dirs.clear();
    state.db!.run("INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES ('compat-snapshot', '2024-04-16T13:00:00.000Z', 'wallet-compat', 'crypto', 'BTC', 2, 4, 2)");
    state.db!.run("INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt, createdAt, updatedAt) VALUES ('compat-snapshot', 1, 'crypto', 'wallet-compat', 'BTC', 2, 2, 'buy', '2024-04-16T13:00:00.000Z', '2024-04-16T13:00:00.000Z', '2024-04-16T13:00:00.000Z')");
    await DATA_MANAGER.exportHistoricalData("/export.json", false);
    const original = JSON.parse(state.files.get("/export.json")!) as ExportData;
    writeFileSync(fixture("export-base.json"), JSON.stringify(original));
    state.db!.run(`INSERT INTO snapshot_partial (uuid, sources_total, missing, fill, created_at)
      VALUES ('compat-snapshot', 2, '[{"wallet":"ddf7fe606e048ac89f8a8c62bf23c4be","kind":"exchange","provider":"OKX","category":"network"}]',
      'last_known', '2024-04-16T13:00:00.000Z')`);
    await DATA_MANAGER.exportHistoricalData("/forward.json", false);
    const extended = JSON.parse(state.files.get("/forward.json")!) as ExportData;
    expect(extended.historicalData[0].partial?.missing[0].provider).toBe("OKX");
    writeFileSync(fixture("export-forward.json"), JSON.stringify(extended));
    await writeBackupV2("/backup", "compat-producer", "0.9.5", extended.historicalData);
    for (const [path, text] of state.files) {
      if (!path.startsWith("/backup/")) continue;
      const destination = fixture(path.slice(1));
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, text);
    }
    expect(state.files.has("/backup/track3-backup/compat-producer/metadata.json")).toBe(true);
  });

  it.skipIf(mode !== "consume")("0.9.4 imports forward export without changing its rows", async () => {
    const original = JSON.parse(readFileSync(fixture("export-base.json"), "utf8")) as ExportData;
    const extended = JSON.parse(readFileSync(fixture("export-forward.json"), "utf8")) as ExportData;
    await freshDb();
    await DATA_MANAGER.importHistoricalData("REPLACE", original);
    const baseRows = {
      assets: rows("SELECT uuid, createdAt, wallet, asset_type, symbol, amount, value, price FROM assets_v2 ORDER BY id"),
      transactions: rows("SELECT uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt, createdAt, updatedAt FROM transactions ORDER BY id"),
    };
    await freshDb();
    await DATA_MANAGER.importHistoricalData("REPLACE", extended);
    expect(rows("SELECT uuid, createdAt, wallet, asset_type, symbol, amount, value, price FROM assets_v2 ORDER BY id")).toStrictEqual(baseRows.assets);
    expect(rows("SELECT uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt, createdAt, updatedAt FROM transactions ORDER BY id")).toStrictEqual(baseRows.transactions);
  });

  it.skipIf(mode !== "consume")("0.9.4 lists and imports forward backup records", async () => {
    loadBackup(fixture("backup"));
    expect(await listBackupClients("/backup")).toMatchObject([{ client: "compat-producer", months: 1 }]);
    const imported: Array<Record<string, unknown>> = [];
    const result = await importBackupV2("/backup", "compat-reader", () => undefined, async () => {}, async (records) => {
      imported.push(...records);
    }, { strict: true });
    expect(result.imported).toBe(true);
    const [{ partial: _extra, ...record }] = imported;
    expect(record).toStrictEqual(JSON.parse(readFileSync(fixture("export-base.json"), "utf8")).historicalData[0]);
  });
});
