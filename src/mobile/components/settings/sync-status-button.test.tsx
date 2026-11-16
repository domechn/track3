import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import SyncSettingsPage from "./sync";
import type { RuntimeStatus } from "@/middlelayers/sync/runtime";

const current = vi.hoisted(() => ({ value: {} as RuntimeStatus }));
vi.mock("@/mobile/components/ui/use-toast", () => ({ useToast: () => ({ toast: () => ({ dismiss: () => {} }) }) }));
vi.mock("@/middlelayers/sync/runtime", () => ({
  syncRuntime: {
    status: () => current.value,
    subscribe: () => () => {},
    getSettings: () => ({
      endpoint: "https://s3.example.test", region: "", bucket: "", prefix: "", accessKeyId: "", secretAccessKey: "",
      pathStyle: true, enabled: true, deviceNames: {},
      categories: { history: true, settings: true, secrets: true, rebalance: true, chat: true },
    }),
    devices: async () => [],
    configConflicts: async () => [],
  },
}));

const lastSync = new Date(2026, 9, 28, 9, 41).getTime();
const report = { pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] };

function statusButton(status: RuntimeStatus) {
  current.value = status;
  return render(<SyncSettingsPage />).container.querySelector(".fidelity-b-sync-status")!;
}

beforeEach(() => { vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone"); });
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("phone sync status button", () => {
  it.each<[string, RuntimeStatus, string, string]>([
    ["locked", { mode: "locked", sync: { phase: "idle" } }, "Sync locked", "is-warning"],
    ["paused retry", { mode: "ready", sync: { phase: "error", error: "network", retryStopped: true } }, "Sync stopped", "is-error"],
    ["soft error", { mode: "ready", sync: { phase: "error", error: "network" } }, "Sync failed", "is-error"],
    ["hard error", { mode: "ready", sync: { phase: "error", error: "passphrase" } }, "Sync failed", "is-error"],
    ["upload", { mode: "ready", sync: { phase: "syncing", progress: { phase: "push", completed: 27, total: 100 } } }, "Syncing 27%", ""],
    ["synced", { mode: "ready", sync: { phase: "idle", lastSync, report } }, "Synced 09:41", ""],
    ["partial", { mode: "ready", sync: { phase: "idle", lastSync, partial: true, report: { ...report, skipped: 2 } } }, "Synced 09:41", "is-warning"],
    ["conflict", { mode: "ready", sync: { phase: "idle", lastSync, report: { ...report, conflicts: ["snapshot:abc"] } } }, "Synced 09:41", ""],
    ["never", { mode: "ready", sync: { phase: "idle" } }, "Not synced", ""],
    ["off", { mode: "disabled", sync: { phase: "idle" } }, "Not synced", ""],
  ])("keeps the %s label", (_name, status, label, dot) => {
    const button = statusButton(status);
    expect(button).toHaveTextContent(label);
    expect(button.querySelector("span")!.className).toBe(dot);
  });

  it("says failed, not never synced, when the saved settings are unreadable", () => {
    const button = statusButton({ mode: "unreadable", sync: { phase: "idle" } });
    expect(button).toHaveTextContent("Sync failed");
    expect(button.querySelector("span")).toHaveClass("is-error");
  });
});
