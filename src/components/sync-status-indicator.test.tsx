import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SyncStatusIndicator from "./sync-status-indicator";
import { syncRuntime } from "@/middlelayers/sync/runtime";

const state = vi.hoisted(() => ({
  current: {
    mode: "ready",
    sync: {
      phase: "error",
      error: "header",
      report: { pulled: 2, pushed: 1, conflicts: ["a"], errors: ["read failed"], tombstonesApplied: 0, configChanges: 0 },
    },
  },
}));

vi.mock("@/middlelayers/sync/runtime", () => ({
  syncRuntime: {
    status: () => state.current,
    subscribe: () => () => {},
    unlock: vi.fn(async () => "ok"),
    syncNow: vi.fn(),
  },
}));

describe("SyncStatusIndicator", () => {
  it("keeps its desktop height and expands the touch target", () => {
    render(<SyncStatusIndicator />);
    expect(screen.getByRole("button", { name: "Sync error" })).toHaveClass("min-h-9", "touch:min-h-11");
  });

  afterEach(() => {
    state.current.mode = "ready";
    state.current.sync.phase = "error";
    state.current.sync.error = "header";
    Object.assign(state.current.sync, {
      report: { pulled: 2, pushed: 1, conflicts: ["a"], errors: ["read failed"], tombstonesApplied: 0, configChanges: 0 },
      retryStopped: false,
    });
    vi.mocked(syncRuntime.unlock).mockResolvedValue("ok");
    vi.clearAllMocks();
  });

  it("prompts for the session passphrase when sync starts locked", async () => {
    state.current.mode = "locked";
    render(<SyncStatusIndicator />);
    expect(await screen.findByLabelText("Sync passphrase")).toHaveAttribute("type", "password");
  });

  it("points to sync settings when saved credentials are unreadable", async () => {
    state.current.mode = "unreadable";
    render(<SyncStatusIndicator />);
    fireEvent.click(screen.getByRole("button", { name: "Sync settings unreadable" }));
    expect(screen.getByRole("link", { name: /re.enter sync settings/i })).toHaveAttribute("href", "#/settings/sync");
  });

  it("shows sync errors and last round counts in an accessible details popover", async () => {
    render(<SyncStatusIndicator />);
    expect(screen.getByRole("status")).toHaveTextContent("Sync error");
    fireEvent.click(screen.getByRole("button", { name: "Sync error" }));
    expect(await screen.findByText(/Pulled 2, pushed 1, conflicts 1, errors 1/)).toBeInTheDocument();
    expect(screen.getByText("Some sync data could not be processed. Track3 will retry automatically.")).toBeInTheDocument();
  });

  it("shows why a missing remote header stopped automatic sync", async () => {
    render(<SyncStatusIndicator />);
    fireEvent.click(screen.getByRole("button", { name: "Sync error" }));
    expect(await screen.findByText("The sync header is damaged or unsupported.")).toBeInTheDocument();
  });
  it("explains when automatic retries stop", async () => {
    state.current.sync.error = "sync";
    Object.assign(state.current.sync, { report: undefined, retryStopped: true });
    render(<SyncStatusIndicator />);
    fireEvent.click(screen.getByRole("button", { name: "Sync error" }));
    expect(await screen.findByText(/retry.*stopped/i)).toBeInTheDocument();
  });

  it("shows a distinct conflict state with a translated summary", async () => {
    state.current.sync.phase = "idle";
    render(<SyncStatusIndicator />);
    fireEvent.click(screen.getByRole("button", { name: "Sync conflicts" }));
    expect(await screen.findByText(/1 conflict needs review/i)).toBeInTheDocument();
    expect(screen.queryByText("a")).not.toBeInTheDocument();
  });

  it("allows only one unlock request while the first is pending", async () => {
    state.current.mode = "locked";
    let finish!: (value: "ok") => void;
    vi.mocked(syncRuntime.unlock).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<SyncStatusIndicator />);
    const button = await screen.findByRole("button", { name: "Unlock sync" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(syncRuntime.unlock).toHaveBeenCalledTimes(1);
    finish("ok");
    await waitFor(() => expect(button).toBeEnabled());
  });
});
