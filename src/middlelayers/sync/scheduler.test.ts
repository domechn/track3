import { afterEach, describe, expect, it, vi } from "vitest";
import { SyncScheduler } from "./scheduler";
import type { SyncReport } from "./engine";
import { FakeS3, S3Error } from "./object-store";

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

  it("keeps the last successful time when a later round fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
    const run = vi.fn().mockResolvedValueOnce(success)
      .mockRejectedValueOnce(new S3Error("bucket unavailable", 404));
    const scheduler = new SyncScheduler(run);
    await scheduler.syncNow();
    const lastSync = scheduler.status().lastSync;
    vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
    await scheduler.syncNow();
    expect(scheduler.status()).toMatchObject({ phase: "error", error: "bucket", lastSync });
    await scheduler.stop();
  });

  it("allows Sync now to retry after a synchronous setup failure", async () => {
    const run = vi.fn().mockImplementationOnce(() => { throw new Error("setup failed"); })
      .mockResolvedValueOnce(success);
    const scheduler = new SyncScheduler(run);
    await scheduler.syncNow();
    expect(scheduler.status().phase).toBe("error");
    await scheduler.syncNow();
    expect(scheduler.status()).toMatchObject({ phase: "idle", report: success });
    await scheduler.stop();
  });

  it("aborts work when stopped", async () => {
    let runningSignal: AbortSignal | undefined;
    const scheduler = new SyncScheduler(async (signal) => {
      runningSignal = signal;
      return new Promise<SyncReport>((_, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    const round = scheduler.syncNow();
    await scheduler.stop();
    await round;
    expect(runningSignal?.aborted).toBe(true);
  });

  it("returns from stop after five seconds when work ignores abort", async () => {
    vi.useFakeTimers();
    const scheduler = new SyncScheduler(async () => new Promise<SyncReport>(() => {}));
    void scheduler.syncNow();
    let stopped = false;
    const stopping = scheduler.stop().then(() => { stopped = true; });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(stopped).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(stopped).toBe(true);
    await stopping;
  });

  it("does not overlap a watchdog retry with work that has not settled", async () => {
    vi.useFakeTimers();
    const store = new FakeS3();
    let finishStale!: () => void;
    store.getObject = () => new Promise((resolve) => { finishStale = () => resolve(null); });
    const run = vi.fn()
      .mockImplementationOnce(async (signal: AbortSignal) => {
        await store.getObject("sync-header", signal);
        return { ...success, pulled: 99 };
      })
      .mockResolvedValueOnce(success);
    const scheduler = new SyncScheduler(run, { retryBaseMs: 10 });
    const first = scheduler.syncNow();
    expect(scheduler.status().phase).toBe("syncing");
    await vi.advanceTimersByTimeAsync(180_000);
    expect(scheduler.status()).toMatchObject({ phase: "error", error: "timeout" });
    await first;
    await vi.advanceTimersByTimeAsync(10);
    expect(run).toHaveBeenCalledTimes(1);
    await scheduler.syncNow();
    expect(run).toHaveBeenCalledTimes(1);
    finishStale();
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.status()).toMatchObject({ phase: "idle", report: success });
    expect(run).toHaveBeenCalledTimes(2);
    expect(scheduler.status().report?.pulled).toBe(1);
    await scheduler.stop();
  });

  it("keeps a progressing round alive past ten minutes and publishes bounded progress updates", async () => {
    vi.useFakeTimers();
    let finish!: (report: SyncReport) => void;
    let activity!: (progress?: { phase: "pull" | "push"; completed: number; total: number }) => void;
    const scheduler = new SyncScheduler((_signal, pulse) => {
      activity = pulse;
      return new Promise<SyncReport>((resolve) => { finish = resolve; });
    });
    const round = scheduler.syncNow();
    for (let minute = 1; minute <= 12; minute++) {
      await vi.advanceTimersByTimeAsync(60_000);
      activity({ phase: "push", completed: minute, total: 12 });
      expect(scheduler.status().phase).toBe("syncing");
    }
    expect(scheduler.status().progress).toEqual({ phase: "push", completed: 12, total: 12 });
    finish(success);
    await round;
    expect(scheduler.status().phase).toBe("idle");
    expect(scheduler.status().progress).toBeUndefined();
    await scheduler.stop();
  });

  it("aborts a round after three minutes without progress or a completed request", async () => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    const scheduler = new SyncScheduler((runningSignal) => {
      signal = runningSignal;
      return new Promise<SyncReport>(() => {});
    });
    const round = scheduler.syncNow();
    await vi.advanceTimersByTimeAsync(179_999);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await round;
    expect(signal.aborted).toBe(true);
    expect(scheduler.status()).toMatchObject({ phase: "error", error: "timeout" });
    const stopping = scheduler.stop();
    await vi.advanceTimersByTimeAsync(5_000);
    await stopping;
  });

  it("uses completed requests to keep a round alive before object progress exists", async () => {
    vi.useFakeTimers();
    let finish!: (report: SyncReport) => void;
    let activity!: (progress?: { phase: "pull" | "push"; completed: number; total: number }) => void;
    const scheduler = new SyncScheduler((_signal, pulse) => {
      activity = pulse;
      return new Promise<SyncReport>((resolve) => { finish = resolve; });
    });
    const round = scheduler.syncNow();
    await vi.advanceTimersByTimeAsync(120_000);
    activity();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(scheduler.status().phase).toBe("syncing");
    finish(success);
    await round;
    await scheduler.stop();
  });

  it("aborts even a progressing round at the six-hour cap", async () => {
    vi.useFakeTimers();
    let activity!: () => void;
    let signal!: AbortSignal;
    const scheduler = new SyncScheduler((runningSignal, pulse) => {
      signal = runningSignal;
      activity = pulse;
      return new Promise<SyncReport>(() => {});
    });
    const round = scheduler.syncNow();
    for (let interval = 1; interval < 180; interval++) {
      await vi.advanceTimersByTimeAsync(120_000);
      activity();
      expect(signal.aborted).toBe(false);
    }
    await vi.advanceTimersByTimeAsync(120_000);
    await round;
    expect(signal.aborted).toBe(true);
    expect(scheduler.status().error).toBe("timeout");
    const stopping = scheduler.stop();
    await vi.advanceTimersByTimeAsync(5_000);
    await stopping;
  });

  it("limits status notifications to about four progress updates per second", async () => {
    vi.useFakeTimers();
    let activity!: (progress?: { phase: "pull" | "push"; completed: number; total: number }) => void;
    let finish!: (report: SyncReport) => void;
    const scheduler = new SyncScheduler((_signal, pulse) => {
      activity = pulse;
      return new Promise<SyncReport>((resolve) => { finish = resolve; });
    });
    let updates = 0;
    scheduler.subscribe(() => { updates++; });
    const round = scheduler.syncNow();
    for (let count = 1; count <= 20; count++) {
      activity({ phase: "push", completed: count, total: 100 });
      await vi.advanceTimersByTimeAsync(10);
    }
    expect(updates).toBeLessThanOrEqual(2);
    await vi.advanceTimersByTimeAsync(50);
    activity({ phase: "push", completed: 21, total: 100 });
    expect(scheduler.status().progress?.completed).toBe(20);
    await vi.advanceTimersByTimeAsync(250);
    expect(scheduler.status().progress?.completed).toBe(21);
    finish(success);
    await round;
    await scheduler.stop();
  });

  it("publishes the latest incomplete progress after the throttle window", async () => {
    vi.useFakeTimers();
    let activity!: (progress?: { phase: "pull" | "push"; completed: number; total: number }) => void;
    let finish!: (report: SyncReport) => void;
    const scheduler = new SyncScheduler((_signal, pulse) => {
      activity = pulse;
      return new Promise<SyncReport>((resolve) => { finish = resolve; });
    });
    const round = scheduler.syncNow();
    activity({ phase: "push", completed: 1, total: 10 });
    await vi.advanceTimersByTimeAsync(10);
    activity({ phase: "push", completed: 2, total: 10 });
    await vi.advanceTimersByTimeAsync(10);
    activity({ phase: "push", completed: 3, total: 10 });
    expect(scheduler.status().progress?.completed).toBe(1);
    await vi.advanceTimersByTimeAsync(230);
    expect(scheduler.status().progress?.completed).toBe(3);
    finish(success);
    await round;
    await scheduler.stop();
  });
});
