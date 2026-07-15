import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AutoUpdater from "./auto-updater";
import { check } from "@tauri-apps/plugin-updater";
import { useToast } from "@/components/ui/use-toast";
import { reloadApp } from "@/utils/app";

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: vi.fn(),
}));

vi.mock("@/utils/app", () => ({
  reloadApp: vi.fn(),
}));

const toast = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useToast).mockReturnValue({
    toast,
    dismiss: vi.fn(),
    toasts: [],
  });
});

describe("AutoUpdater", () => {
  it("contains update check rejections without exposing the error", async () => {
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    vi.mocked(check).mockRejectedValueOnce(
      new Error("check failed token=sensitive-check-token"),
    );

    render(<AutoUpdater />);

    await waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith(
        "Automatic update check failed",
      );
    });
    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  it("contains download rejections without showing a routine failure toast", async () => {
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const downloadAndInstall = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("download failed secret=sensitive-download-secret"),
      );
    vi.mocked(check).mockResolvedValueOnce({
      available: true,
      downloadAndInstall,
    } as unknown as Awaited<ReturnType<typeof check>>);

    render(<AutoUpdater />);

    await waitFor(() => {
      expect(downloadAndInstall).toHaveBeenCalledOnce();
      expect(consoleWarn).toHaveBeenCalledWith(
        "Automatic update check failed",
      );
    });
    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  it("does nothing when no update is available", async () => {
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    vi.mocked(check).mockResolvedValueOnce(null);

    render(<AutoUpdater />);

    await waitFor(() => {
      expect(check).toHaveBeenCalledOnce();
    });
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  it("keeps the reload action after a successful update", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValueOnce(undefined);
    vi.mocked(check).mockResolvedValueOnce({
      available: true,
      downloadAndInstall,
    } as unknown as Awaited<ReturnType<typeof check>>);

    render(<AutoUpdater />);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledOnce();
    });
    expect(downloadAndInstall).toHaveBeenCalledOnce();

    const { action, title } = toast.mock.calls[0][0];
    expect(title).toBe("🔥 New version available!");
    render(action);
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));

    expect(reloadApp).toHaveBeenCalledOnce();
  });
});
