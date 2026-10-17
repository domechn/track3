import initSqlJs from "sql.js";
import { describe, expect, it, vi } from "vitest";
import { getDatabase } from "./database";
import { loadInsightSnapshots } from "./insights-service";

vi.mock("./database", () => ({ getDatabase: vi.fn() }));

describe("loadInsightSnapshots", () => {
  it("retains the snapshot closest to 24 hours when a later same-day refresh exists", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE assets_v2 (id INTEGER PRIMARY KEY, uuid TEXT, createdAt TEXT, asset_type TEXT, symbol TEXT, value REAL, amount REAL, price REAL)");
    const insert = db.prepare("INSERT INTO assets_v2 (uuid, createdAt, asset_type, symbol, value, amount, price) VALUES (?, ?, 'crypto', 'BTC', ?, 1, 1)");
    for (const [uuid, at, value] of [
      ["exact-day", "2024-01-31T12:00:00.000Z", 100],
      ["late-day", "2024-01-31T23:00:00.000Z", 130],
      ["latest", "2024-02-01T12:00:00.000Z", 150],
    ] as const) insert.run([uuid, at, value]);
    insert.free();
    vi.mocked(getDatabase).mockResolvedValue({
      select: async (sql: string, values: unknown[] = []) => {
        const stmt = db.prepare(sql);
        stmt.bind(values as (string | number)[]);
        const rows: object[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },
    } as never);
    const snapshots = await loadInsightSnapshots();
    expect(snapshots.map((snapshot) => snapshot.uuid)).toContain("exact-day");
    expect(snapshots[0].uuid).toBe("latest");
    expect(snapshots.find((snapshot) => snapshot.uuid === "exact-day")?.assets[0].value).toBe(100);
  });

  it("retains snapshots from separate local days that share a UTC date", async () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      const SQL = await initSqlJs();
      const db = new SQL.Database();
      db.run("CREATE TABLE assets_v2 (id INTEGER PRIMARY KEY, uuid TEXT, createdAt TEXT, asset_type TEXT, symbol TEXT, value REAL, amount REAL, price REAL)");
      const insert = db.prepare("INSERT INTO assets_v2 (uuid, createdAt, asset_type, symbol, value, amount, price) VALUES (?, ?, 'crypto', 'BTC', 100, 1, 1)");
      for (const [uuid, at] of [
        ["month", "2024-01-11T00:30:00.000Z"],
        ["week", "2024-02-03T00:30:00.000Z"],
        ["early", "2024-02-08T00:30:00.000Z"],
        ["late", "2024-02-08T23:30:00.000Z"],
        ["day", "2024-02-09T23:30:00.000Z"],
        ["latest", "2024-02-10T00:30:00.000Z"],
      ] as const) insert.run([uuid, at]);
      insert.free();
      vi.mocked(getDatabase).mockResolvedValue({
        select: async (sql: string, values: unknown[] = []) => {
          const stmt = db.prepare(sql);
          stmt.bind(values as (string | number)[]);
          const rows: object[] = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
      } as never);
      const snapshots = await loadInsightSnapshots();
      expect(snapshots.map((snapshot) => snapshot.uuid)).toEqual(expect.arrayContaining(["early", "late"]));
      db.close();
    } finally {
      process.env.TZ = originalTimezone;
    }
  });
});
