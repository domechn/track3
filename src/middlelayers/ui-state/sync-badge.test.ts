import { describe, expect, it } from "vitest";
import en from "@/i18n/locales/en.json";
import mobileEn from "@/mobile/en.json";
import type { RuntimeStatus } from "@/middlelayers/sync/runtime";
import { syncBadge, syncBadgePhase, syncBadgePill, syncSkippedCount, type SyncBadge } from "./sync-badge";

const report = { pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] };
const lastSync = Date.parse("2026-10-28T12:00:00Z");
const synced = { phase: "idle" as const, lastSync, report };
const ready = (sync: RuntimeStatus["sync"]): RuntimeStatus => ({ mode: "ready", sync });
const texts = [en, mobileEn] as Array<Record<string, string>>;

// The wide popover and the phone sheet name the same pills with their own keys.
const pillKeys = {
  passphraseNeeded: ["fidelity.b.sync.sheetPassphraseNeeded"],
  downloading: ["fidelity.settingsB.sync.pop.downloading", "fidelity.b.sync.sheetDownloading"],
  uploading: ["fidelity.settingsB.sync.pop.uploading", "fidelity.b.sync.sheetUploading"],
  needsAttention: ["fidelity.settingsB.sync.pop.needsAttention", "fidelity.b.sync.sheetNeedsAttention"],
  retrying: ["fidelity.settingsB.sync.pop.retrying", "fidelity.b.sync.sheetRetrying"],
  synced: ["fidelity.settingsB.sync.pop.synced", "fidelity.b.sync.synced"],
  never: ["fidelity.settingsB.sync.pop.never", "fidelity.b.sync.sheetNever"],
};

function pillText(badge: SyncBadge): string {
  const [first, ...rest] = pillKeys[syncBadgePill(badge)].map((key) => texts.map((catalog) => catalog[key]).find(Boolean));
  for (const other of rest) expect(other).toBe(first);
  return first!;
}

describe("today's badge states and pills", () => {
  // Rows of sync-status-model.test.tsx, then the fixtures of the indicator states and wide tests.
  it.each<[string, RuntimeStatus, boolean, SyncBadge, string, string]>([
    ["synced", ready(synced), true, { state: "synced", at: lastSync }, "idle", "Synced"],
    ["syncing", ready({ phase: "syncing" }), true, { state: "syncing", direction: undefined }, "syncing", "Uploading"],
    ["error without a reason", ready({ phase: "error" }), true, { state: "error", reason: "sync", retry: "scheduled" }, "error", "Retrying"],
    ["idle round that only reports errors", ready({ ...synced, report: { ...report, errors: ["upload failed"] } }), true,
      { state: "error", reason: "sync", retry: "scheduled" }, "error", "Retrying"],
    ["partial, parked objects", ready({ ...synced, partial: true, report: { ...report, pushed: 1, skipped: 14 } }), true,
      { state: "partial", count: 14 }, "partial", "Needs attention"],
    ["partial, one failed object", ready({ ...synced, partial: true, report: { ...report, pulled: 3, errors: ["Failed to pull edit object"] } }), true,
      { state: "partial", count: 1 }, "partial", "Needs attention"],
    ["conflict", ready({ phase: "idle", report: { ...report, conflicts: ["conflict"] } }), true,
      { state: "conflict", count: 1 }, "conflict", "Needs attention"],
    ["conflict before partial", ready({ ...synced, partial: true, report: { ...report, conflicts: ["snapshot:abc"], errors: ["Failed to write sync manifest"] } }), true,
      { state: "conflict", count: 1 }, "conflict", "Needs attention"],
    ["off", { mode: "disabled", sync: { phase: "idle" } }, true, { state: "off" }, "idle", "Never synced"],
    ["off before offline", { mode: "disabled", sync: { phase: "idle" } }, false, { state: "off" }, "idle", "Never synced"],
    ["offline", ready(synced), false, { state: "offline" }, "idle", "Never synced"],
    ["never", ready({ phase: "idle" }), true, { state: "ready" }, "idle", "Never synced"],
    ["last sync while the report loads", ready({ phase: "idle", lastSync }), true, { state: "synced", at: lastSync }, "idle", "Synced"],
    ["locked", { mode: "locked", sync: { phase: "idle" } }, true, { state: "locked", skipped: false }, "locked", "Passphrase needed"],
    ["skipped", { mode: "locked", skipped: true, sync: { phase: "idle" } }, true, { state: "locked", skipped: true }, "skipped", "Passphrase needed"],
    ["download", ready({ phase: "syncing", progress: { phase: "pull", completed: 3, total: 10 } }), true,
      { state: "syncing", direction: "pull" }, "syncing", "Downloading"],
    ["upload", ready({ phase: "syncing", progress: { phase: "push", completed: 1240, total: 4567 } }), true,
      { state: "syncing", direction: "push" }, "syncing", "Uploading"],
    ["soft error with a last sync", ready({ phase: "error", error: "bucket", lastSync }), true,
      { state: "error", reason: "bucket", retry: "scheduled" }, "error", "Retrying"],
    ["soft error with a retry time", ready({ phase: "error", error: "network", failures: 1, nextRetryAt: lastSync }), true,
      { state: "error", reason: "network", retry: "scheduled" }, "error", "Retrying"],
    ["timeout with a report", ready({ phase: "error", error: "timeout", report, lastSync }), true,
      { state: "error", reason: "timeout", retry: "scheduled" }, "error", "Retrying"],
    ["conditions", ready({ phase: "error", error: "conditions" }), true,
      { state: "error", reason: "conditions", retry: "scheduled" }, "error", "Retrying"],
    ["round errors without progress", ready({ phase: "error", error: "sync", report: { ...report, errors: ["Failed to read sync manifest"] } }), true,
      { state: "error", reason: "sync", retry: "scheduled" }, "error", "Retrying"],
    ["retry paused", ready({ phase: "error", error: "sync", failures: 6, retryStopped: true }), true,
      { state: "error", reason: "sync", retry: "stopped" }, "error", "Needs attention"],
  ])("%s", (_name, status, online, badge, phase, pill) => {
    expect(syncBadge(status, online)).toEqual(badge);
    expect(syncBadgePhase(badge)).toBe(phase);
    expect(pillText(badge)).toBe(pill);
  });

  it("counts parked objects and non-fatal errors only for a finished partial round", () => {
    expect(syncSkippedCount({ ...synced, partial: true, report: { ...report, skipped: 2, errors: ["one"] } })).toBe(3);
    expect(syncSkippedCount({ ...synced, report: { ...report, skipped: 2 } })).toBe(0);
    expect(syncSkippedCount({ phase: "error", partial: true, report: { ...report, skipped: 2 } })).toBe(0);
  });
});

describe("errors that never retry by themselves", () => {
  it.each(["header", "passphrase", "access", "configuration"] as const)("%s is blocked and needs attention", (error) => {
    const badge = syncBadge(ready({ phase: "error", error, lastSync }));
    expect(badge).toEqual({ state: "error", reason: error, retry: "blocked" });
    expect(pillText(badge)).toBe("Needs attention");
  });

  it("unreadable settings are blocked and need attention", () => {
    const badge = syncBadge({ mode: "unreadable", sync: { phase: "idle" } });
    expect(badge).toEqual({ state: "error", reason: "unreadable", retry: "blocked" });
    expect(syncBadgePhase(badge)).toBe("unreadable");
    expect(pillText(badge)).toBe("Needs attention");
  });
});
