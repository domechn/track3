import type { SyncProgress, SyncReport } from "./engine";
import { classifySyncError, type SyncConnectionResult, type SyncRetryState } from "./settings";
import { SyncTimeoutError } from "./object-store";
import type { SyncDiagnostics } from "./diagnostics";

export const SYNC_IDLE_TIMEOUT_MS = 3 * 60_000;
export const SYNC_RUN_TIMEOUT_MS = 6 * 60 * 60_000;
export const SYNC_STOP_GRACE_MS = 5_000;

export type SyncStatus = {
  phase: "idle" | "syncing" | "error";
  report?: SyncReport;
  lastSync?: number;
  startedAt?: number;
  progress?: SyncProgress;
  error?: Exclude<SyncConnectionResult, "ok"> | "sync";
  retryStopped?: boolean;
  diagnostics?: SyncDiagnostics;
  failures?: number;
  nextRetryAt?: number;
  partial?: boolean;
};

const RETRY_DELAYS_MS = [5_000, 30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000];
const HARD_ERRORS = ["header", "passphrase", "access", "configuration"];

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
  private lastErrors?: string;
  private retryPersisted = false;
  private readonly delays: number[];

  constructor(
    private readonly run: (signal: AbortSignal, activity: (progress?: SyncProgress) => void, onDiagnostics: (diagnostics: SyncDiagnostics) => void) => Promise<SyncReport>,
    private readonly options: {
      debounceMs?: number; focusThrottleMs?: number; retryDelaysMs?: number[]; random?: () => number;
      retry?: SyncRetryState; onRetryState?: (retry?: SyncRetryState) => void;
    } = {},
  ) {
    this.delays = options.retryDelaysMs ?? RETRY_DELAYS_MS;
    const retry = options.retry;
    if (!retry) return;
    this.retryPersisted = true;
    const longest = this.delays[this.delays.length - 1] ?? 0;
    const error = retry.error ?? "sync";
    if (retry.stopped) {
      // A restart long after the pause gets one probe round, never a new burst.
      this.failures = this.delays.length;
      if (Date.now() - retry.lastFailureAt < longest) {
        this.state = { phase: "error", error, failures: retry.failures, retryStopped: true };
      }
      return;
    }
    this.failures = Math.max(0, Math.min(Math.floor(retry.failures) || 0, this.delays.length));
    const wait = Math.min((retry.nextRetryAt ?? 0) - Date.now(), longest);
    if (wait <= 0) return;
    this.state = { phase: "error", error, failures: this.failures, nextRetryAt: Date.now() + wait };
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.runNow();
    }, wait);
  }

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
    if (this.state.phase === "error" && HARD_ERRORS.includes(this.state.error ?? "")) return;
    // Only Sync now, a settings change, or a successful round ends the pause.
    if (this.state.retryStopped) return;
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
    if (!this.current) {
      this.failures = 0;
      this.lastErrors = undefined;
    }
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
    this.setStatus({ ...this.state, phase: "syncing", startedAt: Date.now(), progress: undefined, error: undefined, retryStopped: false, nextRetryAt: undefined });
    const work = (async () => {
      let idleWatchdog: ReturnType<typeof setTimeout> | undefined;
      let absoluteWatchdog: ReturnType<typeof setTimeout> | undefined;
      let onAbort: () => void = () => {};
      let run: Promise<SyncReport> | undefined;
      let settled = false;
      let lastPublished = -Infinity;
      let pendingProgress: SyncProgress | undefined;
      let progressTimer: ReturnType<typeof setTimeout> | undefined;
      let reportActivity: (progress?: SyncProgress) => void = () => {};
      try {
        const timedOut = new Promise<never>((_, reject) => {
          const timeout = () => {
            reject(new SyncTimeoutError());
            controller.abort();
          };
          const resetIdle = () => {
            if (idleWatchdog) clearTimeout(idleWatchdog);
            idleWatchdog = setTimeout(timeout, SYNC_IDLE_TIMEOUT_MS);
          };
          const publishProgress = () => {
            if (this.stopped || runId !== this.runId || controller.signal.aborted || settled || !pendingProgress) return;
            lastPublished = Date.now();
            this.setStatus({ ...this.state, progress: pendingProgress });
            pendingProgress = undefined;
          };
          const activity = (progress?: SyncProgress) => {
            if (this.stopped || runId !== this.runId || controller.signal.aborted || settled) return;
            resetIdle();
            if (progress) {
              pendingProgress = progress;
              if (Date.now() - lastPublished >= 250 || progress.completed === progress.total) {
                if (progressTimer) clearTimeout(progressTimer);
                progressTimer = undefined;
                publishProgress();
              } else if (!progressTimer) {
                progressTimer = setTimeout(() => {
                  progressTimer = undefined;
                  publishProgress();
                }, 250 - (Date.now() - lastPublished));
              }
            }
          };
          resetIdle();
          absoluteWatchdog = setTimeout(timeout, SYNC_RUN_TIMEOUT_MS);
          reportActivity = activity;
        });
        const cancelled = new Promise<never>((_, reject) => {
          onAbort = () => reject(new Error("Sync aborted"));
          controller.signal.addEventListener("abort", onAbort, { once: true });
        });
        try {
          run = this.run(controller.signal, reportActivity, (diagnostics) => {
            if (!this.stopped && runId === this.runId) {
              this.setStatus({ ...this.state, diagnostics });
            }
          });
        } catch (error) {
          run = Promise.reject(error);
        }
        this.runSettled = run;
        void run.then(() => { settled = true; }, () => { settled = true; });
        const report = await Promise.race([run, timedOut, cancelled]);
        if (this.stopped || runId !== this.runId) return;
        const errors = [...report.errors].sort().join("\n");
        const progress = report.pulled + report.pushed + report.tombstonesApplied + report.configChanges > 0;
        if (errors && !progress) {
          const persistent = errors === this.lastErrors;
          this.lastErrors = errors;
          this.fail("sync", report, persistent);
        } else {
          // Rounds that moved data or only skipped parked objects end idle with a warning instead of retrying.
          this.failures = 0;
          this.lastErrors = undefined;
          this.setStatus({
            phase: "idle", report, diagnostics: report.diagnostics ?? this.state.diagnostics,
            lastSync: errors ? this.state.lastSync : Date.now(),
            ...(errors || report.skipped ? { partial: true } : {}),
          });
          if (this.retryPersisted) {
            this.retryPersisted = false;
            this.options.onRetryState?.();
          }
        }
      } catch (error) {
        if (!this.stopped && runId === this.runId) this.fail(
          error instanceof Error && error.message === "Sync has not been initialized"
            ? "header" : classifySyncError(error),
        );
      } finally {
        if (idleWatchdog) clearTimeout(idleWatchdog);
        if (absoluteWatchdog) clearTimeout(absoluteWatchdog);
        if (progressTimer) clearTimeout(progressTimer);
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

  private fail(error: Exclude<SyncConnectionResult, "ok"> | "sync", report?: SyncReport, persistent = false): void {
    const hard = HARD_ERRORS.includes(error);
    if (!hard) this.failures++;
    const delay = hard || persistent ? undefined : this.delays[this.failures - 1];
    const now = Date.now();
    const nextRetryAt = delay === undefined ? undefined
      : now + Math.round(delay * (0.8 + 0.4 * (this.options.random ?? Math.random)()));
    const retryStopped = !hard && !nextRetryAt;
    if (!nextRetryAt) this.pending = false;
    this.setStatus({
      ...this.state, phase: "error", startedAt: undefined, progress: undefined, report, error,
      partial: undefined, failures: this.failures, nextRetryAt, retryStopped,
    });
    if (hard) return;
    this.retryPersisted = true;
    this.options.onRetryState?.({
      failures: this.failures, lastFailureAt: now, error,
      ...(nextRetryAt ? { nextRetryAt } : { stopped: true }),
    });
    if (!nextRetryAt) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.runNow();
    }, nextRetryAt - now);
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

  async waitForSettlement(): Promise<void> {
    await this.runSettled?.catch(() => {});
  }
}
