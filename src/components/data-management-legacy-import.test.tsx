import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import DataManagement from "@/components/data-management";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  checkIfDuplicatedHistoricalData: vi.fn(),
  importHistoricalData: vi.fn(),
  readHistoricalDataFromFile: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/middlelayers/data", () => ({
  checkIfDuplicatedHistoricalData: mocks.checkIfDuplicatedHistoricalData,
  exportHistoricalData: vi.fn(),
  importHistoricalData: mocks.importHistoricalData,
  readHistoricalDataFromFile: mocks.readHistoricalDataFromFile,
  previewImport: vi.fn(),
  importSelected: vi.fn(),
}));
vi.mock("@/middlelayers/backup-folder", () => ({
  listBackupClients: vi.fn().mockResolvedValue([]),
  readBackupClient: vi.fn(),
}));
vi.mock("@/middlelayers/backup-summary", () => ({
  queryBackupSummary: vi.fn().mockResolvedValue({ snapshots: 12, assets: 3, transactions: 9 }),
}));
vi.mock("@/middlelayers/configuration", () => ({
  addToBlacklist: vi.fn(),
  cleanAutoBackupDirectory: vi.fn(),
  getAutoBackupDirectory: vi.fn().mockResolvedValue(undefined),
  getBlacklistCoins: vi.fn().mockResolvedValue([]),
  getLastAutoImportAt: vi.fn().mockResolvedValue(undefined),
  getLastAutoBackupAt: vi.fn().mockResolvedValue(undefined),
  removeFromBlacklist: vi.fn(),
  saveAutoBackupDirectory: vi.fn(),
}));

const file = { client: "other-device", clientVersion: "0.9.4", exportAt: "2024-03-01T00:00:00Z", historicalData: [], md5V2: "" };
const importButton = () => screen.getByRole("button", { name: "Import" });

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.readHistoricalDataFromFile.mockResolvedValue(file);
  mocks.checkIfDuplicatedHistoricalData.mockResolvedValue(false);
  mocks.importHistoricalData.mockResolvedValue(true);
  render(<DataManagement />);
});

it("imports directly when there is no conflict", async () => {
  fireEvent.click(importButton());

  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ description: "Import data successfully", tone: "success" }));
  expect(mocks.importHistoricalData).toHaveBeenCalledTimes(1);
  expect(mocks.importHistoricalData).toHaveBeenCalledWith("IGNORE", file, expect.any(Function));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("asks before overwriting when there is a conflict", async () => {
  mocks.checkIfDuplicatedHistoricalData.mockResolvedValue(true);
  fireEvent.click(importButton());

  const dialog = await screen.findByRole("dialog", { name: "Conflicts Found" });
  expect(mocks.importHistoricalData).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Overwrite" }));

  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ description: "Import data successfully", tone: "success" }));
  expect(mocks.importHistoricalData).toHaveBeenCalledWith("REPLACE", file, expect.any(Function));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("reports a file that cannot be read", async () => {
  mocks.readHistoricalDataFromFile.mockRejectedValue(new Error("file is larger than 100 MB"));
  fireEvent.click(importButton());

  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({
    description: "Error: file is larger than 100 MB", variant: "destructive",
  }));
  expect(mocks.importHistoricalData).not.toHaveBeenCalled();
  expect(importButton()).toBeEnabled();
});

it("reports a failed duplicate check", async () => {
  mocks.checkIfDuplicatedHistoricalData.mockRejectedValue(new Error("database is locked"));
  fireEvent.click(importButton());

  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({
    description: "Error: database is locked", variant: "destructive",
  }));
  expect(mocks.importHistoricalData).not.toHaveBeenCalled();
});

it("runs one import when a conflict choice is clicked twice", async () => {
  let finishImport!: (imported: boolean) => void;
  mocks.importHistoricalData.mockReturnValue(new Promise<boolean>((resolve) => { finishImport = resolve; }));
  mocks.checkIfDuplicatedHistoricalData.mockResolvedValue(true);
  fireEvent.click(importButton());
  const dialog = await screen.findByRole("dialog", { name: "Conflicts Found" });

  fireEvent.click(within(dialog).getByRole("button", { name: "Overwrite" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Overwrite" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Ignore" }));

  expect(mocks.importHistoricalData).toHaveBeenCalledTimes(1);
  expect(within(dialog).getByTestId("import-conflict-choices")).toHaveAttribute("data-state", "importing");
  expect(within(dialog).getByRole("button", { name: "Overwrite" })).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "Ignore" })).toBeDisabled();

  await act(async () => finishImport(true));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(mocks.importHistoricalData).toHaveBeenCalledTimes(1);
  expect(importButton()).toBeEnabled();
});
