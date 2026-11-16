import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataManagement from "@/components/data-management";

const m = vi.hoisted(() => ({
  toast: vi.fn(), readFile: vi.fn(), duplicate: vi.fn(), importData: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/middlelayers/data", () => ({
  checkIfDuplicatedHistoricalData: m.duplicate, importHistoricalData: m.importData,
  readHistoricalDataFromFile: m.readFile, exportHistoricalData: vi.fn(), previewImport: vi.fn(), importSelected: vi.fn(),
}));
vi.mock("@/middlelayers/backup-folder", () => ({ listBackupClients: vi.fn(async () => []), readBackupClient: vi.fn() }));
vi.mock("@/middlelayers/backup-summary", () => ({ queryBackupSummary: vi.fn(async () => ({ snapshots: 0, assets: 0, transactions: 0 })) }));
vi.mock("@/middlelayers/configuration", () => ({
  getAutoBackupDirectory: vi.fn(async () => undefined), getBlacklistCoins: vi.fn(async () => []),
  getLastAutoBackupAt: vi.fn(async () => undefined), getLastAutoImportAt: vi.fn(async () => undefined),
}));

const file = { exportAt: "2024-03-01T00:00:00Z", historicalData: [], md5V2: "" };
const importButton = () => screen.getByRole("button", { name: "Import" });
// Node reports an unhandled rejection after the microtask queue drains, so one macrotask turn is enough.
const nextTask = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  vi.clearAllMocks();
  m.readFile.mockResolvedValue(file);
  m.duplicate.mockResolvedValue(false);
  m.importData.mockResolvedValue(true);
});

describe("legacy Import", () => {
  it("imports a file without duplicates once and reports success", async () => {
    render(<DataManagement />);
    fireEvent.click(importButton());
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ description: "Import data successfully" })));
    expect(m.importData).toHaveBeenCalledTimes(1);
    expect(m.importData).toHaveBeenCalledWith("IGNORE", file, expect.any(Function));
  });

  it("asks how to resolve duplicates before importing", async () => {
    m.duplicate.mockResolvedValue(true);
    render(<DataManagement />);
    fireEvent.click(importButton());
    expect(await screen.findByRole("dialog", { name: "Conflicts Found" })).toBeInTheDocument();
    expect(m.importData).not.toHaveBeenCalled();
  });

  it("does nothing when the file picker is cancelled", async () => {
    m.readFile.mockResolvedValue(undefined);
    render(<DataManagement />);
    fireEvent.click(importButton());
    await waitFor(() => expect(m.readFile).toHaveBeenCalledTimes(1));
    await nextTask();
    expect(m.duplicate).not.toHaveBeenCalled();
    expect(m.importData).not.toHaveBeenCalled();
    expect(m.toast).not.toHaveBeenCalled();
  });

  it.each([
    ["the file cannot be read", () => m.readFile.mockRejectedValue(new Error("File is not valid JSON"))],
    ["the duplicate check fails", () => m.duplicate.mockRejectedValue(new Error("File is not valid JSON"))],
  ])("reports the reason when %s", async (_name, fail) => {
    const unhandledRejection = vi.fn();
    process.on("unhandledRejection", unhandledRejection);
    try {
      fail();
      render(<DataManagement />);
      fireEvent.click(importButton());
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
