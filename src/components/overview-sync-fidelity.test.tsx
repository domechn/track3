import { Profiler } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import SyncStatusIndicator from "./sync-status-indicator";

const state = vi.hoisted(() => ({ current: { mode: "ready", sync: {
  phase: "idle", lastSync: Date.parse("2026-10-31T09:41:00Z"),
  report: { pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0,
    conflicts: [], errors: [], devices: [{ id: "local", name: "This device" }] },
} } }));

vi.mock("@/middlelayers/sync/runtime", () => ({
  syncRuntime: {
    subscribe: () => () => {},
    status: () => state.current,
    getSettings: () => ({ endpoint: "https://s3.example.test", bucket: "track3" }),
    syncNow: vi.fn(),
  },
}));

it("shows real sync details in the desktop overview card", () => {
  render(<SyncStatusIndicator overviewFidelity />);
  fireEvent.click(screen.getByRole("button", { name: /Synced .* ago$/ }));
  expect(screen.getByText("Backup & sync")).toBeInTheDocument();
  expect(screen.getByText("Last upload")).toBeInTheDocument();
  expect(screen.getByText("Destination")).toBeInTheDocument();
  expect(screen.getByText("Devices")).toBeInTheDocument();
  expect(screen.getByText("Waiting to upload")).toBeInTheDocument();
  expect([...screen.getByRole("dialog").querySelectorAll("dt")].map((term) => term.textContent)).toContain("Errors");
});

it("does not render again when a scroll event leaves the overview scroll rail unchanged", () => {
  const onRender = vi.fn();
  render(<Profiler id="sync" onRender={onRender}><SyncStatusIndicator overviewFidelity /></Profiler>);
  fireEvent.click(screen.getByRole("button", { name: /Synced .* ago$/ }));
  const body = screen.getByRole("dialog").querySelector(".t3-sync-fidelity-body")!;
  fireEvent.scroll(body);
  const commits = onRender.mock.calls.length;
  fireEvent.scroll(body);
  expect(onRender).toHaveBeenCalledTimes(commits);
});
