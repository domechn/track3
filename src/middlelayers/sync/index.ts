import { SyncEngine } from "./engine";
import { SqliteSyncRepository } from "./sqlite-repository";
import { registerSnapshotSync } from "./delete-hook";
import type { S3Store } from "./object-store";

export function createSqliteSyncEngine(store: S3Store, passphrase: string, storeIdentity?: string) {
  const engine = new SyncEngine(store, new SqliteSyncRepository(), passphrase, { storeIdentity });
  const unregister = registerSnapshotSync(engine);
  return { engine, unregister: () => { unregister(); engine.dispose(); } };
}

export { SyncEngine } from "./engine";
export type { SyncOptions, SyncReport } from "./engine";
