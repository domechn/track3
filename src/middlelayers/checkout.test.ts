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
      sessionId: session.sessionId, createdAt: Date.now(),
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

  it("ignores a late response from a cancelled run after checking again", async () => {
    let finishOld!: (value: { status: "completed"; license: string }) => void;
    let finishCurrent!: (value: { status: "pending" }) => void;
    status.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { finishCurrent = resolve; }))
      .mockResolvedValue({ status: "pending" });
    const first = flow.start("monthly");
    await vi.advanceTimersByTimeAsync(0);
    flow.cancel();
    const second = flow.resume();
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
});
