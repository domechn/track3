import type { RuntimeStatus } from "@/middlelayers/sync/runtime";
import { isHardSyncError, type SyncStatus } from "@/middlelayers/sync/scheduler";

// The one derivation of what the sync surfaces show. docs/state-machines/sync.md has the table.
export type SyncBadge =
  | { state: "off" } | { state: "offline" } | { state: "ready" }
  | { state: "locked"; skipped: boolean }
  | { state: "syncing"; direction?: "pull" | "push" }
  | { state: "synced"; at: number }
  | { state: "partial"; count: number }
  | { state: "conflict"; count: number }
  | { state: "error"; reason: "unreadable" | NonNullable<SyncStatus["error"]>;
      retry: "scheduled" | "stopped" | "blocked" };

export type SyncPill = "passphraseNeeded" | "downloading" | "uploading" | "needsAttention" | "retrying" | "synced" | "never";

// Objects a finished round left behind: parked ones plus errors that did not stop the round.
export function syncSkippedCount(sync: SyncStatus): number {
  return sync.phase === "idle" && sync.partial && sync.report
    ? (sync.report.skipped ?? 0) + (sync.report.errors?.length ?? 0) : 0;
}

export function syncBadge(status: RuntimeStatus, online = true): SyncBadge {
  const { mode, sync } = status;
  if (mode === "disabled") return { state: "off" };
  if (!online) return { state: "offline" };
  if (mode === "unreadable") return { state: "error", reason: "unreadable", retry: "blocked" };
  if (mode === "locked") return { state: "locked", skipped: !!status.skipped };
  switch (sync.phase) {
    case "syncing":
      return { state: "syncing", direction: sync.progress?.phase };
    case "error":
      return {
        state: "error", reason: sync.error ?? "sync",
        retry: sync.retryStopped ? "stopped" : isHardSyncError(sync.error) ? "blocked" : "scheduled",
      };
    case "idle": {
      // Component test doubles pass reports without the arrays, hence the optional reads.
      const conflicts = sync.report?.conflicts?.length ?? 0;
      if (conflicts) return { state: "conflict", count: conflicts };
      const skipped = syncSkippedCount(sync);
      if (skipped) return { state: "partial", count: skipped };
      // The scheduler marks such a round partial; a bare report with errors still reads as failed.
      if (sync.report?.errors?.length) return { state: "error", reason: "sync", retry: "scheduled" };
      return sync.lastSync === undefined ? { state: "ready" } : { state: "synced", at: sync.lastSync };
    }
    default:
      return unhandled(sync.phase);
  }
}

// Suffix of the sync.status.* catalog keys.
export function syncBadgePhase(badge: SyncBadge): "unreadable" | "locked" | "skipped" | "conflict" | "partial" | "error" | "syncing" | "idle" {
  switch (badge.state) {
    case "error": return badge.reason === "unreadable" ? "unreadable" : "error";
    case "locked": return badge.skipped ? "skipped" : "locked";
    case "conflict": case "partial": case "syncing": return badge.state;
    case "off": case "offline": case "ready": case "synced": return "idle";
    default: return unhandled(badge);
  }
}

export function syncBadgePill(badge: SyncBadge): SyncPill {
  switch (badge.state) {
    case "locked": return "passphraseNeeded";
    case "syncing": return badge.direction === "pull" ? "downloading" : "uploading";
    case "partial": case "conflict": return "needsAttention";
    // Only a scheduled retry may say "Retrying"; paused and blocked errors wait for the user.
    case "error": return badge.retry === "scheduled" ? "retrying" : "needsAttention";
    case "synced": return "synced";
    case "off": case "offline": case "ready": return "never";
    default: return unhandled(badge);
  }
}

function unhandled(_value: never): never {
  throw new Error("Unhandled sync badge input");
}
