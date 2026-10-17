import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { registerSnapshotSync } from "@/middlelayers/sync/delete-hook";
import { useOptimisticDelete } from "./use-optimistic-delete";

const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast }) }));

it("keeps a committed delete when recording its tombstone fails", async () => {
  const unregister = registerSnapshotSync({
    recordDeletion: async () => { throw new Error("disk full"); },
    recordUndo: async () => {},
  });
  let stored = true;
  const view = renderHook(() => {
    const [items, setItems] = useState(["one"]);
    return { items, ...useOptimisticDelete(setItems) };
  });
  await act(async () => {
    await view.result.current.run({
      update: (items) => items.filter((item) => item !== "one"),
      rollback: (items) => [...items, "one"],
      commit: async () => { stored = false; return "saved-undo"; },
      undo: async () => { stored = true; },
      successMessage: "Deleted", undoLabel: "Undo", undoAltText: "Undo deletion",
      undoWindowMs: 5000, syncSnapshotUuid: "one",
    });
  });
  expect(stored).toBe(false);
  expect(view.result.current.items).toEqual([]);
  expect(toast.mock.calls.some(([options]) => options.description === "disk full")).toBe(true);
  unregister();
});

it("shows the restored snapshot when recording undo fails after database restore", async () => {
  toast.mockClear();
  const unregister = registerSnapshotSync({
    recordDeletion: async () => {},
    recordUndo: async () => { throw new Error("disk full"); },
  });
  let stored = true;
  const view = renderHook(() => {
    const [items, setItems] = useState(["one"]);
    return { items, ...useOptimisticDelete(setItems) };
  });
  await act(async () => {
    await view.result.current.run({
      update: (items) => items.filter((item) => item !== "one"),
      rollback: (items) => [...items, "one"],
      commit: async () => { stored = false; return "saved-undo"; },
      undo: async () => { stored = true; },
      successMessage: "Deleted", undoLabel: "Undo", undoAltText: "Undo deletion",
      undoWindowMs: 5000, syncSnapshotUuid: "one",
    });
  });
  await act(async () => { toast.mock.calls[0][0].action.props.onClick(); });
  await waitFor(() => expect(stored).toBe(true));
  expect(view.result.current.items).toEqual(["one"]);
  unregister();
});
