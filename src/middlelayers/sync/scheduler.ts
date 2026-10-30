import type { SyncReport } from "./engine";
import { classifySyncError, type SyncConnectionResult } from "./settings";
import { SyncTimeoutError } from "./object-store";

// Bounds a whole sync, including database, crypto, and any transport that ignores abort.
export const SYNC_RUN_TIMEOUT_MS = 10 * 60_000;
export const SYNC_STOP_GRACE_MS = 5_000;

export type SyncStatus = {
  phase: "idle" | "syncing" | "error";
  report?: SyncReport;
  lastSync?: number;
  startedAt?: number;
  error?: Exclude<SyncConnectionResult, "ok"> | "sync";
  retryStopped?: boolean;
};

export class SyncScheduler {
  private controller?: AbortController;
  private runSettled?: Promise<SyncReport>;
  private readonly listeners = new Set<() => void>();
  private current?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private lastFocus = -Infinity;
  private failures = 0;
  private stopped = false;
  private pending = false;
  private runId = 0;
  private state: SyncStatus = { phase: "idle" };

  constructor(
    private readonly run: (signal: AbortSignal) => Promise<SyncReport>,
    private readonly options: { debounceMs?: number; focusThrottleMs?: number; retryBaseMs?: number } = {},
  ) {}

  status(): SyncStatus { return this.state; }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: SyncStatus): void {
    this.state = status;
    for (const listener of this.listeners) listener();
  }

  trigger(kind: "start" | "refresh" | "focus"): void {
    if (this.stopped) return;
    if (this.state.phase === "error" &&
        ["header", "passphrase", "access", "configuration"].includes(this.state.error ?? "")) return;
    if (this.state.retryStopped) {
      if (kind !== "refresh") return;
      this.failures = 0;
    }
    if (kind === "focus") {
      if (Date.now() - this.lastFocus < (this.options.focusThrottleMs ?? 60_000)) return;
      this.lastFocus = Date.now();
    }
    if (this.failures > 0 && this.timer) return;
    if (this.current) {
      this.pending = true;
      return;
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.runNow();
    }, this.options.debounceMs ?? 400);
  }

  syncNow(): Promise<void> {
    if (!this.current) this.failures = 0;
    return this.runNow();
  }

  private runNow(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.current) return this.current;
    if (this.runSettled) {
      this.pending = true;
      return Promise.resolve();
    }
    const runId = ++this.runId;
    const controller = new AbortController();
    this.controller = controller;
    this.setStatus({ ...this.state, phase: "syncing", startedAt: Date.now(), error: undefined, retryStopped: false });
    const work = (async () => {
      let watchdog: ReturnType<typeof setTimeout> | undefined;
      let onAbort: () => void = () => {};
      let run: Promise<SyncReport> | undefined;
      let settled = false;
      try {
        const timedOut = new Promise<never>((_, reject) => {
          watchdog = setTimeout(() => {
            reject(new SyncTimeoutError());
            controller.abort();
          }, SYNC_RUN_TIMEOUT_MS);
        });
        const cancelled = new Promise<never>((_, reject) => {
          onAbort = () => reject(new Error("Sync aborted"));
          controller.signal.addEventListener("abort", onAbort, { once: true });
        });
        try {
          run = this.run(controller.signal);
        } catch (error) {
          run = Promise.reject(error);
        }
        this.runSettled = run;
        void run.then(() => { settled = true; }, () => { settled = true; });
        const report = await Promise.race([run, timedOut, cancelled]);
        if (this.stopped || runId !== this.runId) return;
        if (report.errors.length) {
          this.fail("sync", report);
        } else {
          this.failures = 0;
          this.setStatus({ phase: "idle", report, lastSync: Date.now() });
        }
      } catch (error) {
        if (!this.stopped && runId === this.runId) this.fail(
          error instanceof Error && error.message === "Sync has not been initialized"
            ? "header" : classifySyncError(error),
        );
      } finally {
        if (watchdog) clearTimeout(watchdog);
        controller.signal.removeEventListener("abort", onAbort);
        if (runId === this.runId) {
          this.controller = undefined;
          this.current = undefined;
          if (settled) this.runSettled = undefined;
          else if (run) {
            const staleRun = run;
            void staleRun.then(
              () => this.staleRunSettled(staleRun),
              () => this.staleRunSettled(staleRun),
            );
          }
          if (this.pending && !this.stopped && !this.runSettled) {
            this.pending = false;
            if (!this.failures) void this.runNow();
          }
        }
      }
    })();
    this.current = work;
    return work;
  }

  private staleRunSettled(run: Promise<SyncReport>): void {
    if (this.runSettled !== run) return;
    this.runSettled = undefined;
    if (this.pending && !this.stopped && !this.current && !this.timer) {
      this.pending = false;
      void this.runNow();
    }
  }

  private fail(error: Exclude<SyncConnectionResult, "ok"> | "sync", report?: SyncReport): void {
    this.setStatus({ ...this.state, phase: "error", startedAt: undefined, report, error });
    if (["header", "passphrase", "access", "configuration"].includes(error)) {
      this.pending = false;
      return;
    }
    this.failures++;
    if (this.failures >= 5) {
      this.pending = false;
      this.setStatus({ ...this.state, retryStopped: true });
      return;
    }
    const delay = Math.min((this.options.retryBaseMs ?? 1_000) * 2 ** (this.failures - 1), 60_000);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.runNow();
    }, delay);
  }

  async stop(): Promise<boolean> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.runId++;
    const run = this.runSettled;
    this.controller?.abort();
    if (!run) return true;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        run.then(() => true, () => true),
        new Promise<boolean>((resolve) => { deadline = setTimeout(() => resolve(false), SYNC_STOP_GRACE_MS); }),
      ]);
    } finally {
      if (deadline) clearTimeout(deadline);
    }
  }
}
