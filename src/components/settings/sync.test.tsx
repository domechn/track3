import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SyncSettingsPage from "./sync";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import { S3Error } from "@/middlelayers/sync/object-store";

const toastMock = vi.fn(() => ({ dismiss: dismissMock }));
const dismissMock = vi.fn();
const syncListeners = vi.hoisted(() => new Set<() => void>());
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/middlelayers/sync/runtime", () => ({
  syncRuntime: {
    status: () => status,
    subscribe: (listener: () => void) => {
      syncListeners.add(listener);
      return () => syncListeners.delete(listener);
    },
    getSettings: () => ({
      endpoint: configuredEndpoint, region: "", bucket: "", prefix: "", accessKeyId: "", secretAccessKey: "",
      pathStyle: true, enabled: false, deviceNames: {},
      categories: { history: true, settings: true, secrets: true, rebalance: true, chat: true },
    }),
    test: vi.fn(async () => "configuration"),
    configure: vi.fn(async () => "ok"),
    devices: vi.fn(async () => []),
    disable: vi.fn(),
    forgetRemote: vi.fn(),
    syncNow: vi.fn(),
    unlock: vi.fn(async () => "ok"),
    renameDevice: vi.fn(async () => {}),
    configConflicts: vi.fn(async () => [] as Array<{ id: string }>),
    resolveConfigConflict: vi.fn(async () => {}),
    hasHeader: vi.fn(async () => false),
  },
}));

const status = { mode: "disabled", sync: {
  phase: "idle", error: undefined as string | undefined,
  report: undefined as { pulled: number; pushed: number } | undefined,
} };
let configuredEndpoint = "";

afterEach(() => {
  configuredEndpoint = "";
  status.mode = "disabled";
  status.sync.phase = "idle";
  status.sync.error = undefined;
  status.sync.report = undefined;
  vi.mocked(syncRuntime.devices).mockResolvedValue([]);
  vi.mocked(syncRuntime.configConflicts).mockResolvedValue([]);
  vi.mocked(syncRuntime.configure).mockClear();
  vi.mocked(syncRuntime.forgetRemote).mockClear();
  vi.mocked(syncRuntime.test).mockClear();
  vi.mocked(syncRuntime.syncNow).mockClear();
  vi.mocked(syncRuntime.disable).mockClear();
  vi.mocked(syncRuntime.unlock).mockClear();
  vi.mocked(syncRuntime.resolveConfigConflict).mockClear();
  vi.mocked(syncRuntime.renameDevice).mockClear();
  toastMock.mockClear();
  dismissMock.mockClear();
  syncListeners.clear();
});

describe("Sync settings page", () => {
  function fillConnection() {
    for (const [label, value] of [
      ["S3 endpoint", "https://s3.example.test"], ["Region", "us-east-1"],
      ["Bucket", "track3"], ["Access key ID", "key"], ["Secret access key", "secret"],
    ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }

  it("replaces an identical failure toast rather than stacking it", async () => {
    render(<SyncSettingsPage />);
    const button = screen.getByRole("button", { name: "Test connection" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(toastMock).toHaveBeenCalledTimes(2);
    expect(dismissMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a draft indicator for category changes and saves with one request", async () => {
    status.mode = "ready";
    let finish!: (result: "ok") => void;
    vi.mocked(syncRuntime.configure).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<SyncSettingsPage />);
    fillConnection();
    fireEvent.click(screen.getByRole("switch", { name: "Snapshot history" }));
    expect(screen.getByText("Changes ready to save.")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Save sync settings" }).at(-1)!);
    expect(screen.getAllByRole("button", { name: "Saving…" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Saving…" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
    expect(syncRuntime.configure).toHaveBeenCalledTimes(1);
    finish("ok");
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      description: "Sync settings saved.",
    })));
    expect(screen.queryByText("Changes ready to save.")).not.toBeInTheDocument();
  });

  it("marks a path style toggle as an unsaved change", () => {
    render(<SyncSettingsPage />);
    fireEvent.click(screen.getByRole("switch", { name: "Path style addressing" }));
    expect(screen.getByText("Changes ready to save.")).toBeVisible();
  });

  it("prevents form and category edits during a pending save", async () => {
    status.mode = "ready";
    let finish!: (result: "ok") => void;
    vi.mocked(syncRuntime.configure).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<SyncSettingsPage />);
    fillConnection();
    fireEvent.click(screen.getAllByRole("button", { name: "Save sync settings" })[0]);
    expect(screen.getByLabelText("S3 endpoint")).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Path style addressing" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Snapshot history" })).toBeDisabled();
    finish("ok");
    await waitFor(() => expect(screen.getByRole("switch", { name: "Snapshot history" })).toBeEnabled());
  });

  it("reports a rejected save and leaves settings editable", async () => {
    status.mode = "ready";
    vi.mocked(syncRuntime.configure).mockResolvedValueOnce("bucket");
    render(<SyncSettingsPage />);
    fillConnection();
    fireEvent.click(screen.getAllByRole("button", { name: "Save sync settings" })[0]);
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: "destructive", description: "Bucket not found. Check the bucket name and endpoint.",
    })));
    expect(screen.getAllByRole("button", { name: "Save sync settings" })[0]).toBeEnabled();
  });

  it("shows enable and unlock outcomes with pending buttons", async () => {
    let finishEnable!: (result: "ok") => void;
    vi.mocked(syncRuntime.configure).mockImplementationOnce(() => new Promise((resolve) => { finishEnable = resolve; }));
    const view = render(<SyncSettingsPage />);
    fillConnection();
    fireEvent.change(screen.getByLabelText("Sync passphrase"), { target: { value: "correct horse battery staple" } });
    fireEvent.change(screen.getByLabelText("Confirm sync passphrase"), { target: { value: "correct horse battery staple" } });
    fireEvent.click(screen.getByRole("button", { name: "Enable sync" }));
    expect(await screen.findByRole("button", { name: "Enabling…" })).toBeDisabled();
    expect(syncRuntime.configure).toHaveBeenCalledTimes(1);
    finishEnable("ok");
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: "Sync enabled." })));
    view.unmount();
    status.mode = "locked";
    let finishUnlock!: (result: "passphrase") => void;
    vi.mocked(syncRuntime.unlock).mockImplementationOnce(() => new Promise((resolve) => { finishUnlock = resolve; }));
    render(<SyncSettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Unlock sync" }));
    expect(screen.getByRole("button", { name: "Unlocking…" })).toBeDisabled();
    finishUnlock("passphrase");
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: "destructive", description: "The sync passphrase is missing or incorrect.",
    })));
  });

  it("waits for disable and confirms success", async () => {
    status.mode = "ready";
    let finish!: () => void;
    vi.mocked(syncRuntime.disable).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<SyncSettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Disable sync" }));
    expect(screen.getByRole("button", { name: "Disabling…" })).toBeDisabled();
    expect(syncRuntime.disable).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: "Sync disabled." })));
  });

  it("reports Sync now counts after the scheduler finishes", async () => {
    status.mode = "ready";
    status.sync.report = { pulled: 3, pushed: 2 };
    render(<SyncSettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      description: "Pulled 3 · pushed 2",
    })));
  });

  it("omits zero-count directions from the Sync now result", async () => {
    status.mode = "ready";
    status.sync.report = { pulled: 0, pushed: 5 };
    render(<SyncSettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
    await waitFor(() => expect(toastMock).toHaveBeenLastCalledWith(expect.objectContaining({
      title: "Sync complete", description: "Pushed 5",
    })));
  });

  it("keeps a pending test toast until it replaces it with a titled result", async () => {
    status.mode = "ready";
    let finish!: (result: "ok") => void;
    vi.mocked(syncRuntime.test).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<SyncSettingsPage />);
    fillConnection();
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    const testing = screen.getByRole("button", { name: "Testing…" });
    expect(testing).toHaveAttribute("aria-busy", "true");
    expect(testing).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Save sync settings" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
    expect(screen.getByRole("button", { name: "Disable sync" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Forget remote data" })).toBeDisabled();
    expect(toastMock).toHaveBeenLastCalledWith(expect.objectContaining({
      title: "Testing…", duration: Infinity,
    }));
    finish("ok");
    await waitFor(() => expect(toastMock).toHaveBeenLastCalledWith(expect.objectContaining({
      title: "Connection OK", description: "Connection successful.", duration: 4000,
    })));
    expect(dismissMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Test connection" })).toBeEnabled();
  });

  it("replaces pending sync with a titled error and makes zero changes readable", async () => {
    status.mode = "ready";
    let finish!: () => void;
    vi.mocked(syncRuntime.syncNow).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<SyncSettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
    expect(screen.getByRole("button", { name: "Syncing…" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Disable sync" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Forget remote data" })).toBeDisabled();
    expect(toastMock).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Syncing…", duration: Infinity }));
    status.sync.phase = "error";
    status.sync.error = "bucket";
    finish();
    await waitFor(() => expect(toastMock).toHaveBeenLastCalledWith(expect.objectContaining({
      title: "Sync failed", variant: "destructive", duration: 8000,
    })));
    expect(dismissMock).toHaveBeenCalledTimes(1);
    status.sync.phase = "idle";
    status.sync.error = undefined;
    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
    await waitFor(() => expect(toastMock).toHaveBeenLastCalledWith(expect.objectContaining({
      title: "Sync complete", description: "Up to date", duration: 4000,
    })));
  });

  it("keeps the confirmation open with pending deletion and reports the outcome", async () => {
    configuredEndpoint = "https://s3.example.test";
    let finish!: () => void;
    vi.mocked(syncRuntime.forgetRemote).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<SyncSettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Forget remote data" }));
    fireEvent.change(screen.getByLabelText(/type FORGET/i), { target: { value: "FORGET" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Forget remote data" }).at(-1)!);
    expect(screen.getByRole("alertdialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(syncRuntime.forgetRemote).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      description: "Remote sync data deleted. Local data remains on this device.",
    })));
  });

  it("keeps the delete confirmation available after a remote failure", async () => {
    configuredEndpoint = "https://s3.example.test";
    vi.mocked(syncRuntime.forgetRemote).mockRejectedValueOnce(new Error("secret credential"));
    render(<SyncSettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Forget remote data" }));
    fireEvent.change(screen.getByLabelText(/type FORGET/i), { target: { value: "FORGET" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Forget remote data" }).at(-1)!);
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: "destructive", title: "Remote deletion failed",
      description: "Could not reach the sync store. Check the endpoint and network.",
    })));
    expect(screen.getByRole("alertdialog")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Forget remote data" }).at(-1)).toBeEnabled();
    expect(JSON.stringify(toastMock.mock.calls)).not.toContain("secret credential");
  });

  it("shows a conflict choice pending and reports success", async () => {
    status.mode = "ready";
    vi.mocked(syncRuntime.configConflicts).mockResolvedValue([{ id: "10" }]);
    let finish!: () => void;
    vi.mocked(syncRuntime.resolveConfigConflict).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<SyncSettingsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Keep local" }));
    expect(screen.getAllByRole("button", { name: "Resolving…" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Use remote" })).toBeDisabled();
    expect(syncRuntime.resolveConfigConflict).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      description: "Config conflict resolved.",
    })));
  });

  it("reports a failed conflict choice without showing its value", async () => {
    status.mode = "ready";
    vi.mocked(syncRuntime.configConflicts).mockResolvedValue([{ id: "10" }]);
    vi.mocked(syncRuntime.resolveConfigConflict).mockRejectedValueOnce(new Error("secret credential"));
    render(<SyncSettingsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Use remote" }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: "destructive", title: "Conflict resolution failed",
      description: "Could not resolve the config conflict. Try again.",
    })));
    expect(JSON.stringify(toastMock.mock.calls)).not.toContain("secret credential");
  });

  it("confirms a renamed device and reports rename failures", async () => {
    status.mode = "ready";
    vi.mocked(syncRuntime.devices).mockResolvedValue([{ id: "device-one", name: "Laptop", current: true }]);
    render(<SyncSettingsPage />);
    const input = await screen.findByLabelText("Name for device device-o");
    fireEvent.change(input, { target: { value: "Office" } });
    fireEvent.blur(input);
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      description: "Device name saved.",
    })));
    fireEvent.blur(input);
    expect(syncRuntime.renameDevice).toHaveBeenCalledTimes(1);
    vi.mocked(syncRuntime.renameDevice).mockRejectedValueOnce(new Error("secret credential"));
    fireEvent.change(input, { target: { value: "Other" } });
    fireEvent.blur(input);
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: "destructive", title: "Device rename failed", description: "Could not save the device name.",
    })));
  });
  it("keeps remote cleanup available after sync is disabled", () => {
    configuredEndpoint = "https://s3.example.test";
    render(<SyncSettingsPage />);
    expect(screen.getByRole("button", { name: "Forget remote data" })).toBeInTheDocument();
  });
  it("requires FORGET before deleting remote data", async () => {
    configuredEndpoint = "https://s3.example.test";
    render(<SyncSettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Forget remote data" }));
    const dialog = screen.getByRole("alertdialog");
    const action = screen.getAllByRole("button", { name: "Forget remote data" }).at(-1)!;
    expect(dialog).toBeInTheDocument();
    expect(action).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/type FORGET/i), { target: { value: "FORGET" } });
    expect(action).toBeEnabled();
    fireEvent.click(action);
    await waitFor(() => expect(syncRuntime.forgetRemote).toHaveBeenCalledTimes(1));
  });
  it("keeps the typed confirmation input outside the dialog description", () => {
    configuredEndpoint = "https://s3.example.test";
    render(<SyncSettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Forget remote data" }));
    const input = screen.getByLabelText(/type FORGET/i);
    expect(input.closest("p")).toBeNull();
  });
  it("shows an unmissable recovery warning and masks both secrets", () => {
    render(<SyncSettingsPage />);
    expect(screen.getByText(/never be recovered/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Access key ID")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Secret access key")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Sync passphrase")).toHaveAttribute("type", "password");
    expect(screen.queryByRole("switch", { name: "Goals" })).not.toBeInTheDocument();
  });

  it("shows an unreadable settings warning with re-entry guidance", () => {
    status.mode = "unreadable";
    render(<SyncSettingsPage />);
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: "destructive",
      description: "Sync settings are unreadable. Re-enter your S3 settings to reconnect.",
    }));
    expect(screen.getByRole("alert")).toHaveTextContent("Sync settings are unreadable. Re-enter your S3 settings to reconnect.");
  });

  it("requires passphrase confirmation before enabling", async () => {
    render(<SyncSettingsPage />);
    for (const [label, value] of [
      ["S3 endpoint", "https://s3.example.test"], ["Region", "us-east-1"],
      ["Bucket", "track3"], ["Access key ID", "key"], ["Secret access key", "secret"],
    ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.change(screen.getByLabelText("Sync passphrase"), { target: { value: "correct horse battery staple" } });
    fireEvent.click(screen.getByRole("button", { name: "Enable sync" }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: "destructive", title: "Settings failed", description: "Passphrases must match.",
    })));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(syncRuntime.configure).not.toHaveBeenCalled();
  });

  it("shows connection failures by category without echoing credentials", async () => {
    render(<SyncSettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: "destructive", title: "Connection failed", description: "Check the endpoint, bucket, region and credentials.",
    })));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows testing immediately, blocks a second test, and confirms success", async () => {
    let finish!: (result: "ok") => void;
    vi.mocked(syncRuntime.test).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<SyncSettingsPage />);
    for (const [label, value] of [
      ["S3 endpoint", "https://s3.example.test"], ["Region", "us-east-1"],
      ["Bucket", "track3"], ["Access key ID", "key"], ["Secret access key", "secret"],
    ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    const pending = screen.getByRole("button", { name: /testing/i });
    expect(pending).toBeDisabled();
    expect(pending).toHaveAttribute("aria-busy", "true");
    fireEvent.click(pending);
    expect(syncRuntime.test).toHaveBeenCalledTimes(1);
    finish("ok");
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      description: "Connection successful.",
    })));
    expect(screen.getByRole("button", { name: "Test connection" })).toBeEnabled();
  });

  it("keeps the successful connection status text alongside its toast", async () => {
    vi.mocked(syncRuntime.test).mockResolvedValueOnce("ok");
    render(<SyncSettingsPage />);
    fillConnection();
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    const text = await screen.findByText("Connection successful.");
    expect(text.closest('[role="status"]')).toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: "Connection successful." }));
  });

  it("waits for Sync now and reports a scheduler failure without raw errors", async () => {
    status.mode = "ready";
    let finish!: () => void;
    vi.mocked(syncRuntime.syncNow).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<SyncSettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
    expect(screen.getByRole("button", { name: /syncing/i })).toBeDisabled();
    expect(syncRuntime.syncNow).toHaveBeenCalledTimes(1);
    status.sync.phase = "error";
    finish();
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: "destructive", description: "Some sync data could not be processed. Track3 will retry automatically.",
    })));
  });

  it("waits for a queued sync before reporting fresh counts", async () => {
    status.mode = "ready";
    vi.mocked(syncRuntime.syncNow).mockImplementationOnce(async () => {
      status.sync.phase = "syncing";
      status.sync.report = { pulled: 0, pushed: 1 };
    });
    render(<SyncSettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
    await waitFor(() => expect(syncRuntime.syncNow).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Syncing…" })).toBeDisabled();
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Sync complete" }));
    status.sync.phase = "idle";
    status.sync.report = { pulled: 0, pushed: 5 };
    syncListeners.forEach((listener) => listener());
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Sync complete", description: "Pushed 5",
    })));
  });

  it("marks the current device in the list", async () => {
    status.mode = "ready";
    vi.mocked(syncRuntime.devices).mockResolvedValue([{ id: "device-one", name: "Laptop", current: true }]);
    render(<SyncSettingsPage />);
    expect(await screen.findByText("This device")).toBeInTheDocument();
  });
  it("shows a joining secret conflict and lets the user keep the local value", async () => {
    status.mode = "ready";
    vi.mocked(syncRuntime.configConflicts).mockResolvedValue([{ id: "10" }]);
    render(<SyncSettingsPage />);
    expect(await screen.findByText(/local value.*safe/i)).toBeInTheDocument();
    expect(screen.getByText(/exchanges/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep local" }));
    await waitFor(() => expect(syncRuntime.resolveConfigConflict).toHaveBeenCalledWith("10", "local"));
  });
  it("names wallet and assistant key conflicts without displaying their values", async () => {
    status.mode = "ready";
    vi.mocked(syncRuntime.configConflicts).mockResolvedValue([{ id: "11" }, { id: "994" }]);
    render(<SyncSettingsPage />);
    expect(await screen.findByText(/wallets/i)).toBeInTheDocument();
    expect(screen.getByText("AI assistant")).toBeInTheDocument();
  });
  it("saves changed categories while sync is ready", async () => {
    status.mode = "ready";
    render(<SyncSettingsPage />);
    for (const [label, value] of [
      ["S3 endpoint", "https://s3.example.test"], ["Region", "us-east-1"],
      ["Bucket", "track3"], ["Access key ID", "key"], ["Secret access key", "secret"],
    ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("switch", { name: "Snapshot history" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save sync settings" }).at(-1)!);
    await waitFor(() => expect(syncRuntime.configure).toHaveBeenCalledWith(
      expect.objectContaining({ categories: expect.objectContaining({ history: false }) }), "",
    ));
  });
  it("preserves unsaved fields when sync mode changes", () => {
    status.mode = "ready";
    const view = render(<SyncSettingsPage />);
    fireEvent.change(screen.getByLabelText("S3 endpoint"), { target: { value: "https://edited.example.test" } });
    status.mode = "locked";
    view.rerender(<SyncSettingsPage />);
    expect(screen.getByLabelText("S3 endpoint")).toHaveValue("https://edited.example.test");
  });

  it("reports a failed disable and keeps the button available", async () => {
    status.mode = "ready";
    vi.mocked(syncRuntime.disable).mockRejectedValueOnce(new Error("secret error"));
    render(<SyncSettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Disable sync" }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: "destructive", title: "Could not disable sync",
      description: "Could not disable sync. Please try again.",
    })));
    expect(screen.getByRole("button", { name: "Disable sync" })).toBeEnabled();
  });

  it("lets a joining device enable with its existing passphrase without confirmation", async () => {
    vi.mocked(syncRuntime.hasHeader).mockResolvedValueOnce(true);
    render(<SyncSettingsPage />);
    for (const [label, value] of [
      ["S3 endpoint", "https://s3.example.test"], ["Region", "us-east-1"],
      ["Bucket", "track3"], ["Access key ID", "key"], ["Secret access key", "secret"],
    ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.change(screen.getByLabelText("Sync passphrase"), { target: { value: "correct horse battery staple" } });
    fireEvent.click(screen.getByRole("button", { name: "Enable sync" }));
    await waitFor(() => expect(syncRuntime.configure).toHaveBeenCalled());
  });

  it("warns that a long repeated passphrase is still weak", () => {
    render(<SyncSettingsPage />);
    fireEvent.change(screen.getByLabelText("Sync passphrase"), { target: { value: "aaaaaaaaaaaaaaaaaaaaaaaa" } });
    expect(screen.getByText(/repeated|predictable/i)).toBeInTheDocument();
  });

  it("associates invalid S3 settings with the visible error", async () => {
    render(<SyncSettingsPage />);
    fireEvent.change(screen.getByLabelText("Region"), { target: { value: "us-east-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    const endpoint = screen.getByLabelText("S3 endpoint");
    expect(endpoint).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Region")).toHaveAttribute("aria-invalid", "false");
    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    expect(endpoint).not.toHaveAttribute("aria-describedby");
    expect(screen.getByLabelText("Region")).not.toHaveAttribute("aria-describedby");
    fireEvent.change(endpoint, { target: { value: "https://s3.example.test" } });
    expect(endpoint).toHaveAttribute("aria-invalid", "false");
  });

  it("classifies a denied header check without showing the underlying error", async () => {
    vi.mocked(syncRuntime.hasHeader).mockRejectedValueOnce(new S3Error("secret denied", 403));
    render(<SyncSettingsPage />);
    for (const [label, value] of [
      ["S3 endpoint", "https://s3.example.test"], ["Region", "us-east-1"],
      ["Bucket", "track3"], ["Access key ID", "key"], ["Secret access key", "secret"],
    ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.change(screen.getByLabelText("Sync passphrase"), { target: { value: "correct horse battery staple" } });
    fireEvent.click(screen.getByRole("button", { name: "Enable sync" }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: "destructive", description: "Access denied. Check the access key and bucket permissions.",
    })));
    expect(JSON.stringify(toastMock.mock.calls)).not.toContain("secret denied");
  });
});
