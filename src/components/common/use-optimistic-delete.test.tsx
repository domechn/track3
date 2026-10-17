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
});
