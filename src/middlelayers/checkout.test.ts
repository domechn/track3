import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutFlow, checkoutPendingKey } from "./checkout";
import type { LicenseCenter } from "./license";

const session = { sessionId: "cs_test_123", url: "https://checkout.stripe.test/session" };
let status: ReturnType<typeof vi.fn>;
let create: ReturnType<typeof vi.fn>;
let open: ReturnType<typeof vi.fn>;
let activate: ReturnType<typeof vi.fn>;
let states: string[];
let flow: CheckoutFlow;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.setSystemTime(new Date("2026-10-26T00:00:00Z"));
  status = vi.fn().mockResolvedValue({ status: "pending" });
  create = vi.fn().mockResolvedValue(session);
  open = vi.fn().mockResolvedValue(undefined);
  activate = vi.fn().mockResolvedValue(undefined);
  states = [];
  flow = new CheckoutFlow({ createCheckoutSession: create, getCheckoutStatus: status } as Pick<LicenseCenter, "createCheckoutSession" | "getCheckoutStatus">,
    open as (url: string) => Promise<void>, activate as (license: string) => Promise<void>,
    (state) => states.push(state), localStorage);
});

afterEach(() => {
  flow.dispose();
  vi.useRealTimers();
});

describe("CheckoutFlow", () => {
  it("opens checkout, waits through pending, then activates a completed license once", async () => {
    status.mockResolvedValueOnce({ status: "pending" }).mockResolvedValue({ status: "completed", license: "secret-license" });
    await flow.start("yearly");
    expect(open).toHaveBeenCalledWith(session.url);
    expect(states).toContain("waiting");
    expect(JSON.parse(localStorage.getItem(checkoutPendingKey)!)).toEqual({
      sessionId: session.sessionId, url: session.url, planType: "yearly", createdAt: Date.now(), dismissed: false,
    });
    await vi.advanceTimersByTimeAsync(3000);
    expect(activate).toHaveBeenCalledExactlyOnceWith("secret-license");
    expect(states.at(-1)).toBe("completed");
    expect(localStorage.getItem(checkoutPendingKey)).toBeNull();
    flow.checkAgain();
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it("ends an expired checkout and clears its pending record", async () => {
    status.mockResolvedValue({ status: "expired" });
    await flow.start("monthly");
    expect(states.at(-1)).toBe("expired");
    expect(localStorage.getItem(checkoutPendingKey)).toBeNull();
    expect(activate).not.toHaveBeenCalled();
  });

  it("aborts polling on cancel without losing the recovery record", async () => {
    await flow.start("monthly");
    flow.cancel();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(status).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBe("idle");
    expect(localStorage.getItem(checkoutPendingKey)).not.toBeNull();
  });

  it("reopens checkout after Cancel without resuming it automatically", async () => {
    await flow.start("monthly");
    flow.cancel();
    await flow.resume();
    expect(states.at(-1)).toBe("idle");
    expect(status).toHaveBeenCalledTimes(1);
    await flow.start("monthly");
    expect(open).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBe("waiting");
  });

  it("uses the newly selected plan after Cancel", async () => {
    await flow.start("monthly");
    flow.cancel();
    await flow.start("yearly");
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenNthCalledWith(1, "monthly");
    expect(create).toHaveBeenCalledWith("yearly");
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("keeps a late created session recoverable after Cancel", async () => {
    let finish!: (value: typeof session) => void;
    create.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const starting = flow.start("monthly");
    flow.cancel();
    finish(session);
    await starting;
    expect(localStorage.getItem(checkoutPendingKey)).not.toBeNull();
    expect(open).not.toHaveBeenCalled();
    await flow.resume();
    expect(status).not.toHaveBeenCalled();
    await flow.start("monthly");
    expect(open).toHaveBeenCalledWith(session.url);
  });

  it("keeps a late created session available after leaving the page", async () => {
    let finish!: (value: typeof session) => void;
    create.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const starting = flow.start("monthly");
    flow.dispose();
    finish(session);
    await starting;
    expect(localStorage.getItem(checkoutPendingKey)).not.toBeNull();
    const next = new CheckoutFlow({ createCheckoutSession: create, getCheckoutStatus: status } as Pick<LicenseCenter, "createCheckoutSession" | "getCheckoutStatus">,
      open as (url: string) => Promise<void>, activate as (license: string) => Promise<void>,
      (state) => states.push(state), localStorage);
    await next.resume();
    expect(status).toHaveBeenCalledWith(session.sessionId);
    next.dispose();
  });

  it("discards pending checkout when a license is restored manually", async () => {
    await flow.start("monthly");
    flow.clearPending();
    await flow.resume();
    expect(localStorage.getItem(checkoutPendingKey)).toBeNull();
    expect(status).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBe("idle");
  });

  it("does not recreate pending checkout when manual restore wins a creation race", async () => {
    let finish!: (value: typeof session) => void;
    create.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const starting = flow.start("monthly");
    flow.clearPending();
    finish(session);
    await starting;
    expect(localStorage.getItem(checkoutPendingKey)).toBeNull();
  });

  it("ignores a late response from a cancelled run after checking again", async () => {
    let finishOld!: (value: { status: "completed"; license: string }) => void;
    let finishCurrent!: (value: { status: "pending" }) => void;
    status.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { finishCurrent = resolve; }))
      .mockResolvedValue({ status: "pending" });
    const first = flow.start("monthly");
    await vi.advanceTimersByTimeAsync(0);
    flow.cancel();
    const second = flow.start("monthly");
    await vi.advanceTimersByTimeAsync(0);
    finishOld({ status: "completed", license: "stale-license" });
    await first;
    flow.checkAgain();
    expect(status).toHaveBeenCalledTimes(2);
    finishCurrent({ status: "pending" });
    await second;
    await vi.advanceTimersByTimeAsync(0);
    expect(activate).not.toHaveBeenCalled();
    expect(states.at(-1)).toBe("waiting");
  });

  it("stops automatic polling after ten minutes while retaining recovery", async () => {
    await flow.start("monthly");
    await vi.advanceTimersByTimeAsync(600_000);
    expect(states.at(-1)).toBe("timed-out");
    expect(localStorage.getItem(checkoutPendingKey)).not.toBeNull();
  });

  it("resumes a recent checkout without opening another browser or creating a session", async () => {
    localStorage.setItem(checkoutPendingKey, JSON.stringify({ sessionId: "cs_old", createdAt: Date.now() }));
    status.mockResolvedValue({ status: "completed", license: "restored-license" });
    await flow.resume();
    expect(status).toHaveBeenCalledWith("cs_old");
    expect(open).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(activate).toHaveBeenCalledExactlyOnceWith("restored-license");
  });

  it("drops a pending checkout after 24 hours", async () => {
    localStorage.setItem(checkoutPendingKey, JSON.stringify({ sessionId: "cs_old", createdAt: Date.now() - 86_400_001 }));
    await flow.resume();
    expect(status).not.toHaveBeenCalled();
    expect(localStorage.getItem(checkoutPendingKey)).toBeNull();
  });

  it("starts a fresh checkout if a saved browser URL is unsafe", async () => {
    localStorage.setItem(checkoutPendingKey, JSON.stringify({
      sessionId: "cs_old", url: "javascript:alert(1)", planType: "monthly", createdAt: Date.now(),
    }));
    await flow.start("monthly");
    expect(open).toHaveBeenCalledWith(session.url);
    expect(create).toHaveBeenCalledExactlyOnceWith("monthly");
    expect(states.at(-1)).toBe("waiting");
  });

  it("backs off after network errors, then accepts a manual check", async () => {
    status.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "completed", license: "secret-license" });
    await flow.start("monthly");
    expect(states.at(-1)).toBe("waiting");
    await vi.advanceTimersByTimeAsync(2999);
    expect(status).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(status).toHaveBeenCalledTimes(2);
    flow.checkAgain();
    await vi.advanceTimersByTimeAsync(0);
    expect(activate).toHaveBeenCalledExactlyOnceWith("secret-license");
  });

  it("can retry checkout when the system browser fails to open", async () => {
    open.mockRejectedValueOnce(new Error("opener failed")).mockResolvedValue(undefined);
    await flow.start("yearly");
    expect(states.at(-1)).toBe("error");
    expect(localStorage.getItem(checkoutPendingKey)).toBeNull();
    flow.checkAgain();
    await vi.advanceTimersByTimeAsync(0);
    expect(create).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toBe("waiting");
  });

  it("does not open a non-HTTPS checkout URL", async () => {
    create.mockResolvedValue({ sessionId: "cs_test_123", url: "javascript:alert(1)" });
    await flow.start("monthly");
    expect(open).not.toHaveBeenCalled();
    expect(states.at(-1)).toBe("error");
    expect(localStorage.getItem(checkoutPendingKey)).toBeNull();
  });

  it("keeps a completed session recoverable if local activation fails", async () => {
    status.mockResolvedValue({ status: "completed", license: "secret-license" });
    activate.mockRejectedValueOnce(new Error("write failed")).mockResolvedValue(undefined);
    await flow.start("yearly");
    expect(states.at(-1)).toBe("error");
    expect(localStorage.getItem(checkoutPendingKey)).not.toBeNull();
    await flow.resume();
    expect(states.at(-1)).toBe("completed");
    expect(activate).toHaveBeenCalledTimes(2);
  });

  it("passes a redacted device-limit error to the checkout UI", async () => {
    status.mockResolvedValue({ status: "completed", license: "secret-license" });
    activate.mockRejectedValue(new Error("secret-license is active on 3 devices"));
    let shownError: string | undefined;
    flow.dispose();
    flow = new CheckoutFlow({ createCheckoutSession: create, getCheckoutStatus: status } as Pick<LicenseCenter, "createCheckoutSession" | "getCheckoutStatus">,
      open as (url: string) => Promise<void>, activate as (license: string) => Promise<void>,
      (phase, error) => { states.push(phase); shownError = error; }, localStorage);
    await flow.start("monthly");
    expect(states.at(-1)).toBe("error");
    expect(shownError).toBe("<REDACTED> is active on 3 devices");
  });
});
