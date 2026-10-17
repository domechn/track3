import { SyncEngine } from "./engine";
import { SqliteSyncRepository } from "./sqlite-repository";
import { registerSnapshotSync } from "./delete-hook";
import type { S3Store } from "./object-store";

export function createSqliteSyncEngine(store: S3Store, passphrase: string) {
  const engine = new SyncEngine(store, new SqliteSyncRepository(), passphrase);
  return { engine, unregister: registerSnapshotSync(engine) };
}

export { SyncEngine } from "./engine";
export type { SyncOptions, SyncReport } from "./engine";
