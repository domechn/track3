import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SyncStatusIndicator, { SyncStatusIndicatorView } from "./sync-status-indicator";
import en from "@/i18n/locales/en.json";
import mobileEn from "@/mobile/en.json";
import type { RuntimeStatus } from "@/middlelayers/sync/runtime";

const current = vi.hoisted(() => ({ value: {} as RuntimeStatus }));
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

const soft = ["network", "timeout", "bucket", "conditions", "sync"] as const;
const hard = ["header", "passphrase", "access", "configuration"] as const;
const lastSync = Date.parse("2026-10-28T12:00:00Z");
const autoRetry = en["sync.status.errorsPresent"];
const button = () => document.querySelector<HTMLButtonElement>(".t3-topbar-sync-button")!;

function widePopover(sync: RuntimeStatus["sync"]) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1600 });
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  current.value = { mode: "ready", sync };
  render(<SyncStatusIndicator />);
  fireEvent.click(button());
  return document.querySelector(".t3-b-sync-pop-content")!;
}

function phoneSheet(status: RuntimeStatus) {
  window.location.hash = "#/settings/sync";
  current.value = status;
  render(<SyncStatusIndicatorView t={(key) => (mobileEn as Record<string, string>)[key] ?? key} mobile />);
  fireEvent.click(button());
  return document.querySelector(".fidelity-sync-sheet-pill")!;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  window.location.hash = "";
});

describe("pills that stay as they are", () => {
  it.each(soft)("wide popover says Retrying and promises a retry for %s", (error) => {
    const popover = widePopover({ phase: "error", error, lastSync });
    expect(popover.querySelector(".t3-b-sync-pop-badge")).toHaveTextContent("Retrying");
    expect(popover).toHaveTextContent(autoRetry);
  });

  it("wide popover says Needs attention once automatic retry paused", () => {
    const popover = widePopover({ phase: "error", error: "network", failures: 6, retryStopped: true, lastSync });
    expect(popover.querySelector(".t3-b-sync-pop-badge")).toHaveTextContent("Needs attention");
    expect(popover).toHaveTextContent("Automatic retry paused after 5 attempts");
  });

  it("wide popover keeps the upload, conflict and synced pills", () => {
    const report = { pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [] as string[], errors: [] };
    expect(widePopover({ phase: "syncing" }).querySelector(".t3-b-sync-pop-badge")).toHaveTextContent("Uploading");
    cleanup();
    expect(widePopover({ phase: "idle", lastSync, report: { ...report, conflicts: ["snapshot:abc"] } })
      .querySelector(".t3-b-sync-pop-badge")).toHaveTextContent("Needs attention");
    cleanup();
    expect(widePopover({ phase: "idle", lastSync, report }).querySelector(".t3-b-sync-pop-badge")).toHaveTextContent("Synced");
    cleanup();
    expect(widePopover({ phase: "idle" }).querySelector(".t3-b-sync-pop-badge")).toHaveTextContent("Never synced");
  });

  it.each(soft)("phone sheet says Retrying for %s", (error) => {
    expect(phoneSheet({ mode: "ready", sync: { phase: "error", error, lastSync } })).toHaveTextContent("Retrying");
  });

  it("phone sheet keeps the paused, download, synced, conflict and locked pills", () => {
    const report = { pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [] as string[], errors: [] };
    expect(phoneSheet({ mode: "ready", sync: { phase: "error", error: "network", retryStopped: true } })).toHaveTextContent("Needs attention");
    cleanup();
    expect(phoneSheet({ mode: "ready", sync: { phase: "syncing", progress: { phase: "pull", completed: 1, total: 2 } } }))
      .toHaveTextContent("Downloading");
    cleanup();
    expect(phoneSheet({ mode: "ready", sync: { phase: "idle", lastSync, report } })).toHaveTextContent("Synced");
    cleanup();
    expect(phoneSheet({ mode: "ready", sync: { phase: "idle", lastSync, report: { ...report, conflicts: ["snapshot:abc"] } } }))
      .toHaveTextContent("Synced");
    cleanup();
    expect(phoneSheet({ mode: "ready", sync: { phase: "idle" } })).toHaveTextContent("Never synced");
    cleanup();
    expect(phoneSheet({ mode: "locked", skipped: true, sync: { phase: "idle" } })).toHaveTextContent("Passphrase needed");
  });
});

describe("errors that never retry by themselves", () => {
  it.each(hard)("wide popover asks for attention and promises no retry for %s", (error) => {
    const popover = widePopover({ phase: "error", error, lastSync });
    expect(popover.querySelector(".t3-b-sync-pop-badge")).toHaveTextContent("Needs attention");
    expect(popover).toHaveTextContent(en[`sync.connection.${error}`]);
    expect(popover).not.toHaveTextContent(autoRetry);
    expect(screen.getByRole("button", { name: "Retry now" })).toBeEnabled();
  });

  it.each(hard)("phone sheet asks for attention for %s", (error) => {
    expect(phoneSheet({ mode: "ready", sync: { phase: "error", error, lastSync } })).toHaveTextContent("Needs attention");
  });

  it("phone sheet asks for attention when the settings are unreadable", () => {
    expect(phoneSheet({ mode: "unreadable", sync: { phase: "idle" } })).toHaveTextContent("Needs attention");
  });
});

describe("retry marker on the sync button", () => {
  it.each<[string, RuntimeStatus, string | null]>([
    ["scheduled", { mode: "ready", sync: { phase: "error", error: "network", nextRetryAt: lastSync } }, "scheduled"],
    ["stopped", { mode: "ready", sync: { phase: "error", error: "network", retryStopped: true } }, "stopped"],
    ["blocked", { mode: "ready", sync: { phase: "error", error: "passphrase" } }, "blocked"],
    ["blocked for unreadable settings", { mode: "unreadable", sync: { phase: "idle" } }, "blocked"],
    ["absent when synced", { mode: "ready", sync: { phase: "idle", lastSync } }, null],
    ["absent while syncing", { mode: "ready", sync: { phase: "syncing" } }, null],
  ])("%s", (_name, status, retry) => {
    current.value = status;
    render(<SyncStatusIndicator />);
    expect(button()).toHaveAttribute("data-sync-state", retry ? "error" : expect.any(String));
    expect(button().getAttribute("data-sync-retry")).toBe(retry);
  });
});
