import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import en from "@/i18n/locales/en.json";
import type { RuntimeStatus } from "@/middlelayers/sync/runtime";
import { SyncStatusCard } from "./sync-status-card";

vi.mock("@/middlelayers/sync/runtime", () => ({ syncRuntime: { configConflicts: async () => [] } }));
const t = (key: string) => (en as Record<string, string>)[key] ?? key;
const card = (sync: RuntimeStatus["sync"], onSyncNow = () => {}) =>
  render(<SyncStatusCard status={{ mode: "ready", sync }} busy={undefined} onSyncNow={onSyncNow} t={t} locale="en" />);

it("shows the next automatic retry time next to Sync now", () => {
  const onSyncNow = vi.fn();
  card({ phase: "error", error: "network", failures: 1, nextRetryAt: new Date(2026, 10, 13, 9, 41).getTime() }, onSyncNow);
  expect(screen.getByText("Next automatic retry at 09:41")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
  expect(onSyncNow).toHaveBeenCalledTimes(1);
});

it("shows that automatic retry paused and after how many attempts", () => {
  card({ phase: "error", error: "sync", failures: 6, retryStopped: true });
  expect(screen.getByText("Automatic retry paused after 5 attempts")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sync now" })).toBeEnabled();
});

it("names a round that skipped parked objects instead of calling it connected or failed", () => {
  card({ phase: "idle", partial: true, lastSync: Date.now(), report: {
    pulled: 0, pushed: 1, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [], skipped: 14,
  } });
  expect(screen.getByText("Synced with 14 items skipped")).toBeInTheDocument();
  expect(screen.queryByText("Sync error")).not.toBeInTheDocument();
  expect(screen.queryByText(/Automatic retry|Next automatic retry/)).not.toBeInTheDocument();
});

it("warns that first-join config waits for a complete peer read", () => {
  card({ phase: "error", error: "sync", nextRetryAt: Date.now() + 5_000, report: {
    pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [],
    errors: ["Failed to read sync manifest"], configDecisionDeferred: true,
  } });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Could not check every device. Your local settings were not shared. Retry after the read succeeds.",
  );
});
