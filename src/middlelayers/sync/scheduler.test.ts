import { afterEach, describe, expect, it, vi } from "vitest";
import { SyncScheduler } from "./scheduler";
import type { SyncReport } from "./engine";
import { S3Error } from "./object-store";

const success: SyncReport = { pulled: 1, pushed: 2, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] };

afterEach(() => vi.useRealTimers());

describe("SyncScheduler", () => {
  it("debounces start and refresh triggers into one round", async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => success);
    const scheduler = new SyncScheduler(run, { debounceMs: 20 });
    scheduler.trigger("start");
    scheduler.trigger("refresh");
    await vi.advanceTimersByTimeAsync(20);
    expect(run).toHaveBeenCalledTimes(1);
    expect(scheduler.status().report).toEqual(success);
    scheduler.stop();
  });

  it("keeps manual rounds single flight", async () => {
    let complete!: (report: SyncReport) => void;
    const run = vi.fn(() => new Promise<SyncReport>((resolve) => { complete = resolve; }));
    const scheduler = new SyncScheduler(run);
    const first = scheduler.syncNow();
    const second = scheduler.syncNow();
    expect(run).toHaveBeenCalledTimes(1);
    complete(success);
    await Promise.all([first, second]);
    expect(scheduler.status().phase).toBe("idle");
    scheduler.stop();
  });
  it("runs one more round when a refresh arrives during a running round", async () => {
    vi.useFakeTimers();
    let complete!: (report: SyncReport) => void;
    const run = vi.fn().mockImplementationOnce(() => new Promise<SyncReport>((resolve) => { complete = resolve; }))
      .mockResolvedValue(success);
    const scheduler = new SyncScheduler(run, { debounceMs: 10 });
    const first = scheduler.syncNow();
    scheduler.trigger("refresh");
    await vi.advanceTimersByTimeAsync(10);
    complete(success);
    await first;
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it("keeps exponential backoff when refresh and focus arrive after an error", async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockResolvedValueOnce({ ...success, errors: ["Failed to read sync manifest"] })
      .mockResolvedValueOnce(success).mockResolvedValueOnce(success);
    const scheduler = new SyncScheduler(run, { debounceMs: 5, retryBaseMs: 100 });
    await scheduler.syncNow();
    expect(run).toHaveBeenCalledTimes(1);
    expect(scheduler.status().error).toBe("sync");
    scheduler.trigger("focus");
    scheduler.trigger("refresh");
    await vi.advanceTimersByTimeAsync(5);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(94);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);
    expect(scheduler.status().phase).toBe("idle");
    scheduler.stop();
  });

  it("retries a partial round with exponential backoff without another trigger", async () => {
    vi.useFakeTimers();
    const partial = { ...success, errors: ["Failed to push snapshot object"] };
    const run = vi.fn().mockResolvedValueOnce(partial).mockResolvedValueOnce(partial).mockResolvedValue(success);
    const scheduler = new SyncScheduler(run, { retryBaseMs: 10 });
    await scheduler.syncNow();
    await vi.advanceTimersByTimeAsync(9);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(19);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(3);
    expect(scheduler.status().phase).toBe("idle");
    scheduler.stop();
  });

  it("stops automatic retries after repeated failures until a refresh", async () => {
    vi.useFakeTimers();
    const failed = { ...success, errors: ["Failed to read sync manifest"] };
    const run = vi.fn(async () => failed);
    const scheduler = new SyncScheduler(run, { debounceMs: 5, retryBaseMs: 10 });
    await scheduler.syncNow();
    await vi.advanceTimersByTimeAsync(300_000);
    const exhausted = run.mock.calls.length;
    expect(exhausted).toBeGreaterThan(1);
    expect(exhausted).toBeLessThan(10);
    expect(scheduler.status()).toMatchObject({ phase: "error", retryStopped: true });
    await vi.advanceTimersByTimeAsync(300_000);
    expect(run).toHaveBeenCalledTimes(exhausted);
    scheduler.trigger("focus");
    await vi.advanceTimersByTimeAsync(5);
    expect(run).toHaveBeenCalledTimes(exhausted);
    scheduler.trigger("refresh");
    await vi.advanceTimersByTimeAsync(5);
    expect(run).toHaveBeenCalledTimes(exhausted + 1);
    scheduler.stop();
  });

  it.each(["bucket", "conditions"] as const)("retries %s errors with backoff", async (kind) => {
    vi.useFakeTimers();
    const run = vi.fn().mockRejectedValueOnce(
      kind === "bucket" ? new S3Error("bucket unavailable", 404) : new Error("Sync store does not enforce conditional writes"),
    ).mockResolvedValue(success);
    const scheduler = new SyncScheduler(run, { retryBaseMs: 10 });
    await scheduler.syncNow();
    await vi.advanceTimersByTimeAsync(10);
    expect(run).toHaveBeenCalledTimes(2);
    expect(scheduler.status().phase).toBe("idle");
    scheduler.stop();
  });

  it("reports a missing header without retrying it as a network failure", async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => { throw new Error("Sync has not been initialized"); });
    const scheduler = new SyncScheduler(run, { retryBaseMs: 10 });
    await scheduler.syncNow();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(scheduler.status().error).toBe("header");
    scheduler.stop();
  });

  it("stops retrying when the remote header is malformed", async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => { throw new SyntaxError("secret header body"); });
    const scheduler = new SyncScheduler(run, { retryBaseMs: 10 });
    await scheduler.syncNow();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(scheduler.status().error).toBe("header");
    scheduler.stop();
  });

  it("throttles focus and retries errors without throwing into callers", async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockRejectedValueOnce(new Error("secret")).mockResolvedValue(success);
    const scheduler = new SyncScheduler(run, { debounceMs: 10, focusThrottleMs: 100, retryBaseMs: 40 });
    scheduler.trigger("focus");
    scheduler.trigger("focus");
    await vi.advanceTimersByTimeAsync(10);
    expect(run).toHaveBeenCalledTimes(1);
    expect(scheduler.status().phase).toBe("error");
    expect(scheduler.status().error).toBe("network");
    await vi.advanceTimersByTimeAsync(40);
    expect(run).toHaveBeenCalledTimes(2);
    expect(scheduler.status().phase).toBe("idle");
    scheduler.stop();
  });

  it("aborts work when stopped", async () => {
    let runningSignal: AbortSignal | undefined;
    const scheduler = new SyncScheduler(async (signal) => {
      runningSignal = signal;
      return success;
    });
    await scheduler.syncNow();
    scheduler.stop();
    expect(runningSignal?.aborted).toBe(true);
  });
});
