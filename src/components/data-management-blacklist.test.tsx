import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataManagement from "@/components/data-management";
import {
  I18nProvider,
  localeLocalStorageKey,
} from "@/i18n";
import {
  resetEncryptionWriteGateForTests,
  runWithEncryptionWriteGate,
} from "@/middlelayers/encryption-write-gate";

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
  invoke: vi.fn(),
  readHistoricalDataFromFile: vi.fn(),
  removeFromBlacklist: vi.fn(),
  saveAutoBackupDirectory: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
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
  resetEncryptionWriteGateForTests();
  vi.clearAllMocks();
  localStorage.removeItem(localeLocalStorageKey);
  mocks.getAutoBackupDirectory.mockResolvedValue(undefined);
  mocks.getLastAutoBackupAt.mockResolvedValue(
    new Date("2024-04-16T00:00:00.000Z"),
  );
  mocks.getLastAutoImportAt.mockResolvedValue(
    new Date("2024-04-15T00:00:00.000Z"),
  );
  mocks.getBlacklistCoins.mockResolvedValue(["BTC"]);
  mocks.invoke.mockResolvedValue(undefined);
  mocks.removeFromBlacklist.mockResolvedValue(undefined);
});

describe("Data Management", () => {
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

  it.each([
    ["empty keys", "", ""],
    ["mismatched keys", "new-key-123", "different-key"],
    ["a short key", "short", "short"],
  ])("does not invoke rotation for %s", async (_label, key, confirmation) => {
    render(<DataManagement />);

    fireEvent.change(
      screen.getByPlaceholderText("New encryption key (min 8 chars)"),
      { target: { value: key } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("Confirm new encryption key"),
      { target: { value: confirmation } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Update Encryption Key" }),
    );

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      );
    });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it.each([" leading-key", "trailing-key "])(
    "rejects surrounding whitespace in %j",
    async (key) => {
      render(<DataManagement />);

      fireEvent.change(
        screen.getByPlaceholderText("New encryption key (min 8 chars)"),
        { target: { value: key } },
      );
      fireEvent.change(
        screen.getByPlaceholderText("Confirm new encryption key"),
        { target: { value: key } },
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Update Encryption Key" }),
      );

      await waitFor(() => {
        expect(mocks.toast).toHaveBeenCalledWith({
          description:
            "Encryption key must not have leading or trailing whitespace",
          variant: "destructive",
        });
      });
      expect(mocks.invoke).not.toHaveBeenCalled();
    },
  );

  it("uses translated copy for surrounding-whitespace validation", async () => {
    localStorage.setItem(localeLocalStorageKey, "zh");
    render(
      <I18nProvider>
        <DataManagement />
      </I18nProvider>,
    );

    expect(screen.getByText("加密密钥")).toBeInTheDocument();
    expect(
      screen.getByText(
        "更改用于在应用层加密敏感配置值和聊天消息正文的密钥。保存时，现有加密数据会使用新密钥重新加密。资产与交易仍以未经过应用层加密的形式存储在本地 SQLite 数据库中。",
      ),
    ).toBeInTheDocument();
    fireEvent.change(
      screen.getByPlaceholderText("新加密密钥（至少 8 个字符）"),
      { target: { value: " leading-key" } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("确认新加密密钥"),
      { target: { value: " leading-key" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "更新加密密钥" }),
    );

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith({
        description: "加密密钥首尾不能包含空格",
        variant: "destructive",
      });
    });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("invokes the atomic rotation command and clears fields on success", async () => {
    render(<DataManagement />);
    const keyInput = screen.getByPlaceholderText(
      "New encryption key (min 8 chars)",
    );
    const confirmationInput = screen.getByPlaceholderText(
      "Confirm new encryption key",
    );

    fireEvent.change(keyInput, { target: { value: "new-key-123" } });
    fireEvent.change(confirmationInput, {
      target: { value: "new-key-123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Update Encryption Key" }),
    );

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledTimes(1);
      expect(mocks.invoke).toHaveBeenCalledWith("rotate_encryption_key", {
        newKey: "new-key-123",
      });
      expect(keyInput).toHaveValue("");
      expect(confirmationInput).toHaveValue("");
    });
    expect(mocks.toast).toHaveBeenCalledWith({
      description:
        "Encryption key updated. Sensitive configuration and chat message content were re-encrypted; assets and transactions remain unchanged.",
    });
  });

  it("waits for sensitive writes and blocks late writers until rotation returns", async () => {
    let releaseActiveWrite: (() => void) | undefined;
    const activeWriteBlocked = new Promise<void>((resolve) => {
      releaseActiveWrite = resolve;
    });
    const activeWrite = runWithEncryptionWriteGate(() => activeWriteBlocked);
    let releaseRotation: (() => void) | undefined;
    mocks.invoke.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseRotation = resolve;
        }),
    );

    render(<DataManagement />);
    fireEvent.change(
      screen.getByPlaceholderText("New encryption key (min 8 chars)"),
      { target: { value: "new-key-123" } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("Confirm new encryption key"),
      { target: { value: "new-key-123" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Update Encryption Key" }),
    );

    const lateWriter = vi.fn();
    const lateWrite = runWithEncryptionWriteGate(async () => {
      lateWriter();
    });
    await Promise.resolve();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(lateWriter).not.toHaveBeenCalled();

    releaseActiveWrite?.();
    await activeWrite;
    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("rotate_encryption_key", {
        newKey: "new-key-123",
      });
    });
    expect(lateWriter).not.toHaveBeenCalled();

    releaseRotation?.();
    await lateWrite;
    expect(lateWriter).toHaveBeenCalledOnce();
  });

  it("retains fields and shows a destructive toast when rotation fails", async () => {
    mocks.invoke.mockRejectedValueOnce(new Error("rotation failed"));
    render(<DataManagement />);
    const keyInput = screen.getByPlaceholderText(
      "New encryption key (min 8 chars)",
    );
    const confirmationInput = screen.getByPlaceholderText(
      "Confirm new encryption key",
    );

    fireEvent.change(keyInput, { target: { value: "new-key-123" } });
    fireEvent.change(confirmationInput, {
      target: { value: "new-key-123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Update Encryption Key" }),
    );

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith({
        description: "Error: rotation failed",
        variant: "destructive",
      });
    });
    expect(keyInput).toHaveValue("new-key-123");
    expect(confirmationInput).toHaveValue("new-key-123");
  });

  it("requires restart when rotation recovery cannot roll back", async () => {
    mocks.invoke.mockRejectedValueOnce({
      code: "recovery_required",
      message: "backend recovery message",
    });
    render(<DataManagement />);

    fireEvent.change(
      screen.getByPlaceholderText("New encryption key (min 8 chars)"),
      { target: { value: "new-key-123" } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("Confirm new encryption key"),
      { target: { value: "new-key-123" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Update Encryption Key" }),
    );

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith({
        description:
          "Encryption key recovery is required. Restart Track3 before making further changes.",
        variant: "destructive",
      });
    });
  });

  it("disables repeat submission while rotation is saving", async () => {
    let resolveRotation: (() => void) | undefined;
    mocks.invoke.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveRotation = resolve;
        }),
    );
    render(<DataManagement />);

    fireEvent.change(
      screen.getByPlaceholderText("New encryption key (min 8 chars)"),
      { target: { value: "new-key-123" } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("Confirm new encryption key"),
      { target: { value: "new-key-123" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Update Encryption Key" }),
    );

    const savingButton = await screen.findByRole("button", {
      name: "Saving...",
    });
    expect(savingButton).toBeDisabled();
    fireEvent.click(savingButton);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);

    resolveRotation?.();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Update Encryption Key" }),
      ).toBeEnabled();
    });
  });
});
