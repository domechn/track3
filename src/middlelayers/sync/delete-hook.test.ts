import { expect, it, vi } from "vitest";
import { recordSnapshotDeleted, recordSnapshotUndone, registerSnapshotSync } from "./delete-hook";

it("forwards delete and undo to the active sync engine", async () => {
  const engine = { recordDeletion: vi.fn(), recordUndo: vi.fn() };
  const unregister = registerSnapshotSync(engine);
  await recordSnapshotDeleted("uuid-1");
  await recordSnapshotUndone("uuid-1");
  expect(engine.recordDeletion).toHaveBeenCalledWith("uuid-1");
  expect(engine.recordUndo).toHaveBeenCalledWith("uuid-1");
  unregister();
});
