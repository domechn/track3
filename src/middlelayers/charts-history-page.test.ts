import initSqlJs from "sql.js";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hourlyHistory } from "@/test/history-fixtures";

const sqlSelect = vi.hoisted(() => vi.fn());
const dbSelect = vi.hoisted(() => vi.fn());
vi.mock("./database", () => ({
  selectFromDatabaseWithSql: sqlSelect,
  selectFromDatabase: dbSelect,
}));

import { queryHistoricalPage, queryHistoricalDetail, queryEditLog } from "./charts-history";

const range = {
  start: new Date("2021-01-01T00:00:00.000Z"),
  end: new Date("2026-01-01T00:00:00.000Z"),
};

describe("paged historical queries", () => {
  let addRows: (sql: string) => void;
  let queryPlan: (sql: string, values: unknown[]) => string[];
  beforeEach(async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run(`CREATE TABLE assets_v2 (
      id INTEGER PRIMARY KEY, uuid TEXT, createdAt TEXT, wallet TEXT,
      asset_type TEXT, symbol TEXT, amount REAL, value REAL, price REAL
    )`);
    db.run("CREATE INDEX createdAt_idx ON assets_v2 (createdAt)");
    db.run("CREATE INDEX uuid_idx ON assets_v2 (uuid)");
    db.run(`CREATE TABLE transactions (
      id INTEGER PRIMARY KEY, uuid TEXT, assetID INTEGER, asset_type TEXT,
      wallet TEXT, symbol TEXT, amount REAL, price REAL, txnType TEXT,
      txnCreatedAt TEXT, createdAt TEXT, updatedAt TEXT
    )`);
    const insert = db.prepare(
      "INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const snapshot of hourlyHistory(43, 200)) {
      for (const asset of snapshot.assets) {
        insert.run([
          snapshot.id, snapshot.createdAt, "wallet", "crypto",
          asset.symbol, asset.amount, asset.value, asset.price,
        ]);
      }
    }
    insert.free();
    db.run(`INSERT INTO transactions
      (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt, createdAt, updatedAt)
      VALUES ('snapshot-000042', 1, 'crypto', 'wallet', 'ASSET0', 1, 43, 'buy',
        '2022-01-02T18:00:00.000Z', '2022-01-02T18:00:00.000Z', '2022-01-02T18:00:00.000Z')`);
    db.run(readFileSync("src-tauri/migrations/v08t09/history_snapshots_up.sql", "utf8"));
    db.run(`CREATE TABLE snapshot_edit_log (
      id INTEGER PRIMARY KEY, snapshot_uuid TEXT, edited_at TEXT, origin TEXT,
      target TEXT, action TEXT, asset_type TEXT, symbol TEXT, wallet TEXT,
      old_value TEXT, new_value TEXT
    )`);
    db.run(readFileSync("src-tauri/migrations/v094t095/snapshot_partial_up.sql", "utf8"));
    addRows = (sql) => db.run(sql);
    queryPlan = (sql, values) => {
      const statement = db.prepare(`EXPLAIN QUERY PLAN ${sql}`);
      statement.bind(values as (string | number)[]);
      const details: string[] = [];
      while (statement.step()) details.push(String(statement.getAsObject().detail));
      statement.free();
      return details;
    };
    sqlSelect.mockReset();
    sqlSelect.mockImplementation(async (sql: string, values: unknown[]) => {
      const stmt = db.prepare(sql);
      stmt.bind(values as (string | number)[]);
      const rows: object[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    });
    dbSelect.mockReset();
    dbSelect.mockImplementation(async (
      table: string, where: { uuid?: string }, _limit: number,
      _order: unknown, _extraWhere: string, extraValues: string[],
    ) => sqlSelect(
      `SELECT * FROM ${table} WHERE uuid = ?`,
      where.uuid ? [where.uuid] : extraValues,
    ));
  });

  it("loads a page with bounded queries and a successor for the final change", async () => {
    const result = await queryHistoricalPage(range, 20, 1);
    expect(result.totalCount).toBe(43);
    expect(result.rows).toHaveLength(20);
    expect(result.rows[0].id).toBe("snapshot-000022");
    expect(result.rows[0].assetCount).toBe(200);
    expect(result.rows[0].topAssets).toHaveLength(7);
    expect(result.rows[0].change).toBe(200);
    expect(result.rows[19].change).toBe(200);
    expect(result.latest).toMatchObject({ id: "snapshot-000042", total: 28500 });
    expect(sqlSelect).toHaveBeenCalledTimes(1);
  });

  it("filters edited snapshots and marks rows with retained edits", async () => {
    addRows(`INSERT INTO snapshot_edit_log
      (snapshot_uuid, edited_at, origin, target, action)
      VALUES ('snapshot-000042', '2026-01-01', 'local', 'transaction', 'price'),
             ('snapshot-000040', '2026-01-01', 'local', 'asset', 'delete')`);
    const all = await queryHistoricalPage(range, 20, 0);
    expect(all.rows[0]).toMatchObject({ id: "snapshot-000042", edited: true });
    expect(all.rows[1]).toMatchObject({ id: "snapshot-000041", edited: false });
    const edited = await queryHistoricalPage(range, 20, 0, "edited");
    expect(edited.totalCount).toBe(2);
    expect(edited.rows.map((row) => row.id)).toEqual(["snapshot-000042", "snapshot-000040"]);
    expect(edited.rows[0].change).toBe(200);
    expect(edited.rows[1].change).toBe(200);
    expect(edited.latest?.id).toBe("snapshot-000042");
    expect(sqlSelect).toHaveBeenCalledTimes(2);
  });

  it("filters complete and partial snapshots while keeping the actual latest total", async () => {
    addRows(`INSERT INTO snapshot_partial (uuid, sources_total, missing, fill, created_at)
      VALUES ('snapshot-000042', 5, '[{"wallet":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","kind":"wallet","provider":"BTC","category":"network"}]',
        'last_known', '2022-01-02T18:00:00.000Z')`);
    const all = await queryHistoricalPage(range, 20, 0);
    expect(all.rows[0]).toMatchObject({ id: "snapshot-000042", sourcesTotal: 5, missingCount: 1 });
    const partial = await queryHistoricalPage(range, 20, 0, "partial");
    expect(partial.totalCount).toBe(1);
    expect(partial.rows.map((row) => row.id)).toEqual(["snapshot-000042"]);
    const complete = await queryHistoricalPage(range, 20, 0, "complete");
    expect(complete.totalCount).toBe(42);
    expect(complete.rows[0].id).toBe("snapshot-000041");
    expect(complete.latest?.id).toBe("snapshot-000042");
    expect(sqlSelect).toHaveBeenCalledTimes(3);
  });

  it("loads one snapshot's retained edits newest first", async () => {
    addRows(`INSERT INTO snapshot_edit_log
      (snapshot_uuid, edited_at, origin, target, action, symbol, old_value, new_value)
      VALUES ('snapshot-000042', '2026-11-01T10:00:00Z', 'local', 'transaction', 'price', 'ETH', '2310', '2295'),
             ('snapshot-000042', '2026-11-01T11:00:00Z', 'local', 'asset', 'delete', 'BTC', '{"amount":1}', NULL),
             ('snapshot-000041', '2026-11-01T12:00:00Z', 'local', 'asset', 'delete', 'SOL', '{"amount":1}', NULL)`);
    expect((await queryEditLog("snapshot-000042")).map((row) => [row.symbol, row.old_value, row.new_value]))
      .toEqual([["BTC", '{"amount":1}', null], ["ETH", "2310", "2295"]]);
  });

  it("loads one snapshot's assets and transactions only on detail request", async () => {
    await queryHistoricalPage(range, 20, 0);
    expect(sqlSelect.mock.calls.every(([sql]) => !String(sql).includes("SELECT * FROM assets_v2"))).toBe(true);
    const detail = await queryHistoricalDetail("snapshot-000042");
    expect(detail.assets).toHaveLength(200);
    expect(detail.transactions).toHaveLength(0);
    expect(sqlSelect).toHaveBeenCalledTimes(3);
    const withTransactions = await queryHistoricalDetail("snapshot-000042", true);
    expect(withTransactions.transactions).toHaveLength(1);
    expect(withTransactions.transactions[0].assetType).toBe("crypto");
  });

  it("keeps the count and latest snapshot when the requested page is past the end", async () => {
    const pastEnd = await queryHistoricalPage(range, 20, 9);
    expect(pastEnd.totalCount).toBe(43);
    expect(pastEnd.rows).toEqual([]);
    expect(pastEnd.latest?.id).toBe("snapshot-000042");
    expect(sqlSelect).toHaveBeenCalledTimes(1);
  });

  it("returns an empty page from a range with no snapshots", async () => {
    const empty = await queryHistoricalPage({
      start: new Date("2023-01-01T00:00:00.000Z"),
      end: new Date("2023-01-02T00:00:00.000Z"),
    }, 20, 0);
    expect(empty).toEqual({ totalCount: 0, rows: [], latest: null });
    expect(sqlSelect).toHaveBeenCalledTimes(1);
  });

  it("counts and previews symbols once across wallets and merges detail values", async () => {
    await sqlSelect(
      `INSERT INTO assets_v2
       (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
       VALUES
       ('snapshot-000042', '2022-01-02T18:00:00.000Z', 'wallet-b', 'crypto', 'ASSET0', 2, 1000, 500),
       ('snapshot-000042', '2022-01-02T18:00:00.000Z', 'wallet-c', 'crypto', 'ASSET0', 2, 2000, 1000),
       ('snapshot-000042', '2022-01-02T18:00:00.000Z', 'wallet-b', 'crypto', 'DUST', 1, 0.8, 0.8),
       ('snapshot-000042', '2022-01-02T18:00:00.000Z', 'wallet-c', 'crypto', 'DUST', 1, 0.8, 0.8)`,
      [],
    );
    sqlSelect.mockClear();

    const page = await queryHistoricalPage(range, 20, 0);
    const latest = page.rows[0];
    expect(latest.assetCount).toBe(201);
    expect(latest.topAssets).toHaveLength(7);
    expect(latest.topAssets.filter((asset) => asset.symbol === "ASSET0")).toHaveLength(1);
    expect(latest.topAssets.find((asset) => asset.symbol === "ASSET0")?.value).toBe(3043);

    const detail = await queryHistoricalDetail(latest.id);
    expect(detail.assets).toHaveLength(201);
    expect(detail.assets.find((asset) => asset.symbol === "ASSET0")).toMatchObject({
      amount: 5, value: 3043,
    });
    expect(detail.assets.find((asset) => asset.symbol === "DUST")).toMatchObject({
      amount: 2, value: 1.6,
    });
    expect(detail.total).toBeCloseTo(31501.6);
  });

  it("generates three years of hourly snapshots lazily", () => {
    const snapshots = hourlyHistory();
    expect(snapshots.next().value?.assets).toHaveLength(200);
    let final;
    for (final of snapshots) {
      // Iterate without retaining the five million generated asset records.
    }
    expect(final?.id).toBe("snapshot-026279");
  });

  it("pages two thousand snapshots without aggregating every asset in the range", async () => {
    for (const snapshot of hourlyHistory(2000, 1)) {
      if (snapshot.id <= "snapshot-000042") continue;
      addRows(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
        VALUES ('${snapshot.id}', '${snapshot.createdAt}', 'wallet', 'crypto', 'ASSET0', 1, 1, 1)`);
    }
    const page = await queryHistoricalPage(range, 20, 50);
    expect(page.totalCount).toBe(2000);
    expect(page.rows).toHaveLength(20);
    expect(page.rows[0].id).toBe("snapshot-000999");
    const [sql, values] = sqlSelect.mock.calls.at(-1)!;
    expect(queryPlan(sql, values).some((detail) =>
      detail.includes("assets_v2") && detail.includes("createdAt_idx"),
    )).toBe(false);
  });

  it("keeps snapshot pagination current after asset imports and deletes", async () => {
    addRows(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
      VALUES ('imported', '2024-01-01T00:00:00.000Z', 'wallet', 'crypto', 'BTC', 1, 50, 50)`);
    expect((await queryHistoricalPage(range, 20, 0)).latest).toMatchObject({ id: "imported", total: 50 });
    addRows("DELETE FROM assets_v2 WHERE uuid = 'imported'");
    const page = await queryHistoricalPage(range, 20, 0);
    expect(page.totalCount).toBe(43);
    expect(page.latest?.id).toBe("snapshot-000042");
  });
});
