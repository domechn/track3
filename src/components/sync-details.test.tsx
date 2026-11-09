import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SyncDetails } from "./sync-details";
import en from "@/i18n/locales/en.json";
import type { SyncReport } from "@/middlelayers/sync/engine";

const { resolve, configConflicts } = vi.hoisted(() => ({
  resolve: vi.fn(async () => {}),
  configConflicts: vi.fn(async () => [{ id: "10" }]),
}));
vi.mock("@/middlelayers/sync/runtime", () => ({
  syncRuntime: { resolveConfigConflict: resolve, configConflicts },
}));
const t = (key: string) => (en as Record<string, string>)[key] ?? key;

it("groups fixed errors and hides unknown error text and conflict values", async () => {
  const privateText = "super-secret-access-key";
  const report: SyncReport = {
    pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0,
    conflicts: ["10", `snapshot:${privateText}`, `edit:${privateText}`],
    errors: ["Failed to read sync manifest", "Failed to read sync manifest", privateText],
  };
  render(<SyncDetails report={report} t={t} />);
  fireEvent.click(screen.getByText("Details"));
  expect(screen.getByText(/Failed to read sync manifest.*2/)).toBeInTheDocument();
  expect(await screen.findByText("Exchanges")).toBeInTheDocument();
  expect(screen.getByText(/Snapshot.*super-se/)).toBeInTheDocument();
  expect(screen.queryByText(privateText)).not.toBeInTheDocument();
});

it("requires confirmation before resolving a config conflict", async () => {
  resolve.mockClear();
  const report: SyncReport = {
    pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: ["10"], errors: [],
  };
  render(<SyncDetails report={report} t={t} />);
  fireEvent.click(screen.getByText("Details"));
  fireEvent.click(await screen.findByRole("button", { name: "Use this device's value" }));
  expect(resolve).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog")).toHaveTextContent(/overwrite the other side/i);
  fireEvent.click(screen.getByRole("button", { name: "Use this device's value" }));
  await waitFor(() => expect(resolve).toHaveBeenCalledWith("10", "local"));
});

it("explains reported config conflicts that are no longer resolvable", async () => {
  configConflicts.mockResolvedValueOnce([]);
  const report: SyncReport = {
    pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: ["10"], errors: [],
  };
  render(<SyncDetails report={report} t={t} />);
  fireEvent.click(screen.getByText("Details"));
  await waitFor(() => expect(configConflicts).toHaveBeenCalled());
  expect(screen.queryByRole("button", { name: "Use this device's value" })).not.toBeInTheDocument();
  expect(screen.getByText(/Configuration 10.*Review this item on both devices/)).toBeInTheDocument();
});

it("copies only the numeric diagnostics object", async () => {
  const writeText = vi.fn(async (_value: string) => {});
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const diagnostics = (await import("@/middlelayers/sync/diagnostics")).createSyncDiagnostics(
    new (await import("@/middlelayers/sync/object-store")).FakeS3(),
  ).diagnostics;
  diagnostics.retryWaitMs = 125;
  render(<SyncDetails diagnostics={diagnostics} t={t} />);
  fireEvent.click(screen.getByText("Details"));
  fireEvent.click(screen.getByRole("button", { name: "Copy diagnostics" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(JSON.stringify(diagnostics, null, 2)));
  expect(JSON.parse(writeText.mock.calls[0][0]).retryWaitMs).toBe(125);
});

it("formats large diagnostics for reading", async () => {
  const diagnostics = (await import("@/middlelayers/sync/diagnostics")).createSyncDiagnostics(
    new (await import("@/middlelayers/sync/object-store")).FakeS3(),
  ).diagnostics;
  diagnostics.requests.GET.bytesReceived = 1_200_000;
  diagnostics.syncStateBytes = 18_422_103;
  diagnostics.snapshots = 5_000;
  render(<SyncDetails diagnostics={diagnostics} t={t} />);
  fireEvent.click(screen.getByText("Details"));
  expect(screen.getByText("1.2 MB")).toBeInTheDocument();
  expect(screen.getByText(/Sync state size: 18.4 MB/)).toBeInTheDocument();
  expect(screen.getByText(/Cached snapshots: 5,000/)).toBeInTheDocument();
});
