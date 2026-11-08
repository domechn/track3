import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import SyncStatusIndicator from "./sync-status-indicator";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import type { SyncDiagnostics } from "@/middlelayers/sync/diagnostics";

const current = vi.hoisted(() => ({ value: {} as any }));
vi.mock("@/middlelayers/sync/runtime", () => ({
  syncRuntime: {
    status: () => current.value,
    subscribe: () => () => {},
    claimLockedPrompt: () => false,
    getSettings: () => ({ bucket: "test-bucket", endpoint: "https://example.test" }),
    syncNow: vi.fn(),
    configConflicts: vi.fn(async () => []),
  },
}));

const report = {
  pulled: 2, pushed: 1, tombstonesApplied: 0, configChanges: 0,
  conflicts: ["snapshot:abc"], errors: ["Failed to write sync manifest"], devices: [],
};
const diagnostics: SyncDiagnostics = {
  wallMs: 1000, phases: Object.fromEntries([
    "headerRead", "keyDerivation", "discover", "manifestsDownload", "pull",
    "localScan", "stateSave", "push", "manifestWrite", "prune",
  ].map((phase) => [phase, 0])) as SyncDiagnostics["phases"],
  requests: Object.fromEntries(["GET", "PUT", "LIST", "DELETE", "HEAD"].map((verb) =>
    [verb, { count: 0, bytesSent: 0, bytesReceived: 0, outcomes: Object.fromEntries([
      "ok", "notModified", "notFound", "preconditionFailed", "conflict",
      "rateLimited", "serverError", "timeout", "retry", "otherError",
    ].map((outcome) => [outcome, { count: 0, bytesSent: 0, bytesReceived: 0 }])) }])) as SyncDiagnostics["requests"],
  retries: 0, retryWaitMs: 0, timeouts: 0, syncStateBytes: 0,
  snapshots: 0, entries: 0, knownTokens: 0, slowest: [],
};

function wide() {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1600 });
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
});

it("does not call a finished sync up to date when conflicts need review", async () => {
  wide();
  current.value = { mode: "ready", sync: { phase: "idle", report, lastSync: Date.now() } };
  render(<SyncStatusIndicator />);
  fireEvent.click(screen.getByRole("button", { name: "Sync conflicts - open Backup & sync" }));
  expect(await screen.findByText(/1 conflict needs review/i)).toBeInTheDocument();
  expect(screen.queryByText("Up to date")).not.toBeInTheDocument();
});

it("keeps the connection error and error report alongside wide diagnostics", async () => {
  wide();
  current.value = { mode: "ready", sync: { phase: "error", error: "timeout", report, diagnostics, lastSync: Date.now() } };
  render(<SyncStatusIndicator />);
  fireEvent.click(screen.getByRole("button", { name: /Sync failed - open Backup & sync/ }));
  expect(await screen.findByText("Sync timed out. Check your connection and try again.")).toBeInTheDocument();
  expect(screen.getByText("Error details")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getAllByText("Phase timings")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: /Error details/ }));
  expect(screen.getAllByText("Phase timings")).toHaveLength(2);
  expect(vi.mocked(syncRuntime.syncNow)).not.toHaveBeenCalled();
});

it("uses a button to open stopped wide diagnostics", async () => {
  wide();
  current.value = { mode: "ready", sync: { phase: "error", retryStopped: true, report, diagnostics, lastSync: Date.now() } };
  render(<SyncStatusIndicator />);
  fireEvent.click(screen.getByRole("button", { name: /Sync failed - open Backup & sync/ }));
  const toggle = screen.getByRole("button", { name: "Details" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(within(toggle.closest(".t3-b-sync-pop-diagnostics") as HTMLElement).getByText("Phase timings")).toBeVisible();
});
