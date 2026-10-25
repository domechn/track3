import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import DataManagement from "./data-management";
import { Toast, ToastProvider, ToastViewport } from "@/mobile/components/ui/toast";

const m = vi.hoisted(() => ({
  invoke: vi.fn(), choose: vi.fn(), find: vi.fn(), list: vi.fn(), read: vi.fn(), save: vi.fn(),
  getFolder: vi.fn(), getBlacklist: vi.fn(), getTime: vi.fn(), duplicate: vi.fn(), importData: vi.fn(), toast: vi.fn(), clean: vi.fn(),
}));
vi.mock("@/utils/platform", () => ({ isIOS: () => true }));
vi.mock("@/utils/backup-location", () => ({ chooseBackupLocation: m.choose, documentsBackupLocation: vi.fn() }));
vi.mock("@/middlelayers/backup-folder", () => ({ findBackupFolder: m.find, listBackupClients: m.list, readBackupClient: m.read }));
vi.mock("@/utils/ios-native", () => ({ appLockEnabled: vi.fn(async () => false) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: m.invoke }));
vi.mock("@/mobile/components/ui/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/middlelayers/configuration", () => ({
  getAutoBackupDirectory: m.getFolder, getBlacklistCoins: m.getBlacklist,
  getLastAutoBackupAt: m.getTime, getLastAutoImportAt: m.getTime,
  saveAutoBackupDirectory: m.save,
  cleanAutoBackupDirectory: m.clean,
}));
vi.mock("@/middlelayers/data", () => ({
  checkIfDuplicatedHistoricalData: m.duplicate, importHistoricalData: m.importData,
  readHistoricalDataFromPath: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = "#/settings/data?section=backup";
  m.invoke.mockImplementation(async (command: string) =>
    command === "ios_backup_folder_status" ? { path: null, failure: null } : null);
  m.choose.mockResolvedValue("/cloud/track3-backup");
  m.find.mockResolvedValue({ directory: "/cloud", normalized: true, legacy: false });
  m.list.mockResolvedValue([{ client: "device-a", exportAt: "2024-03-01T00:00:00Z", months: 2 }]);
  m.read.mockResolvedValue({ client: "device-a", exportAt: "2024-03-01T00:00:00Z", historicalData: [], md5V2: "" });
  m.getFolder.mockResolvedValue("/app/Documents");
  m.getBlacklist.mockResolvedValue([]);
  m.getTime.mockResolvedValue(new Date(0));
  m.duplicate.mockResolvedValue(false);
  m.importData.mockResolvedValue(true);
  m.clean.mockResolvedValue(undefined);
});

it("reviews a selected folder and imports without changing auto backup", async () => {
  render(<HashRouter><DataManagement /></HashRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Import from backup folder" }));
  expect(await screen.findByText(/Using the parent folder/)).toBeInTheDocument();
  expect(screen.getByText("device-a")).toBeInTheDocument();
  expect(screen.getByText(/2 months · Last backup:/)).toHaveTextContent(/\d{1,2}:\d{2}/);
  fireEvent.click(screen.getByRole("button", { name: "Import device-a" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Restore data?" });
  fireEvent.click(within(confirm).getByRole("button", { name: "Restore" }));
  await waitFor(() => expect(m.importData).toHaveBeenCalled());
  expect(m.save).not.toHaveBeenCalled();
});

it("shows a missing saved folder and lets the owner choose again", async () => {
  m.getFolder.mockResolvedValue("/cloud/old");
  m.invoke.mockImplementation(async (command: string) =>
    command === "ios_backup_folder_status" ? { path: null, failure: "Backup folder is unavailable." } : null);
  m.choose.mockResolvedValue("/cloud/new");
  render(<HashRouter><DataManagement /></HashRouter>);
  expect(await screen.findByRole("alert")).toHaveTextContent("Backup folder unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Choose folder again" }));
  await waitFor(() => expect(screen.getByText("/cloud/new")).toBeInTheDocument());
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
  await screen.findByText("/app/Documents");
  m.invoke.mockImplementation(async (command: string) =>
    command === "ios_backup_folder_status" ? { path: null, failure: "Downloading from iCloud timed out. Try again when online." } : null);
  window.dispatchEvent(new Event("track3:backup-folder-status"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Downloading from iCloud timed out");
});

it("removes an orphaned auto bookmark left by an earlier Clear", async () => {
  m.getFolder.mockResolvedValue(undefined);
  m.invoke.mockImplementation(async (command: string) =>
    command === "ios_backup_folder_status" ? { path: "/cloud/old", failure: null } : null);
  render(<HashRouter><DataManagement /></HashRouter>);
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("ios_clear_backup_folder", { kind: "auto" }));
  expect(m.save).not.toHaveBeenCalled();
});

it("clears the bookmark with the folder and restores it on Undo", async () => {
  render(<HashRouter><DataManagement /></HashRouter>);
  await screen.findByText("/app/Documents");
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Clear" }));
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("ios_clear_backup_folder", { kind: "auto" }));
  const toastView = render(<ToastProvider><Toast defaultOpen>{m.toast.mock.lastCall?.[0].action}</Toast><ToastViewport /></ToastProvider>);
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
