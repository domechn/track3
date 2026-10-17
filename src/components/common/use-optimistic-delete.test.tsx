import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/toaster";
import { useOptimisticDelete } from "./use-optimistic-delete";

function Fixture({ commit, restore }: { commit: () => Promise<void>; restore: () => Promise<void> }) {
  const [items, setItems] = useState(["a", "b"]);
  const { run } = useOptimisticDelete(setItems);
  return <>
    <div>{items.join(",")}</div>
    <button onClick={() => void run({
      update: (previous) => previous.filter((item) => item !== "a"),
      rollback: (previous) => ["a", ...previous.filter((item) => item !== "a")],
      commit,
      undo: restore,
      successMessage: "Deleted",
      undoLabel: "Undo",
      undoAltText: "Restore item",
      undoWindowMs: 5000,
    })}>Delete</button>
    <Toaster />
  </>;
}

function ConcurrentFixture({ commit }: { commit: (item: string) => Promise<void> }) {
  const [items, setItems] = useState(["a", "b"]);
  const { run, isDeleting } = useOptimisticDelete(setItems);
  return <>
    <div>{items.join(",")}</div>
    <div data-testid="delete-state">{isDeleting ? "Deleting" : "Idle"}</div>
    {["a", "b"].map((item) => <button key={item} onClick={() => void run({
      update: (previous) => previous.filter((value) => value !== item),
      rollback: (previous) => [item, ...previous],
      commit: () => commit(item),
      undo: async () => {},
      successMessage: "Deleted",
      undoLabel: "Undo",
      undoAltText: "Restore item",
      undoWindowMs: 5000,
    })}>Delete {item}</button>)}
  </>;
}

beforeEach(() => vi.useRealTimers());

describe("useOptimisticDelete", () => {
  it("removes locally before the API completes and restores through Undo", async () => {
    let finish!: () => void;
    const commit = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const restore = vi.fn().mockResolvedValue(undefined);
    render(<Fixture commit={commit} restore={restore} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("b")).toBeInTheDocument();
    await act(async () => finish());
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.getByText("a,b")).toBeInTheDocument());
    expect(restore).toHaveBeenCalledOnce();
  });

  it("rolls back and reports an API error", async () => {
    render(<Fixture commit={() => Promise.reject(new Error("storage failed"))} restore={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("b")).toBeInTheDocument();
    expect(await screen.findByText("a,b")).toBeInTheDocument();
    expect(screen.getByText("storage failed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("stays busy until both overlapping deletes finish", async () => {
    const finishes = new Map<string, () => void>();
    render(<ConcurrentFixture commit={(item) => new Promise((resolve) => { finishes.set(item, resolve); })} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete a" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete b" }));
    expect(screen.getByTestId("delete-state")).toHaveTextContent("Deleting");
    await act(async () => finishes.get("a")?.());
    expect(screen.getByTestId("delete-state")).toHaveTextContent("Deleting");
    await act(async () => finishes.get("b")?.());
    expect(screen.getByTestId("delete-state")).toHaveTextContent("Idle");
  });

  it("keeps the item deleted and reports a failed undo", async () => {
    render(<Fixture commit={async () => {}} restore={async () => { throw new Error("restore failed"); }} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Delete" })); });
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(await screen.findByText("restore failed")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
  });

  it("removes the undo action when its window expires", async () => {
    vi.useFakeTimers();
    try {
      render(<Fixture commit={async () => {}} restore={async () => {}} />);
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Delete" })); });
      expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(5001); });
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });
});
