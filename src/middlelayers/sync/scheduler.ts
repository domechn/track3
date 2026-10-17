import type { SyncReport } from "./engine";
import { classifySyncError, type SyncConnectionResult } from "./settings";

export type SyncStatus = {
  phase: "idle" | "syncing" | "error";
  report?: SyncReport;
  lastSync?: number;
  error?: Exclude<SyncConnectionResult, "ok"> | "sync";
  retryStopped?: boolean;
};

export class SyncScheduler {
  private readonly controller = new AbortController();
  private readonly listeners = new Set<() => void>();
  private current?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private lastFocus = -Infinity;
  private failures = 0;
  private stopped = false;
  private pending = false;
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
    this.setStatus({ ...this.state, phase: "syncing", error: undefined, retryStopped: false });
    const work = (async () => {
      try {
        const report = await this.run(this.controller.signal);
        if (this.stopped) return;
        if (report.errors.length) {
          this.fail("sync", report);
        } else {
          this.failures = 0;
          this.setStatus({ phase: "idle", report, lastSync: Date.now() });
        }
      } catch (error) {
        if (!this.stopped) this.fail(
          error instanceof Error && error.message === "Sync has not been initialized"
            ? "header" : classifySyncError(error),
        );
      } finally {
        this.current = undefined;
        if (this.pending && !this.stopped) {
          this.pending = false;
          if (!this.failures) void this.runNow();
        }
      }
    })();
    this.current = work;
    return work;
  }

  private fail(error: Exclude<SyncConnectionResult, "ok"> | "sync", report?: SyncReport): void {
    this.setStatus({ ...this.state, phase: "error", report, error });
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

  stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.controller.abort();
    return this.current ?? Promise.resolve();
  }
}
