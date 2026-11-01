// Regenerate only from 0.9.4: UPDATE_GOLDEN=1 corepack yarn vitest run src/middlelayers/sync/golden-wire.test.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { describe, expect, it, vi } from "vitest";
import { hourlyHistory } from "@/test/history-fixtures";
import { decryptObject, type SyncHeader } from "./crypto";
import { FakeS3, writeSyncHeader } from "./object-store";
import { SyncEngine, type Snapshot, type SyncRepository, type SyncSession, type SyncState } from "./engine";
import { SqliteSyncRepository } from "./sqlite-repository";

const state = vi.hoisted(() => ({ db: undefined as SqlJsDatabase | undefined }));
vi.mock("../database", () => ({
  getDatabase: async () => ({
    select: async (sql: string, values: unknown[] = []) => {
      const stmt = state.db!.prepare(sql);
      stmt.bind(values as (string | number | null)[]);
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
  }),
  executeWrite: async (sql: string, values: unknown[] = []) => {
    state.db!.run(sql, values as (string | number | null)[]);
    return { rowsAffected: state.db!.getRowsModified() };
  },
}));
vi.mock("../ai/sessions", async (importOriginal) => ({
  ...await importOriginal<typeof import("../ai/sessions")>(),
  listSessions: async () => [{
    id: "session-golden", title: "Golden chat", createdAt: "2022-01-01T00:00:00.000Z",
    updatedAt: "2022-01-01T00:00:00.000Z", pinned: 0, messageCount: 1, preview: "Hello",
  }],
  loadSession: async () => ({
    id: "session-golden", title: "Golden chat", createdAt: "2022-01-01T00:00:00.000Z",
    updatedAt: "2022-01-01T00:00:00.000Z", pinned: 0, messageCount: 1, preview: "Hello",
    messages: [{ role: "user", content: "Hello" }],
  }),
}));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (command: string, args: { data?: string }) => {
    if (command === "decrypt" && args.data === "!ent:fake-secrets") return "fake-secret-json";
    throw new Error(`Unexpected Tauri command: ${command}`);
  },
}));

const fixedKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
vi.mock("./crypto", async (importOriginal) => ({
  ...await importOriginal<typeof import("./crypto")>(),
  unlockSyncHeader: async () => fixedKey,
}));

const header: SyncHeader = {
  version: 1,
  kdf: { name: "argon2id", salt: "MDEyMzQ1Njc4OUFCQ0RFRg==", memoryKiB: 65536, iterations: 3, parallelism: 1 },
  keyCheck: { version: 1, nonce: "", ciphertext: "" },
};
const deviceId = "00000000-0000-4000-8000-000000000001";
const fixedTime = Date.parse("2024-04-16T13:00:00.000Z");
const decoder = new TextDecoder();
const golden = (name: string) => resolve(`tests/golden/sync-${name}.json`);
function capture(name: string, value: unknown) {
  const text = JSON.stringify(value, null, 2) + "\n";
  if (process.env.UPDATE_GOLDEN === "1") {
    mkdirSync(resolve("tests/golden"), { recursive: true });
    writeFileSync(golden(name), text);
  }
  expect(value).toStrictEqual(JSON.parse(readFileSync(golden(name), "utf8")));
}

class Repository implements SyncRepository {
  state: SyncState = { deviceId };
  snapshots = new Map<string, Snapshot>();
  config = new Map<string, string>();
  sessions = new Map<string, SyncSession>();
  async loadState() { return structuredClone(this.state); }
  async saveState(value: SyncState) { this.state = structuredClone(value); }
  async listSnapshotIds() { return [...this.snapshots.keys()]; }
  async readSnapshot(id: string) { return structuredClone(this.snapshots.get(id)!); }
  async importSnapshot(value: Snapshot) {
    if (this.snapshots.has(value.uuid)) return false;
    this.snapshots.set(value.uuid, structuredClone(value));
    return true;
  }
  async replaceSnapshot(value: Snapshot) { this.snapshots.set(value.uuid, structuredClone(value)); }
  async deleteSnapshot(id: string) { this.snapshots.delete(id); }
  async listConfig() { return Object.fromEntries(this.config); }
  async writeConfig(id: string, value: string | null) {
    if (value === null) this.config.delete(id);
    else this.config.set(id, value);
  }
  async listSessions() { return [...this.sessions.values()].map((session) => structuredClone(session)); }
  async listSessionIds() { return [...this.sessions.keys()]; }
  async writeSession(value: SyncSession) { this.sessions.set(value.id, structuredClone(value)); }
  async deleteSession(id: string) { this.sessions.delete(id); }
  takeReadErrors() { return { configIds: [], sessionIds: [] }; }
  dataChanged() {}
}

async function seededRepository() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  state.db = db;
  for (const table of ["assets_v2", "asset_prices", "transactions", "configuration", "rebalance_profiles", "sync_state", "sync_manifest_cache"]) {
    db.run(readFileSync(resolve(`src-tauri/migrations/init/${table}_up.sql`), "utf8"));
  }
  const snapshot = [...hourlyHistory(1, 2)][0];
  for (const asset of snapshot.assets) {
    db.run("INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, 'wallet-golden', 'crypto', ?, ?, ?, ?)",
      [snapshot.id, snapshot.createdAt, asset.symbol, asset.amount, asset.value, asset.price]);
  }
  db.run(`INSERT INTO asset_prices (uuid, assetID, symbol, price, assetCreatedAt, updatedAt)
    VALUES ('snapshot-000000', 1, 'ASSET0', 1, '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z')`);
  db.run(`INSERT INTO asset_prices (uuid, assetID, symbol, price, assetCreatedAt, updatedAt)
    VALUES ('snapshot-000000', 99, 'ORPHAN', 1, '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z')`);
  db.run(`INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt, createdAt, updatedAt)
    VALUES ('snapshot-000000', 1, 'crypto', 'wallet-golden', 'ASSET0', 1, 1, 'buy',
    '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z')`);
  db.run(`INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt, createdAt, updatedAt)
    VALUES ('snapshot-000000', 99, 'crypto', 'wallet-golden', 'ORPHAN', 1, 1, 'buy',
    '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z')`);
  db.run("INSERT INTO configuration (id, data) VALUES (7, 'USD'), (10, '!ent:fake-secrets'), (991, 'local-only')");
  db.run("INSERT INTO rebalance_profiles (id, targets, tolerance_percent) VALUES (1, '[{\"symbol\":\"BTC\",\"percent\":50}]', 2.5)");
  db.run("INSERT INTO sync_state (id, data) VALUES (1, ?)", [JSON.stringify({ deviceId })]);
  return { repo: new SqliteSyncRepository(), db, snapshotId: snapshot.id };
}

async function objectBodies(store: FakeS3) {
  const result: Record<string, string> = {};
  let next: string | undefined;
  do {
    const page = await store.listObjectsV2({ continuationToken: next });
    for (const object of page.objects) {
      result[object.key] = Buffer.from((await store.getObject(object.key))!.body).toString("base64");
    }
    next = page.nextContinuationToken;
  } while (next);
  return result;
}

describe("0.9.4 encrypted sync wire", () => {
  it("pins every decrypted pushed object and restores a committed bucket", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedTime);
    const random = vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      const bytes = array as Uint8Array;
      for (let index = 0; index < bytes.length; index++) bytes[index] = index + 7;
      return array;
    });
    try {
      const { repo: source, db, snapshotId } = await seededRepository();
      const originalSnapshots = [await source.readSnapshot(snapshotId)];
      expect(originalSnapshots[0].prices).toHaveLength(1);
      expect(originalSnapshots[0].transactions).toHaveLength(1);
      const originalConfig = await source.listConfig();
      const originalSessions = await source.listSessions();
      expect(originalConfig).toStrictEqual({
        "7": "USD", "10": "fake-secret-json",
        rebalance: '{"targets":"[{\\"symbol\\":\\"BTC\\",\\"percent\\":50}]","tolerance_percent":2.5}',
      });
      expect(originalSessions[0].messages[0]).toMatchObject({
        role: "user", content: "Hello", at: "2022-01-01T00:00:00.000Z",
      });
      const store = new FakeS3();
      await writeSyncHeader(store, header);
      const result = await new SyncEngine(store, source, "unused", { now: () => fixedTime })
        .syncOnce({ deviceName: "Golden device" });
      expect(result.errors).toStrictEqual([]);
      const bodies = await objectBodies(store);
      const plaintext: Record<string, unknown> = {};
      for (const [path, body] of Object.entries(bodies)) {
        if (path === "sync-header") continue;
        const decoded = decoder.decode(await decryptObject(fixedKey, path, JSON.parse(decoder.decode(Buffer.from(body, "base64")))));
        plaintext[path] = JSON.parse(decoded);
      }
      capture("real-wire-0.9.4", plaintext);
      capture("real-bucket-0.9.4", bodies);

      const committed = JSON.parse(readFileSync(golden("real-bucket-0.9.4"), "utf8")) as Record<string, string>;
      const restored = new FakeS3();
      for (const [path, body] of Object.entries(committed)) {
        await restored.putObject(path, Uint8Array.from(Buffer.from(body, "base64")));
      }
      const target = new Repository();
      target.state.deviceId = "00000000-0000-4000-8000-000000000002";
      const pulled = await new SyncEngine(restored, target, "unused", { now: () => fixedTime }).syncOnce();
      expect(pulled.errors).toStrictEqual([]);
      expect([...target.snapshots.values()]).toStrictEqual(originalSnapshots);
      expect(Object.fromEntries(target.config)).toStrictEqual(originalConfig);
      expect([...target.sessions.values()]).toStrictEqual(originalSessions);
      db.close();
      state.db = undefined;
    } finally {
      random.mockRestore();
      vi.useRealTimers();
    }
  });

  it("pulls the original committed 0.9.4 bucket", async () => {
    const committed = JSON.parse(readFileSync(golden("bucket-0.9.4"), "utf8")) as Record<string, string>;
    const restored = new FakeS3();
    for (const [path, body] of Object.entries(committed)) {
      await restored.putObject(path, Uint8Array.from(Buffer.from(body, "base64")));
    }
    const target = new Repository();
    target.state.deviceId = "00000000-0000-4000-8000-000000000002";
    const pulled = await new SyncEngine(restored, target, "unused", { now: () => fixedTime }).syncOnce();
    expect(pulled.errors).toStrictEqual([]);
    const snapshot = JSON.parse(readFileSync(golden("snapshot"), "utf8")) as Snapshot;
    const session = JSON.parse(readFileSync(golden("session"), "utf8")) as SyncSession;
    const config = JSON.parse(readFileSync(golden("config"), "utf8")) as { value: string };
    expect(target.snapshots.get(snapshot.uuid)).toStrictEqual(snapshot);
    expect(target.sessions.get(session.id)).toStrictEqual(session);
    expect(Object.fromEntries(target.config)).toStrictEqual({ "7": config.value });
  });
});
