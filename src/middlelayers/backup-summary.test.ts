import initSqlJs from "sql.js";
import { expect, it, vi } from "vitest";

const sqlSelect = vi.hoisted(() => vi.fn());
vi.mock("./database", () => ({ selectFromDatabaseWithSql: sqlSelect }));

import { queryBackupSummary } from "./backup-summary";

it("counts the latest assets and all exported history without loading every record", async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("CREATE TABLE history_snapshots (uuid TEXT, createdAt TEXT)");
  db.run("CREATE TABLE assets_v2 (uuid TEXT, asset_type TEXT, symbol TEXT)");
  db.run("CREATE TABLE transactions (id INTEGER)");
  db.run(`INSERT INTO history_snapshots VALUES ('old', '2024-01-01'), ('new', '2024-02-01')`);
  db.run(`INSERT INTO assets_v2 VALUES ('old', 'crypto', 'BTC'), ('new', 'crypto', 'BTC'), ('new', 'crypto', 'BTC'), ('new', 'stock', 'AAPL')`);
  db.run("INSERT INTO transactions VALUES (1), (2), (3)");
  sqlSelect.mockImplementation(async (sql: string) => {
    const stmt = db.prepare(sql);
    const rows: object[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  });

  expect(await queryBackupSummary()).toEqual({ snapshots: 2, assets: 2, transactions: 3 });
  expect(sqlSelect).toHaveBeenCalledTimes(1);
});
