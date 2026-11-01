import React from "react";
import { fireEvent, render as testingRender, screen, waitFor, within } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataManagement from "@/mobile/components/data-management";
import { Toast, ToastProvider, ToastViewport } from "@/mobile/components/ui/toast";
import {
  I18nProvider,
  localeLocalStorageKey,
} from "@/mobile/i18n";
import {
  resetEncryptionWriteGateForTests,
  runWithEncryptionWriteGate,
} from "@/middlelayers/encryption-write-gate";
import { isIOS } from "@/utils/platform";
import { appLockEnabled, setAppLockEnabled } from "@/utils/ios-native";

const render = (ui: React.ReactElement) => testingRender(<HashRouter>{ui}</HashRouter>);

vi.mock("@/utils/platform", () => ({ isIOS: vi.fn(() => false) }));
vi.mock("@/utils/ios-native", () => ({
  appLockEnabled: vi.fn().mockResolvedValue(false),
  setAppLockEnabled: vi.fn().mockResolvedValue(undefined),
}));

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  addToBlacklist: vi.fn(),
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
  queryBackupSummary: vi.fn(),
  removeFromBlacklist: vi.fn(),
  saveAutoBackupDirectory: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));
vi.mock("@tauri-apps/api/path", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tauri-apps/api/path")>(),
  documentDir: vi.fn(async () => "/Documents"),
}));

vi.mock("@/mobile/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/middlelayers/data", () => ({
  checkIfDuplicatedHistoricalData: mocks.checkIfDuplicatedHistoricalData,
  exportHistoricalData: mocks.exportHistoricalData,
  importHistoricalData: mocks.importHistoricalData,
  readHistoricalDataFromFile: mocks.readHistoricalDataFromFile,
}));
vi.mock("@/middlelayers/backup-summary", () => ({
  queryBackupSummary: mocks.queryBackupSummary,
}));

vi.mock("@/middlelayers/configuration", () => ({
  addToBlacklist: mocks.addToBlacklist,
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
  vi.mocked(isIOS).mockReturnValue(false);
  localStorage.removeItem(localeLocalStorageKey);
  mocks.getAutoBackupDirectory.mockResolvedValue(undefined);
  mocks.getLastAutoBackupAt.mockResolvedValue(
    new Date("2024-04-16T00:00:00.000Z"),
  );
  mocks.getLastAutoImportAt.mockResolvedValue(
    new Date("2024-04-15T00:00:00.000Z"),
  );
  mocks.getBlacklistCoins.mockResolvedValue(["BTC"]);
  mocks.queryBackupSummary.mockResolvedValue({ snapshots: 12, assets: 3, transactions: 9 });
  mocks.invoke.mockImplementation(async (command: string) =>
    command === "ios_backup_folder_status" ? { path: null, failure: null } : undefined);
  mocks.removeFromBlacklist.mockResolvedValue(undefined);
  mocks.addToBlacklist.mockResolvedValue(undefined);
  mocks.cleanAutoBackupDirectory.mockResolvedValue(undefined);
  mocks.saveAutoBackupDirectory.mockResolvedValue(undefined);
});

describe("Data Management", () => {
  it("shows the device summary and export categories on iPhone", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/data?section=backup";
    render(<DataManagement />);
    const summary = await screen.findByRole("region", { name: "On this device" });
    expect(within(summary).getByText("12")).toBeInTheDocument();
    expect(within(summary).getByText("3")).toBeInTheDocument();
    expect(within(summary).getByText("9")).toBeInTheDocument();
    expect(screen.getByText("Portfolio history")).toBeInTheDocument();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
  });
  it("keeps the blacklist setting limited to existing removal actions", async () => {
    render(<DataManagement />);
    await screen.findByText("BTC");
    expect(screen.queryByRole("textbox", { name: "Token symbol" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hide token" })).not.toBeInTheDocument();
  });

  it("confirms a Files restore before importing on iPhone", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/data?section=backup";
    const imported = { assets: [] };
    mocks.readHistoricalDataFromFile.mockResolvedValue(imported);
    mocks.checkIfDuplicatedHistoricalData.mockResolvedValue(false);
    mocks.importHistoricalData.mockResolvedValue(true);
    render(<DataManagement />);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(await screen.findByRole("alertdialog", { name: "Restore data?" })).toBeInTheDocument();
    expect(mocks.importHistoricalData).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "Restore data?" })).getByRole("button", { name: "Cancel" }));
    expect(mocks.importHistoricalData).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(within(await screen.findByRole("alertdialog", { name: "Restore data?" })).getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(mocks.importHistoricalData).toHaveBeenCalledWith("IGNORE", imported));
    vi.mocked(isIOS).mockReturnValue(false);
    window.location.hash = "";
  });

  it("opens focused backup and blacklist pages on iPhone", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/data?section=backup";
    const view = render(<DataManagement />);
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share JSON" })).toBeInTheDocument();
    expect(screen.queryByText("Blacklist")).not.toBeInTheDocument();
    view.unmount();
    window.location.hash = "#/settings/data?section=blacklist";
    render(<DataManagement />);
    expect(await screen.findByText("BTC")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
    vi.mocked(isIOS).mockReturnValue(false);
    window.location.hash = "";
  });

  it("shows the last backup and import dates as readable text on iPhone", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/data?section=backup";
    mocks.getAutoBackupDirectory.mockResolvedValue("/Documents/Track3");
    try {
      render(<DataManagement />);
      await waitFor(() => expect(screen.getByText("Last backup")).toBeVisible());
      expect(screen.getByText("Last import")).toBeVisible();
      expect(screen.getByText("Last backup").parentElement).toHaveTextContent("2024-4-16");
      expect(screen.getByText("Last import").parentElement).toHaveTextContent("2024-4-15");
    } finally {
      vi.mocked(isIOS).mockReturnValue(false);
      window.location.hash = "";
    }
  });

  it("lets an iPhone owner enable app lock after native authentication", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    vi.mocked(appLockEnabled).mockResolvedValue(false);
    window.location.hash = "#/settings/data?section=security";
    render(<DataManagement />);
    const lock = await screen.findByRole("switch", { name: "App lock" });
    fireEvent.click(lock);
    await waitFor(() => expect(lock).toHaveAttribute("aria-checked", "true"));
    expect(setAppLockEnabled).toHaveBeenCalledWith(true);
    vi.mocked(isIOS).mockReturnValue(false);
    window.location.hash = "";
  });

  it("uses a switch to include configuration in an iPhone export", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/data?section=backup";
    try {
      render(<DataManagement />);
      const include = screen.getByRole("switch", { name: "Include configuration" });
      expect(include).toHaveAttribute("aria-checked", "false");
      fireEvent.click(include);
      expect(include).toHaveAttribute("aria-checked", "true");
      fireEvent.click(screen.getByRole("button", { name: "Export" }));
      await waitFor(() => expect(mocks.exportHistoricalData).toHaveBeenCalledWith(true));
    } finally {
      vi.mocked(isIOS).mockReturnValue(false);
      window.location.hash = "";
    }
  });

  it("loads blacklisted tokens and removes one from the list", async () => {
    render(<DataManagement />);

    expect(await screen.findByText("BTC")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /remove btc from blacklist/i }),
    );
    expect(mocks.removeFromBlacklist).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("BTC")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /remove btc from blacklist/i }));
    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));

    await waitFor(() => {
      expect(mocks.removeFromBlacklist).toHaveBeenCalledWith("BTC");
    });
    expect(screen.queryByText("BTC")).not.toBeInTheDocument();
    expect(screen.getByText("No blacklisted tokens")).toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: '"BTC" removed from blacklist',
      duration: 5000,
    }));
    const toastView = render(<ToastProvider><Toast defaultOpen>
      {mocks.toast.mock.lastCall?.[0].action}
    </Toast><ToastViewport /></ToastProvider>);
    fireEvent.click(toastView.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(mocks.addToBlacklist).toHaveBeenCalledWith("BTC"));
    expect(screen.getByText("BTC")).toBeInTheDocument();
  });

  it("restores a blacklist chip when removal fails", async () => {
    mocks.removeFromBlacklist.mockRejectedValueOnce(new Error("disk failed"));
    render(<DataManagement />);
    await screen.findByText("BTC");
    fireEvent.click(screen.getByRole("button", { name: /remove btc from blacklist/i }));
    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({
      description: "disk failed",
      variant: "destructive",
    }));
    expect(screen.getByText("BTC")).toBeInTheDocument();
  });

  it("shows an undone blacklist entry in the order saved by addToBlacklist", async () => {
    mocks.getBlacklistCoins.mockResolvedValue(["BTC", "ETH", "SOL"]);
    render(<DataManagement />);
    await screen.findByText("BTC");
    fireEvent.click(screen.getByRole("button", { name: /remove btc from blacklist/i }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(mocks.removeFromBlacklist).toHaveBeenCalledOnce());
    const undoAction = mocks.toast.mock.lastCall?.[0].action;
    const toastView = render(<ToastProvider><Toast defaultOpen>{undoAction}</Toast><ToastViewport /></ToastProvider>);
    fireEvent.click(toastView.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(mocks.addToBlacklist).toHaveBeenCalledWith("BTC"));
    expect(screen.getAllByRole("button", { name: /remove .* from blacklist/i }).map((button) => button.getAttribute("aria-label"))).toEqual([
      "Remove ETH from blacklist", "Remove SOL from blacklist", "Remove BTC from blacklist",
    ]);
  });

  it("keeps blacklist order when removing the first entry fails", async () => {
    mocks.getBlacklistCoins.mockResolvedValue(["BTC", "ETH", "SOL"]);
    mocks.removeFromBlacklist.mockRejectedValueOnce(new Error("storage failed"));
    render(<DataManagement />);
    await screen.findByText("BTC");
    fireEvent.click(screen.getByRole("button", { name: /remove btc from blacklist/i }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({
      description: "storage failed", variant: "destructive",
    }));
    expect(screen.getAllByRole("button", { name: /remove .* from blacklist/i }).map((button) => button.getAttribute("aria-label"))).toEqual([
      "Remove BTC from blacklist", "Remove ETH from blacklist", "Remove SOL from blacklist",
    ]);
  });

  it("confirms clearing the backup folder and can undo it", async () => {
    mocks.getAutoBackupDirectory.mockResolvedValue("/backups");
    render(<DataManagement />);
    await screen.findByText("/backups");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(mocks.cleanAutoBackupDirectory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("/backups")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(mocks.cleanAutoBackupDirectory).toHaveBeenCalledOnce());
    expect(screen.queryByText("/backups")).not.toBeInTheDocument();
    const toastView = render(<ToastProvider><Toast defaultOpen>
      {mocks.toast.mock.lastCall?.[0].action}
    </Toast><ToastViewport /></ToastProvider>);
    fireEvent.click(toastView.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(mocks.saveAutoBackupDirectory).toHaveBeenCalledWith("/backups"));
    expect(screen.getByText("/backups")).toBeInTheDocument();
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
      screen.getByRole("button", { name: "Update encryption key" }),
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
        screen.getByRole("button", { name: "Update encryption key" }),
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
      screen.getByRole("button", { name: "Update encryption key" }),
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
      screen.getByRole("button", { name: "Update encryption key" }),
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
      screen.getByRole("button", { name: "Update encryption key" }),
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
      screen.getByRole("button", { name: "Update encryption key" }),
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
      screen.getByRole("button", { name: "Update encryption key" }),
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
        screen.getByRole("button", { name: "Update encryption key" }),
      ).toBeEnabled();
    });
  });
});
