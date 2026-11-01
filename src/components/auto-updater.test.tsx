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

  it("offers restart after a successful update", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValueOnce(undefined);
    vi.mocked(check).mockResolvedValueOnce({
      available: true,
      downloadAndInstall,
    } as unknown as Awaited<ReturnType<typeof check>>);

    render(<AutoUpdater />);

    await screen.findByRole("dialog", { name: "Update ready to install" });
    expect(downloadAndInstall).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Restart now" }));
    expect(reloadApp).toHaveBeenCalledOnce();
  });

  it("shows a dismissible ready dialog after the existing download completes", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValueOnce(undefined);
    vi.mocked(check).mockResolvedValueOnce({
      available: true,
      version: "0.9.5",
      downloadAndInstall,
    } as unknown as Awaited<ReturnType<typeof check>>);

    render(<AutoUpdater />);

    const dialog = await screen.findByRole("dialog", { name: "Update ready to install" });
    expect(dialog).toHaveTextContent("0.9.5");
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restart now" }));
    expect(reloadApp).toHaveBeenCalledOnce();
    expect(toast).not.toHaveBeenCalled();
  });
});
