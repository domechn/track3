import initSqlJs from "sql.js";
import { expect, it } from "vitest";
import { isLatestSnapshotPartial, isSnapshotPartial, partialSnapshotIds, snapshotExclusionOptions } from "./snapshot-partial";

it("checks the latest snapshot marker without treating an older partial snapshot as current", async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("CREATE TABLE assets_v2 (id INTEGER PRIMARY KEY, uuid TEXT, createdAt TEXT)");
  db.run("CREATE TABLE snapshot_partial (uuid TEXT PRIMARY KEY)");
  db.run(`INSERT INTO assets_v2 (uuid, createdAt) VALUES
    ('old', '2026-01-01T00:00:00.000Z'), ('new', '2026-01-02T00:00:00.000Z')`);
  db.run("INSERT INTO snapshot_partial (uuid) VALUES ('old')");
  const database = { select: async <T,>(sql: string, values: unknown[] = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(values as string[]);
    const rows: object[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows as T;
  } };
  expect(await isSnapshotPartial("old", database)).toBe(true);
  expect(await partialSnapshotIds(["old", "new"], database)).toEqual(new Set(["old"]));
  expect(await isLatestSnapshotPartial(database)).toBe(false);
  db.run("INSERT INTO snapshot_partial (uuid) VALUES ('new')");
  expect(await isLatestSnapshotPartial(database)).toBe(true);
});

it("calculates render-only totals for each unavailable provider from its wallet hashes", async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("CREATE TABLE assets_v2 (uuid TEXT, wallet TEXT, value REAL)");
  db.run("CREATE TABLE snapshot_partial (uuid TEXT PRIMARY KEY, missing TEXT)");
  db.run(`INSERT INTO assets_v2 VALUES
    ('snapshot', 'wallet-a', 100), ('snapshot', 'wallet-a', 50),
    ('snapshot', 'wallet-b', 25), ('snapshot', 'current', 200)`);
  db.run("INSERT INTO snapshot_partial VALUES (?, ?)", ["snapshot", JSON.stringify([
    { wallet: "wallet-a", provider: "OKX" },
    { wallet: "wallet-a", provider: "OKX" },
    { wallet: "wallet-b", provider: "Kraken" },
  ])]);
  const database = { select: async <T,>(sql: string, values: unknown[] = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(values as string[]);
    const rows: object[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows as T;
  } };
  expect(await snapshotExclusionOptions("snapshot", database)).toEqual([
    { provider: "Kraken", value: 25 },
    { provider: "OKX", value: 150 },
  ]);
});
