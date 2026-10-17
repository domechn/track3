import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { expect, it, vi } from "vitest";
import { createSyncHeader } from "./crypto";
import { SyncEngine, type SyncSession } from "./engine";
import { FakeS3, writeSyncHeader } from "./object-store";
import { SqliteSyncRepository } from "./sqlite-repository";
import { claimSessionAction, finishSessionAction } from "../ai/sessions";

vi.setConfig({ testTimeout: 20_000 });

const storage = vi.hoisted(() => ({
  active: "a" as "a" | "b",
  databases: {} as Record<"a" | "b", SqlJsDatabase>,
  files: new Map<string, string>(),
}));

function rows(sql: string, values: unknown[] = []): Record<string, unknown>[] {
  const statement = storage.databases[storage.active].prepare(sql);
  try {
    statement.bind(values as (string | number | null)[]);
    const result: Record<string, unknown>[] = [];
    while (statement.step()) result.push(statement.getAsObject());
    return result;
  } finally {
    statement.free();
  }
}

function write(sql: string, values: unknown[] = []) {
  storage.databases[storage.active].run(sql, values as (string | number | null)[]);
  return { rowsAffected: storage.databases[storage.active].getRowsModified() };
}

vi.mock("../database", () => ({
  getDatabase: async () => ({ select: async (sql: string, values?: unknown[]) => rows(sql, values),
    execute: async (sql: string, values?: unknown[]) => write(sql, values) }),
  executeWrite: async (sql: string, values?: unknown[]) => write(sql, values),
  selectFromDatabase: async (table: string, where: Record<string, unknown>, limit = 0,
    orderBy?: Record<string, string>) => {
    const conditions = Object.keys(where).map((key) => `${key} = ?`).join(" AND ");
    const ordering = Object.entries(orderBy ?? {}).map(([key, direction]) => `${key} ${direction}`).join(", ");
    return rows(`SELECT * FROM ${table}${conditions ? ` WHERE ${conditions}` : ""}` +
      `${ordering ? ` ORDER BY ${ordering}` : ""}${limit ? ` LIMIT ${limit}` : ""}`, Object.values(where));
  },
  saveModelsToDatabase: async (table: string, models: Record<string, unknown>[]) => {
    for (const model of models) {
      const keys = Object.keys(model);
      write(`INSERT OR REPLACE INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
        Object.values(model));
    }
    return models;
  },
  deleteFromDatabase: async (table: string, where: Record<string, unknown>) =>
    write(`DELETE FROM ${table} WHERE ${Object.keys(where).map((key) => `${key} = ?`).join(" AND ")}`,
      Object.values(where)),
}));
vi.mock("@tauri-apps/api/path", async (importOriginal) => ({
  ...await importOriginal<object>(),
  appDataDir: async () => `/${storage.active}`,
}));
vi.mock("@tauri-apps/plugin-fs", async (importOriginal) => ({
  ...await importOriginal<object>(),
  mkdir: async () => {},
  exists: async (path: string) => storage.files.has(path),
  readTextFile: async (path: string) => storage.files.get(path),
  writeTextFile: async (path: string, text: string) => { storage.files.set(path, text); },
  remove: async (path: string) => { storage.files.delete(path); },
}));
vi.mock("@tauri-apps/api/core", async (importOriginal) => ({
  ...await importOriginal<object>(),
  invoke: async (command: string, args: { data: string }) => {
    if (command === "encrypt") return `encrypted:${args.data}`;
    if (command === "decrypt") return args.data.slice("encrypted:".length);
    throw new Error(`Unexpected command: ${command}`);
  },
}));

it("converges SQLite backed session merges on two devices without ping pong", async () => {
  const SQL = await initSqlJs();
  for (const device of ["a", "b"] as const) {
    const db = new SQL.Database();
    db.run(`CREATE TABLE chat_sessions (
      id TEXT PRIMARY KEY, title TEXT, createdAt TEXT, updatedAt TEXT, pinned INTEGER,
      messageCount INTEGER, preview TEXT
    );
    CREATE TABLE sync_state (id INTEGER PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE assets_v2 (uuid TEXT);
    CREATE TABLE transactions (uuid TEXT);
    CREATE TABLE configuration (id INTEGER PRIMARY KEY, data TEXT);
    CREATE TABLE rebalance_profiles (id INTEGER PRIMARY KEY, targets TEXT, tolerance_percent REAL);
    CREATE TABLE sync_snapshot_revision_counter (id INTEGER PRIMARY KEY, revision INTEGER);
    INSERT INTO sync_snapshot_revision_counter VALUES (1, 0);
    CREATE TABLE sync_snapshot_revisions (uuid TEXT, revision INTEGER);`);
    storage.databases[device] = db;
  }
  storage.files.clear();
  const store = new FakeS3();
  await writeSyncHeader(store, (await createSyncHeader("correct horse battery staple")).header);
  const repositories = { a: new SqliteSyncRepository(), b: new SqliteSyncRepository() };
  const engines = {
    a: new SyncEngine(store, repositories.a, "correct horse battery staple"),
    b: new SyncEngine(store, repositories.b, "correct horse battery staple"),
  };
  const base = {
    id: "chat", title: "Chat", createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z", pinned: 0 as const, messageCount: 1, preview: "",
  };
  try {
    for (const device of ["a", "b"] as const) {
      storage.active = device;
      await repositories[device].writeSession({
        ...base, messages: [{ id: device, at: `2026-01-01T00:00:0${device === "a" ? 1 : 2}Z`,
          role: "user", content: device }],
      } satisfies SyncSession);
    }
    for (const device of ["a", "b", "a", "b", "a", "b"] as const) {
      storage.active = device;
      const report = await engines[device].syncOnce({ categories: { history: false } });
      expect(report.errors).toEqual([]);
    }
    for (const device of ["a", "b"] as const) {
      storage.active = device;
      expect((await repositories[device].listSessions())[0].messages.map((message) => message.id)).toEqual(["a", "b"]);
      expect(await engines[device].syncOnce({ categories: { history: false } }))
        .toMatchObject({ pulled: 0, pushed: 0, errors: [] });
    }
  } finally {
    storage.databases.a.close();
    storage.databases.b.close();
  }
});

it("does not execute an action again on another device after its approval syncs", async () => {
  const SQL = await initSqlJs();
  for (const device of ["a", "b"] as const) {
    const db = new SQL.Database();
    db.run(`CREATE TABLE chat_sessions (
      id TEXT PRIMARY KEY, title TEXT, createdAt TEXT, updatedAt TEXT, pinned INTEGER,
      messageCount INTEGER, preview TEXT
    );
    CREATE TABLE sync_state (id INTEGER PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE assets_v2 (uuid TEXT);
    CREATE TABLE transactions (uuid TEXT);
    CREATE TABLE configuration (id INTEGER PRIMARY KEY, data TEXT);
    CREATE TABLE rebalance_profiles (id INTEGER PRIMARY KEY, targets TEXT, tolerance_percent REAL);
    CREATE TABLE sync_snapshot_revision_counter (id INTEGER PRIMARY KEY, revision INTEGER);
    INSERT INTO sync_snapshot_revision_counter VALUES (1, 0);
    CREATE TABLE sync_snapshot_revisions (uuid TEXT, revision INTEGER);`);
    storage.databases[device] = db;
  }
  storage.files.clear();
  const store = new FakeS3();
  await writeSyncHeader(store, (await createSyncHeader("correct horse battery staple")).header);
  const repositories = { a: new SqliteSyncRepository(), b: new SqliteSyncRepository() };
  const engines = {
    a: new SyncEngine(store, repositories.a, "correct horse battery staple"),
    b: new SyncEngine(store, repositories.b, "correct horse battery staple"),
  };
  try {
    storage.active = "a";
    await repositories.a.writeSession({
      id: "chat", title: "Chat", createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z", pinned: 0, messageCount: 1, preview: "",
      messages: [{ id: "message", at: "2026-01-01T00:00:00Z", role: "assistant", blocks: [{
        kind: "pending_action", id: "action", toolCallId: "call", name: "blacklist_add",
        args: {}, preview: { before: "", after: "BTC" }, risk: "low", status: "pending",
        createdAt: "2026-01-01T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z",
      }] }],
    });
    await engines.a.syncOnce({ categories: { history: false } });
    storage.active = "b";
    await engines.b.syncOnce({ categories: { history: false } });
    await repositories.b.listSessions();
    storage.active = "a";
    expect(await claimSessionAction("chat", "action", "executing")).toBe(true);
    await finishSessionAction("chat", "action", "approved", "Added BTC");
    await engines.a.syncOnce({ categories: { history: false } });
    storage.active = "b";
    await engines.b.syncOnce({ categories: { history: false } });
    expect((await repositories.b.listSessions())[0].messages[0].blocks).toMatchObject([
      { status: "approved", result: "Added BTC" },
    ]);
    expect(await claimSessionAction("chat", "action", "executing")).toBe(false);
  } finally {
    storage.databases.a.close();
    storage.databases.b.close();
  }
});
