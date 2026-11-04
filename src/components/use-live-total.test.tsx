import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { liveTotalTransition, useLiveTotal } from "./use-live-total";

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
