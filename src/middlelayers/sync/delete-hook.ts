import type { SyncEngine } from "./engine";

let active: Pick<SyncEngine, "recordDeletion" | "recordUndo"> | undefined;

export function registerSnapshotSync(engine: Pick<SyncEngine, "recordDeletion" | "recordUndo">): () => void {
  active = engine;
  return () => { if (active === engine) active = undefined; };
}

export async function recordSnapshotDeleted(uuid: string): Promise<void> {
  await active?.recordDeletion(uuid);
}

export async function recordSnapshotUndone(uuid: string): Promise<void> {
  await active?.recordUndo(uuid);
}
