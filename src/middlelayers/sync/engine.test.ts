import { describe, expect, it, vi } from "vitest";
import { createSyncHeader, decryptObject, encryptObject, unlockSyncHeader } from "./crypto";
import { FakeS3, S3Error, readSyncHeader, writeSyncHeader } from "./object-store";
import {
  SyncEngine,
  mergeSessions,
  resetSyncState,
  type SyncRepository,
  type Snapshot,
  type SyncState,
  type SyncSession,
} from "./engine";
import { SyncRuntime } from "./runtime";
import { defaultSyncSettings, type SyncSettings } from "./settings";

vi.setConfig({ testTimeout: 20_000 });

class MemoryRepository implements SyncRepository {
  state: SyncState = {};
  snapshots = new Map<string, Snapshot>();
  config = new Map<string, string>();
  sessions = new Map<string, SyncSession>();
  unreadableSessions = new Set<string>();

  async loadState() { return structuredClone(this.state); }
  async saveState(state: SyncState) { this.state = structuredClone(state); }
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
  async listSessions() { return [...this.sessions.values()].map((v) => structuredClone(v)); }
  async listSessionIds() { return [...this.sessions.keys(), ...this.unreadableSessions]; }
  async writeSession(value: SyncSession) { this.sessions.set(value.id, structuredClone(value)); }
  async deleteSession(id: string) { this.sessions.delete(id); }
  takeReadErrors() { return { configIds: [] as string[], sessionIds: [] as string[] }; }
  dataChanged() {}
}

const snapshot = (uuid: string, amount = 1): Snapshot => ({
  uuid,
  assets: [{ id: 1, uuid, createdAt: "2026-01-01T00:00:00Z", asset_type: "crypto", wallet: "", symbol: "BTC", amount, value: amount, price: 1 }],
  prices: [{ id: 1, uuid, assetID: 1, symbol: "BTC", price: 1, assetCreatedAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }],
  transactions: [{ id: 1, uuid, assetID: 1, asset_type: "crypto", wallet: "", symbol: "BTC", amount, price: 1, txnType: "buy", txnCreatedAt: "2026-01-01T00:00:00Z", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }],
});

async function devices(count: number, pageSize = 1000) {
  const s3 = new FakeS3(pageSize);
  const { header } = await createSyncHeader("passphrase");
  await writeSyncHeader(s3, header);
  const repos = Array.from({ length: count }, () => new MemoryRepository());
  const engines = repos.map((repo, i) => new SyncEngine(s3, repo, "passphrase", {
    now: () => Date.parse("2026-01-02T00:00:00.000Z") + i * 100,
  }));
  return { s3, repos, engines };
}

describe("SyncEngine", () => {
  it("leaves snapshot history local when history sync is disabled", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("a", snapshot("a"));
    repos[1].snapshots.set("b", snapshot("b"));
    await engines[0].syncOnce({ categories: { history: false } });
    await engines[1].syncOnce({ categories: { history: false } });
    expect([...repos[0].snapshots.keys()]).toEqual(["a"]);
    expect([...repos[1].snapshots.keys()]).toEqual(["b"]);
    expect((await engines[0].syncOnce({ categories: { history: false } })).pushed).toBe(0);
  });
  it("reports the device that supplied newly pulled snapshots", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("a", snapshot("a"));
    await engines[0].syncOnce();
    const report = await engines[1].syncOnce();
    expect(report.pulledFrom).toEqual([repos[0].state.deviceId]);
    expect(report.devices).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: repos[0].state.deviceId, lastUpload: expect.any(String) }),
    ]));
  });
  it("shares an edited device name through its manifest without requiring a new object", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("a", snapshot("a"));
    await engines[0].syncOnce({ deviceName: "Laptop" });
    expect((await engines[1].syncOnce()).devices).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: repos[0].state.deviceId, name: "Laptop" }),
    ]));
    const renamed = await engines[0].syncOnce({ deviceName: "Desk" });
    expect(renamed.errors).toEqual([]);
    expect((await engines[1].syncOnce()).devices).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: repos[0].state.deviceId, name: "Desk" }),
    ]));
    repos[0].config.set("7", "USD");
    await engines[0].syncOnce();
    expect((await engines[1].syncOnce()).devices).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: repos[0].state.deviceId, name: "Desk" }),
    ]));
  });
  it("does not use the root key directly for configuration fingerprints", async () => {
    const { s3, repos, engines } = await devices(1);
    repos[0].config.set("7", "USD");
    await engines[0].syncOnce();
    const root = await unlockSyncHeader((await readSyncHeader(s3))!, "passphrase");
    const rawHmac = await crypto.subtle.importKey("raw", root, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const rawHash = Array.from(new Uint8Array(await crypto.subtle.sign(
      "HMAC", rawHmac, new TextEncoder().encode("USD"),
    )), (byte) => byte.toString(16).padStart(2, "0")).join("");
    expect(repos[0].state.config?.["7"].hash).not.toBe(rawHash);
  });
  it("republishes local history after the remote header is replaced", async () => {
    const { s3, repos, engines } = await devices(2);
    repos[0].snapshots.set("a", snapshot("a"));
    await engines[0].syncOnce();
    for (const item of (await s3.listObjectsV2()).objects) await s3.deleteObject(item.key);
    await writeSyncHeader(s3, (await createSyncHeader("passphrase")).header);
    await engines[0].syncOnce();
    const report = await engines[1].syncOnce();
    expect(report.pulled).toBe(1);
    expect(repos[1].snapshots.has("a")).toBe(true);
    expect(repos[0].state.deviceId).toBeDefined();
  });
  it("uploads local history again after Forget remote data and re-enable", async () => {
    const s3 = new FakeS3();
    const firstRepo = new MemoryRepository();
    const secondRepo = new MemoryRepository();
    firstRepo.snapshots.set("a", snapshot("a"));
    const secret = "correct horse battery staple";
    const firstEngine = new SyncEngine(s3, firstRepo, secret);
    const secondEngine = new SyncEngine(s3, secondRepo, secret);
    let saved: SyncSettings = { ...defaultSyncSettings, endpoint: "https://s3.example.test",
      region: "us-east-1", bucket: "track3", accessKeyId: "key", secretAccessKey: "secret" };
    const runtime = new SyncRuntime({
      load: async () => saved,
      save: async (next) => { saved = next; },
      store: () => s3,
      engine: () => ({ engine: firstEngine, unregister: () => {} }),
      resetState: async () => firstRepo.saveState(resetSyncState(await firstRepo.loadState())),
    });
    await runtime.initialize();
    expect(await runtime.configure(saved, secret)).toBe("ok");
    await runtime.syncNow();
    await runtime.forgetRemote();
    expect(await runtime.configure(saved, secret)).toBe("ok");
    await runtime.syncNow();
    expect((await secondEngine.syncOnce()).pulled).toBe(1);
    expect(secondRepo.snapshots.has("a")).toBe(true);
    runtime.stop();
  });
  it("accepts S3 conditional conflict status 409 during probes and immutable reuse", async () => {
    const { s3, repos, engines } = await devices(1);
    repos[0].snapshots.set("a", snapshot("a"));
    const put = s3.putObject.bind(s3);
    s3.putObject = async (key, body, conditions, signal) => {
      try {
        return await put(key, body, conditions, signal);
      } catch (error) {
        if (error instanceof S3Error && error.status === 412) throw new S3Error("ConditionalRequestConflict", 409);
        throw error;
      }
    };
    expect((await engines[0].syncOnce()).errors).toEqual([]);
  });
  it("chooses the same session metadata on equal timestamps regardless of merge order", () => {
    const a: SyncSession = { id: "chat", title: "Alpha", createdAt: "2026-01-01", updatedAt: "2026-01-02", pinned: 0, messageCount: 0, preview: "", messages: [] };
    const b = { ...a, title: "Beta" };
    expect(mergeSessions(a, b).title).toBe(mergeSessions(b, a).title);
  });

  it("keeps unpublished deletions when the remote header salt changes", () => {
    const pending = { one: { deleted: true, clock: { ms: 10, counter: 0, deviceId: "device" } } };
    expect(resetSyncState({ deviceId: "device", pendingTombstones: pending }).pendingTombstones).toEqual(pending);
  });
  it("keeps a locally deleted session deleted after joining a replaced store", async () => {
    const { s3, repos, engines } = await devices(2);
    const chat: SyncSession = { id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 0, preview: "", messages: [] };
    repos[0].sessions.set("chat", chat);
    await engines[0].syncOnce();
    repos[0].sessions.delete("chat");
    const put = s3.putObject.bind(s3);
    s3.putObject = async (key, body, conditions, signal) => {
      if (key.includes("/session-delete/")) throw new Error("network");
      return put(key, body, conditions, signal);
    };
    expect((await engines[0].syncOnce()).errors).toContain("Failed to push session-delete object");
    expect(repos[0].state.pendingSessionDeletions?.chat).toBeDefined();
    s3.putObject = put;
    for (const item of (await s3.listObjectsV2()).objects) await s3.deleteObject(item.key);
    await writeSyncHeader(s3, (await createSyncHeader("passphrase")).header);
    repos[1].sessions.set("chat", chat);
    await engines[1].syncOnce();
    await engines[0].syncOnce();
    expect(repos[0].sessions.has("chat")).toBe(false);
    expect(repos[0].state.pendingSessionDeletions?.chat ?? repos[0].state.sessionDeletions?.chat).toBeDefined();
  });
  it("does not create a fresh deletion for an already deleted session after a reset", async () => {
    const { s3, repos, engines } = await devices(2);
    const chat: SyncSession = { id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 0, preview: "", messages: [] };
    repos[0].sessions.set("chat", chat);
    await engines[0].syncOnce();
    repos[0].sessions.delete("chat");
    await engines[0].syncOnce();
    const deletion = repos[0].state.sessionDeletions!.chat;
    repos[0].state.trackedSessions = ["chat"];
    for (const item of (await s3.listObjectsV2()).objects) await s3.deleteObject(item.key);
    await writeSyncHeader(s3, (await createSyncHeader("passphrase")).header);
    repos[1].sessions.set("chat", chat);
    await engines[1].syncOnce();
    await engines[0].syncOnce();
    expect(repos[0].state.sessionDeletions?.chat).toEqual(deletion);
    expect(repos[0].state.pendingSessionDeletions?.chat).toBeUndefined();
    expect(repos[1].sessions.has("chat")).toBe(true);
  });
  it("keeps an unpublished snapshot deletion when its device joins a replaced store first", async () => {
    const { s3, repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].snapshots.delete("one");
    await engines[0].recordDeletion("one");
    const put = s3.putObject.bind(s3);
    s3.putObject = async (key, body, conditions, signal) => {
      if (key.includes("/tombstone/")) throw new Error("network");
      return put(key, body, conditions, signal);
    };
    expect((await engines[0].syncOnce()).errors).toContain("Failed to push tombstone object");
    s3.putObject = put;
    for (const item of (await s3.listObjectsV2()).objects) await s3.deleteObject(item.key);
    await writeSyncHeader(s3, (await createSyncHeader("passphrase")).header);
    await engines[0].syncOnce();
    const report = await engines[1].syncOnce();
    expect(report.conflicts).not.toContain("snapshot:one");
    expect(repos[1].snapshots.has("one")).toBe(false);
  });
  it("keeps an unpublished chat deletion when its device joins a replaced store first", async () => {
    const { s3, repos, engines } = await devices(2);
    const chat: SyncSession = { id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 0, preview: "", messages: [] };
    repos[0].sessions.set("chat", chat);
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].sessions.delete("chat");
    const put = s3.putObject.bind(s3);
    s3.putObject = async (key, body, conditions, signal) => {
      if (key.includes("/session-delete/")) throw new Error("network");
      return put(key, body, conditions, signal);
    };
    expect((await engines[0].syncOnce()).errors).toContain("Failed to push session-delete object");
    s3.putObject = put;
    for (const item of (await s3.listObjectsV2()).objects) await s3.deleteObject(item.key);
    await writeSyncHeader(s3, (await createSyncHeader("passphrase")).header);
    await engines[0].syncOnce();
    const report = await engines[1].syncOnce();
    expect(report.conflicts).not.toContain("session:chat");
    expect(repos[1].sessions.has("chat")).toBe(false);
  });
  it("publishes later edits to a snapshot kept during a store reset conflict", async () => {
    const { s3, repos, engines } = await devices(3);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    await engines[2].syncOnce();
    repos[0].snapshots.delete("one");
    await engines[0].recordDeletion("one");
    const localEdit = snapshot("one", 2);
    repos[1].snapshots.set("one", localEdit);
    for (const item of (await s3.listObjectsV2()).objects) await s3.deleteObject(item.key);
    await writeSyncHeader(s3, (await createSyncHeader("passphrase")).header);
    await engines[2].syncOnce();
    await engines[0].syncOnce();
    expect((await engines[1].syncOnce()).conflicts).toContain("snapshot:one");
    const laterEdit = snapshot("one", 3);
    repos[1].snapshots.set("one", laterEdit);
    await engines[1].syncOnce();
    await engines[2].syncOnce();
    expect(repos[2].snapshots.get("one")).toEqual(laterEdit);
  });
  it("accepts a reset store deletion when the local snapshot matches its original version", async () => {
    const { s3, repos, engines } = await devices(3);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    for (const item of (await s3.listObjectsV2()).objects) await s3.deleteObject(item.key);
    await writeSyncHeader(s3, (await createSyncHeader("passphrase")).header);
    await engines[0].syncOnce();
    repos[0].snapshots.set("one", snapshot("one", 2));
    await engines[0].syncOnce();
    await engines[2].syncOnce();
    repos[2].snapshots.delete("one");
    await engines[2].recordDeletion("one");
    await engines[2].syncOnce();
    const report = await engines[1].syncOnce();
    expect(report.conflicts).not.toContain("snapshot:one");
    expect(repos[1].snapshots.has("one")).toBe(false);
  });
  it("prunes deleted snapshot row caches and rebuilds them after Undo", async () => {
    const { repos, engines } = await devices(1);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    expect(repos[0].state.assetRows?.one).toHaveLength(1);
    repos[0].snapshots.delete("one");
    await engines[0].recordDeletion("one");
    await engines[0].syncOnce();
    expect(repos[0].state.assetRows?.one).toBeUndefined();
    expect(repos[0].state.transactionRows?.one).toBeUndefined();
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].recordUndo("one");
    await engines[0].syncOnce();
    expect(repos[0].state.assetRows?.one).toHaveLength(1);
    expect(Object.keys(repos[0].state.transactionRows?.one ?? {})).toHaveLength(1);
  });
  it("rejects session messages without stable IDs", () => {
    const session = {
      id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 1, preview: "",
      messages: [{ at: "2026-01-01", role: "user", content: "Hi" }],
    } as unknown as SyncSession;
    expect(() => mergeSessions(undefined, session)).toThrow(/message/i);
  });
  it("unions concurrent refreshes across three devices without duplicate imports", async () => {
    const { repos, engines } = await devices(3, 2);
    repos.forEach((repo, i) => repo.snapshots.set(`snapshot-${i}`, snapshot(`snapshot-${i}`)));
    await Promise.all(engines.map((engine) => engine.syncOnce()));
    await Promise.all(engines.map((engine) => engine.syncOnce()));
    expect(repos.map((repo) => [...repo.snapshots.keys()].sort())).toEqual(Array(3).fill(0).map(() => ["snapshot-0", "snapshot-1", "snapshot-2"]));
    expect((await engines[0].syncOnce()).pulled).toBe(0);
  });

  it("applies a delete over a concurrent keep, then restores on newer undo", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    await repos[0].deleteSnapshot("one");
    await engines[0].recordDeletion("one");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[1].snapshots.has("one")).toBe(false);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].recordUndo("one");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[1].snapshots.get("one")).toEqual(snapshot("one"));
  });
  it("keeps and republishes a snapshot edited after a remote delete clock", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    const edited = snapshot("one", 3);
    repos[1].snapshots.set("one", edited);
    await engines[1].syncOnce();
    repos[0].snapshots.delete("one");
    await engines[0].recordDeletion("one");
    await engines[0].syncOnce();
    const report = await engines[1].syncOnce();
    expect(repos[1].snapshots.get("one")).toEqual(edited);
    expect(report.conflicts).toContain("snapshot:one");
    await engines[0].syncOnce();
    expect(repos[0].snapshots.get("one")).toEqual(edited);
  });
  it("keeps an unsynced local snapshot edit even when its device clock trails the delete", async () => {
    const { repos, engines } = await devices(2);
    repos[1].snapshots.set("one", snapshot("one"));
    await engines[1].syncOnce();
    await engines[0].syncOnce();
    const edited = snapshot("one", 4);
    repos[0].snapshots.set("one", edited);
    repos[1].snapshots.delete("one");
    await engines[1].recordDeletion("one");
    await engines[1].syncOnce();
    expect((await engines[0].syncOnce()).conflicts).toContain("snapshot:one");
    expect(repos[0].snapshots.get("one")).toEqual(edited);
  });
  it("checks a snapshot's content before deletion even when the revision index missed its edit", async () => {
    const { repos, engines } = await devices(2);
    repos[1].snapshots.set("one", snapshot("one"));
    await engines[1].syncOnce();
    Object.assign(repos[0], { listChangedSnapshotIds: async (since?: number) => ({
      ids: since === undefined ? ["one"] : [], revision: 1,
    }) });
    await engines[0].syncOnce();
    const edited = snapshot("one", 5);
    repos[0].snapshots.set("one", edited);
    repos[1].snapshots.delete("one");
    await engines[1].recordDeletion("one");
    await engines[1].syncOnce();
    expect((await engines[0].syncOnce()).conflicts).toContain("snapshot:one");
    expect(repos[0].snapshots.get("one")).toEqual(edited);
  });
  it("retries a tombstone after a local snapshot read failure", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[1].snapshots.delete("one");
    await engines[1].recordDeletion("one");
    await engines[1].syncOnce();
    const read = repos[0].readSnapshot.bind(repos[0]);
    repos[0].readSnapshot = async () => { throw new Error("disk unavailable"); };
    expect((await engines[0].syncOnce()).errors).toContain("Failed to read local snapshot");
    expect(repos[0].snapshots.has("one")).toBe(true);
    repos[0].readSnapshot = read;
    await engines[0].syncOnce();
    expect(repos[0].snapshots.has("one")).toBe(false);
  });

  it("publishes edits made while restoring a deleted snapshot", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    await repos[0].deleteSnapshot("one");
    await engines[0].recordDeletion("one");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    const restored = snapshot("one");
    restored.transactions[0].price = 9;
    repos[0].snapshots.set("one", restored);
    await engines[0].recordUndo("one");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[1].snapshots.get("one")?.transactions[0].price).toBe(9);
  });

  it("resolves config by HLC and leaves secrets alone when disabled", async () => {
    const { repos, engines } = await devices(2);
    repos[0].config.set("7", "USD");
    repos[0].config.set("10", "!ent:secret-a");
    repos[1].config.set("7", "EUR");
    await engines[0].syncOnce();
    await engines[1].syncOnce({ categories: { secrets: false } });
    await engines[0].syncOnce();
    expect(repos[0].config.get("7")).toBe("USD");
    expect(repos[1].config.get("7")).toBe("EUR");
    expect(JSON.stringify(repos[0].state)).not.toContain("secret-a");
    expect(repos[1].config.has("10")).toBe(false);
    await engines[1].resolveConfigConflict("7", "remote");
    await engines[1].syncOnce();
    expect(repos[1].config.get("7")).toBe("USD");
    expect(repos[1].config.get("10")).toBe("!ent:secret-a");
  });

  it("reports a joining device's conflicting initial config", async () => {
    const { repos, engines } = await devices(2);
    repos[0].config.set("7", "USD");
    repos[1].config.set("7", "EUR");
    await engines[0].syncOnce();
    const report = await engines[1].syncOnce();
    expect(report.conflicts).toContain("7");
    expect(repos[1].config.get("7")).toBe("EUR");
    expect((await engines[1].configConflicts()).map((item) => item.id)).toContain("7");
  });
  it("clears a config conflict after its remote entry leaves the manifest", async () => {
    const { s3, repos, engines } = await devices(2);
    repos[0].config.set("7", "USD");
    repos[1].config.set("7", "EUR");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    await s3.deleteObject(`devices/${repos[0].state.deviceId}/manifest`);
    const report = await engines[1].syncOnce();
    expect(report.errors).toEqual([]);
    expect(await engines[1].configConflicts()).toEqual([]);
    expect(report.conflicts).not.toContain("7");
    expect(repos[1].config.get("7")).toBe("EUR");
  });
  it("clears a config conflict when the local value becomes equal to the remote value", async () => {
    const { repos, engines } = await devices(2);
    repos[0].config.set("7", "USD");
    repos[1].config.set("7", "EUR");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[1].config.set("7", "USD");
    const report = await engines[1].syncOnce();
    expect(await engines[1].configConflicts()).toEqual([]);
    expect(report.conflicts).not.toContain("7");
  });
  it("keeps a joining device's secret until its conflict is resolved", async () => {
    const { repos, engines } = await devices(2);
    repos[0].config.set("10", "remote-secret");
    repos[1].config.set("10", "local-secret");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[1].config.get("10")).toBe("local-secret");
    await engines[1].resolveConfigConflict("10", "remote");
    await engines[1].syncOnce();
    expect(repos[1].config.get("10")).toBe("remote-secret");
  });
  it("publishes a chosen local config over the conflicting remote version", async () => {
    const { repos, engines } = await devices(2);
    repos[0].config.set("7", "USD");
    repos[1].config.set("7", "EUR");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    await engines[1].resolveConfigConflict("7", "local");
    const resolved = await engines[1].syncOnce();
    expect(resolved.conflicts).not.toContain("7");
    await engines[0].syncOnce();
    expect(repos[0].config.get("7")).toBe("EUR");
  });
  it("honors a local deletion chosen while a config conflict is open", async () => {
    const { repos, engines } = await devices(2);
    repos[0].config.set("7", "USD");
    repos[1].config.set("7", "EUR");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[1].config.delete("7");
    await engines[1].resolveConfigConflict("7", "local");
    await engines[1].syncOnce();
    expect(repos[1].config.has("7")).toBe(false);
    await engines[0].syncOnce();
    expect(repos[0].config.has("7")).toBe(false);
  });
  it("rejects a session delete older than a local update", async () => {
    const { repos, engines } = await devices(2);
    const chat: SyncSession = { id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 1, preview: "Hi",
      messages: [{ id: "m1", at: "2026-01-01", role: "user", content: "Hi" }] };
    repos[0].sessions.set("chat", chat);
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[1].sessions.set("chat", { ...chat, updatedAt: "2026-01-02T00:00:00.200Z", title: "Updated" });
    repos[0].sessions.delete("chat");
    await engines[0].syncOnce();
    const report = await engines[1].syncOnce();
    expect(report.conflicts).toContain("session:chat");
    expect(repos[1].sessions.get("chat")?.title).toBe("Updated");
    await engines[0].syncOnce();
    expect(repos[0].sessions.get("chat")?.title).toBe("Updated");
  });
  it("republishes an unchanged chat when its timestamp is newer than a deletion clock", async () => {
    const { s3, repos, engines } = await devices(2);
    const chat: SyncSession = { id: "chat", title: "Chat", createdAt: "2026-01-01",
      updatedAt: "2026-01-01", pinned: 0, messageCount: 0, preview: "", messages: [] };
    repos[0].sessions.set("chat", chat);
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[1].sessions.set("chat", { ...chat, updatedAt: "2026-01-02T00:00:00.200Z" });
    await engines[1].syncOnce();
    await s3.deleteObject(`devices/${repos[1].state.deviceId}/manifest`);
    repos[0].sessions.delete("chat");
    await engines[0].syncOnce();
    expect((await engines[1].syncOnce()).conflicts).toContain("session:chat");
    await engines[0].syncOnce();
    expect(repos[0].sessions.get("chat")).toEqual(repos[1].sessions.get("chat"));
  });
  it("keeps an unsynced chat update despite a faster deleter clock", async () => {
    const { repos, engines } = await devices(2);
    const chat: SyncSession = { id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 0, preview: "", messages: [] };
    repos[0].sessions.set("chat", chat);
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].sessions.set("chat", { ...chat, title: "Updated", updatedAt: "2026-01-02T00:00:00.000Z" });
    repos[1].sessions.delete("chat");
    await engines[1].syncOnce();
    expect((await engines[0].syncOnce()).conflicts).toContain("session:chat");
    expect(repos[0].sessions.get("chat")?.title).toBe("Updated");
    await engines[1].syncOnce();
    expect(repos[1].sessions.get("chat")?.title).toBe("Updated");
  });
  it("reports a failed chat keep write without applying the competing delete", async () => {
    const { repos, engines } = await devices(2);
    const chat: SyncSession = { id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 0, preview: "", messages: [] };
    repos[0].sessions.set("chat", chat);
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].sessions.set("chat", { ...chat, title: "Updated", updatedAt: "2026-01-02T00:00:00.000Z" });
    repos[1].sessions.delete("chat");
    await engines[1].syncOnce();
    repos[0].writeSession = async () => { throw new Error("disk unavailable"); };
    const report = await engines[0].syncOnce();
    expect(report.errors).toContain("Failed to retain local session");
    expect(repos[0].sessions.get("chat")?.title).toBe("Updated");
  });
  it("preserves an approved action while merging a stale pending copy", () => {
    const base: SyncSession = { id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 1, preview: "", messages: [{ id: "m1", at: "2026-01-01", role: "assistant",
        blocks: [{ kind: "pending_action", id: "action", status: "pending" }] }] };
    const approved: SyncSession = { ...base, updatedAt: "2026-01-02", messages: [{
      ...base.messages[0], blocks: [{ kind: "pending_action", id: "action", status: "approved", result: "Done" }],
    }] };
    expect(mergeSessions(base, approved).messages[0].blocks).toEqual(approved.messages[0].blocks);
    expect(mergeSessions(approved, base).messages[0].blocks).toEqual(approved.messages[0].blocks);
  });
  it("preserves a completed action over a newer expired or rejected copy", () => {
    const base: SyncSession = { id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 1, preview: "", messages: [{ id: "m1", at: "2026-01-01", role: "assistant",
        blocks: [{ kind: "pending_action", id: "action", status: "approved", result: "Done" }] }] };
    for (const status of ["expired", "rejected"]) {
      const stale = { ...base, updatedAt: "2026-01-03", messages: [{
        ...base.messages[0], blocks: [{ kind: "pending_action", id: "action", status }],
      }] };
      expect(mergeSessions(base, stale).messages[0].blocks).toEqual(base.messages[0].blocks);
    }
  });
  it("preserves an executing action over a newer expired or rejected copy", () => {
    const base: SyncSession = { id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 1, preview: "", messages: [{ id: "m1", at: "2026-01-01", role: "assistant",
        blocks: [{ kind: "pending_action", id: "action", status: "executing" }] }] };
    for (const status of ["expired", "rejected"]) {
      const stale = { ...base, updatedAt: "2026-01-03", messages: [{
        ...base.messages[0], blocks: [{ kind: "pending_action", id: "action", status }],
      }] };
      expect(mergeSessions(base, stale).messages[0].blocks).toEqual(base.messages[0].blocks);
      expect(mergeSessions(stale, base).messages[0].blocks).toEqual(base.messages[0].blocks);
    }
  });

  it("does not store an unsalted digest of a secret in sync state", async () => {
    const { repos, engines } = await devices(1);
    const secret = "exchange-api-key";
    repos[0].config.set("10", secret);
    await engines[0].syncOnce();
    const hex = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret))),
      (byte) => byte.toString(16).padStart(2, "0")).join("");
    expect(repos[0].state.config?.["10"].hash).not.toBe(hex);
    expect((await engines[0].syncOnce()).pushed).toBe(0);
  });

  it("does not publish a deletion when a tracked session file is unreadable", async () => {
    const { repos, engines } = await devices(2);
    repos[0].sessions.set("chat", {
      id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 0, preview: "", messages: [],
    });
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].sessions.delete("chat");
    repos[0].unreadableSessions.add("chat");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[1].sessions.has("chat")).toBe(true);
  });

  it("does not load chat sessions when chat sync is disabled", async () => {
    const { repos, engines } = await devices(1);
    repos[0].listSessions = async () => { throw new Error("session file unavailable"); };
    expect((await engines[0].syncOnce({ categories: { chat: false } })).errors).toEqual([]);
  });

  it("pulls a session skipped while chat sync was disabled", async () => {
    const { repos, engines } = await devices(2);
    repos[0].sessions.set("chat", {
      id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 1, preview: "Hi",
      messages: [{ id: "m1", at: "2026-01-01", role: "user", content: "Hi" }],
    });
    await engines[0].syncOnce();
    await engines[1].syncOnce({ categories: { chat: false } });
    expect(repos[1].sessions.has("chat")).toBe(false);
    await engines[1].syncOnce();
    expect(repos[1].sessions.get("chat")).toEqual(repos[0].sessions.get("chat"));
  });

  it("applies a session deletion skipped while chat sync was disabled", async () => {
    const { repos, engines } = await devices(2);
    repos[0].sessions.set("chat", {
      id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 0, preview: "", messages: [],
    });
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].sessions.delete("chat");
    await engines[0].syncOnce();
    await engines[1].syncOnce({ categories: { chat: false } });
    expect(repos[1].sessions.has("chat")).toBe(true);
    await engines[1].syncOnce();
    expect(repos[1].sessions.has("chat")).toBe(false);
  });

  it("prunes session metadata after its deletion is published", async () => {
    const { repos, engines } = await devices(1);
    repos[0].sessions.set("chat", {
      id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 0, preview: "", messages: [],
    });
    await engines[0].syncOnce();
    expect(repos[0].state.sessionHashes?.chat).toBeDefined();
    repos[0].sessions.delete("chat");
    await engines[0].syncOnce();
    expect(repos[0].state.sessionHashes?.chat).toBeUndefined();
    expect(repos[0].state.trackedSessions).not.toContain("chat");
  });

  it("reports unreadable local items and still pushes readable snapshots", async () => {
    const { repos, engines } = await devices(2);
    repos[0].config.set("10", "old-secret");
    repos[0].sessions.set("broken", {
      id: "broken", title: "", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 0, preview: "", messages: [],
    });
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].snapshots.set("one", snapshot("one"));
    repos[0].listConfig = async () => ({ "7": "USD" });
    repos[0].listSessions = async () => [];
    repos[0].takeReadErrors = () => ({ configIds: ["10"], sessionIds: ["broken"] });
    const report = await engines[0].syncOnce();
    expect(report.errors).toContain("Failed to read local config");
    expect(report.errors).toContain("Failed to read local session");
    expect(report.pushed).toBeGreaterThan(0);
    await engines[1].syncOnce();
    expect(repos[1].snapshots.has("one")).toBe(true);
    expect(repos[1].config.get("10")).toBe("old-secret");
    expect(repos[1].sessions.has("broken")).toBe(true);
  });

  it("does not read unchanged snapshots again when the repository tracks revisions", async () => {
    const { s3, repos } = await devices(1);
    repos[0].snapshots.set("one", snapshot("one"));
    let reads = 0;
    const read = repos[0].readSnapshot.bind(repos[0]);
    repos[0].readSnapshot = async (id) => { reads++; return read(id); };
    Object.assign(repos[0], {
      listChangedSnapshotIds: async (since?: number) =>
        ({ ids: since === undefined ? ["one"] : [], revision: 1 }),
    });
    const engine = new SyncEngine(s3, repos[0], "passphrase");
    await engine.syncOnce();
    const firstReads = reads;
    await engine.syncOnce();
    expect(reads).toBe(firstReads);
  });

  it("retries a failed session push when a snapshot push succeeds", async () => {
    const { s3, repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    repos[0].sessions.set("chat", {
      id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 0, preview: "", messages: [],
    });
    const put = s3.putObject.bind(s3);
    let fail = true;
    s3.putObject = async (key, body, conditions) => {
      if (key.includes("/session/") && fail) { fail = false; throw new Error("network"); }
      return put(key, body, conditions);
    };
    expect((await engines[0].syncOnce()).errors).toContain("Failed to push session object");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[1].sessions.has("chat")).toBe(true);
  });

  it("marks published objects known only after their manifest succeeds", async () => {
    const { repos, engines } = await devices(1);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    const first = repos[0].state.known;
    expect(first?.some((token) => token.includes(":snapshot:one:"))).toBe(true);
    expect((await engines[0].syncOnce()).pulled).toBe(0);
    expect(repos[0].state.known).toEqual(first);
  });

  it("does not republish pulled snapshots when a manifest cannot be read", async () => {
    const { s3, repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].snapshots.set("two", snapshot("two"));
    await engines[0].syncOnce();
    const get = s3.getObject.bind(s3);
    s3.getObject = async (key) => key === `devices/${repos[0].state.deviceId}/manifest`
      ? null : get(key);
    const report = await engines[1].syncOnce();
    expect(report.errors).toContain("Failed to read sync manifest");
    expect(report.pushed).toBe(0);
  });

  it("does not expose an unlisted object after a crash before manifest write", async () => {
    const { s3, repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    const original = s3.putObject.bind(s3);
    let failed = false;
    s3.putObject = async (key, body, conditions) => {
      if (key.endsWith("/manifest") && !failed) { failed = true; throw new Error("crash"); }
      return original(key, body, conditions);
    };
    const result = await engines[0].syncOnce();
    expect(result.errors).toHaveLength(1);
    expect(result.pushed).toBe(0);
    await engines[1].syncOnce();
    expect(repos[1].snapshots.size).toBe(0);
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[1].snapshots.has("one")).toBe(true);
  });

  it("rejects a wrong passphrase before changing local data", async () => {
    const { s3 } = await devices(1);
    const repo = new MemoryRepository();
    await expect(new SyncEngine(s3, repo, "wrong").syncOnce()).rejects.toThrow(/passphrase/i);
    expect(repo.snapshots.size).toBe(0);
  });

  it("merges disjoint session messages by id and orders them by timestamp", async () => {
    const { repos, engines } = await devices(2);
    const base = { id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-02", pinned: 0 as const, messageCount: 1, preview: "Hi" };
    repos[0].sessions.set("chat", { ...base, messages: [{ id: "a", at: "2026-01-01", role: "user", content: "Hi" }] });
    repos[1].sessions.set("chat", { ...base, messages: [{ id: "b", at: "2026-01-02", role: "user", content: "Bye" }] });
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    await engines[0].syncOnce();
    expect(repos[0].sessions.get("chat")?.messages.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("does not resurrect a chat session deleted on another device", async () => {
    const { repos, engines } = await devices(2);
    repos[0].sessions.set("chat", {
      id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 0, preview: "", messages: [],
    });
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[1].sessions.delete("chat");
    await engines[1].syncOnce();
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[0].sessions.has("chat")).toBe(false);
    expect(repos[1].sessions.has("chat")).toBe(false);
  });

  it("syncs snapshot and session payloads larger than one MiB", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("large", snapshot("large"));
    repos[0].snapshots.get("large")!.assets[0].wallet = "x".repeat(1_100_000);
    repos[0].sessions.set("large-chat", {
      id: "large-chat", title: "Large", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 1, preview: "",
      messages: [{ id: "one", at: "2026-01-01", role: "user", content: "x".repeat(1_100_000) }],
    });
    expect((await engines[0].syncOnce()).errors).toEqual([]);
    expect((await engines[1].syncOnce()).errors).toEqual([]);
    expect(repos[1].snapshots.has("large")).toBe(true);
    expect(repos[1].sessions.has("large-chat")).toBe(true);
  });

  it("syncs a session beyond the single-object plaintext limit", async () => {
    const { s3, repos, engines } = await devices(2);
    repos[0].sessions.set("large-chat", {
      id: "large-chat", title: "Large", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 1, preview: "",
      messages: [{ id: "one", at: "2026-01-01", role: "user", content: "x".repeat(17_000_000) }],
    });
    expect((await engines[0].syncOnce()).errors).toEqual([]);
    expect((await engines[1].syncOnce()).errors).toEqual([]);
    expect(repos[1].sessions.get("large-chat")?.messages[0].content).toHaveLength(17_000_000);
    repos[0].sessions.get("large-chat")!.title = "Renamed";
    expect((await engines[0].syncOnce()).errors).toEqual([]);
    const objects = (await s3.listObjectsV2({ prefix: `devices/${repos[0].state.deviceId}/session/` })).objects;
    expect(objects).toHaveLength(4);
  }, 60_000);

  it("syncs a snapshot beyond the single-object plaintext limit", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("large", snapshot("large"));
    repos[0].snapshots.get("large")!.assets[0].wallet = "x".repeat(17_000_000);
    expect((await engines[0].syncOnce()).errors).toEqual([]);
    expect((await engines[1].syncOnce()).errors).toEqual([]);
    expect(repos[1].snapshots.get("large")?.assets[0].wallet).toHaveLength(17_000_000);
  }, 60_000);

  it("reuses a large orphaned snapshot after local row IDs change", async () => {
    const { s3, repos, engines } = await devices(2);
    repos[0].snapshots.set("large", snapshot("large"));
    repos[0].snapshots.get("large")!.assets[0].wallet = "x".repeat(17_000_000);
    const put = s3.putObject.bind(s3);
    let fail = true;
    s3.putObject = async (key, body, conditions) => {
      if (key.endsWith("/manifest") && fail) { fail = false; throw new Error("crash"); }
      return put(key, body, conditions);
    };
    await engines[0].syncOnce();
    const local = repos[0].snapshots.get("large")!;
    local.assets[0].id = 9;
    local.prices[0].assetID = 9;
    local.transactions[0].assetID = 9;
    expect((await engines[0].syncOnce()).errors).toEqual([]);
    expect((await engines[1].syncOnce()).errors).toEqual([]);
    expect(repos[1].snapshots.has("large")).toBe(true);
  }, 60_000);

  it("replaces unpublished parts after a partial large snapshot write", async () => {
    const { s3, repos, engines } = await devices(1);
    repos[0].snapshots.set("large", snapshot("large"));
    repos[0].snapshots.get("large")!.assets[0].wallet = "x".repeat(17_000_000);
    const put = s3.putObject.bind(s3);
    let fail = true;
    s3.putObject = async (key, body, conditions) => {
      if (key.includes("/part/1") && fail) { fail = false; throw new Error("network"); }
      return put(key, body, conditions);
    };
    expect((await engines[0].syncOnce()).errors).toContain("Failed to push snapshot object");
    const local = repos[0].snapshots.get("large")!;
    local.assets[0].id = 9;
    local.prices[0].assetID = 9;
    local.transactions[0].assetID = 9;
    expect((await engines[0].syncOnce()).errors).toEqual([]);
  }, 60_000);

  it("makes no probe writes in a round without pending changes", async () => {
    const { s3, engines } = await devices(1);
    const put = s3.putObject.bind(s3);
    let writes = 0;
    s3.putObject = async (key, body, conditions) => {
      writes++;
      return put(key, body, conditions);
    };
    await engines[0].syncOnce();
    expect(writes).toBe(0);
  });

  it("keeps only the current session revision after publishing an edit", async () => {
    const { s3, repos, engines } = await devices(1);
    repos[0].sessions.set("chat", {
      id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 0, preview: "", messages: [],
    });
    await engines[0].syncOnce();
    repos[0].sessions.get("chat")!.title = "Edited";
    await engines[0].syncOnce();
    const keys = (await s3.listObjectsV2({ prefix: `devices/${repos[0].state.deviceId}/session/` })).objects;
    expect(keys).toHaveLength(1);
    await engines[0].syncOnce();
    expect(repos[0].state.known?.filter((token) => token.includes(":session:chat:"))).toHaveLength(1);
  });

  it("syncs transaction edits and individual asset deletions", async () => {
    const { s3, repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    repos[0].snapshots.get("one")!.assets.push({
      ...repos[0].snapshots.get("one")!.assets[0], id: 2, symbol: "ETH",
    });
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].snapshots.get("one")!.transactions[0].price = 9;
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[1].snapshots.get("one")?.transactions[0].price).toBe(9);
    repos[0].snapshots.get("one")!.transactions[0].price = 10;
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect((await s3.listObjectsV2({ prefix: `devices/${repos[0].state.deviceId}/edit/` })).objects).toHaveLength(1);
    repos[1].snapshots.get("one")!.assets = [repos[1].snapshots.get("one")!.assets[1]];
    repos[1].snapshots.get("one")!.prices = [];
    repos[1].snapshots.get("one")!.transactions = [];
    await engines[1].syncOnce();
    await engines[0].syncOnce();
    expect(repos[0].snapshots.get("one")?.assets.map((asset) => asset.symbol)).toEqual(["ETH"]);
  });

  it("restores the latest edit when undoing a snapshot deletion", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].snapshots.get("one")!.transactions[0].price = 9;
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    await repos[0].deleteSnapshot("one");
    await engines[0].recordDeletion("one");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    const restored = snapshot("one");
    restored.transactions[0].price = 9;
    repos[0].snapshots.set("one", restored);
    await engines[0].recordUndo("one");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[1].snapshots.get("one")?.transactions[0].price).toBe(9);
  });

  it("keeps an undo recorded while a round is loading state", async () => {
    const { repos, engines } = await devices(1);
    const load = repos[0].loadState.bind(repos[0]);
    let entered!: () => void;
    const roundLoading = new Promise<void>((resolve) => { entered = resolve; });
    let release!: () => void;
    const loaded = new Promise<void>((resolve) => { release = resolve; });
    let first = true;
    repos[0].loadState = async () => {
      const state = await load();
      if (first) {
        first = false;
        entered();
        await loaded;
      }
      return state;
    };
    const round = engines[0].syncOnce();
    await roundLoading;
    const undo = engines[0].recordUndo("one");
    await Promise.race([undo, new Promise<void>((resolve) => setTimeout(resolve, 50))]);
    release();
    await Promise.all([undo, round]);
    expect(repos[0].state.tombstones?.one?.deleted).toBe(false);
  });

  it("publishes a snapshot deletion made while no engine was registered", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].snapshots.delete("one");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[0].snapshots.has("one")).toBe(false);
    expect(repos[1].snapshots.has("one")).toBe(false);
  });

  it("recovers a restored local snapshot after recording undo fails", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].snapshots.delete("one");
    await engines[0].recordDeletion("one");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].snapshots.set("one", snapshot("one"));
    const save = repos[0].saveState.bind(repos[0]);
    repos[0].saveState = async () => { throw new Error("disk full"); };
    await expect(engines[0].recordUndo("one")).rejects.toThrow("disk full");
    repos[0].saveState = save;
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[0].snapshots.has("one")).toBe(true);
    expect(repos[1].snapshots.has("one")).toBe(true);
  });

  it("keeps an individual asset deletion over a concurrent transaction edit", async () => {
    const { repos, engines } = await devices(2);
    const original = snapshot("one");
    original.assets.push({ ...original.assets[0], id: 2, symbol: "ETH" });
    repos[0].snapshots.set("one", original);
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    const edited = repos[1].snapshots.get("one")!;
    edited.transactions[0].price = 9;
    const deleted = repos[0].snapshots.get("one")!;
    deleted.assets = deleted.assets.filter((asset) => asset.symbol !== "BTC");
    deleted.prices = [];
    deleted.transactions = [];
    await engines[1].syncOnce();
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[0].snapshots.get("one")?.assets.map((asset) => asset.symbol)).toEqual(["ETH"]);
    expect(repos[1].snapshots.get("one")?.assets.map((asset) => asset.symbol)).toEqual(["ETH"]);
  });

  it("restores an individual asset after undoing its deletion", async () => {
    const { repos, engines } = await devices(2);
    const original = snapshot("one");
    original.assets.push({ ...original.assets[0], id: 2, symbol: "ETH" });
    repos[0].snapshots.set("one", structuredClone(original));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].snapshots.get("one")!.assets = [original.assets[1]];
    repos[0].snapshots.get("one")!.prices = [];
    repos[0].snapshots.get("one")!.transactions = [];
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].snapshots.set("one", structuredClone(original));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[1].snapshots.get("one")?.assets.map((asset) => asset.symbol)).toEqual(["BTC", "ETH"]);
  });

  it("merges concurrent transaction price and type edits", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].snapshots.get("one")!.transactions[0].price = 9;
    repos[1].snapshots.get("one")!.transactions[0].txnType = "sell";
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    await engines[0].syncOnce();
    expect(repos[0].snapshots.get("one")?.transactions[0]).toMatchObject({ price: 9, txnType: "sell" });
    expect(repos[1].snapshots.get("one")?.transactions[0]).toMatchObject({ price: 9, txnType: "sell" });
  });

  it("retries a config change after the manifest write fails", async () => {
    const { s3, repos, engines } = await devices(2);
    repos[0].config.set("7", "EUR");
    const put = s3.putObject.bind(s3);
    let fail = true;
    s3.putObject = async (key, body, conditions) => {
      if (key.endsWith("/manifest") && fail) { fail = false; throw new Error("crash"); }
      return put(key, body, conditions);
    };
    expect((await engines[0].syncOnce()).errors).toHaveLength(1);
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[1].config.get("7")).toBe("EUR");
  });

  it("batches state writes while applying several remote config keys", async () => {
    const { repos, engines } = await devices(2);
    repos[0].config.set("6", "one");
    repos[0].config.set("7", "USD");
    repos[0].config.set("8", "three");
    await engines[0].syncOnce();
    let stateWrites = 0;
    const save = repos[1].saveState.bind(repos[1]);
    repos[1].saveState = async (state) => { stateWrites++; await save(state); };
    await engines[1].syncOnce();
    expect(stateWrites).toBeLessThanOrEqual(5);
    expect(Object.fromEntries(repos[1].config)).toEqual({ "6": "one", "7": "USD", "8": "three" });
  });

  it("propagates a per-key config deletion", async () => {
    const { repos, engines } = await devices(2);
    repos[0].config.set("7", "USD");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].config.delete("7");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    expect(repos[1].config.has("7")).toBe(false);
  });

  it("does not change local state in a dry run", async () => {
    const { repos, engines } = await devices(1);
    repos[0].snapshots.set("one", snapshot("one"));
    expect((await engines[0].dryRun()).pushed).toBe(1);
    expect(repos[0].state).toEqual({});
  });

  it("does not count an already local snapshot as pulled in a dry run", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    repos[1].snapshots.set("one", snapshot("one"));
    expect((await engines[1].dryRun()).pulled).toBe(0);
  });

  it("skips a snapshot already deleted by a tombstone in the same first round", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    repos[0].snapshots.delete("one");
    await engines[0].recordDeletion("one");
    await engines[0].syncOnce();
    let imports = 0;
    const importSnapshot = repos[1].importSnapshot.bind(repos[1]);
    repos[1].importSnapshot = async (value) => { imports++; return importSnapshot(value); };
    const report = await engines[1].syncOnce();
    expect(imports).toBe(0);
    expect(report.pulled).toBe(0);
    expect(repos[1].snapshots.has("one")).toBe(false);
  });

  it("retries an edit after its base snapshot import fails", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    repos[0].snapshots.get("one")!.transactions[0].price = 9;
    await engines[0].syncOnce();
    const importSnapshot = repos[1].importSnapshot.bind(repos[1]);
    let failed = false;
    repos[1].importSnapshot = async (value) => {
      if (!failed) { failed = true; throw new Error("temporary import failure"); }
      return importSnapshot(value);
    };
    await engines[1].syncOnce();
    expect(repos[1].snapshots.has("one")).toBe(false);
    await engines[1].syncOnce();
    expect(repos[1].snapshots.get("one")?.transactions[0].price).toBe(9);
  });

  it("publishes an undo after a remotely deleted snapshot is restored locally", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[0].snapshots.delete("one");
    await engines[0].recordDeletion("one");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[1].snapshots.set("one", snapshot("one"));
    await engines[1].syncOnce();
    await engines[0].syncOnce();
    expect(repos[0].snapshots.has("one")).toBe(true);
  });

  it("publishes an undo when a fresh device restores an already deleted snapshot", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    repos[0].snapshots.delete("one");
    await engines[0].recordDeletion("one");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    repos[1].snapshots.set("one", snapshot("one"));
    await engines[1].syncOnce();
    await engines[0].syncOnce();
    expect(repos[0].snapshots.has("one")).toBe(true);
  });

  it("downloads a paginated large first sync", async () => {
    const { repos, engines } = await devices(2, 7);
    for (let i = 0; i < 60; i++) repos[0].snapshots.set(`id-${i}`, snapshot(`id-${i}`));
    await engines[0].syncOnce();
    expect((await engines[1].syncOnce()).pulled).toBe(60);
    expect(repos[1].snapshots.size).toBe(60);
  });

  it("keeps local data on a UUID collision and reports the conflict", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one", 1));
    repos[1].snapshots.set("one", snapshot("one", 9));
    await engines[0].syncOnce();
    const report = await engines[1].syncOnce();
    expect(repos[1].snapshots.get("one")?.assets[0].amount).toBe(9);
    expect(report.conflicts).toContain("snapshot:one");
  });

  it("rejects a different local snapshot under an orphaned immutable key", async () => {
    const { s3, repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    const put = s3.putObject.bind(s3);
    let fail = true;
    s3.putObject = async (key, body, conditions) => {
      if (key.endsWith("/manifest") && fail) { fail = false; throw new Error("crash"); }
      return put(key, body, conditions);
    };
    await engines[0].syncOnce();
    repos[0].snapshots.set("one", snapshot("one", 9));
    expect((await engines[0].syncOnce()).errors).toContain("Immutable sync object changed");
    await engines[1].syncOnce();
    expect(repos[1].snapshots.size).toBe(0);
  });

  it("does not import an object with a mismatched checksum", async () => {
    const { s3, repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    const keys = (await s3.listObjectsV2({ prefix: "devices/" })).objects.map((item) => item.key);
    const object = keys.find((key) => !key.endsWith("/manifest"))!;
    await s3.putObject(object, new TextEncoder().encode("bad"));
    const report = await engines[1].syncOnce();
    expect(report.errors).toContain("Failed to pull snapshot object");
    expect(repos[1].snapshots.size).toBe(0);
  });

  it("rejects malformed manifest entries before trusting their object paths", async () => {
    const { s3, engines } = await devices(1);
    const owner = "00000000-0000-4000-8000-000000000000";
    const path = `devices/${owner}/manifest`;
    const key = await unlockSyncHeader((await readSyncHeader(s3))!, "passphrase");
    const body = new TextEncoder().encode(JSON.stringify(await encryptObject(key, path, new TextEncoder().encode(JSON.stringify({
      version: 1, deviceId: owner, entries: [{ kind: "snapshot", id: "../bad", version: "1", bytes: 0, sha256: "x" }],
    })))));
    await s3.putObject(path, body);
    expect((await engines[0].syncOnce()).errors).toContain("Failed to read sync manifest");
  });

  it("recovers a config apply interrupted between the value and state writes", async () => {
    const { repos, engines } = await devices(2);
    repos[0].config.set("7", "EUR");
    await engines[0].syncOnce();
    const save = repos[1].saveState.bind(repos[1]);
    const write = repos[1].writeConfig.bind(repos[1]);
    let applied = false;
    let fail = true;
    repos[1].writeConfig = async (id, value) => { await write(id, value); applied = true; };
    repos[1].saveState = async (state) => {
      if (applied && fail) { fail = false; throw new Error("crash"); }
      await save(state);
    };
    expect((await engines[1].syncOnce()).errors).toContain("Failed to apply config object");
    repos[0].config.set("7", "USD");
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    await engines[0].syncOnce();
    expect(repos[1].config.get("7")).toBe("USD");
    expect(repos[0].config.get("7")).toBe("USD");
  });

  it("does not publish a queued secret after its category is disabled", async () => {
    const { s3, repos, engines } = await devices(2);
    repos[0].config.set("10", "private-key");
    const put = s3.putObject.bind(s3);
    let fail = true;
    s3.putObject = async (key, body, conditions) => {
      if (key.endsWith("/manifest") && fail) { fail = false; throw new Error("crash"); }
      return put(key, body, conditions);
    };
    await engines[0].syncOnce();
    await engines[0].syncOnce({ categories: { secrets: false } });
    await engines[1].syncOnce();
    expect(repos[1].config.has("10")).toBe(false);
  });

  it("retries a failed session independently of imported snapshots", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    repos[0].sessions.set("chat", {
      id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      pinned: 0, messageCount: 1, preview: "Hi",
      messages: [{ id: "m1", at: "2026-01-01", role: "user", content: "Hi" }],
    });
    await engines[0].syncOnce();
    const write = repos[1].writeSession.bind(repos[1]);
    repos[1].writeSession = async () => { throw new Error("disk error"); };
    const report = await engines[1].syncOnce();
    expect(report.pulled).toBe(1);
    expect(report.errors).toContain("Failed to apply session object");
    repos[1].writeSession = write;
    await engines[1].syncOnce();
    expect(repos[1].sessions.has("chat")).toBe(true);
  });

  it("continues importing snapshots when one config apply fails", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    repos[0].config.set("7", "EUR");
    await engines[0].syncOnce();
    const write = repos[1].writeConfig.bind(repos[1]);
    repos[1].writeConfig = async () => { throw new Error("disk error"); };
    const report = await engines[1].syncOnce();
    expect(report.pulled).toBe(1);
    expect(report.errors).toContain("Failed to apply config object");
    repos[1].writeConfig = write;
    await engines[1].syncOnce();
    expect(repos[1].config.get("7")).toBe("EUR");
  });

  it("retries a tombstone when its local delete fails", async () => {
    const { repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    await engines[1].syncOnce();
    await repos[0].deleteSnapshot("one");
    await engines[0].recordDeletion("one");
    await engines[0].syncOnce();
    const remove = repos[1].deleteSnapshot.bind(repos[1]);
    repos[1].deleteSnapshot = async () => { throw new Error("disk error"); };
    expect((await engines[1].syncOnce()).errors).toContain("Failed to apply tombstone object");
    expect(repos[1].snapshots.has("one")).toBe(true);
    repos[1].deleteSnapshot = remove;
    await engines[1].syncOnce();
    expect(repos[1].snapshots.has("one")).toBe(false);
  });

  it("groups immutable delete and undo events under an opaque UUID key", async () => {
    const { s3, engines } = await devices(1);
    await engines[0].recordDeletion("one");
    await engines[0].syncOnce();
    await engines[0].recordUndo("one");
    await engines[0].syncOnce();
    const keys = (await s3.listObjectsV2({ prefix: "devices/" })).objects
      .map((item) => item.key).filter((key) => key.includes("/tombstone/"));
    expect(keys).toHaveLength(2);
    expect(keys[0].split("/")).toHaveLength(5);
    expect(keys[0].split("/")[3]).toBe(keys[1].split("/")[3]);
    expect(keys[0].split("/")[3]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps only the newest config and tombstone versions in its manifest", async () => {
    const { s3, repos, engines } = await devices(1);
    repos[0].config.set("7", "USD");
    await engines[0].syncOnce();
    repos[0].config.set("7", "EUR");
    await engines[0].syncOnce();
    await engines[0].recordDeletion("one");
    await engines[0].syncOnce();
    await engines[0].recordUndo("one");
    await engines[0].syncOnce();
    const path = `devices/${repos[0].state.deviceId}/manifest`;
    const body = (await s3.getObject(path))!.body;
    const key = await unlockSyncHeader((await readSyncHeader(s3))!, "passphrase");
    const manifest = JSON.parse(new TextDecoder().decode(await decryptObject(
      key, path, JSON.parse(new TextDecoder().decode(body)),
    ))) as { entries: Array<{ kind: string; id: string }> };
    expect(manifest.entries.filter((entry) => entry.kind === "config" && entry.id === "7")).toHaveLength(1);
    expect(manifest.entries.filter((entry) => entry.kind === "tombstone" && entry.id === "one")).toHaveLength(1);
  });

  it("rejects a provider that ignores conditional writes", async () => {
    const { s3, repos, engines } = await devices(1);
    repos[0].snapshots.set("one", snapshot("one"));
    const put = s3.putObject.bind(s3);
    s3.putObject = async (key, body) => put(key, body);
    await expect(engines[0].syncOnce()).rejects.toThrow(/conditional writes/i);
    expect((await s3.listObjectsV2({ prefix: "devices/" })).objects).toEqual([]);
  });

  it("does not lose a delete recorded while a sync round is publishing", async () => {
    const { s3, repos, engines } = await devices(1);
    repos[0].snapshots.set("one", snapshot("one"));
    const put = s3.putObject.bind(s3);
    let release!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const reached = new Promise<void>((resolve) => { entered = resolve; });
    s3.putObject = async (key, body, conditions) => {
      if (key.endsWith("/manifest")) { entered(); await blocked; }
      return put(key, body, conditions);
    };
    const sync = engines[0].syncOnce();
    await reached;
    const deletion = engines[0].recordDeletion("one");
    release();
    await Promise.all([sync, deletion]);
    expect(repos[0].state.tombstones?.one.deleted).toBe(true);
  });
  it("records a delete before a slow sync round finishes", async () => {
    const { s3, repos, engines } = await devices(1);
    repos[0].snapshots.set("one", snapshot("one"));
    const put = s3.putObject.bind(s3);
    let release!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const reached = new Promise<void>((resolve) => { entered = resolve; });
    s3.putObject = async (key, body, conditions, signal) => {
      if (key.endsWith("/manifest")) { entered(); await blocked; }
      return put(key, body, conditions, signal);
    };
    const sync = engines[0].syncOnce();
    await reached;
    const deletion = engines[0].recordDeletion("one");
    try {
      expect(await Promise.race([
        deletion.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 50)),
      ])).toBe(true);
    } finally {
      release();
      await Promise.all([sync, deletion]);
    }
    expect(repos[0].state.pendingTombstones?.one.deleted).toBe(true);
  });

  it("honors cancellation after the last downloaded object", async () => {
    const { s3, repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    await engines[0].syncOnce();
    const controller = new AbortController();
    const get = s3.getObject.bind(s3);
    s3.getObject = async (key) => {
      const object = await get(key);
      if (key.includes("/snapshot/")) controller.abort();
      return object;
    };
    await expect(engines[1].syncOnce({ signal: controller.signal })).rejects.toThrow(/abort/i);
  });

  it("lets a slow device edit after observing a far future remote clock", async () => {
    const { s3, repos } = await devices(2);
    const fast = new SyncEngine(s3, repos[0], "passphrase", { now: () => 3_600_000 });
    const slow = new SyncEngine(s3, repos[1], "passphrase", { now: () => 1_000 });
    repos[0].config.set("7", "USD");
    await fast.syncOnce();
    await slow.syncOnce();
    repos[1].config.set("7", "EUR");
    await slow.syncOnce();
    await fast.syncOnce();
    expect(repos[0].config.get("7")).toBe("EUR");
  });

  it("rejects a remote config clock more than a day ahead", async () => {
    const { s3, repos } = await devices(2);
    const fast = new SyncEngine(s3, repos[0], "passphrase", { now: () => 30 * 86_400_000 });
    const slow = new SyncEngine(s3, repos[1], "passphrase", { now: () => 1_000 });
    repos[0].config.set("7", "USD");
    await fast.syncOnce();
    const report = await slow.syncOnce();
    expect(report.errors).toContain("Failed to pull config object");
    expect(repos[1].state.clock?.ms ?? 0).toBeLessThan(86_400_000);
  });

  it("syncs rebalance targets only while their category is enabled", async () => {
    const { repos, engines } = await devices(2);
    const targets = JSON.stringify({ targets: "[{\"kind\":\"cash\",\"percent\":100}]", tolerance_percent: 5 });
    repos[0].config.set("rebalance", targets);
    await engines[0].syncOnce();
    await engines[1].syncOnce({ categories: { rebalance: false } });
    expect(repos[1].config.has("rebalance")).toBe(false);
    await engines[1].syncOnce();
    expect(repos[1].config.get("rebalance")).toBe(targets);
  });

  it("reuses an orphaned snapshot when only local row IDs changed", async () => {
    const { s3, repos, engines } = await devices(2);
    repos[0].snapshots.set("one", snapshot("one"));
    const put = s3.putObject.bind(s3);
    let fail = true;
    s3.putObject = async (key, body, conditions) => {
      if (key.endsWith("/manifest") && fail) { fail = false; throw new Error("crash"); }
      return put(key, body, conditions);
    };
    await engines[0].syncOnce();
    const renumbered = snapshot("one");
    renumbered.assets[0].id = 9;
    renumbered.prices[0].assetID = 9;
    renumbered.transactions[0].assetID = 9;
    repos[0].snapshots.set("one", renumbered);
    expect((await engines[0].syncOnce()).errors).toEqual([]);
    await engines[1].syncOnce();
    expect(repos[1].snapshots.has("one")).toBe(true);
  });

});
