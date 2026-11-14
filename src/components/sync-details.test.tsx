import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SyncDetails } from "./sync-details";
import en from "@/i18n/locales/en.json";
import type { SyncReport } from "@/middlelayers/sync/engine";
import { I18nProvider, useTranslation } from "@/i18n";
import { createSyncDiagnostics } from "@/middlelayers/sync/diagnostics";
import { FakeS3 } from "@/middlelayers/sync/object-store";

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

it("groups remote failures and conflicts while keeping config resolution and copy available", async () => {
  const writeText = vi.fn(async (_value: string) => {});
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const diagnostics = createSyncDiagnostics(new FakeS3()).diagnostics;
  diagnostics.failures = [
    { phase: "pull", kind: "edit", reason: "invalid-remote-entry:uuid", count: 3 },
    { phase: "pull", kind: "snapshot", reason: "import-failed: Error: UNIQUE constraint failed: assets_v2.<redacted>", count: 2 },
  ];
  diagnostics.conflicts = { snapshot: 2, edit: 0, config: 1, session: 0, tombstone: 0 };
  diagnostics.failedPulls = { count: 3, earliestRetryAt: "2026-01-03T00:00:00.000Z" };
  diagnostics.perDevice = { abcdef12: { failed: 5, succeeded: 2, manifestVersion: 1, appVersion: "unknown" } };
  diagnostics.appVersion = "0.9.15";
  diagnostics.syncFormatVersion = 1;
  const report: SyncReport = {
    pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0,
    errors: Array(3).fill("Failed to pull edit object").concat(Array(2).fill("Failed to pull snapshot object")),
    conflicts: ["10", "snapshot:one", "snapshot:two"],
  };
  render(<SyncDetails report={report} diagnostics={diagnostics} t={t} defaultExpanded />);
  expect(screen.getByText("Could not read or validate 5 remote objects (edit ×3, snapshot ×2)")).toBeInTheDocument();
  expect(screen.getByText(/2 snapshots could not be imported: import-failed: Error: UNIQUE constraint failed: assets_v2\.<redacted>/)).toBeInTheDocument();
  expect(screen.getByText("Needs review 3 (config ×1, snapshot ×2)")).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Use this device's value" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Use the other device's value" })).toBeInTheDocument();
  expect(screen.getByText("Local app version").closest(".t3-sync-definition-row")).toHaveTextContent("0.9.15");
  expect(screen.getByText("Sync format version").closest(".t3-sync-definition-row")).toHaveTextContent("1");
  fireEvent.click(screen.getByRole("button", { name: "Copy diagnostics" }));
  await waitFor(() => expect(JSON.parse(writeText.mock.calls[0][0]).failures).toHaveLength(2));
});

it("renders grouped failure reasons in Chinese", () => {
  localStorage.setItem("track3-ui-locale", "zh");
  const diagnostics = createSyncDiagnostics(new FakeS3()).diagnostics;
  diagnostics.failures = [{ phase: "pull", kind: "snapshot", reason: "read-failed:hash", count: 2 }];
  diagnostics.conflicts = { snapshot: 0, edit: 0, config: 0, session: 0, tombstone: 0 };
  function LocalizedDetails() {
    const { t } = useTranslation();
    return <SyncDetails diagnostics={diagnostics} t={t} defaultExpanded />;
  }
  render(<I18nProvider><LocalizedDetails /></I18nProvider>);
  expect(screen.getByText("无法读取或验证 2 个远程对象（快照 ×2）")).toBeInTheDocument();
  expect(screen.getByText(/读取失败：哈希不匹配/)).toBeInTheDocument();
  localStorage.removeItem("track3-ui-locale");
});

it("says which days and writer device the invalid snapshots come from, counted per sub-reason", () => {
  const diagnostics = createSyncDiagnostics(new FakeS3()).diagnostics;
  const priceNull = "import-failed: Error: Invalid sync snapshot: parse (assets[].price is null)";
  const badId = "import-failed: Error: Invalid sync snapshot: asset id <= 0";
  diagnostics.failures = [
    { phase: "pull", kind: "snapshot", reason: priceNull, count: 9 },
    { phase: "pull", kind: "snapshot", reason: badId, count: 5 },
  ];
  diagnostics.invalidSnapshots = [
    ...Array.from({ length: 9 }, (_, index) => ({
      device: "ab12cd34", reason: priceNull, path: "assets[3].price", date: index ? "2023-03-26" : "2024-01-07",
    })),
    ...Array.from({ length: 5 }, () => ({ device: "ab12cd34", reason: badId, path: "assets[0].id", date: "2023-06-01" })),
  ];
  const report: SyncReport = {
    pulled: 0, pushed: 1, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [], skipped: 14,
  };
  render(<SyncDetails report={report} diagnostics={diagnostics} t={t} defaultExpanded />);
  expect(screen.getByRole("button", { name: "Details, 14 issues" })).toBeInTheDocument();
  expect(screen.getByText("Could not read or validate 14 remote objects (snapshot ×14)")).toBeInTheDocument();
  expect(screen.getByText(
    "14 snapshots could not be imported, dated 2023-03-26 .. 2024-01-07, written by device ab12cd34")).toBeInTheDocument();
  expect(screen.getByText("9 × assets[].price is null, 5 × asset id <= 0")).toBeInTheDocument();
});

it("leaves the date out when an invalid snapshot has no readable day", () => {
  const diagnostics = createSyncDiagnostics(new FakeS3()).diagnostics;
  const reason = "import-failed: Error: Invalid sync snapshot: parse (snapshot is null)";
  diagnostics.failures = [{ phase: "pull", kind: "snapshot", reason, count: 1 }];
  diagnostics.invalidSnapshots = [{ device: "ab12cd34", reason }];
  render(<SyncDetails diagnostics={diagnostics} t={t} defaultExpanded />);
  expect(screen.getByText("1 snapshot could not be imported, written by device ab12cd34")).toBeInTheDocument();
  expect(screen.getByText("1 × snapshot is null")).toBeInTheDocument();
});

it("caps the writer device list of invalid snapshots", () => {
  const diagnostics = createSyncDiagnostics(new FakeS3()).diagnostics;
  const reason = "import-failed: Error: Invalid sync snapshot: parse (snapshot is null)";
  diagnostics.failures = [{ phase: "pull", kind: "snapshot", reason, count: 7 }];
  diagnostics.invalidSnapshots = Array.from({ length: 7 }, (_, index) => ({ device: `device0${index}`, reason }));
  render(<SyncDetails diagnostics={diagnostics} t={t} defaultExpanded />);
  expect(screen.getByText(
    "7 snapshots could not be imported, written by device device00, device01, device02, device03, device04 +2")).toBeInTheDocument();
});
