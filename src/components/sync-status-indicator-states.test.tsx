import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DesktopIndicator from "./sync-status-indicator";
import { SyncStatusIndicatorView } from "./sync-status-indicator";
import MobileIndicator from "@/mobile/components/sync-status-indicator";
import mobileEn from "@/mobile/en.json";
import { syncRuntime, type RuntimeStatus } from "@/middlelayers/sync/runtime";
import type { SyncReport } from "@/middlelayers/sync/engine";

const state = vi.hoisted(() => ({
  current: { mode: "ready", sync: { phase: "idle" } } as RuntimeStatus,
  listeners: new Set<() => void>(),
  prompted: false,
}));

vi.mock("@/middlelayers/sync/runtime", () => ({
  syncRuntime: {
    status: () => state.current,
    subscribe: (listener: () => void) => {
      state.listeners.add(listener);
      return () => { state.listeners.delete(listener); };
    },
    claimLockedPrompt: vi.fn(() => {
      if (state.current.mode !== "locked" || state.prompted) return false;
      state.prompted = true;
      return true;
    }),
    skip: vi.fn(() => publish({ mode: "locked", skipped: true, sync: { phase: "idle" } })),
    disable: vi.fn(async () => publish({ mode: "disabled", sync: { phase: "idle" } })),
    unlock: vi.fn(async () => "ok"),
    syncNow: vi.fn(),
    getSettings: vi.fn(() => state.current.mode === "disabled"
      ? { endpoint: "", bucket: "" }
      : { endpoint: "https://fixture.r2.cloudflarestorage.com", bucket: "sync-fixture" }),
  },
}));

function publish(next: RuntimeStatus) {
  act(() => {
    state.current = next;
    for (const listener of state.listeners) listener();
  });
}

const zeroReport: SyncReport = { pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] };
const previous = Date.parse("2026-10-28T12:00:00Z");

beforeEach(() => {
  state.current = { mode: "ready", sync: { phase: "idle" } };
  state.prompted = false;
  vi.clearAllMocks();
});
afterEach(() => { window.location.hash = ""; });

describe.each([
  ["desktop", DesktopIndicator],
  ["mobile", MobileIndicator],
])("%s sync indicator", (_platform, Indicator) => {
  it("shows no counts before the first sync", () => {
    render(<Indicator />);
    fireEvent.click(screen.getByRole("button", { name: /Not synced yet - open Backup & sync/ }));
    expect(screen.getByText("Not synced yet")).toBeInTheDocument();
    expect(screen.queryByText(/Pulled 0/)).not.toBeInTheDocument();
  });

  it("shows the running start and elapsed time while disabling only the active run", () => {
    publish({ mode: "ready", sync: { phase: "syncing", startedAt: Date.now() - 5000 } });
    render(<Indicator />);
    fireEvent.click(screen.getByRole("button", { name: /Syncing\.\.\./ }));
    expect(screen.getByText("Syncing…")).toBeInTheDocument();
    expect(screen.getByText(/Elapsed: 5s/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sync now" })).toBeDisabled();
    publish({ mode: "ready", sync: { phase: "error", error: "timeout" } });
    expect(screen.getByRole("button", { name: "Sync now" })).toBeEnabled();
  });

  it("shows determinate upload and download progress below the running time", () => {
    publish({ mode: "ready", sync: {
      phase: "syncing", startedAt: Date.now() - 5000,
      progress: { phase: "push", completed: 1240, total: 4567 },
    } });
    render(<Indicator />);
    fireEvent.click(screen.getByRole("button", { name: /Syncing\.\.\./ }));
    const upload = screen.getByText("Uploading 1,240 / 4,567");
    const started = screen.getByText(/Started:/);
    expect(started.compareDocumentPosition(upload) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1240");
    publish({ mode: "ready", sync: {
      phase: "syncing", startedAt: Date.now() - 5000,
      progress: { phase: "pull", completed: 3, total: 10 },
    } });
    expect(screen.getByText("Downloading 3 / 10")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
  });

  it("caps displayed progress when known downloads exceed the current manifest", () => {
    publish({ mode: "ready", sync: {
      phase: "syncing", progress: { phase: "pull", completed: 12, total: 10 },
    } });
    render(<Indicator />);
    fireEvent.click(screen.getByRole("button", { name: /Syncing\.\.\./ }));
    expect(screen.getByText("Downloading 10 / 10")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");
  });

  it("shows the error reason and last successful time without made-up counts", () => {
    publish({ mode: "ready", sync: { phase: "error", error: "bucket", lastSync: previous } });
    render(<Indicator />);
    fireEvent.click(screen.getByRole("button", { name: /Sync failed - open Backup & sync/ }));
    const reason = screen.getByText("Bucket not found. Check the bucket name and endpoint.");
    const lastSync = screen.getByText(/Last successful sync:/);
    expect(reason.compareDocumentPosition(lastSync) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/Pulled 0/)).not.toBeInTheDocument();
  });

  it("shows when an error happened before any successful sync", () => {
    publish({ mode: "ready", sync: { phase: "error", error: "bucket" } });
    render(<Indicator />);
    fireEvent.click(screen.getByRole("button", { name: /Sync failed - open Backup & sync/ }));
    expect(screen.getByText("Bucket not found. Check the bucket name and endpoint.")).toBeInTheDocument();
    expect(screen.getByText("Not synced yet")).toBeInTheDocument();
  });

  it("summarizes an unchanged successful round and shows its time", () => {
    publish({ mode: "ready", sync: { phase: "idle", report: zeroReport, lastSync: previous } });
    render(<Indicator />);
    fireEvent.click(screen.getByRole("button", { name: /Synced .* ago$/ }));
    expect(screen.getByText("Everything is up to date")).toBeInTheDocument();
    expect(screen.getByText(/Last synced:/)).toBeInTheDocument();
    expect(screen.queryByText(/Pulled 0/)).not.toBeInTheDocument();
  });

  it("shows counts when the last round changed data", () => {
    publish({ mode: "ready", sync: { phase: "idle", report: { ...zeroReport, pulled: 2, pushed: 1 }, lastSync: previous } });
    render(<Indicator />);
    fireEvent.click(screen.getByRole("button", { name: /Synced .* ago$/ }));
    expect(screen.getByText("Pulled 2, pushed 1, conflicts 0, errors 0")).toBeInTheDocument();
  });

  it("opens locked sync once, lets the user skip, and keeps a muted pill available", async () => {
    publish({ mode: "locked", sync: { phase: "idle" } });
    render(<Indicator />);
    expect(await screen.findByRole("button", { name: "Skip for now" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(screen.queryByLabelText("Sync passphrase")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sync locked - tap to unlock" })).toBeInTheDocument();
    publish({ mode: "locked", sync: { phase: "idle" } });
    expect(screen.queryByLabelText("Sync passphrase")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sync locked - unlock sync" }));
    expect(screen.getByLabelText("Sync passphrase")).toBeInTheDocument();
    expect(syncRuntime.skip).toHaveBeenCalledTimes(1);
  });

  it("closes the first locked prompt with Escape and keeps focus on the pill", async () => {
    publish({ mode: "locked", sync: { phase: "idle" } });
    render(<Indicator />);
    expect(await screen.findByLabelText("Sync passphrase")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByLabelText("Sync passphrase")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Sync locked - unlock sync" })).toHaveFocus();
    publish({ mode: "locked", sync: { phase: "idle" } });
    expect(screen.queryByLabelText("Sync passphrase")).not.toBeInTheDocument();
  });

  it("names the passphrase dialog with its locked heading", async () => {
    publish({ mode: "locked", sync: { phase: "idle" } });
    render(<Indicator />);
    const title = "Sync is locked";
    const dialog = await screen.findByRole("dialog", { name: title });
    expect(dialog).toHaveTextContent(title);
    expect(dialog).not.toHaveTextContent("Last sync result");
  });

  it("turns off sync only after confirmation and leaves cancel harmless", async () => {
    publish({ mode: "locked", sync: { phase: "idle" } });
    render(<Indicator />);
    fireEvent.click(await screen.findByRole("button", { name: "Turn off sync on this device" }));
    expect(screen.getByText(/data already in the bucket and local data are not deleted/i)).toBeInTheDocument();
    expect(syncRuntime.disable).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(syncRuntime.disable).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Turn off sync on this device" }));
    fireEvent.click(screen.getByRole("button", { name: /^Turn off sync$/ }));
    await waitFor(() => expect(syncRuntime.disable).toHaveBeenCalledTimes(1));
    expect(syncRuntime.disable).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("button", { name: "Sync locked - unlock sync" })).not.toBeInTheDocument();
  });

  it("announces a failed turn-off separately from the passphrase field", async () => {
    publish({ mode: "locked", sync: { phase: "idle" } });
    vi.mocked(syncRuntime.disable).mockRejectedValueOnce(new Error("save failed"));
    render(<Indicator />);
    fireEvent.click(await screen.findByRole("button", { name: "Turn off sync on this device" }));
    fireEvent.click(screen.getByRole("button", { name: /^Turn off sync$/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not disable sync. Please try again.");
    expect(screen.getByLabelText("Sync passphrase")).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByLabelText("Sync passphrase")).not.toHaveAttribute("aria-describedby");
  });

  it("still unlocks from the locked prompt", async () => {
    publish({ mode: "locked", sync: { phase: "idle" } });
    render(<Indicator />);
    fireEvent.change(await screen.findByLabelText("Sync passphrase"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock sync" }));
    await waitFor(() => expect(syncRuntime.unlock).toHaveBeenCalledWith("secret"));
  });
});

it("shows the phone first-sync sheet with its status and settings action", () => {
  window.location.hash = "#/settings/sync";
  publish({ mode: "ready", sync: { phase: "idle", report: { ...zeroReport,
    devices: [{ id: "remote", name: "iPhone", lastUpload: "2026-10-30T22:07:00Z" }] } } });
  render(<SyncStatusIndicatorView t={(key) => (mobileEn as Record<string, string>)[key] ?? key} mobile />);
  fireEvent.click(screen.getByRole("button", { name: /Not synced yet - open Backup & sync/ }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Never synced");
  expect(screen.getByRole("dialog")).toHaveTextContent("Nothing has been uploaded from this device yet.");
  expect(screen.getByRole("dialog").querySelector("a[href='#/settings/sync']")).toHaveTextContent("Settings");
});

it("shows phone upload progress with elapsed time and remaining items", () => {
  window.location.hash = "#/settings/sync";
  publish({ mode: "ready", sync: {
    phase: "syncing", startedAt: Date.now() - 134_000,
    progress: { phase: "push", completed: 1240, total: 4567 },
  } });
  render(<SyncStatusIndicatorView t={(key) => (mobileEn as Record<string, string>)[key] ?? key} mobile />);
  fireEvent.click(screen.getByRole("button", { name: /Syncing\.\.\./ }));
  const sheet = screen.getByRole("dialog");
  expect(sheet).toHaveTextContent("Uploading");
  expect(sheet).toHaveTextContent("Uploading 1,240 / 4,567");
  expect(sheet).toHaveTextContent("02:14");
  expect(sheet).toHaveTextContent("3,327");
  expect(sheet).toHaveTextContent("about 6 min");
  expect(sheet).not.toHaveTextContent("Started:");
  expect(sheet).not.toHaveTextContent("Settings");
});

it("shows the phone successful sheet with last upload and inline details", () => {
  window.location.hash = "#/settings/sync";
  publish({ mode: "ready", sync: { phase: "idle", report: { ...zeroReport, pushed: 312,
    devices: [{ id: "remote", name: "iPhone", lastUpload: "2026-10-28T12:00:00Z" }] }, lastSync: previous } });
  render(<SyncStatusIndicatorView t={(key) => (mobileEn as Record<string, string>)[key] ?? key} mobile />);
  expect(screen.getByRole("button", { name: /Synced .* ago$/ })).toHaveTextContent(/Synced \d\d:\d\d/);
  fireEvent.click(screen.getByRole("button", { name: /Synced .* ago$/ }));
  const sheet = screen.getByRole("dialog");
  expect(sheet).toHaveTextContent("Last upload");
  expect(sheet).toHaveTextContent("Cloudflare R2 · sync-fixture");
  expect(sheet.querySelector(".fidelity-sync-sheet-actions .t3-sync-details")).toBeInTheDocument();
  expect(sheet.querySelector(".fidelity-sync-sheet-actions")).not.toHaveTextContent("Settings");
});

it("shows the known failure in expanded phone diagnostics", () => {
  window.location.hash = "#/settings/sync";
  publish({ mode: "ready", sync: { phase: "error", error: "bucket", report: zeroReport } });
  render(<SyncStatusIndicatorView t={(key) => (mobileEn as Record<string, string>)[key] ?? key} mobile />);
  fireEvent.click(screen.getByRole("button", { name: /Sync failed - open Backup & sync/ }));
  const details = screen.getByRole("dialog").querySelector(".t3-sync-details")!;
  expect(details.querySelector(".t3-sync-details-toggle")).toHaveAttribute("aria-expanded", "true");
  expect(details.querySelector(".t3-sync-details-panel")).toHaveTextContent("Bucket not found");
  expect(details.querySelector(".t3-sync-details-panel")).not.toHaveTextContent("None");
  expect(screen.getByRole("dialog").querySelector(".fidelity-sync-sheet-actions")).toHaveTextContent("Retry now");
});

it("starts stopped phone diagnostics collapsed", () => {
  window.location.hash = "#/settings/sync";
  publish({ mode: "ready", sync: { phase: "error", error: "bucket", retryStopped: true, report: zeroReport } });
  render(<SyncStatusIndicatorView t={(key) => (mobileEn as Record<string, string>)[key] ?? key} mobile />);
  fireEvent.click(screen.getByRole("button", { name: /Sync failed - open Backup & sync/ }));
  expect(screen.getByRole("dialog").querySelector(".t3-sync-details-toggle")).toHaveAttribute("aria-expanded", "false");
});
