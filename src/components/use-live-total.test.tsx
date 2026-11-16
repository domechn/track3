import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { liveTotalTransition, safeLiveTotalError, useLiveTotal } from "./use-live-total";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("moves from connecting to live and becomes stale after two missed intervals", async () => {
  vi.useFakeTimers();
  let resolve!: (value: number) => void;
  const load = vi.fn()
    .mockResolvedValueOnce(100)
    .mockImplementationOnce(() => new Promise<number>((done) => { resolve = done; }));
  const { result } = renderHook(() => useLiveTotal({ key: "stale-test", load, enabled: true, live: true, intervalMs: 1000 }));
  await act(async () => { await Promise.resolve(); });
  expect(result.current.state).toBe("live");
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(result.current.state).toBe("live");
  await act(async () => { await vi.advanceTimersByTimeAsync(1001); });
  expect(result.current.state).toBe("stale");
  expect(result.current.value).toBe(100);
  await act(async () => { resolve(120); await Promise.resolve(); });
  expect(result.current.state).toBe("live");
  expect(result.current.announcedValue).toBe(100);
});

it("keeps the session value while reconnecting and skips tween for hidden values or reduced motion", async () => {
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValueOnce(42).mockResolvedValueOnce(50);
  const { result, rerender } = renderHook(({ hideValues }) => useLiveTotal({
    key: "motion-test", load, enabled: true, live: true, intervalMs: 1000, hideValues,
  }), { initialProps: { hideValues: false } });
  await act(async () => { await Promise.resolve(); });
  expect(result.current.value).toBe(42);
  expect(result.current.animatedValue).toBe(42);
  rerender({ hideValues: true });
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(result.current.value).toBe(50);
  expect(result.current.animatedValue).toBe(50);
  expect(result.current.animate).toBe(false);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  rerender({ hideValues: false });
  expect(result.current.animate).toBe(false);
});

it("keeps the last known value for a remount in the same session", async () => {
  const load = vi.fn().mockResolvedValue(77);
  const first = renderHook(() => useLiveTotal({ key: "session-test", load, enabled: true, live: true, intervalMs: 60000 }));
  await act(async () => { await Promise.resolve(); });
  first.unmount();
  const second = renderHook(() => useLiveTotal({ key: "session-test", load: () => new Promise<number>(() => {}),
    enabled: true, live: true, intervalMs: 60000 }));
  expect(second.result.current.value).toBe(77);
  expect(second.result.current.state).toBe("connecting");
});

it("clears a period total when the selected period changes", async () => {
  const load = vi.fn().mockResolvedValueOnce(12).mockImplementationOnce(() => new Promise<number>(() => {}));
  const { result, rerender } = renderHook(({ key }) => useLiveTotal({
    key, load, enabled: true, live: false, intervalMs: 60_000,
  }), { initialProps: { key: "period-a" } });
  await act(async () => { await Promise.resolve(); });
  expect(result.current.value).toBe(12);
  rerender({ key: "period-b" });
  expect(result.current.value).toBeUndefined();
});

it("distinguishes an initial error, a stale cached value, and an off feed", () => {
  const initial = { state: "idle" as const, firstReveal: false };
  const connecting = liveTotalTransition(initial, { type: "start" });
  expect(connecting.state).toBe("connecting");
  expect(liveTotalTransition(connecting, { type: "error" }).state).toBe("error");
  const loaded = liveTotalTransition(connecting, { type: "success", value: 0, at: 1000, live: true });
  expect(loaded.state).toBe("live");
  expect(liveTotalTransition(loaded, { type: "start" }).state).toBe("live");
  expect(liveTotalTransition(loaded, { type: "error" }).state).toBe("stale");
  expect(liveTotalTransition(liveTotalTransition(loaded, { type: "error" }), { type: "start" }).state).toBe("connecting");
  expect(liveTotalTransition(loaded, { type: "off" }).state).toBe("off");
});

it("does no number tween when an in-flight update finishes in a hidden tab", async () => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  let finish!: (value: number) => void;
  const load = vi.fn().mockResolvedValueOnce(0)
    .mockImplementationOnce(() => new Promise<number>((resolve) => { finish = resolve; }));
  const raf = vi.spyOn(window, "requestAnimationFrame");
  const { result } = renderHook(() => useLiveTotal({
    key: "hidden-test", load, enabled: true, live: true, intervalMs: 1000,
  }));
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); finish(20); await Promise.resolve(); });
  expect(result.current.value).toBe(20);
  expect(result.current.animatedValue).toBe(20);
  expect(result.current.animate).toBe(false);
  expect(raf).not.toHaveBeenCalled();
});

it("animates a later update down to zero", async () => {
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValueOnce(20).mockResolvedValueOnce(0);
  const { result } = renderHook(() => useLiveTotal({
    key: "zero-tween-test", load, enabled: true, live: true, intervalMs: 1000,
  }));
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(result.current.value).toBe(0);
  expect(result.current.animate).toBe(true);
});

it("keeps a safe reason and retries failures at 5, 15, then 60 seconds", async () => {
  vi.useFakeTimers();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const load = vi.fn().mockRejectedValue(new Error("CoinGecko 429 token=abc123secret"));
  const { result } = renderHook(() => useLiveTotal({
    key: "retry-schedule-test", load, enabled: true, live: true, intervalMs: 10_000_000,
  }));
  await act(async () => { await Promise.resolve(); });
  expect(result.current.state).toBe("error");
  expect(result.current.error).toBe("rateLimited");
  expect(JSON.stringify(log.mock.calls)).toContain("Price service rate limited (HTTP 429)");
  expect(JSON.stringify(log.mock.calls)).not.toContain("abc123secret");
  await act(async () => { await vi.advanceTimersByTimeAsync(4_999); });
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(load).toHaveBeenCalledTimes(3);
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(load).toHaveBeenCalledTimes(4);
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(load).toHaveBeenCalledTimes(5);
});

it("retries now and clears the error after a success", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const load = vi.fn().mockRejectedValueOnce(new Error("stock price offline")).mockResolvedValue(42);
  const { result } = renderHook(() => useLiveTotal({
    key: "retry-now-test", load, enabled: true, live: true, intervalMs: 60_000,
  }));
  await act(async () => { await Promise.resolve(); });
  expect(result.current.error).toBeTruthy();
  await act(async () => { result.current.retryNow(); await Promise.resolve(); });
  expect(result.current.state).toBe("live");
  expect(result.current.error).toBeUndefined();
  expect(result.current.lastAt).toBeGreaterThan(0);
});

it("retains the last successful time when a later load fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  const load = vi.fn().mockResolvedValueOnce(42).mockRejectedValue(new Error("offline"));
  const { result } = renderHook(() => useLiveTotal({
    key: "last-at-test", load, enabled: true, live: true, intervalMs: 1000,
  }));
  await act(async () => { await Promise.resolve(); });
  const successfulAt = result.current.lastAt;
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(result.current.state).toBe("stale");
  expect(result.current.error).toBeTruthy();
  expect(result.current.lastAt).toBe(successfulAt);
});

it("clears an old missing-price list when a later request fails", () => {
  const initial = { state: "idle" as const, firstReveal: false };
  const partial = liveTotalTransition(initial, {
    type: "success", value: 80, at: 1000, live: true, partial: true, reason: "pricesMissing",
    missingSymbols: [{ symbol: "OLD", assetType: "crypto", lastValue: 20 }],
    dustSymbols: [{ symbol: "DUST", assetType: "crypto", lastValue: 0.01 }],
    missingShare: 0.2,
  });
  const failed = liveTotalTransition(partial, { type: "error", reason: "pricesMissing" });

  expect(failed.state).toBe("stale");
  expect(failed.value).toBe(80);
  expect(failed.error).toBe("pricesMissing");
  expect(failed.missingSymbols).toBeUndefined();
  expect(failed.dustSymbols).toBeUndefined();
  expect(failed.missingShare).toBeUndefined();
});

it("retains a safe IBKR expiry reason when the live query has no priced holdings", () => {
  expect(safeLiveTotalError(new Error("ibkrToken"))).toBe("ibkrToken");
});

it("retains only a numeric missing-price count from a failed live query", () => {
  expect(safeLiveTotalError(new Error("pricesMissing:2"))).toBe("pricesMissing:2");
  expect(safeLiveTotalError(new Error("pricesMissing:secret"))).toBe("pricesMissing");
});

it("does not let the 60-second polling tick preempt the 60-second retry", async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const load = vi.fn().mockRejectedValue(new Error("CoinGecko 429"));
  renderHook(() => useLiveTotal({
    key: "retry-poll-test", load, enabled: true, live: true, intervalMs: 60_000,
  }));
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(load).toHaveBeenCalledTimes(3);
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(load).toHaveBeenCalledTimes(4);
});

it("remembers the last successful time when the live display remounts", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  const first = renderHook(() => useLiveTotal({
    key: "remount-time-test", load: async () => 42,
    enabled: true, live: true, intervalMs: 60_000,
  }));
  await act(async () => { await Promise.resolve(); });
  first.unmount();
  const second = renderHook(() => useLiveTotal({
    key: "remount-time-test", load: () => new Promise<number>(() => {}),
    enabled: true, live: true, intervalMs: 60_000,
  }));
  expect(second.result.current.lastAt).toBe(Date.parse("2026-11-15T12:00:00Z"));
});

const setVisibility = (state: "visible" | "hidden") => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
  document.dispatchEvent(new Event("visibilitychange"));
};

it("waits for a load that is slower than the interval but faster than the time limit", async () => {
  vi.useFakeTimers();
  const load = vi.fn(() => new Promise<number>((done) => { setTimeout(() => done(100), 5_000); }));
  const { result } = renderHook(() => useLiveTotal({ key: "slow-load-test", load, enabled: true, live: true, intervalMs: 1000 }));
  await act(async () => { await vi.advanceTimersByTimeAsync(4_999); });
  expect(result.current.state).toBe("connecting");
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(result.current.state).toBe("live");
  expect(result.current.value).toBe(100);
});

it("gives up on a first load that never answers and lets Retry now start another", async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const load = vi.fn(() => new Promise<number>(() => {}));
  const { result } = renderHook(() => useLiveTotal({ key: "hung-first-test", load, enabled: true, live: true, intervalMs: 1000 }));
  await act(async () => { await vi.advanceTimersByTimeAsync(29_999); });
  expect(result.current.state).toBe("connecting");
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(result.current.state).toBe("error");
  expect(result.current.error).toBe("unknown");
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => { result.current.retryNow(); });
  expect(load).toHaveBeenCalledTimes(2);
  expect(result.current.state).toBe("connecting");
});

it("marks a known value stale and retries when a later load never answers", async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const load = vi.fn().mockResolvedValueOnce(100).mockImplementation(() => new Promise<number>(() => {}));
  const { result } = renderHook(() => useLiveTotal({
    key: "hung-later-test", load, enabled: true, live: true, intervalMs: 1000, timeoutMs: 10_000,
  }));
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });
  expect(load).toHaveBeenCalledTimes(2);
  expect(result.current.state).toBe("stale");
  expect(result.current.error).toBe("unknown");
  expect(result.current.value).toBe(100);
  await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
  expect(load).toHaveBeenCalledTimes(3);
});

it("does not call an old value live when the tab returns after a long hidden period", async () => {
  vi.useFakeTimers();
  let resolve!: (value: number) => void;
  const load = vi.fn().mockResolvedValueOnce(100)
    .mockImplementationOnce(() => new Promise<number>((done) => { resolve = done; }));
  const { result } = renderHook(() => useLiveTotal({ key: "resume-test", load, enabled: true, live: true, intervalMs: 1000 }));
  await act(async () => { await Promise.resolve(); });
  expect(result.current.state).toBe("live");
  act(() => setVisibility("hidden"));
  await act(async () => { await vi.advanceTimersByTimeAsync(3_600_000); });
  expect(result.current.state).toBe("live");
  act(() => setVisibility("visible"));
  expect(load).toHaveBeenCalledTimes(2);
  expect(result.current.state).toBe("connecting");
  expect(result.current.value).toBe(100);
  await act(async () => { resolve(120); await Promise.resolve(); });
  expect(result.current.state).toBe("live");
});

it("keeps a recent value live when the tab returns within two intervals", async () => {
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValueOnce(100).mockImplementation(() => new Promise<number>(() => {}));
  const { result } = renderHook(() => useLiveTotal({ key: "short-hide-test", load, enabled: true, live: true, intervalMs: 1000 }));
  await act(async () => { await Promise.resolve(); });
  act(() => setVisibility("hidden"));
  await act(async () => { await vi.advanceTimersByTimeAsync(1_500); });
  act(() => setVisibility("visible"));
  expect(load).toHaveBeenCalledTimes(2);
  expect(result.current.state).toBe("live");
});
