import { performance } from "node:perf_hooks";
import { expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getDatabase } from "../database";
import type { SyncState } from "./engine";
import { SqliteSyncRepository } from "./sqlite-repository";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock("../database", () => ({ getDatabase: vi.fn(), executeWrite: vi.fn() }));

it("keeps a one-snapshot save bounded with 5000 snapshots of 50 assets", async () => {
  const deviceId = "00000000-0000-4000-8000-000000000001";
  const hash = "a".repeat(64);
  const ids = Array.from({ length: 5000 }, (_, index) => `snapshot-${index.toString().padStart(6, "0")}`);
  const assetKeys = Array.from({ length: 50 }, (_, index) => `${index.toString().padStart(2, "0")}${hash}`);
  const old: SyncState = {
    deviceId, known: [], published: [...ids], snapshotHashes: {}, assetRows: {},
    transactionRows: {}, rowEvents: {}, transactionEvents: {}, snapshotEdits: {}, pendingSnapshotEdits: {},
  };
  for (const id of ids) {
    old.known!.push(`${deviceId}:snapshot:${id}:1`);
    old.snapshotHashes![id] = hash;
    old.assetRows![id] = [...assetKeys];
    old.transactionRows![id] = { txn: { price: 1, txnType: "buy" } };
    old.rowEvents![id] = {};
    old.transactionEvents![id] = {};
  }
  const rows = ids.map((id) => ({
    snapshotId: id, snapshotHash: hash, snapshotEdit: null, pendingSnapshotEdit: null,
    published: 1, known: JSON.stringify([`${deviceId}:snapshot:${id}:1`]),
  }));
  const target = ids[2500];
  vi.mocked(getDatabase).mockResolvedValue({ select: async (sql: string) =>
    sql.includes("FROM sync_state") ? [{ data: JSON.stringify({ deviceId, known: [] }) }] :
    sql.includes("asset_rows AS") ? [{
      snapshotId: target, assetRows: JSON.stringify(assetKeys),
      transactionRows: JSON.stringify({ txn: { price: 1, txnType: "buy" } }),
      rowEvents: "{}", transactionEvents: "{}",
    }] : rows,
  } as never);
  const repo = new SqliteSyncRepository();
  const current = await repo.loadState();
  await repo.loadSnapshotDetails(current, [target]);
  let oldBytes = 0;
  let newBytes = 0;
  let oldMs = 0;
  let newMs = 0;
  for (let round = 0; round < 4; round++) {
    old.snapshotHashes![target] = `changed-${round}`;
    old.assetRows![target][0] = `${round}${hash}`;
    current.snapshotHashes![target] = `changed-${round}`;
    current.assetRows![target][0] = `${round}${hash}`;
    let started = performance.now();
    oldBytes += new TextEncoder().encode(JSON.stringify(old)).length;
    oldMs += performance.now() - started;
    started = performance.now();
    newBytes += await repo.saveState(current);
    newMs += performance.now() - started;
  }
  expect(vi.mocked(invoke).mock.calls).toHaveLength(4);
  expect(newBytes).toBeLessThan(oldBytes / 100);
  console.info(`P0e payload benchmark (5000 snapshots × 50 assets, 4 saves): ` +
    `before ${(oldBytes / 4).toFixed(0)} bytes/round, ${oldMs.toFixed(1)} ms total; ` +
    `after ${(newBytes / 4).toFixed(0)} bytes/round, ${newMs.toFixed(1)} ms total ` +
    `(application serialization and save preparation only)`);
});
