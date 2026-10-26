import type { LicenseCenter } from "./license";
import { redactSecrets } from "./security/redact";

export const checkoutPendingKey = "track3-pending-checkout";
const PENDING_LIFETIME_MS = 24 * 60 * 60 * 1000;
const POLLING_LIMIT_MS = 10 * 60 * 1000;

export type CheckoutPhase = "idle" | "starting" | "waiting" | "completed" | "expired" | "timed-out" | "error";

type CheckoutApi = Pick<LicenseCenter, "createCheckoutSession" | "getCheckoutStatus">;
type PendingCheckout = { sessionId: string; createdAt: number; url?: string; planType?: "monthly" | "yearly"; dismissed?: boolean };

export class CheckoutFlow {
  private phase: CheckoutPhase = "idle";
  private sessionId?: string;
  private lastPlan?: "monthly" | "yearly";
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private inFlightGeneration?: number;
  private queued = false;
  private failures = 0;
  private startedAt = 0;
  private latestStartGeneration = 0;
  private dismissedGeneration = 0;

  constructor(
    private readonly api: CheckoutApi,
    private readonly open: (url: string) => Promise<void>,
    private readonly activate: (license: string) => Promise<void>,
    private readonly onState: (phase: CheckoutPhase, error?: string) => void,
    private readonly storage: Storage = localStorage,
  ) {}

  private setPhase(phase: CheckoutPhase, error?: string) {
    this.phase = phase;
    this.onState(phase, error);
  }

  private readPending(): PendingCheckout | undefined {
    try {
      const raw = this.storage.getItem(checkoutPendingKey);
      if (!raw) return;
      const value = JSON.parse(raw) as PendingCheckout;
      if (typeof value.sessionId === "string" && value.sessionId.length > 0 &&
        (value.url === undefined || (typeof value.url === "string" && new URL(value.url).protocol === "https:")) &&
        Number.isFinite(value.createdAt) && value.createdAt <= Date.now() &&
        Date.now() - value.createdAt < PENDING_LIFETIME_MS) return value;
    } catch {
      // A damaged record should not prevent checkout.
    }
    this.storage.removeItem(checkoutPendingKey);
  }

  private async begin(sessionId: string) {
    this.sessionId = sessionId;
    this.startedAt = Date.now();
    this.failures = 0;
    const generation = ++this.generation;
    this.setPhase("waiting");
    await this.tick(generation);
  }

  async start(planType: "monthly" | "yearly") {
    if (this.phase === "starting" || this.phase === "waiting") return;
    this.lastPlan = planType;
    const pending = this.readPending();
    this.setPhase("starting");
    const generation = ++this.generation;
    this.latestStartGeneration = generation;
    try {
      if (pending?.planType === planType && pending.url) {
        if (new URL(pending.url).protocol !== "https:") throw new Error("Invalid checkout URL");
        try {
          await this.open(pending.url);
        } catch (error) {
          if (generation === this.generation) this.storage.removeItem(checkoutPendingKey);
          throw error;
        }
        if (generation !== this.generation) return;
        this.storage.setItem(checkoutPendingKey, JSON.stringify({ ...pending, dismissed: false }));
        await this.begin(pending.sessionId);
        return;
      }
      const { sessionId, url } = await this.api.createCheckoutSession(planType);
      if (!sessionId || !url || new URL(url).protocol !== "https:") throw new Error("Invalid checkout session");
      if (generation !== this.latestStartGeneration) return;
      this.storage.setItem(checkoutPendingKey, JSON.stringify({
        sessionId, url, planType, createdAt: Date.now(), dismissed: generation === this.dismissedGeneration,
      } satisfies PendingCheckout));
      if (generation !== this.generation) return;
      try {
        await this.open(url);
      } catch (error) {
        if (generation === this.generation) this.storage.removeItem(checkoutPendingKey);
        throw error;
      }
      if (generation !== this.generation) return;
      await this.begin(sessionId);
    } catch {
      if (generation === this.generation) this.setPhase("error");
    }
  }

  async resume() {
    if (this.phase === "starting" || this.phase === "waiting") return;
    const pending = this.readPending();
    if (pending && !pending.dismissed) await this.begin(pending.sessionId);
  }

  private async tick(generation: number) {
    if (!this.sessionId || generation !== this.generation || this.inFlightGeneration === generation) return;
    if (Date.now() - this.startedAt >= POLLING_LIMIT_MS) {
      this.setPhase("timed-out");
      return;
    }
    this.inFlightGeneration = generation;
    try {
      const result = await this.api.getCheckoutStatus(this.sessionId);
      if (generation !== this.generation) return;
      if (result.status === "expired") {
        this.storage.removeItem(checkoutPendingKey);
        this.setPhase("expired");
        return;
      }
      if (result.status === "completed" && result.license) {
        try {
          await this.activate(result.license);
          if (generation !== this.generation) return;
          this.storage.removeItem(checkoutPendingKey);
          this.setPhase("completed");
        } catch (error) {
          if (generation === this.generation) {
            const message = error instanceof Error ? error.message : String(error);
            this.setPhase("error", redactSecrets(message, [result.license]));
          }
        }
        return;
      }
      this.failures = 0;
    } catch {
      if (generation !== this.generation) return;
      this.failures += 1;
    } finally {
      if (this.inFlightGeneration === generation) this.inFlightGeneration = undefined;
    }
    if (generation !== this.generation) return;
    const delay = this.queued ? 0 : Math.min(3000 * 2 ** Math.max(0, this.failures - 1), 30_000);
    this.queued = false;
    this.timer = setTimeout(() => void this.tick(generation), delay);
  }

  checkAgain() {
    if (this.phase === "error" || this.phase === "timed-out" || this.phase === "idle") {
      if (this.phase === "error" && !this.readPending() && this.lastPlan) {
        void this.start(this.lastPlan);
        return;
      }
      void this.resume();
      return;
    }
    if (this.phase !== "waiting") return;
    if (this.inFlightGeneration === this.generation) {
      this.queued = true;
      return;
    }
    clearTimeout(this.timer);
    void this.tick(this.generation);
  }

  cancel() {
    this.dismissedGeneration = this.generation;
    ++this.generation;
    clearTimeout(this.timer);
    this.inFlightGeneration = undefined;
    this.queued = false;
    const pending = this.readPending();
    if (pending) this.storage.setItem(checkoutPendingKey, JSON.stringify({ ...pending, dismissed: true }));
    this.setPhase("idle");
  }

  clearPending() {
    this.cancel();
    this.latestStartGeneration = 0;
    this.storage.removeItem(checkoutPendingKey);
  }

  dismiss() {
    this.setPhase("idle");
  }

  dispose() {
    ++this.generation;
    clearTimeout(this.timer);
    this.inFlightGeneration = undefined;
    this.phase = "idle";
  }
}
