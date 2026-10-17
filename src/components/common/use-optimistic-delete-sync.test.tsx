import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi, afterEach } from "vitest";
import { registerSnapshotSync } from "@/middlelayers/sync/delete-hook";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import { useOptimisticDelete } from "./use-optimistic-delete";

const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast }) }));
afterEach(() => vi.useRealTimers());

it("waits until the undo window ends before syncing a deletion", async () => {
  vi.useFakeTimers();
  toast.mockClear();
  const trigger = vi.spyOn(syncRuntime, "trigger");
  const unregister = registerSnapshotSync({ recordDeletion: async () => {}, recordUndo: async () => {} });
  const view = renderHook(() => {
    const [items, setItems] = useState(["one"]);
    return { items, ...useOptimisticDelete(setItems) };
  });
  try {
    await act(async () => {
      await view.result.current.run({
        update: (items) => items.filter((item) => item !== "one"),
        rollback: (items) => [...items, "one"],
        commit: async () => "saved-undo", undo: async () => {},
        successMessage: "Deleted", undoLabel: "Undo", undoAltText: "Undo deletion",
        undoWindowMs: 5000, syncSnapshotUuid: "one",
      });
    });
    await act(async () => { await Promise.resolve(); });
    expect(trigger).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(4999); });
    expect(trigger).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(trigger).toHaveBeenCalledTimes(1);
  } finally {
    trigger.mockRestore();
    unregister();
  }
});

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

it("shows delete feedback while sync is still recording the tombstone", async () => {
  toast.mockClear();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const unregister = registerSnapshotSync({
    recordDeletion: () => pending,
    recordUndo: async () => {},
  });
  const onDeleted = vi.fn();
  const view = renderHook(() => {
    const [items, setItems] = useState(["one"]);
    return { items, ...useOptimisticDelete(setItems) };
  });
  try {
    let completed = false;
    const run = view.result.current.run({
      update: (items) => items.filter((item) => item !== "one"),
      rollback: (items) => [...items, "one"],
      commit: async () => "saved-undo",
      undo: async () => {},
      onDeleted,
      successMessage: "Deleted", undoLabel: "Undo", undoAltText: "Undo deletion",
      undoWindowMs: 5000, syncSnapshotUuid: "one",
    }).then(() => { completed = true; });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(completed).toBe(true);
    expect(onDeleted).toHaveBeenCalledOnce();
    release();
    await run;
  } finally {
    release();
    unregister();
  }
});

it("syncs an Undo without first publishing the deletion", async () => {
  toast.mockClear();
  const trigger = vi.spyOn(syncRuntime, "trigger");
  const unregister = registerSnapshotSync({
    recordDeletion: async () => {},
    recordUndo: async () => {},
  });
  const view = renderHook(() => {
    const [items, setItems] = useState(["one"]);
    return { items, ...useOptimisticDelete(setItems) };
  });
  try {
    await act(async () => {
      await view.result.current.run({
        update: (items) => items.filter((item) => item !== "one"),
        rollback: (items) => [...items, "one"],
        commit: async () => "saved-undo",
        undo: async () => {},
        successMessage: "Deleted", undoLabel: "Undo", undoAltText: "Undo deletion",
        undoWindowMs: 5000, syncSnapshotUuid: "one",
      });
    });
    expect(trigger).not.toHaveBeenCalled();
    await act(async () => { toast.mock.calls[0][0].action.props.onClick(); });
    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(1));
  } finally {
    trigger.mockRestore();
    unregister();
  }
});
