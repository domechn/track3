import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SyncSettingsPage from "./sync";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import { S3Error } from "@/middlelayers/sync/object-store";

vi.mock("@/middlelayers/sync/runtime", () => ({
  syncRuntime: {
    status: () => status,
    subscribe: () => () => {},
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
    configConflicts: vi.fn(async () => [] as Array<{ id: string }>),
    resolveConfigConflict: vi.fn(async () => {}),
    hasHeader: vi.fn(async () => false),
  },
}));

const status = { mode: "disabled", sync: { phase: "idle" } };
let configuredEndpoint = "";

afterEach(() => {
  configuredEndpoint = "";
  status.mode = "disabled";
  vi.mocked(syncRuntime.devices).mockResolvedValue([]);
  vi.mocked(syncRuntime.configConflicts).mockResolvedValue([]);
  vi.mocked(syncRuntime.configure).mockClear();
  vi.mocked(syncRuntime.forgetRemote).mockClear();
});

describe("Sync settings page", () => {
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
    expect(screen.getByRole("alert")).toHaveTextContent(/sync settings.*unreadable.*re.enter/i);
  });

  it("requires passphrase confirmation before enabling", async () => {
    render(<SyncSettingsPage />);
    for (const [label, value] of [
      ["S3 endpoint", "https://s3.example.test"], ["Region", "us-east-1"],
      ["Bucket", "track3"], ["Access key ID", "key"], ["Secret access key", "secret"],
    ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.change(screen.getByLabelText("Sync passphrase"), { target: { value: "correct horse battery staple" } });
    fireEvent.click(screen.getByRole("button", { name: "Enable sync" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/match/i);
    expect(syncRuntime.configure).not.toHaveBeenCalled();
  });

  it("shows connection failures by category without echoing credentials", async () => {
    render(<SyncSettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/endpoint|bucket|credential/i));
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
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not|failed/i);
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
    const error = await screen.findByRole("alert");
    expect(endpoint).toHaveAttribute("aria-describedby", error.id);
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
    expect(await screen.findByRole("alert")).toHaveTextContent(/permission|access/i);
    expect(screen.getByRole("alert")).not.toHaveTextContent("secret denied");
  });
});
