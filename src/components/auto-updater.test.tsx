import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AutoUpdater from "./auto-updater";
import { check } from "@tauri-apps/plugin-updater";
import { useToast } from "@/components/ui/use-toast";
import { reloadApp } from "@/utils/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { I18nProvider } from "@/i18n";

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: vi.fn(),
}));

vi.mock("@/utils/app", () => ({
  reloadApp: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

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
  it("automatically downloads an available update when the prompt is left alone", async () => {
    vi.useFakeTimers();
    try {
      const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
      vi.mocked(check).mockResolvedValueOnce({
        available: true, version: "2.4.0", downloadAndInstall,
      } as unknown as Awaited<ReturnType<typeof check>>);
      render(<AutoUpdater />);
      await act(async () => {});
      expect(screen.getByRole("button", { name: "Download and install" })).toBeVisible();
      expect(downloadAndInstall).not.toHaveBeenCalled();
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(downloadAndInstall).toHaveBeenCalledOnce();
      expect(screen.getByRole("dialog", { name: "Ready to restart" })).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });
  it("runs only one automatic download under StrictMode", async () => {
    vi.useFakeTimers();
    try {
      const staleDownload = vi.fn().mockResolvedValue(undefined);
      const currentDownload = vi.fn().mockResolvedValue(undefined);
      vi.mocked(check)
        .mockResolvedValueOnce({
          available: true, version: "2.4.0", downloadAndInstall: staleDownload,
        } as unknown as Awaited<ReturnType<typeof check>>)
        .mockResolvedValueOnce({
          available: true, version: "2.5.0", downloadAndInstall: currentDownload,
        } as unknown as Awaited<ReturnType<typeof check>>);
      render(<React.StrictMode><AutoUpdater /></React.StrictMode>);
      await act(async () => {});
      expect(check).toHaveBeenCalledTimes(2);
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(staleDownload).not.toHaveBeenCalled();
      expect(currentDownload).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
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

  it("shows a dismissible failure after a download rejection", async () => {
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
    fireEvent.click(await screen.findByRole("button", { name: "Download and install" }));
    await screen.findByRole("heading", { name: "Update failed" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(downloadAndInstall).toHaveBeenCalledOnce();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  it("shows download progress and safe error details after a failed download", async () => {
    const downloadAndInstall = vi.fn(async (onEvent: (event: unknown) => void) => {
      onEvent({ event: "Started", data: { contentLength: 84_200_000 } });
      onEvent({ event: "Progress", data: { chunkLength: 38_000_000 } });
      throw new Error("connection reset; token=sensitive-download-secret");
    });
    vi.mocked(check).mockResolvedValueOnce({
      available: true, version: "2.4.0", currentVersion: "2.3.1", downloadAndInstall,
    } as unknown as Awaited<ReturnType<typeof check>>);
    render(<AutoUpdater />);
    fireEvent.click(await screen.findByRole("button", { name: "Download and install" }));
    await screen.findByRole("heading", { name: "Update failed" });
    expect(screen.getByText(/stopped at 38.0 of 84.2 MB/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy details" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Download manually" })).toBeVisible();
    expect(screen.queryByText("sensitive-download-secret")).not.toBeInTheDocument();
  });

  it("reports when the manual download link cannot open", async () => {
    vi.mocked(check).mockResolvedValueOnce({
      available: true, downloadAndInstall: vi.fn().mockRejectedValue(new Error("download failed")),
    } as unknown as Awaited<ReturnType<typeof check>>);
    vi.mocked(openUrl).mockRejectedValueOnce(new Error("opener unavailable"));
    render(<AutoUpdater />);
    fireEvent.click(await screen.findByRole("button", { name: "Download and install" }));
    await screen.findByRole("heading", { name: "Update failed" });
    fireEvent.click(screen.getByRole("button", { name: "Download manually" }));
    expect(await screen.findByText(/Could not open the download page/)).toBeVisible();
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
    fireEvent.click(await screen.findByRole("button", { name: "Download and install" }));
    await screen.findByRole("heading", { name: "Ready to restart" });
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
    fireEvent.click(await screen.findByRole("button", { name: "Download and install" }));
    const dialog = await screen.findByRole("dialog", { name: "Ready to restart" });
    expect(dialog).toHaveTextContent("0.9.5");
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ready to restart.*Restart now/ }));
    fireEvent.click(screen.getByRole("button", { name: "Restart now" }));
    expect(reloadApp).toHaveBeenCalledOnce();
    expect(toast).not.toHaveBeenCalled();
  });

  it("shows release notes before downloading an update that provides them", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValueOnce(undefined);
    vi.mocked(check).mockResolvedValueOnce({
      available: true,
      version: "2.4.0",
      currentVersion: "2.3.1",
      date: "2026-10-29",
      body: "## New\n- Refresh progress per source.",
      downloadAndInstall,
    } as unknown as Awaited<ReturnType<typeof check>>);
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1600 });
    try {
      render(<AutoUpdater />);
      fireEvent.click(await screen.findByRole("button", { name: "See what's new" }));
      expect(screen.getByRole("heading", { name: "Track3 2.4.0 is available" })).toBeVisible();
      expect(screen.getByText("Refresh progress per source.")).toBeVisible();
      expect(screen.queryByRole("button", { name: "Skip this version" })).not.toBeInTheDocument();
      expect(downloadAndInstall).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Download and install" }));
      await waitFor(() => expect(downloadAndInstall).toHaveBeenCalledOnce());
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: previousWidth });
    }
  });

  it("formats the release date in the selected Chinese locale", async () => {
    const language = vi.spyOn(navigator, "language", "get").mockReturnValue("zh-CN");
    try {
      vi.mocked(check).mockResolvedValueOnce({
        available: true,
        version: "2.4.0",
        currentVersion: "2.3.1",
        date: "2026-10-29",
        body: "## New",
        downloadAndInstall: vi.fn(),
      } as unknown as Awaited<ReturnType<typeof check>>);
      render(<I18nProvider><AutoUpdater /></I18nProvider>);
      fireEvent.click(await screen.findByRole("button", { name: "查看更新内容" }));
      expect(screen.getByRole("dialog")).toHaveTextContent("2026年10月29日");
    } finally {
      language.mockRestore();
    }
  });

  it("uses the same update prompt at narrow widths", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    vi.mocked(check).mockResolvedValueOnce({
      available: true,
      version: "2.4.0",
      body: "Release notes",
      downloadAndInstall,
    } as unknown as Awaited<ReturnType<typeof check>>);
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    try {
      render(<AutoUpdater />);
      expect(await screen.findByRole("button", { name: "See what's new" })).toBeVisible();
      expect(downloadAndInstall).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: previousWidth });
    }
  });
});
