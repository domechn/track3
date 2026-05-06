import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataManagement from "@/components/data-management";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  checkIfDuplicatedHistoricalData: vi.fn(),
  cleanAutoBackupDirectory: vi.fn(),
  exportHistoricalData: vi.fn(),
  getAutoBackupDirectory: vi.fn(),
  getBlacklistCoins: vi.fn(),
  getLastAutoBackupAt: vi.fn(),
  getLastAutoImportAt: vi.fn(),
  importHistoricalData: vi.fn(),
  readHistoricalDataFromFile: vi.fn(),
  removeFromBlacklist: vi.fn(),
  saveAutoBackupDirectory: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/middlelayers/data", () => ({
  checkIfDuplicatedHistoricalData: mocks.checkIfDuplicatedHistoricalData,
  exportHistoricalData: mocks.exportHistoricalData,
  importHistoricalData: mocks.importHistoricalData,
  readHistoricalDataFromFile: mocks.readHistoricalDataFromFile,
}));

vi.mock("@/middlelayers/configuration", () => ({
  cleanAutoBackupDirectory: mocks.cleanAutoBackupDirectory,
  getAutoBackupDirectory: mocks.getAutoBackupDirectory,
  getBlacklistCoins: mocks.getBlacklistCoins,
  getLastAutoImportAt: mocks.getLastAutoImportAt,
  getLastAutoBackupAt: mocks.getLastAutoBackupAt,
  removeFromBlacklist: mocks.removeFromBlacklist,
  saveAutoBackupDirectory: mocks.saveAutoBackupDirectory,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAutoBackupDirectory.mockResolvedValue(undefined);
  mocks.getLastAutoBackupAt.mockResolvedValue(
    new Date("2024-04-16T00:00:00.000Z"),
  );
  mocks.getLastAutoImportAt.mockResolvedValue(
    new Date("2024-04-15T00:00:00.000Z"),
  );
  mocks.getBlacklistCoins.mockResolvedValue(["BTC"]);
  mocks.removeFromBlacklist.mockResolvedValue(undefined);
});

describe("Data Management blacklist", () => {
  it("loads blacklisted tokens and removes one from the list", async () => {
    render(<DataManagement />);

    expect(await screen.findByText("BTC")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /remove btc from blacklist/i }),
    );

    await waitFor(() => {
      expect(mocks.removeFromBlacklist).toHaveBeenCalledWith("BTC");
    });
    expect(screen.queryByText("BTC")).not.toBeInTheDocument();
    expect(screen.getByText("No blacklisted tokens")).toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith({
      description: '"BTC" removed from blacklist',
    });
  });
});
