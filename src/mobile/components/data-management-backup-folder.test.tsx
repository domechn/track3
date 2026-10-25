import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import DataManagement from "./data-management";

const m = vi.hoisted(() => ({
  invoke: vi.fn(), choose: vi.fn(), find: vi.fn(), list: vi.fn(), read: vi.fn(), save: vi.fn(),
  getFolder: vi.fn(), getBlacklist: vi.fn(), getTime: vi.fn(), duplicate: vi.fn(), importData: vi.fn(), toast: vi.fn(),
}));
vi.mock("@/utils/platform", () => ({ isIOS: () => true }));
vi.mock("@/utils/backup-location", () => ({ chooseBackupLocation: m.choose, documentsBackupLocation: vi.fn() }));
vi.mock("@/utils/backup-folder", () => ({ findBackupFolder: m.find, listBackupClients: m.list, readBackupClient: m.read }));
vi.mock("@/utils/ios-native", () => ({ appLockEnabled: vi.fn(async () => false) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: m.invoke }));
vi.mock("@/mobile/components/ui/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/middlelayers/configuration", () => ({
  getAutoBackupDirectory: m.getFolder, getBlacklistCoins: m.getBlacklist,
  getLastAutoBackupAt: m.getTime, getLastAutoImportAt: m.getTime,
  saveAutoBackupDirectory: m.save,
}));
vi.mock("@/middlelayers/data", () => ({
  checkIfDuplicatedHistoricalData: m.duplicate, importHistoricalData: m.importData,
  readHistoricalDataFromPath: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = "#/settings/data?section=backup";
  m.invoke.mockResolvedValue(null);
  m.choose.mockResolvedValue("/cloud/track3-backup");
  m.find.mockResolvedValue({ directory: "/cloud", normalized: true, legacy: false });
  m.list.mockResolvedValue([{ client: "device-a", exportAt: "2024-03-01T00:00:00Z", months: 2 }]);
  m.read.mockResolvedValue({ client: "device-a", exportAt: "2024-03-01T00:00:00Z", historicalData: [], md5V2: "" });
  m.getFolder.mockResolvedValue("/app/Documents");
  m.getBlacklist.mockResolvedValue([]);
  m.getTime.mockResolvedValue(new Date(0));
  m.duplicate.mockResolvedValue(false);
  m.importData.mockResolvedValue(true);
});

it("reviews a selected folder and imports without changing auto backup", async () => {
  render(<HashRouter><DataManagement /></HashRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Import from backup folder" }));
  expect(await screen.findByText(/Using the parent folder/)).toBeInTheDocument();
  expect(screen.getByText(/device-a · 2 months/)).toHaveTextContent("2 months");
  expect(screen.getByText(/device-a · 2 months/)).toHaveTextContent(/\d{1,2}:\d{2}/);
  fireEvent.click(screen.getByRole("button", { name: "Import device-a" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Restore data?" });
  fireEvent.click(within(confirm).getByRole("button", { name: "Restore" }));
  await waitFor(() => expect(m.importData).toHaveBeenCalled());
  expect(m.save).not.toHaveBeenCalled();
});

it("shows a missing saved folder and lets the owner choose again", async () => {
  m.getFolder.mockResolvedValue("/cloud/old");
  m.invoke.mockImplementation(async (command: string) => command === "ios_backup_folder_failure" ? "unavailable" : null);
  m.choose.mockResolvedValue("/cloud/new");
  render(<HashRouter><DataManagement /></HashRouter>);
  expect(await screen.findByRole("alert")).toHaveTextContent("Backup folder unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Choose folder again" }));
  await waitFor(() => expect(screen.getByText("/cloud/new")).toBeInTheDocument());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
