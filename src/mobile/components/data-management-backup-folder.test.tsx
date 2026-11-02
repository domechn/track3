import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import DataManagement from "./data-management";
import { Toast, ToastProvider, ToastViewport } from "@/mobile/components/ui/toast";

const m = vi.hoisted(() => ({
  invoke: vi.fn(), choose: vi.fn(), find: vi.fn(), list: vi.fn(), read: vi.fn(), save: vi.fn(),
  getFolder: vi.fn(), getBlacklist: vi.fn(), getTime: vi.fn(), duplicate: vi.fn(), importData: vi.fn(), previewImport: vi.fn(), importSelected: vi.fn(), toast: vi.fn(), clean: vi.fn(), documents: vi.fn(),
}));
vi.mock("@/utils/platform", () => ({ isIOS: () => true }));
vi.mock("@/utils/backup-location", () => ({ chooseBackupLocation: m.choose, documentsBackupLocation: m.documents }));
vi.mock("@/middlelayers/backup-folder", () => ({ findBackupFolder: m.find, listBackupClients: m.list, readBackupClient: m.read }));
vi.mock("@/utils/ios-native", () => ({ appLockEnabled: vi.fn(async () => false) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: m.invoke }));
vi.mock("@tauri-apps/api/path", () => ({ documentDir: m.documents }));
vi.mock("@/mobile/components/ui/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/middlelayers/configuration", () => ({
  getAutoBackupDirectory: m.getFolder, getBlacklistCoins: m.getBlacklist,
  getLastAutoBackupAt: m.getTime, getLastAutoImportAt: m.getTime,
  saveAutoBackupDirectory: m.save,
  cleanAutoBackupDirectory: m.clean,
}));
vi.mock("@/middlelayers/data", () => ({
  checkIfDuplicatedHistoricalData: m.duplicate, importHistoricalData: m.importData,
  readHistoricalDataFromPath: vi.fn(), previewImport: m.previewImport, importSelected: m.importSelected,
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = "#/settings/data?section=backup";
  m.invoke.mockImplementation(async (command: string) =>
    command === "ios_backup_folder_status" ? { path: null, failure: null } : null);
  m.choose.mockResolvedValue("/cloud/track3-backup");
  m.find.mockResolvedValue({ directory: "/cloud", normalized: true, legacy: false });
  m.list.mockResolvedValue([{ client: "device-a", exportAt: "2024-03-01T00:00:00Z", months: 2, snapshots: 2 }]);
  m.read.mockResolvedValue({ client: "device-a", exportAt: "2024-03-01T00:00:00Z", historicalData: [], md5V2: "" });
  m.getFolder.mockResolvedValue("/app/Documents");
  m.documents.mockResolvedValue("/app/Documents");
  m.getBlacklist.mockResolvedValue([]);
  m.getTime.mockResolvedValue(new Date(0));
  m.duplicate.mockResolvedValue(false);
  m.importData.mockResolvedValue(true);
  m.previewImport.mockResolvedValue({ rows: [{ uuid: "snapshot-one", createdAt: "2024-02-01T00:00:00Z", total: 42, assetCount: 1, status: "new", choice: "import", transactionIdCollisions: 0 }] });
  m.importSelected.mockResolvedValue({ imported: 1, replaced: 0, skipped: 0, failures: [] });
  m.clean.mockResolvedValue(undefined);
  m.save.mockResolvedValue(undefined);
});

it("reviews a selected folder and imports without changing auto backup", async () => {
  render(<HashRouter><DataManagement /></HashRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Import from backup folder" }));
  expect(await screen.findByText(/Using the parent folder/)).toBeInTheDocument();
  expect(screen.getByText("device-a")).toBeInTheDocument();
  expect(screen.getByText("To use it for auto backup, choose the parent folder directly under Auto backup folder.")).toBeInTheDocument();
  expect(screen.getByText(/2 months · Last backup:/)).toHaveTextContent(/\d{1,2}:\d{2}/);
  fireEvent.click(screen.getByRole("button", { name: "Import device-a" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Restore data?" });
  fireEvent.click(within(confirm).getByRole("button", { name: "Restore" }));
  await waitFor(() => expect(m.importData).toHaveBeenCalled());
  expect(m.save).not.toHaveBeenCalledWith("/cloud");
});

it("reviews the configured automatic copy through iOS preparation and merges selected snapshots", async () => {
  m.getFolder.mockResolvedValue("/cloud");
  m.invoke.mockImplementation(async (command: string) =>
    command === "ios_backup_folder_status" ? { path: "/cloud", failure: null } : null);
  m.list.mockResolvedValue([{ client: "device-a", exportAt: "2024-03-01T00:00:00Z", months: 1, snapshots: 1 }]);
  render(<HashRouter><DataManagement /></HashRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Review backup from device-a" }));
  expect(await screen.findByText("2024-02: 1 snapshot")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Apply selected choices" }));
  await waitFor(() => expect(m.importSelected).toHaveBeenCalledWith(expect.objectContaining({ client: "device-a" }), { "snapshot-one": "import" }));
  expect(m.invoke).toHaveBeenCalledWith("ios_prepare_backup_folder", { path: "/cloud", kind: "auto" });
  expect(m.importData).not.toHaveBeenCalled();
});

it("shows a saved Documents choice in the current app container", async () => {
  m.getFolder.mockResolvedValue("track3:ios-documents");
  render(<HashRouter><DataManagement /></HashRouter>);
  expect(await screen.findByText("Documents")).toBeInTheDocument();
  expect(m.save).not.toHaveBeenCalled();
});

it("migrates an old Documents container path in backup settings", async () => {
  m.getFolder.mockResolvedValue("/var/mobile/Containers/Data/Application/12345678-1234-1234-1234-123456789abc/Documents");
  render(<HashRouter><DataManagement /></HashRouter>);
  expect(await screen.findByText("Documents")).toBeInTheDocument();
  expect(m.save).toHaveBeenCalledWith("track3:ios-documents");
});

it("saves a Documents marker when selected", async () => {
  m.getFolder.mockResolvedValue(undefined);
  render(<HashRouter><DataManagement /></HashRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Use Documents folder" }));
  await waitFor(() => expect(m.save).toHaveBeenCalledWith("track3:ios-documents"));
  expect(screen.getByText("Documents")).toBeInTheDocument();
});

it("shows the chosen iCloud folder by name and location", async () => {
  m.getFolder.mockResolvedValue("/private/var/mobile/Library/Mobile Documents/com~apple~CloudDocs/backups");
  render(<HashRouter><DataManagement /></HashRouter>);
  expect(await screen.findByText("backups")).toBeInTheDocument();
  expect(screen.getByText(/iCloud Drive/)).toBeInTheDocument();
  expect(screen.queryByText("/private/var/mobile/Library/Mobile Documents/com~apple~CloudDocs/backups")).not.toBeInTheDocument();
});

it("shows background iCloud preparation in backup settings", async () => {
  render(<HashRouter><DataManagement /></HashRouter>);
  await screen.findByText("Documents");
  window.dispatchEvent(new CustomEvent("track3:backup-folder-preparation", { detail: true }));
  expect(await screen.findByText("Downloading from iCloud…")).toBeInTheDocument();
  window.dispatchEvent(new CustomEvent("track3:backup-folder-preparation", { detail: false }));
  await waitFor(() => expect(screen.queryByText("Downloading from iCloud…")).not.toBeInTheDocument());
});

it("shows a missing saved folder and lets the owner choose again", async () => {
  m.getFolder.mockResolvedValue("/cloud/old");
  m.invoke.mockImplementation(async (command: string) =>
    command === "ios_backup_folder_status" ? { path: null, failure: "Backup folder is unavailable. Choose the folder again." } : null);
  m.choose.mockResolvedValue("/cloud/new");
  render(<HashRouter><DataManagement /></HashRouter>);
  expect(await screen.findByRole("alert")).toHaveTextContent("Backup folder old is unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Choose folder again" }));
  await waitFor(() => expect(screen.getByText("new")).toBeInTheDocument());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("shows a bad first auto folder choice with the parent folder hint", async () => {
  m.getFolder.mockResolvedValue(undefined);
  m.choose.mockRejectedValueOnce("Choose the parent folder containing track3-backup for auto backup.");
  render(<HashRouter><DataManagement /></HashRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Choose Folder" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Choose the parent folder containing track3-backup");
});

it("can opt into auto backup after importing from a parent folder", async () => {
  m.choose.mockResolvedValue("/cloud");
  m.find.mockResolvedValue({ directory: "/cloud", normalized: false, legacy: false });
  render(<HashRouter><DataManagement /></HashRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Import from backup folder" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "Use this folder for auto backup" }));
  fireEvent.click(screen.getByRole("button", { name: "Import device-a" }));
  fireEvent.click(within(await screen.findByRole("alertdialog", { name: "Restore data?" })).getByRole("button", { name: "Restore" }));
  await waitFor(() => expect(m.save).toHaveBeenCalledWith("/cloud"));
  expect(m.invoke).toHaveBeenCalledWith("ios_use_import_backup_folder", { path: "/cloud" });
});

it("refreshes a later iCloud timeout in backup settings", async () => {
  render(<HashRouter><DataManagement /></HashRouter>);
  await screen.findByText("Documents");
  m.invoke.mockImplementation(async (command: string) =>
    command === "ios_backup_folder_status" ? { path: null, failure: "Downloading from iCloud timed out. Try again when online." } : null);
  window.dispatchEvent(new Event("track3:backup-folder-status"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Downloading from iCloud timed out");
  expect(screen.getByRole("button", { name: "Choose Folder" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Choose folder again" })).not.toBeInTheDocument();
});

it("keeps the normal chooser label after a rejected pick while the old folder works", async () => {
  m.getFolder.mockResolvedValue("/cloud/old");
  m.invoke.mockImplementation(async (command: string) =>
    command === "ios_backup_folder_status" ? { path: "/cloud/old", failure: null } : null);
  m.choose.mockRejectedValueOnce("Choose the parent folder containing track3-backup for auto backup.");
  render(<HashRouter><DataManagement /></HashRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Choose Folder" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Choose the parent folder containing track3-backup");
  expect(screen.getByRole("button", { name: "Choose Folder" })).toBeInTheDocument();
});

it("removes an orphaned auto bookmark left by an earlier Clear", async () => {
  m.getFolder.mockResolvedValue(undefined);
  m.invoke.mockImplementation(async (command: string) =>
    command === "ios_backup_folder_status" ? { path: "/cloud/old", failure: null } : null);
  render(<HashRouter><DataManagement /></HashRouter>);
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("ios_clear_backup_folder", { kind: "auto" }));
  expect(m.save).not.toHaveBeenCalled();
});

it("keeps a newly picked bookmark while its configuration write is pending", async () => {
  m.getFolder.mockResolvedValue(undefined);
  let finishSave!: () => void;
  let picked = false;
  m.choose.mockImplementation(async () => {
    picked = true;
    return "/cloud/new";
  });
  m.save.mockImplementation(() => new Promise<void>((resolve) => { finishSave = resolve; }));
  let finishRefresh!: () => void;
  m.invoke.mockImplementation(async (command: string) => {
    if (command !== "ios_backup_folder_status") return null;
    if (!picked) return { path: null, failure: null };
    await new Promise<void>((resolve) => { finishRefresh = resolve; });
    return { path: "/cloud/new", failure: null };
  });
  render(<HashRouter><DataManagement /></HashRouter>);
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("ios_backup_folder_status"));
  fireEvent.click(screen.getByRole("button", { name: "Choose Folder" }));
  await waitFor(() => expect(m.save).toHaveBeenCalledWith("/cloud/new"));
  window.dispatchEvent(new Event("track3:backup-folder-status"));
  await waitFor(() => expect(m.invoke.mock.calls.filter(([command]) => command === "ios_backup_folder_status")).toHaveLength(2));
  finishSave();
  expect(await screen.findByText("new")).toBeInTheDocument();
  await act(async () => { finishRefresh(); });
  expect(m.invoke).not.toHaveBeenCalledWith("ios_clear_backup_folder", { kind: "auto" });
});

it("clears the bookmark with the folder and restores it on Undo", async () => {
  render(<HashRouter><DataManagement /></HashRouter>);
  await screen.findByText("Documents");
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Clear" }));
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("ios_clear_backup_folder", { kind: "auto" }));
  const toastView = render(<ToastProvider><Toast defaultOpen duration={Infinity}>{m.toast.mock.lastCall?.[0].action}</Toast><ToastViewport /></ToastProvider>);
  fireEvent.click(toastView.getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("ios_undo_clear_backup_folder"));
});

it("offers the existing conflict choice for a folder import", async () => {
  m.find.mockResolvedValue({ directory: "/cloud", normalized: false, legacy: false });
  m.choose.mockResolvedValue("/cloud");
  m.duplicate.mockResolvedValue(true);
  render(<HashRouter><DataManagement /></HashRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Import from backup folder" }));
  fireEvent.click(await screen.findByRole("button", { name: "Import device-a" }));
  fireEvent.click(within(await screen.findByRole("alertdialog", { name: "Restore data?" })).getByRole("button", { name: "Restore" }));
  const conflict = await screen.findByRole("dialog");
  fireEvent.click(within(conflict).getByRole("button", { name: "Overwrite" }));
  await waitFor(() => expect(m.importData).toHaveBeenCalledWith("REPLACE", expect.objectContaining({ client: "device-a" })));
});
