import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FakeS3, writeSyncHeader } from "@/middlelayers/sync/object-store";
import { SyncEngine, type Snapshot, type SyncRepository, type SyncSession, type SyncState } from "@/middlelayers/sync/engine";
import type { SyncHeader } from "@/middlelayers/sync/crypto";

const mode = process.env.TRACK3_COMPAT_MODE;
const fixture = (name: string) => resolve(`tests/compat/forward/${name}`);
const key = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
vi.mock("@/middlelayers/sync/crypto", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/middlelayers/sync/crypto")>(),
  unlockSyncHeader: async () => key,
}));

const header: SyncHeader = {
  version: 1,
  kdf: { name: "argon2id", salt: "MDEyMzQ1Njc4OUFCQ0RFRg==", memoryKiB: 65536, iterations: 3, parallelism: 1 },
  keyCheck: { version: 1, nonce: "", ciphertext: "" },
};
const snapshotId = "10000000-0000-4000-8000-000000000001";
const oldSnapshotId = "10000000-0000-4000-8000-000000000002";
const now = Date.parse("2024-04-16T13:00:00.000Z");
const snapshot: Snapshot & { compatOptional: { note: string } } = {
  uuid: snapshotId,
  assets: [{
    id: 1, uuid: snapshotId, createdAt: "2024-04-16T13:00:00.000Z", wallet: "wallet-compat",
    asset_type: "crypto", symbol: "BTC", amount: 2, value: 4, price: 2,
  }],
  prices: [],
  transactions: [],
  compatOptional: { note: "0.9.4 ignores this snapshot field" },
};

class Repository implements SyncRepository {
  state: SyncState;
  snapshots = new Map<string, Snapshot>();
  config = new Map<string, string>();
  sessions = new Map<string, SyncSession>();
  constructor(deviceId: string) { this.state = { deviceId }; }
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

async function dump(store: FakeS3) {
  const bodies: Record<string, string> = {};
  let continuationToken: string | undefined;
  do {
    const page = await store.listObjectsV2({ continuationToken });
    for (const object of page.objects) {
      bodies[object.key] = Buffer.from((await store.getObject(object.key))!.body).toString("base64");
    }
    continuationToken = page.nextContinuationToken;
  } while (continuationToken);
  return bodies;
}

async function restore(name: string) {
  const bodies = JSON.parse(readFileSync(fixture(name), "utf8")) as Record<string, string>;
  const store = new FakeS3();
  for (const [path, body] of Object.entries(bodies)) {
    await store.putObject(path, Uint8Array.from(Buffer.from(body, "base64")));
  }
  return store;
}

describe.skipIf(!mode)("cross-version sync bucket", () => {
  it.skipIf(mode !== "produce")("writes a new-build FakeS3 bucket with an optional snapshot field", async () => {
    const source = new Repository("00000000-0000-4000-8000-000000000001");
    source.snapshots.set(snapshotId, snapshot);
    const store = new FakeS3();
    await writeSyncHeader(store, header);
    const report = await new SyncEngine(store, source, "unused", { now: () => now }).syncOnce();
    expect(report.errors).toStrictEqual([]);
    writeFileSync(fixture("sync-bucket.json"), JSON.stringify(await dump(store)));
    writeFileSync(fixture("sync-snapshot.json"), JSON.stringify(snapshot));
  });

  it.skipIf(mode !== "consume")("0.9.4 pulls the new bucket and pushes a new snapshot", async () => {
    const store = await restore("sync-bucket.json");
    const old = new Repository("00000000-0000-4000-8000-000000000002");
    const pull = await new SyncEngine(store, old, "unused", { now: () => now }).syncOnce();
    expect(pull.errors).toStrictEqual([]);
    expect(old.snapshots.get(snapshotId)?.assets).toStrictEqual(snapshot.assets);
    old.snapshots.set(oldSnapshotId, { ...structuredClone(snapshot), uuid: oldSnapshotId,
      assets: snapshot.assets.map((asset) => ({ ...asset, uuid: oldSnapshotId })) });
    const push = await new SyncEngine(store, old, "unused", { now: () => now + 1000 }).syncOnce();
    expect(push.errors).toStrictEqual([]);
    writeFileSync(fixture("sync-after-094.json"), JSON.stringify(await dump(store)));
  });

  it.skipIf(mode !== "verify")("new build re-pulls the 0.9.4 bucket without losing optional data", async () => {
    const store = await restore("sync-after-094.json");
    const target = new Repository("00000000-0000-4000-8000-000000000003");
    const report = await new SyncEngine(store, target, "unused", { now: () => now + 2000 }).syncOnce();
    expect(report.errors).toStrictEqual([]);
    expect(target.snapshots.get(snapshotId)).toMatchObject(snapshot);
    expect(target.snapshots.get(oldSnapshotId)?.assets).toHaveLength(1);
  });
});
