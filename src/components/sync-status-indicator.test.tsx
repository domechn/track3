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
    claimLockedPrompt: () => true,
    skip: vi.fn(),
    disable: vi.fn(),
  },
}));

describe("SyncStatusIndicator", () => {
  it("keeps its desktop height and expands the touch target", () => {
    render(<SyncStatusIndicator />);
    expect(screen.getByRole("button", { name: /Sync failed - open Backup & sync/ })).toHaveClass("min-h-9", "touch:min-h-11");
  });

  afterEach(() => {
    state.current.mode = "ready";
    state.current.sync.phase = "error";
    state.current.sync.error = "header";
    Object.assign(state.current.sync, {
      report: { pulled: 2, pushed: 1, conflicts: ["a"], errors: ["read failed"], tombstonesApplied: 0, configChanges: 0 },
      retryStopped: false,
      lastSync: undefined,
      failures: undefined,
      nextRetryAt: undefined,
      partial: undefined,
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
    fireEvent.click(screen.getByRole("button", { name: /Sync failed - open Backup & sync/ }));
    expect(screen.getByRole("link", { name: /re.enter sync settings/i })).toHaveAttribute("href", "#/settings/sync");
  });

  it("shows sync errors and last round counts in an accessible details popover", async () => {
    render(<SyncStatusIndicator />);
    expect(screen.getByRole("status")).toHaveTextContent("Sync error");
    fireEvent.click(screen.getByRole("button", { name: /Sync failed - open Backup & sync/ }));
    expect(await screen.findByText(/Pulled 2, pushed 1, conflicts 1, errors 1/)).toBeInTheDocument();
    expect(screen.getByText("Some sync data could not be processed. Track3 will retry automatically.")).toBeInTheDocument();
  });

  it("shows why a missing remote header stopped automatic sync", async () => {
    render(<SyncStatusIndicator />);
    fireEvent.click(screen.getByRole("button", { name: /Sync failed - open Backup & sync/ }));
    expect(await screen.findByText("The sync header is damaged or unsupported.")).toBeInTheDocument();
  });
  it("shows no invented counts before the first sync", async () => {
    state.current.sync.phase = "idle";
    Object.assign(state.current.sync, { report: undefined, error: undefined });
    render(<SyncStatusIndicator />);
    fireEvent.click(screen.getByRole("button", { name: /Not synced yet - open Backup & sync/ }));
    expect(await screen.findByText("Not synced yet")).toBeInTheDocument();
    expect(screen.queryByText(/Pulled 0, pushed 0/)).not.toBeInTheDocument();
  });

  it("shows the completed sync time in the records header and keeps its details popover", async () => {
    state.current.sync.phase = "idle";
    Object.assign(state.current.sync, {
      report: undefined,
      error: undefined,
      lastSync: Date.parse("2026-10-31T09:41:00.000Z"),
    });
    render(<SyncStatusIndicator recordsStamp />);
    expect(screen.getByRole("status")).toHaveTextContent("Synced 09:41");
    fireEvent.click(screen.getByRole("button", { name: /Synced .* ago$/ }));
    expect(await screen.findByText(/Last synced:/)).toBeInTheDocument();
  });

  it("explains when automatic retries stop", async () => {
    state.current.sync.error = "sync";
    Object.assign(state.current.sync, { report: undefined, retryStopped: true });
    render(<SyncStatusIndicator />);
    fireEvent.click(screen.getByRole("button", { name: /Sync failed - open Backup & sync/ }));
    expect(await screen.findByText(/retry.*stopped/i)).toBeInTheDocument();
  });

  it("says when the next automatic retry runs and keeps Sync now available", async () => {
    state.current.sync.error = "network";
    Object.assign(state.current.sync, { report: undefined, failures: 2, nextRetryAt: new Date(2026, 10, 13, 9, 41).getTime() });
    render(<SyncStatusIndicator />);
    fireEvent.click(screen.getByRole("button", { name: /Sync failed - open Backup & sync/ }));
    expect(await screen.findByText("Next automatic retry at 09:41")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
    expect(syncRuntime.syncNow).toHaveBeenCalledTimes(1);
  });

  it("says after how many attempts automatic retry paused", async () => {
    state.current.sync.error = "network";
    Object.assign(state.current.sync, { report: undefined, retryStopped: true, failures: 6 });
    render(<SyncStatusIndicator />);
    fireEvent.click(screen.getByRole("button", { name: /Sync failed - open Backup & sync/ }));
    expect(await screen.findByText("Automatic retry paused after 5 attempts")).toBeInTheDocument();
    expect(screen.queryByText(/refresh to try again/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sync now" })).toBeEnabled();
  });

  it("ends a round with parked objects as a warning with Details", async () => {
    state.current.sync.phase = "idle";
    state.current.sync.error = undefined as unknown as string;
    Object.assign(state.current.sync, {
      partial: true, lastSync: Date.now(),
      report: { pulled: 0, pushed: 1, conflicts: [], errors: [], skipped: 14, tombstonesApplied: 0, configChanges: 0 },
    });
    render(<SyncStatusIndicator />);
    const button = screen.getByRole("button", { name: "Synced with 14 items skipped - open Backup & sync" });
    expect(button).toHaveClass("text-warning");
    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: "Details, 14 issues" })).toBeInTheDocument();
    expect(screen.getByText("Synced with 14 items skipped", { selector: "p" })).toHaveClass("text-warning");
    expect(screen.queryByText(/Track3 will retry automatically/)).not.toBeInTheDocument();
  });

  it("shows a distinct conflict state with a translated summary", async () => {
    state.current.sync.phase = "idle";
    render(<SyncStatusIndicator />);
    fireEvent.click(screen.getByRole("button", { name: "Sync conflicts - open Backup & sync" }));
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
