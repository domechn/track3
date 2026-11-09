import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { check } from "@tauri-apps/plugin-updater";
import { openUrl } from "@tauri-apps/plugin-opener";
import AutoUpdater from "./auto-updater";

vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));
vi.mock("@/utils/app", () => ({ reloadApp: vi.fn() }));

const update = (download: (onEvent: (event: never) => void) => Promise<void>) => ({
  available: true, version: "0.9.11", currentVersion: "0.9.10", date: "2026-11-08", body: "", rawJson: {},
  download: vi.fn(download), install: vi.fn(async () => {}), close: vi.fn(async () => {}),
});
const start = async () => fireEvent.click(await screen.findByRole("button", { name: "Download and install" }));

beforeEach(() => { vi.clearAllMocks(); });

describe("updater download failures", () => {
  it.each(["light", "dark"])("announces checking and keeps progress colors in CSS for %s theme", async (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    vi.mocked(check).mockResolvedValueOnce(update(() => new Promise(() => {})) as never);
    render(<AutoUpdater />);
    expect(screen.getByRole("status")).toHaveTextContent("Checking for updates");
    await start();
    expect(screen.getByRole("progressbar").querySelector("span")).not.toHaveAttribute("style");
    document.documentElement.classList.remove("dark");
  });

  it("waits 2, 5 and 15 seconds before three automatic retries, then stops", async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const updates = Array.from({ length: 4 }, () => update(async () => { throw new Error("HTTP 503"); }));
      for (const item of updates) vi.mocked(check).mockResolvedValueOnce(item as never);
      render(<AutoUpdater />);
      await act(async () => {});
      fireEvent.click(screen.getByRole("button", { name: "Download and install" }));
      await act(async () => {});
      expect(screen.getByRole("dialog")).toHaveTextContent("Retrying in 2s");
      for (const [delay, next] of [[2_000, "5"], [5_000, "15"], [15_000, null]] as const) {
        await act(async () => { await vi.advanceTimersByTimeAsync(delay); });
        if (next) expect(screen.getByRole("dialog")).toHaveTextContent(`Retrying in ${next}s`);
      }
      expect(updates.every((item) => item.download.mock.calls.length === 1)).toBe(true);
      expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
      expect(screen.getByRole("dialog")).not.toHaveTextContent("Retrying in");
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(check).toHaveBeenCalledTimes(4);
    } finally { log.mockRestore(); vi.useRealTimers(); }
  });

  it("shows percent, speed and ETA, then verify and install states", async () => {
    vi.useFakeTimers();
    try {
      let emit!: (event: never) => void;
      let finishDownload!: () => void;
      let finishInstall!: () => void;
      const found = update((onEvent) => { emit = onEvent; return new Promise((resolve) => { finishDownload = resolve; }); });
      found.install.mockImplementationOnce(() => new Promise((resolve) => { finishInstall = resolve; }));
      vi.mocked(check).mockResolvedValueOnce(found as never);
      render(<AutoUpdater />);
      await act(async () => {});
      fireEvent.click(screen.getByRole("button", { name: "Download and install" }));
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      await act(async () => {
        emit({ event: "Started", data: { contentLength: 100_000_000 } } as never);
        await vi.advanceTimersByTimeAsync(1_000);
        emit({ event: "Progress", data: { chunkLength: 25_000_000 } } as never);
      });
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
      expect(screen.getByRole("dialog")).toHaveTextContent("25.0 MB/s");
      expect(screen.getByRole("dialog")).toHaveTextContent("3s remaining");
      await act(async () => { emit({ event: "Finished" } as never); });
      expect(screen.getByRole("status")).toHaveTextContent("Verifying");
      await act(async () => { finishDownload(); });
      expect(screen.getByRole("status")).toHaveTextContent("Installing");
      await act(async () => { finishInstall(); });
      expect(screen.getByRole("heading", { name: "Ready to restart" })).toBeVisible();
    } finally { vi.useRealTimers(); }
  });

  it("fails after 20 seconds without a first byte, then starts a fresh retry after 2 seconds", async () => {
    vi.useFakeTimers();
    try {
      const first = update(() => new Promise(() => {}));
      const second = update(() => new Promise(() => {}));
      vi.mocked(check).mockResolvedValueOnce(first as never).mockResolvedValueOnce(second as never);
      render(<AutoUpdater />);
      await act(async () => {});
      fireEvent.click(screen.getByRole("button", { name: "Download and install" }));
      expect(screen.getByRole("status")).toHaveTextContent("Connecting");
      expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
      expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
      expect(check).toHaveBeenCalledWith({ timeout: 15_000 });
      expect(first.download).toHaveBeenCalledWith(expect.any(Function), { timeout: 900_000 });
      await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
      expect(screen.getByRole("dialog")).toHaveTextContent("Could not download the update. GitHub may be slow or blocked on your network.");
      expect(screen.getByRole("dialog")).toHaveTextContent("If you use a proxy or VPN");
      await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
      expect(second.download).toHaveBeenCalledOnce();
      expect(first.close).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });

  it("shows unknown length as indeterminate, then fails after 30 seconds without progress", async () => {
    vi.useFakeTimers();
    try {
      let emit!: (event: never) => void;
      vi.mocked(check).mockResolvedValueOnce(update((onEvent) => { emit = onEvent; return new Promise(() => {}); }) as never);
      render(<AutoUpdater />);
      await act(async () => {});
      fireEvent.click(screen.getByRole("button", { name: "Download and install" }));
      await act(async () => { emit({ event: "Started", data: {} } as never); });
      expect(screen.getByRole("status")).toHaveTextContent("MB downloaded");
      expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
      await act(async () => { await vi.advanceTimersByTimeAsync(25_000); });
      await act(async () => { emit({ event: "Progress", data: { chunkLength: 1_000_000 } } as never); });
      expect(screen.getByRole("status")).toHaveTextContent("1.0");
      await act(async () => { await vi.advanceTimersByTimeAsync(29_000); });
      expect(screen.getByRole("status")).toHaveTextContent("1.0");
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
      expect(screen.getByRole("dialog")).toHaveTextContent("Could not download the update");
    } finally { vi.useRealTimers(); }
  });

  it("does not treat an empty chunk as progress", async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      let emit!: (event: never) => void;
      vi.mocked(check).mockResolvedValueOnce(update((onEvent) => { emit = onEvent; return new Promise(() => {}); }) as never);
      render(<AutoUpdater />);
      await act(async () => {});
      fireEvent.click(screen.getByRole("button", { name: "Download and install" }));
      await act(async () => { emit({ event: "Started", data: {} } as never); });
      await act(async () => { await vi.advanceTimersByTimeAsync(29_000); emit({ event: "Progress", data: { chunkLength: 0 } } as never); });
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
      expect(screen.getByRole("heading", { name: "Update failed" })).toBeVisible();
    } finally { log.mockRestore(); vi.useRealTimers(); }
  });

  it("manual retry uses a new update after a failed download", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const first = update(async () => { throw new Error("HTTP 403"); });
      const second = update(async () => {});
      vi.mocked(check).mockResolvedValueOnce(first as never).mockResolvedValueOnce(second as never);
      render(<AutoUpdater />);
      await start();
      await screen.findByRole("heading", { name: "Update failed" });
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await screen.findByRole("heading", { name: "Ready to restart" });
      expect(first.close).toHaveBeenCalled();
      expect(second.download).toHaveBeenCalledOnce();
      expect(second.install).toHaveBeenCalledOnce();
    } finally { log.mockRestore(); }
  });

  it("does not automatically repeat a failed installation", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const found = update(async () => {});
      found.install.mockRejectedValueOnce(new Error("Installer could not start"));
      vi.mocked(check).mockResolvedValueOnce(found as never);
      render(<AutoUpdater />);
      await start();
      expect(await screen.findByRole("heading", { name: "Update failed" })).toBeVisible();
      expect(screen.getByRole("dialog")).not.toHaveTextContent("Retrying in");
    } finally { log.mockRestore(); }
  });

  it.each(["403", "404", "429", "500", "503"])("shows HTTP %s in expandable safe details", async (code) => {
    vi.mocked(check).mockResolvedValueOnce(update(async () => { throw new Error(`Download request failed with status: ${code} at https://release-assets.githubusercontent.com/private?token=secret`); }) as never);
    render(<AutoUpdater />);
    await start();
    await screen.findByRole("heading", { name: "Update failed" });
    fireEvent.click(screen.getByText("Details"));
    expect(screen.getByText(new RegExp(`HTTP ${code}`))).toBeVisible();
    expect(screen.getByText(new RegExp(`HTTP ${code}.*release-assets\\.githubusercontent\\.com`))).toBeVisible();
    expect(screen.queryByText(/token=secret/)).not.toBeInTheDocument();
  });

  it("labels a signature failure and never installs", async () => {
    const found = update(async (onEvent) => {
      onEvent({ event: "Started", data: { contentLength: 100 } } as never);
      onEvent({ event: "Progress", data: { chunkLength: 50 } } as never);
      onEvent({ event: "Finished" } as never);
      throw new Error("Signature verification failed");
    });
    vi.mocked(check).mockResolvedValueOnce(found as never);
    render(<AutoUpdater />);
    await start();
    expect(await screen.findByRole("heading", { name: "Update failed" })).toBeVisible();
    expect(screen.getByRole("dialog")).toHaveTextContent("signature");
    expect(found.install).not.toHaveBeenCalled();
  });

  it("cancel prevents a late download from installing and manual link opens download page", async () => {
    let finish!: () => void;
    const found = update(() => new Promise<void>((resolve) => { finish = resolve; }));
    vi.mocked(check).mockResolvedValueOnce(found as never);
    render(<AutoUpdater />);
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("status")).toHaveTextContent("Cancelled");
    await act(async () => { finish(); });
    expect(found.install).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Download manually" }));
    await waitFor(() => expect(openUrl).toHaveBeenCalledWith("https://track3.dev/download.html"));
  });

  it("Escape dismisses a failed update and stops its scheduled retry", async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      vi.mocked(check).mockResolvedValueOnce(update(async () => { throw new Error("HTTP 503"); }) as never);
      render(<AutoUpdater />);
      await act(async () => {});
      fireEvent.click(screen.getByRole("button", { name: "Download and install" }));
      await act(async () => {});
      expect(screen.getByRole("dialog")).toHaveTextContent("Retrying in 2s");
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Update failed/ })).not.toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
      expect(check).toHaveBeenCalledOnce();
    } finally { log.mockRestore(); vi.useRealTimers(); }
  });

  it("labels a hidden cancelled update as cancelled", async () => {
    vi.mocked(check).mockResolvedValueOnce(update(() => new Promise(() => {})) as never);
    render(<AutoUpdater />);
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.getByRole("button", { name: "Cancelled" })).toBeVisible();
  });
});
