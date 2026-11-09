import { beforeEach, expect, it, vi } from "vitest";
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

beforeEach(() => {
  sessionStorage.clear();
  document.documentElement.lang = "en";
});

it("opens, closes, and remembers Details with an accessible button", () => {
  const report: SyncReport = {
    pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [],
  };
  const view = render(<SyncDetails report={report} t={t} />);
  const toggle = screen.getByRole("button", { name: "Details" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("heading", { name: "Errors" })).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("heading", { name: "Errors" })).toBeInTheDocument();
  view.unmount();
  render(<SyncDetails report={report} t={t} />);
  expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "true");
});

it("opens Details when an error arrives after the panel mounts", () => {
  const report: SyncReport = {
    pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [],
  };
  const view = render(<SyncDetails report={report} t={t} />);
  const toggle = screen.getByRole("button", { name: "Details" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  view.rerender(<SyncDetails report={{ ...report, errors: ["Failed to read sync manifest"] }}
    t={t} defaultExpanded />);
  expect(screen.getByRole("button", { name: "Details, 1 issue" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("heading", { name: "Errors" })).toBeInTheDocument();
});

it("shows a badge for errors and distinct conflicts", () => {
  const report: SyncReport = {
    pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0,
    conflicts: ["snapshot:abc", "snapshot:abc", "edit:def"],
    errors: ["Failed to read sync manifest", "Failed to pull snapshot object", "Failed to read sync manifest"],
  };
  render(<SyncDetails report={report} t={t} />);
  expect(screen.getByRole("button", { name: "Details, 5 issues" })).toHaveTextContent("5");
});

it("renders a locale-formatted Total row and request measures", async () => {
  document.documentElement.lang = "de";
  const diagnostics = (await import("@/middlelayers/sync/diagnostics")).createSyncDiagnostics(
    new (await import("@/middlelayers/sync/object-store")).FakeS3(),
  ).diagnostics;
  diagnostics.phases.localScan = 504;
  diagnostics.wallMs = 5040;
  diagnostics.requests.GET.count = 1234;
  diagnostics.requests.GET.bytesReceived = 12_500;
  diagnostics.requests.GET.outcomes.timeout.count = 3;
  diagnostics.retries = 2;
  render(<SyncDetails diagnostics={diagnostics} t={t} />);
  fireEvent.click(screen.getByRole("button", { name: "Details" }));
  const total = screen.getByText("Total").closest(".t3-sync-definition-row");
  expect(total).toHaveClass("t3-sync-definition-total");
  expect(total).toHaveTextContent("5,0 s");
  expect(screen.getByText("Total requests").closest(".t3-sync-definition-row")).toHaveTextContent("1.234");
  expect(screen.getByText("Failures").closest(".t3-sync-definition-row")).toHaveTextContent("3");
  expect(screen.getByText("Received bytes").closest(".t3-sync-definition-row")).toHaveTextContent("12,5 KB");
});

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
  expect(screen.getByText((_, node) => node?.classList.contains("t3-sync-details-item") === true &&
    /Snapshot.*super-se/.test(node.textContent ?? ""))).toBeInTheDocument();
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
  expect(screen.getByText((_, node) => node?.classList.contains("t3-sync-details-item") === true &&
    /Configuration 10.*Review this item on both devices/.test(node.textContent ?? ""))).toBeInTheDocument();
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
  expect(screen.getByText("Received bytes").closest(".t3-sync-definition-row")).toHaveTextContent("1.2 MB");
  expect(screen.getByText("Sync state size").closest(".t3-sync-definition-row")).toHaveTextContent("18.4 MB");
  expect(screen.getByText("Cached snapshots").closest(".t3-sync-definition-row")).toHaveTextContent("5,000");
});
