import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataManagement from "./data-management";

const m = vi.hoisted(() => ({
  toast: vi.fn(), readFile: vi.fn(), duplicate: vi.fn(), importData: vi.fn(),
}));
vi.mock("@/utils/platform", () => ({ isIOS: () => true }));
vi.mock("@/utils/backup-location", () => ({ chooseBackupLocation: vi.fn(), documentsBackupLocation: vi.fn(async () => "/app/Documents") }));
vi.mock("@/middlelayers/backup-folder", () => ({ findBackupFolder: vi.fn(), listBackupClients: vi.fn(async () => []), readBackupClient: vi.fn() }));
vi.mock("@/utils/ios-native", () => ({ appLockEnabled: vi.fn(async () => false) }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => command === "ios_backup_folder_status" ? { path: null, failure: null } : null),
}));
vi.mock("@tauri-apps/api/path", () => ({ documentDir: vi.fn(async () => "/app/Documents") }));
vi.mock("@/mobile/components/ui/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/middlelayers/configuration", () => ({
  getAutoBackupDirectory: vi.fn(async () => "/app/Documents"), getBlacklistCoins: vi.fn(async () => []),
  getLastAutoBackupAt: vi.fn(async () => new Date(0)), getLastAutoImportAt: vi.fn(async () => new Date(0)),
}));
vi.mock("@/middlelayers/data", () => ({
  checkIfDuplicatedHistoricalData: m.duplicate, importHistoricalData: m.importData,
  readHistoricalDataFromFile: m.readFile, readHistoricalDataFromPath: vi.fn(), previewImport: vi.fn(),
  importSelected: vi.fn(), exportHistoricalData: vi.fn(), shareHistoricalData: vi.fn(),
}));

const file = { exportAt: "2024-03-01T00:00:00Z", historicalData: [], md5V2: "" };
// Node reports an unhandled rejection after the microtask queue drains, so one macrotask turn is enough.
const nextTask = () => new Promise((resolve) => setImmediate(resolve));
const renderPage = () => render(<HashRouter><DataManagement /></HashRouter>);
const pickFile = () => fireEvent.click(screen.getByRole("button", { name: "Import" }));
async function confirmRestore() {
  const confirm = await screen.findByRole("alertdialog", { name: "Restore data?" });
  fireEvent.click(within(confirm).getByRole("button", { name: "Restore" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = "#/settings/data?section=backup";
  m.readFile.mockResolvedValue(file);
  m.duplicate.mockResolvedValue(false);
  m.importData.mockResolvedValue(true);
});

describe("legacy Import on iPhone", () => {
  it("imports a confirmed file without duplicates once and reports success", async () => {
    renderPage();
    pickFile();
    await confirmRestore();
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ description: "Import data successfully" })));
    expect(m.importData).toHaveBeenCalledTimes(1);
    expect(m.importData).toHaveBeenCalledWith("IGNORE", file, expect.any(Function));
  });

  it("asks how to resolve duplicates before importing", async () => {
    m.duplicate.mockResolvedValue(true);
    renderPage();
    pickFile();
    await confirmRestore();
    expect(await screen.findByRole("dialog", { name: "Conflicts Found" })).toBeInTheDocument();
    expect(m.importData).not.toHaveBeenCalled();
  });

  it("does nothing when the file picker is cancelled", async () => {
    m.readFile.mockResolvedValue(undefined);
    renderPage();
    pickFile();
    await waitFor(() => expect(m.readFile).toHaveBeenCalledTimes(1));
    await nextTask();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(m.duplicate).not.toHaveBeenCalled();
    expect(m.toast).not.toHaveBeenCalled();
  });

  it.each([
    ["the file cannot be read", false, () => m.readFile.mockRejectedValue(new Error("File is not valid JSON"))],
    ["the duplicate check fails", true, () => m.duplicate.mockRejectedValue(new Error("File is not valid JSON"))],
  ])("reports the reason when %s", async (_name, reachesConfirm, fail) => {
    const unhandledRejection = vi.fn();
    process.on("unhandledRejection", unhandledRejection);
    try {
      fail();
      renderPage();
      pickFile();
      if (reachesConfirm) await confirmRestore();
      await waitFor(() => expect(m.toast).toHaveBeenCalledWith({
        description: "Error: File is not valid JSON", variant: "destructive",
      }));
      await nextTask();
      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(m.importData).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      process.off("unhandledRejection", unhandledRejection);
    }
  });
});
