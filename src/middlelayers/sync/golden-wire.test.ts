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
  invoke: async (command: string, args: { data?: string; rows?: Array<Record<string, string | number | null>>;
    deletedIds?: string[]; clearSnapshots?: boolean; snapshot?: Snapshot; uuid?: string }) => {
    if (command === "decrypt" && args.data === "!ent:fake-secrets") return "fake-secret-json";
    if (command === "encrypt") return `!ent:fake-${args.data}`;
    if (command === "delete_sync_snapshot") {
      for (const table of ["asset_prices", "transactions", "assets_v2"]) {
        state.db!.run(`DELETE FROM ${table} WHERE uuid = ?`, [args.uuid!]);
      }
      return;
    }
    if (command === "import_sync_snapshot" || command === "replace_sync_snapshot") {
      const db = state.db!;
      const snapshot = args.snapshot!;
      const exists = db.exec(`SELECT 1 FROM assets_v2 WHERE uuid = '${snapshot.uuid}'`).length > 0;
      if (command === "import_sync_snapshot" && exists) return false;
      if (command === "replace_sync_snapshot") {
        for (const table of ["asset_prices", "transactions", "assets_v2"]) {
          db.run(`DELETE FROM ${table} WHERE uuid = ?`, [snapshot.uuid]);
        }
      }
      const ids = new Map<number, number>();
      for (const asset of snapshot.assets) {
        db.run("INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [snapshot.uuid, asset.createdAt, asset.wallet, asset.asset_type, asset.symbol, asset.amount, asset.value, asset.price] as never[]);
        ids.set(Number(asset.id), Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]));
      }
      for (const transaction of snapshot.transactions) {
        db.run("INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt, createdAt, updatedAt) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
          snapshot.uuid, ids.get(Number(transaction.assetID)), transaction.asset_type, transaction.wallet,
          transaction.symbol, transaction.amount, transaction.price, transaction.txnType,
          transaction.txnCreatedAt, transaction.createdAt, transaction.updatedAt,
        ] as never[]);
      }
      for (const price of snapshot.prices) {
        if (!ids.has(Number(price.assetID))) continue;
        db.run("INSERT INTO asset_prices (uuid, assetID, symbol, price, assetCreatedAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
          [snapshot.uuid, ids.get(Number(price.assetID)), price.symbol, price.price, price.assetCreatedAt, price.updatedAt] as never[]);
      }
      return command === "import_sync_snapshot" ? true : undefined;
    }
    if (command === "save_sync_state") {
      const db = state.db!;
      db.run("BEGIN");
      try {
        if (args.clearSnapshots) db.run("DELETE FROM sync_snapshot_state");
        for (const id of args.deletedIds ?? []) db.run("DELETE FROM sync_snapshot_state WHERE snapshot_id = ?", [id]);
        for (const row of args.rows ?? []) db.run(
          `INSERT OR REPLACE INTO sync_snapshot_state
           (snapshot_id, snapshot_hash, snapshot_edit, pending_snapshot_edit, published, known,
            asset_rows, transaction_rows, row_events, transaction_events)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ["snapshotId", "snapshotHash", "snapshotEdit", "pendingSnapshotEdit", "published", "known",
            "assetRows", "transactionRows", "rowEvents", "transactionEvents"].map((key) => row[key]),
        );
        db.run("INSERT OR REPLACE INTO sync_state (id, data) VALUES (1, ?)", [args.data!]);
        db.run("COMMIT");
      } catch (error) {
        db.run("ROLLBACK");
        throw error;
      }
      return;
    }
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

class LegacyJsonRepository extends Repository {
  async loadState() { return JSON.parse(JSON.stringify(this.state)) as SyncState; }
  async saveState(value: SyncState) { this.state = JSON.parse(JSON.stringify(value)) as SyncState; }
}

async function seededRepository() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  state.db = db;
  for (const table of ["assets_v2", "asset_prices", "transactions", "configuration", "rebalance_profiles", "sync_state", "sync_snapshot_state", "sync_manifest_cache"]) {
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

async function decryptedBodies(store: FakeS3) {
  const bodies = await objectBodies(store);
  const result: Record<string, unknown> = {};
  for (const [path, body] of Object.entries(bodies)) {
    if (path === "sync-header") continue;
    const decoded = JSON.parse(decoder.decode(await decryptObject(
      fixedKey, path, JSON.parse(decoder.decode(Buffer.from(body, "base64"))),
    ))) as { value?: { entries?: Array<{ sha256?: string }> }; entries?: Array<{ sha256?: string }> };
    if (path.endsWith("/manifest")) {
      for (const entry of decoded.value?.entries ?? decoded.entries ?? []) delete entry.sha256;
    }
    result[path] = decoded;
  }
  return result;
}

describe("0.9.4 encrypted sync wire", () => {
  it("matches the migration fixture to current engine output", async () => {
    const { repo, db, snapshotId } = await seededRepository();
    const changes = await repo.listChangedSnapshotIds();
    const legacy = Object.assign(new LegacyJsonRepository(), {
      listChangedSnapshotIds: async () => changes,
    });
    legacy.snapshots.set(snapshotId, await repo.readSnapshot(snapshotId));
    for (const [id, value] of Object.entries(await repo.listConfig())) legacy.config.set(id, value);
    for (const session of await repo.listSessions()) legacy.sessions.set(session.id, session);
    const store = new FakeS3();
    await writeSyncHeader(store, header);
    const engine = new SyncEngine(store, legacy, "unused", { now: () => fixedTime });
    try {
      expect((await engine.syncOnce()).errors).toEqual([]);
      const current = await legacy.loadState();
      const fixture = resolve("tests/fixtures/sync-state-current-engine.json");
      if (process.env.UPDATE_GOLDEN === "1") writeFileSync(fixture, JSON.stringify(current) + "\n");
      expect(current).toStrictEqual(JSON.parse(readFileSync(fixture, "utf8")));
    } finally {
      engine.dispose();
      db.close();
      state.db = undefined;
    }
  });

  it("loads Rust-migrated state through SqliteSyncRepository without losing a field", async () => {
    const { repo, db } = await seededRepository();
    const migrated = JSON.parse(readFileSync(
      resolve("tests/fixtures/sync-state-migrated-current.json"), "utf8",
    )) as { data: string; rows: Array<Record<string, string | number | null>> };
    const original = JSON.parse(readFileSync(
      resolve("tests/fixtures/sync-state-current-engine.json"), "utf8",
    )) as SyncState;
    try {
      db.run("UPDATE sync_state SET data = ? WHERE id = 1", [migrated.data]);
      for (const row of migrated.rows) {
        db.run(
          `INSERT INTO sync_snapshot_state
           (snapshot_id, snapshot_hash, snapshot_edit, pending_snapshot_edit, published, known,
            asset_rows, transaction_rows, row_events, transaction_events)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ["snapshotId", "snapshotHash", "snapshotEdit", "pendingSnapshotEdit", "published", "known",
            "assetRows", "transactionRows", "rowEvents", "transactionEvents"].map((key) => row[key]),
        );
      }
      const loaded = await repo.loadState();
      await repo.loadSnapshotDetails(loaded, migrated.rows.map((row) => String(row.snapshotId)));
      const normalized = (value: SyncState) => ({
        ...value, known: [...value.known ?? []].sort(), published: [...value.published ?? []].sort(),
      });
      expect(normalized(loaded)).toStrictEqual(normalized(original));
    } finally {
      db.close();
      state.db = undefined;
    }
  });

  it("clears cached rows of a deleted snapshot on the next clean round", async () => {
    const { repo, db } = await seededRepository();
    const gone = "snapshot-deleted";
    const clock = { ms: fixedTime, counter: 0, deviceId };
    db.run("UPDATE sync_state SET data = ? WHERE id = 1", [
      JSON.stringify({ deviceId, tombstones: { [gone]: { deleted: true, clock } } }),
    ]);
    db.run(`INSERT INTO sync_snapshot_state
      (snapshot_id, snapshot_hash, known, asset_rows, transaction_rows) VALUES (?, 'old', '[]', '["stale"]', '{"old":{"price":1,"txnType":"buy"}}')`, [gone]);
    const store = new FakeS3();
    await writeSyncHeader(store, header);
    const engine = new SyncEngine(store, repo, "unused", { now: () => fixedTime });
    try {
      const list = store.listObjectsV2.bind(store);
      store.listObjectsV2 = async () => { throw new Error("injected listing failure"); };
      await expect(engine.syncOnce()).rejects.toThrow("injected listing failure");
      expect(db.exec("SELECT asset_rows FROM sync_snapshot_state WHERE snapshot_id = 'snapshot-deleted'")[0]?.values[0])
        .toEqual(['["stale"]']);
      store.listObjectsV2 = list;
      engine.dispose();
      expect((await engine.syncOnce()).errors).toEqual([]);
      expect(db.exec("SELECT asset_rows, transaction_rows FROM sync_snapshot_state WHERE snapshot_id = 'snapshot-deleted'")[0]?.values[0])
        .toEqual([null, null]);
    } finally {
      engine.dispose();
      db.close();
      state.db = undefined;
    }
  });

  it.each(["row_events", "asset_rows"])("retains an unloaded %s-only row on save", async (column) => {
    const { repo, db } = await seededRepository();
    db.run(`INSERT INTO sync_snapshot_state (snapshot_id, known, ${column}) VALUES ('details-only', '[]', ?)`,
      [column === "asset_rows" ? '["old"]' : '{"old":{"deleted":true}}']);
    try {
      const loaded = await repo.loadState();
      loaded.lastSync = fixedTime;
      await repo.saveState(loaded);
      expect(db.exec("SELECT snapshot_id FROM sync_snapshot_state WHERE snapshot_id = 'details-only'")[0]?.values)
        .toEqual([["details-only"]]);
    } finally {
      db.close();
      state.db = undefined;
    }
  });

  it("matches legacy state and pushed bodies through two-device edits, deletion, retry, and pruning", async () => {
    const first = await seededRepository();
    const ids = [...hourlyHistory(3, 2)].map((snapshot) => snapshot.id);
    for (const snapshot of [...hourlyHistory(3, 2)].slice(1)) {
      for (const asset of snapshot.assets) {
        first.db.run("INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) " +
          "VALUES (?, ?, 'wallet-golden', 'crypto', ?, ?, ?, ?)",
        [snapshot.id, snapshot.createdAt, asset.symbol, asset.amount, asset.value, asset.price]);
      }
    }
    const second = await seededRepository();
    second.db.run("DELETE FROM asset_prices");
    second.db.run("DELETE FROM transactions");
    second.db.run("DELETE FROM assets_v2");
    const secondId = "00000000-0000-4000-8000-000000000002";
    second.db.run("UPDATE sync_state SET data = ? WHERE id = 1", [JSON.stringify({ deviceId: secondId })]);
    const devices = [first, second];
    const legacy = [new LegacyJsonRepository(), new LegacyJsonRepository()];
    legacy[1].state.deviceId = secondId;
    for (let index = 0; index < 2; index++) {
      state.db = devices[index].db;
      for (const id of index === 0 ? ids : []) {
        legacy[index].snapshots.set(id, await devices[index].repo.readSnapshot(id));
      }
      for (const [id, value] of Object.entries(await devices[index].repo.listConfig())) legacy[index].config.set(id, value);
      for (const session of await devices[index].repo.listSessions()) legacy[index].sessions.set(session.id, session);
    }
    const oldStore = new FakeS3();
    const splitStore = new FakeS3();
    await writeSyncHeader(oldStore, header);
    await writeSyncHeader(splitStore, header);
    const oldEngines = legacy.map((repo) => new SyncEngine(oldStore, repo, "unused", { now: () => fixedTime }));
    const splitEngines = devices.map(({ repo }) => new SyncEngine(splitStore, repo, "unused", { now: () => fixedTime }));
    const semantic = (value: SyncState) => {
      const { snapshotRevision: _revision, ...rest } = value;
      return { ...rest, known: [...rest.known ?? []].sort(), published: [...rest.published ?? []].sort() };
    };
    const compareRound = async (index: number) => {
      const options = { manual: true, categories: { chat: false, settings: false, secrets: false, rebalance: false } };
      oldEngines[index].dispose();
      splitEngines[index].dispose();
      const oldReport = await oldEngines[index].syncOnce(options);
      state.db = devices[index].db;
      const splitReport = await splitEngines[index].syncOnce(options);
      expect({ pulled: splitReport.pulled, pushed: splitReport.pushed, errors: splitReport.errors,
        conflicts: splitReport.conflicts }).toEqual({
        pulled: oldReport.pulled, pushed: oldReport.pushed, errors: oldReport.errors,
        conflicts: oldReport.conflicts,
      });
      const splitState = await devices[index].repo.loadState();
      const allIds = devices[index].db.exec("SELECT snapshot_id FROM sync_snapshot_state")[0]?.values
        .map(([id]) => String(id)) ?? [];
      await devices[index].repo.loadSnapshotDetails(splitState, allIds);
      expect(semantic(splitState)).toEqual(semantic(await legacy[index].loadState()));
      expect(await decryptedBodies(splitStore)).toEqual(await decryptedBodies(oldStore));
      // Snapshot imports assign local row IDs; compare storage with the same local portfolio.
      legacy[index].snapshots.clear();
      for (const id of await devices[index].repo.listSnapshotIds()) {
        legacy[index].snapshots.set(id, await devices[index].repo.readSnapshot(id));
      }
      return oldReport;
    };
    const edit = async (index: number, id: string) => {
      state.db = devices[index].db;
      devices[index].db.run("UPDATE assets_v2 SET amount = amount + 1, value = value + 3 WHERE uuid = ?", [id]);
      legacy[index].snapshots.set(id, await devices[index].repo.readSnapshot(id));
    };
    let random = 0x5eed;
    try {
      await compareRound(0);
      await compareRound(1);
      await edit(0, ids[0]);
      await compareRound(0);
      await compareRound(1);
      await edit(1, ids[1]);
      await compareRound(1);
      await compareRound(0);
      first.db.run("DELETE FROM asset_prices WHERE uuid = ?", [ids[2]]);
      first.db.run("DELETE FROM transactions WHERE uuid = ?", [ids[2]]);
      first.db.run("DELETE FROM assets_v2 WHERE uuid = ?", [ids[2]]);
      legacy[0].snapshots.delete(ids[2]);
      await compareRound(0);
      await compareRound(1);
      state.db = first.db;
      first.db.run("INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) " +
        "VALUES (?, '2022-01-01T02:00:00.000Z', 'wallet-golden', 'crypto', 'ASSET0', 2, 3, 1)", [ids[2]]);
      legacy[0].snapshots.set(ids[2], await first.repo.readSnapshot(ids[2]));
      await compareRound(0);
      await compareRound(1);
      await edit(0, ids[0]);
      await compareRound(0);
      const oldGet = oldStore.getObject.bind(oldStore);
      const splitGet = splitStore.getObject.bind(splitStore);
      let failOld = true;
      let failSplit = true;
      oldStore.getObject = (async (path: string, signal?: AbortSignal, etag?: string) =>
        path.includes("/edit/") && failOld ? (() => { failOld = false; throw new Error("injected pull failure"); })() :
          etag === undefined ? oldGet(path, signal) : oldGet(path, signal, etag)) as FakeS3["getObject"];
      splitStore.getObject = (async (path: string, signal?: AbortSignal, etag?: string) =>
        path.includes("/edit/") && failSplit ? (() => { failSplit = false; throw new Error("injected pull failure"); })() :
          etag === undefined ? splitGet(path, signal) : splitGet(path, signal, etag)) as FakeS3["getObject"];
      const failed = await compareRound(1);
      expect(failed.errors).toContain("Failed to pull edit object");
      oldStore.getObject = oldGet;
      splitStore.getObject = splitGet;
      await compareRound(1);
      for (let step = 0; step < 12; step++) {
        random ^= random << 13;
        random ^= random >>> 17;
        random ^= random << 5;
        const index = random >>> 0 & 1;
        await edit(index, ids[(random >>> 2) % ids.length]);
        await compareRound(index);
        await compareRound(1 - index);
      }
      await oldStore.deleteObject(`devices/${deviceId}/manifest`);
      await splitStore.deleteObject(`devices/${deviceId}/manifest`);
      await compareRound(1);
    } finally {
      oldEngines.forEach((engine) => engine.dispose());
      splitEngines.forEach((engine) => engine.dispose());
      devices.forEach(({ db }) => db.close());
      state.db = undefined;
    }
  });

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
