import { expect, it, vi } from "vitest";
import initSqlJs from "sql.js";
import { queryLatestAssets } from "./charts-assets";
import { selectFromDatabaseWithSql } from "./database";
import { getBlacklistCoins } from "./configuration";

vi.mock("./database", () => ({ selectFromDatabaseWithSql: vi.fn() }));
vi.mock("./configuration", () => ({ getBlacklistCoins: vi.fn() }));

it("counts positions in the selected range's final snapshot", async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("CREATE TABLE assets_v2 (uuid TEXT, createdAt TEXT, symbol TEXT, asset_type TEXT, amount REAL, value REAL)");
  db.run(`INSERT INTO assets_v2 VALUES
    ('a', '2026-04-01T12:00:00.000Z', 'BTC', 'crypto', 1, 100),
    ('b', '2026-04-02T12:00:00.000Z', 'BTC', 'crypto', 2, 240),
    ('c', '2026-04-03T12:00:00.000Z', 'ETH', 'crypto', 1, 300)`);
  vi.mocked(selectFromDatabaseWithSql).mockImplementation(async (sql, values) => {
    const statement = db.prepare(sql);
    statement.bind(values as (string | number)[]);
    const rows: object[] = [];
    while (statement.step()) rows.push(statement.getAsObject());
    statement.free();
    return rows as never;
  });
  vi.mocked(getBlacklistCoins).mockResolvedValue([]);
  expect(await queryLatestAssets({
    start: new Date("2026-04-02T00:00:00.000Z"),
    end: new Date("2026-04-02T23:59:59.999Z"),
  })).toEqual([{ symbol: "BTC", assetType: "crypto", amount: 2, value: 240, price: 120 }]);
});
