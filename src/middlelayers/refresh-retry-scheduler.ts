import type { PortfolioSourceStatus } from "./portfolio-baseline";
import { FullRefreshRequiredError } from "./refresh-error";

const delays = [60_000, 5 * 60_000, 15 * 60_000];
const retryable = new Set(["network", "service", "rateLimit", "other"]);
export const RETRY_ENABLED_KEY = "track3-auto-retry-failed-sources";

export function readAutoRetryEnabled(): boolean {
  try { return localStorage.getItem(RETRY_ENABLED_KEY) !== "false"; } catch { return true; }
}

export class RefreshRetryScheduler {
  private entries = new Map<string, { attempts: number; nextAt: number }>();
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private active = false;
  private running = false;
  private stopped = false;
  private lastStatuses: PortfolioSourceStatus[] = [];
  private exhaustedSources = new Set<string>();
  private enabled = readAutoRetryEnabled();
  private snapshot = { nextBySource: {} as Record<string, number>, stopped: false, enabled: this.enabled };

  constructor(
    private readonly run: (sourceId: string) => Promise<PortfolioSourceStatus[] | null | undefined>,
    private readonly canRun: () => boolean,
  ) {}

  status = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private publish() {
    this.snapshot = { nextBySource: this.enabled
      ? Object.fromEntries([...this.entries].map(([id, entry]) => [id, entry.nextAt])) : {},
      stopped: this.enabled && this.stopped, enabled: this.enabled };
    for (const listener of this.listeners) listener();
  }

  private onWake = () => this.poke();

  start(): void {
    if (this.active) return;
    this.active = true;
    document.addEventListener("visibilitychange", this.onWake);
    window.addEventListener("online", this.onWake);
    window.addEventListener("focus", this.onWake);
    this.poke();
  }

  dispose(): void {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    document.removeEventListener("visibilitychange", this.onWake);
    window.removeEventListener("online", this.onWake);
    window.removeEventListener("focus", this.onWake);
  }

  setEnabled(enabled: boolean): void {
    const wasEnabled = this.enabled;
    this.enabled = enabled;
    try { localStorage.setItem(RETRY_ENABLED_KEY, String(enabled)); } catch { /* Session choice remains active. */ }
    if (enabled && !wasEnabled && !this.stopped && !this.entries.size) this.complete(this.lastStatuses);
    this.publish();
    this.poke();
  }

  manualStart(): void {
    this.entries.clear();
    this.lastStatuses = [];
    this.exhaustedSources.clear();
    this.stopped = false;
    this.publish();
    this.poke();
  }

  stop(): void {
    this.entries.clear();
    this.stopped = true;
    this.publish();
    this.poke();
  }

  complete(statuses: PortfolioSourceStatus[]): void {
    this.lastStatuses = statuses;
    if (this.stopped || !this.enabled) return;
    const failed = statuses.filter((source) => (source.status === "stale" || source.status === "failed") &&
      retryable.has(source.category ?? "other"));
    const ids = new Set(failed.map((source) => source.sourceId));
    for (const id of this.entries.keys()) if (!ids.has(id)) this.entries.delete(id);
    for (const source of failed) {
      if (this.entries.has(source.sourceId)) continue;
      const finished = Date.parse(source.finishedAt ?? "");
      this.entries.set(source.sourceId, { attempts: 0, nextAt: Math.max(Date.now(), Number.isFinite(finished) ? finished : Date.now()) + delays[0] });
    }
    this.publish();
    this.poke();
  }

  poke(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.active || !this.enabled || this.stopped || this.running || !this.entries.size) return;
    const nextAt = Math.min(...[...this.entries.values()].map((entry) => entry.nextAt));
    if (nextAt <= Date.now()) {
      if (document.visibilityState === "hidden" || !navigator.onLine) return;
      if (!this.canRun()) {
        this.timer = setTimeout(this.onWake, 5_000);
        return;
      }
      const due = [...this.entries].find(([, entry]) => entry.nextAt <= Date.now());
      if (due) void this.trySource(due[0], due[1]);
    } else {
      this.timer = setTimeout(this.onWake, nextAt - Date.now());
    }
  }

  private async trySource(id: string, entry: { attempts: number; nextAt: number }): Promise<void> {
    this.running = true;
    let deferred = false;
    entry.attempts += 1;
    try {
      const statuses = await this.run(id);
      if (statuses === undefined) {
        deferred = true;
        entry.attempts -= 1;
      } else if (statuses === null) {
        this.entries.delete(id);
      } else {
        this.lastStatuses = statuses;
        const source = statuses.find((status) => status.sourceId === id);
        if (!source || (source.status !== "stale" && source.status !== "failed") || !retryable.has(source.category ?? "other")) {
          this.entries.delete(id);
          this.exhaustedSources.delete(id);
        }
      }
    } catch (error) {
      if (error instanceof FullRefreshRequiredError) this.stop();
    } finally {
      if (deferred) {
        this.running = false;
        this.timer = setTimeout(this.onWake, 5_000);
        return;
      }
      if (!this.stopped && this.entries.get(id) === entry) {
        if (entry.attempts >= delays.length) {
          this.exhaustedSources.add(id);
          this.entries.delete(id);
        }
        else entry.nextAt = Date.now() + delays[entry.attempts];
      }
      if (!this.stopped && !this.entries.size && this.exhaustedSources.size) this.stopped = true;
      this.running = false;
      this.publish();
      this.poke();
    }
  }
}

let activeRun: ((sourceId: string) => Promise<PortfolioSourceStatus[] | null | undefined>) | undefined;
let activeCanRun: (() => boolean) | undefined;
export const refreshRetryScheduler = new RefreshRetryScheduler(
  (id) => activeRun?.(id) ?? Promise.resolve(undefined),
  () => activeCanRun?.() === true,
);
export function bindRefreshRetry(
  run: (sourceId: string) => Promise<PortfolioSourceStatus[] | null | undefined>, canRun: () => boolean,
): () => void {
  activeRun = run;
  activeCanRun = canRun;
  refreshRetryScheduler.start();
  return () => {
    activeRun = undefined;
    activeCanRun = undefined;
    refreshRetryScheduler.dispose();
  };
}
