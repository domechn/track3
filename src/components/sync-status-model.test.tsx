import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { RuntimeStatus } from "@/middlelayers/sync/runtime";
import SyncStatusIndicator from "./sync-status-indicator";

const fixture = vi.hoisted(() => ({
  status: { mode: "ready", sync: { phase: "idle" } } as RuntimeStatus,
  settings: { endpoint: "https://sync.example.test", bucket: "portfolio" },
}));

vi.mock("@/middlelayers/sync/runtime", () => ({
  syncRuntime: {
    status: () => fixture.status,
    subscribe: () => () => {},
    getSettings: () => fixture.settings,
    claimLockedPrompt: () => false,
  },
}));

afterEach(() => {
  cleanup();
  window.location.hash = "";
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

const synced = { phase: "idle" as const, lastSync: Date.now() - 120_000,
  report: { pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] } };

for (const { name, status, label, icon, tone } of [
  { name: "synced", status: { mode: "ready", sync: synced }, label: "Synced 2 min ago", icon: "check", tone: "text-muted-foreground" },
  { name: "syncing", status: { mode: "ready", sync: { phase: "syncing" } }, label: "Syncing...", icon: "sync", tone: "text-muted-foreground" },
  { name: "error", status: { mode: "ready", sync: { phase: "error" } }, label: "Sync failed - open Backup & sync", icon: "alert", tone: "text-destructive" },
  { name: "error", status: { mode: "ready", sync: { ...synced, report: { ...synced.report, errors: ["upload failed"] } } }, label: "Sync failed - open Backup & sync", icon: "alert", tone: "text-destructive" },
  { name: "partial", status: { mode: "ready", sync: { ...synced, partial: true, report: { ...synced.report, pushed: 1, skipped: 14 } } }, label: "Synced with 14 items skipped - open Backup & sync", icon: "alert", tone: "text-warning" },
  { name: "partial", status: { mode: "ready", sync: { ...synced, partial: true, report: { ...synced.report, pulled: 3, errors: ["Failed to pull edit object"] } } }, label: "Synced with 1 item skipped - open Backup & sync", icon: "alert", tone: "text-warning" },
  { name: "conflict", status: { mode: "ready", sync: { phase: "idle", report: { ...synced.report, conflicts: ["conflict"] } } }, label: "Sync conflicts - open Backup & sync", icon: "alert", tone: "text-warning" },
  { name: "off", status: { mode: "disabled", sync: { phase: "idle" } }, label: "Sync is off", icon: "off", tone: "text-muted-foreground" },
] as const) {
  it(`shows ${name} as a labelled cloud icon`, () => {
    fixture.status = status as RuntimeStatus;
    const { container } = render(<SyncStatusIndicator overviewFidelity />);
    const button = container.querySelector<HTMLButtonElement>(".t3-topbar-sync-button")!;
    expect(button).toHaveAttribute("title", label);
    expect(button).toHaveAttribute("data-sync-state", name);
    expect(button).toHaveClass(tone);
    expect(button.querySelector("svg")).toHaveAttribute("data-icon", icon);
    if (name === "synced") expect(button).toHaveAttribute("aria-label", expect.stringMatching(/^Synced \d\d:\d\d, 2 min ago$/));
    else expect(button).toHaveAttribute("aria-label", label);
    if (name === "off") expect(button).toHaveTextContent("Sync off");
    expect(container.querySelector(".t3-topbar-sync-button .rounded-full")).not.toBeInTheDocument();
  });
}

it("shows an offline cloud when the device loses connectivity", () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  fixture.status = { mode: "ready", sync: synced };
  render(<SyncStatusIndicator overviewFidelity />);
  const button = screen.getByRole("button", { name: /Sync is offline/ });
  expect(button).toHaveAttribute("data-sync-state", "offline");
  expect(button).toHaveTextContent("Offline");
  expect(screen.getByRole("status")).toHaveTextContent("Sync is offline");
});

it("describes configured sync before the first run", () => {
  fixture.status = { mode: "ready", sync: { phase: "idle" } };
  render(<SyncStatusIndicator overviewFidelity />);
  expect(screen.getByRole("button", { name: /Not synced yet - open Backup & sync/ })).toHaveTextContent("Not synced");
  expect(screen.getByRole("status")).toHaveTextContent("Not synced yet");
});

it("keeps the last successful sync visible while its report loads", () => {
  fixture.status = { mode: "ready", sync: { phase: "idle", lastSync: Date.now() - 120_000 } };
  render(<SyncStatusIndicator overviewFidelity />);
  const button = screen.getByRole("button", { name: /Synced \d\d:\d\d, 2 min ago/ });
  expect(button).toHaveTextContent(/Synced \d\d:\d\d/);
  expect(button).toHaveAttribute("title", "Synced 2 min ago");
});

it("names a week-old sync with its visible time and relative age", () => {
  fixture.status = { mode: "ready", sync: { phase: "idle", lastSync: Date.now() - 7 * 86_400_000 } };
  render(<SyncStatusIndicator overviewFidelity />);
  expect(screen.getByRole("button", { name: /Synced \d\d:\d\d, 7 d ago/ })).toHaveTextContent(/Synced \d\d:\d\d/);
});

it("opens Backup & sync instead of a dead sync popover when sync is off", () => {
  fixture.status = { mode: "disabled", sync: { phase: "idle" } };
  render(<SyncStatusIndicator overviewFidelity />);
  fireEvent.click(screen.getByRole("button", { name: /Sync is off/ }));
  expect(window.location.hash).toBe("#/settings/sync");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("names the skipped control for its unlock action", () => {
  fixture.status = { mode: "locked", skipped: true, sync: { phase: "idle" } };
  render(<SyncStatusIndicator />);
  expect(screen.getByRole("button", { name: "Sync locked - tap to unlock" })).toBeInTheDocument();
});

it("hides sync when it has never been configured", () => {
  fixture.settings = { endpoint: "", bucket: "" };
  fixture.status = { mode: "disabled", sync: { phase: "idle" } };
  const { container } = render(<SyncStatusIndicator overviewFidelity />);
  expect(container.querySelector(".t3-topbar-sync")).not.toBeInTheDocument();
  fixture.settings = { endpoint: "https://sync.example.test", bucket: "portfolio" };
});
