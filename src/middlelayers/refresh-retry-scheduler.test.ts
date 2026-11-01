import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FullRefreshRequiredError } from "./refresh-error";
import { RETRY_ENABLED_KEY, RefreshRetryScheduler } from "./refresh-retry-scheduler";
import type { PortfolioSourceStatus } from "./portfolio-baseline";

const failed = (sourceId: string, category: PortfolioSourceStatus["category"] = "network"): PortfolioSourceStatus =>
  ({ sourceId, label: sourceId, status: "failed", category, finishedAt: new Date().toISOString() });

beforeEach(() => { localStorage.removeItem(RETRY_ENABLED_KEY); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-01T10:00:00Z")); });
afterEach(() => { vi.useRealTimers(); });

it("schedules only retryable failures and retries each source at 1, 5 and 15 minutes before stopping", async () => {
  const run = vi.fn(async () => [failed("network"), failed("auth", "auth")]);
  const scheduler = new RefreshRetryScheduler(run, () => true);
  scheduler.start();
  scheduler.complete([failed("network"), failed("auth", "auth"), failed("quota", "quota"), failed("unsupported", "unsupported")]);
  expect(scheduler.status().nextBySource).toEqual({ network: Date.parse("2026-11-01T10:01:00Z") });
  await vi.advanceTimersByTimeAsync(60_000);
  expect(run).toHaveBeenCalledTimes(1);
  expect(run).toHaveBeenCalledWith("network");
  expect(scheduler.status().nextBySource.network).toBe(Date.parse("2026-11-01T10:06:00Z"));
  await vi.advanceTimersByTimeAsync(5 * 60_000);
  await vi.advanceTimersByTimeAsync(15 * 60_000);
  expect(run).toHaveBeenCalledTimes(3);
  expect(scheduler.status().nextBySource).toEqual({});
  expect(scheduler.status().stopped).toBe(true);
  scheduler.dispose();
});

it("pauses while hidden, offline or busy and resumes without overlapping a refresh", async () => {
  let ready = false;
  const run = vi.fn(async () => [failed("one")]);
  const scheduler = new RefreshRetryScheduler(run, () => ready);
  scheduler.start();
  scheduler.complete([failed("one")]);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(run).not.toHaveBeenCalled();
  ready = true;
  scheduler.poke();
  await vi.advanceTimersByTimeAsync(0);
  expect(run).toHaveBeenCalledTimes(1);
  scheduler.dispose();
});

it("clears a successful source, resets on manual refresh, and stops on a full refresh requirement", async () => {
  const run = vi.fn().mockRejectedValueOnce(new FullRefreshRequiredError("changed"));
  const scheduler = new RefreshRetryScheduler(run, () => true);
  scheduler.start();
  scheduler.complete([failed("one")]);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(scheduler.status().stopped).toBe(true);
  scheduler.manualStart();
  scheduler.complete([failed("two")]);
  expect(scheduler.status().nextBySource.two).toBeDefined();
  scheduler.complete([{ ...failed("two"), status: "ok" }]);
  expect(scheduler.status().nextBySource).toEqual({});
  scheduler.dispose();
});

it("restores a runnable failure when the Settings toggle is turned back on", () => {
  const scheduler = new RefreshRetryScheduler(async () => [], () => true);
  scheduler.start();
  scheduler.complete([failed("one")]);
  scheduler.setEnabled(false);
  expect(scheduler.status().nextBySource).toEqual({});
  scheduler.setEnabled(true);
  expect(scheduler.status().nextBySource.one).toBeDefined();
  scheduler.dispose();
});

it("does not restore a recovered source when the toggle changes", async () => {
  const scheduler = new RefreshRetryScheduler(async () => [{ ...failed("one"), status: "ok" }], () => true);
  scheduler.start();
  scheduler.complete([failed("one")]);
  await vi.advanceTimersByTimeAsync(60_000);
  scheduler.setEnabled(false);
  scheduler.setEnabled(true);
  expect(scheduler.status().nextBySource).toEqual({});
  scheduler.dispose();
});

it("does not consume an attempt when the app reports that retry is paused", async () => {
  const run = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce([{ ...failed("one"), status: "ok" }]);
  const scheduler = new RefreshRetryScheduler(run, () => true);
  scheduler.start();
  scheduler.complete([failed("one")]);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(run).toHaveBeenCalledTimes(1);
  expect(scheduler.status().nextBySource.one).toBeDefined();
  await vi.advanceTimersByTimeAsync(5_000);
  expect(run).toHaveBeenCalledTimes(2);
  expect(scheduler.status().nextBySource).toEqual({});
  scheduler.dispose();
});

it("clears a retry whose previous refresh inputs are unavailable", async () => {
  const scheduler = new RefreshRetryScheduler(async () => null, () => true);
  scheduler.start();
  scheduler.complete([failed("one")]);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(scheduler.status().nextBySource).toEqual({});
  await vi.advanceTimersByTimeAsync(10 * 60_000);
  expect(scheduler.status().nextBySource).toEqual({});
  scheduler.dispose();
});

it("waits for the window to become visible", async () => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  const run = vi.fn(async () => [{ ...failed("one"), status: "ok" as const }]);
  const scheduler = new RefreshRetryScheduler(run, () => true);
  try {
    scheduler.start();
    scheduler.complete([failed("one")]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
  } finally {
    scheduler.dispose();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  }
});

it("waits for connectivity to return", async () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  const run = vi.fn(async () => [{ ...failed("one"), status: "ok" as const }]);
  const scheduler = new RefreshRetryScheduler(run, () => true);
  try {
    scheduler.start();
    scheduler.complete([failed("one")]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).not.toHaveBeenCalled();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
  } finally {
    scheduler.dispose();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  }
});

it("does not claim retries stopped when the third attempt succeeds", async () => {
  let attempts = 0;
  const scheduler = new RefreshRetryScheduler(async () => {
    attempts += 1;
    return [{ ...failed("one"), status: attempts === 3 ? "ok" : "failed" }];
  }, () => true);
  scheduler.start();
  scheduler.complete([failed("one")]);
  await vi.advanceTimersByTimeAsync(21 * 60_000);
  expect(attempts).toBe(3);
  expect(scheduler.status().nextBySource).toEqual({});
  expect(scheduler.status().stopped).toBe(false);
  scheduler.dispose();
});

it("turning the setting off and on keeps the attempt count", async () => {
  const run = vi.fn(async () => [failed("one")]);
  const scheduler = new RefreshRetryScheduler(run, () => true);
  scheduler.start();
  scheduler.complete([failed("one")]);
  await vi.advanceTimersByTimeAsync(60_000);
  scheduler.setEnabled(false);
  expect(scheduler.status().nextBySource).toEqual({});
  scheduler.setEnabled(true);
  expect(scheduler.status().nextBySource.one).toBe(Date.parse("2026-11-01T10:06:00Z"));
  await vi.advanceTimersByTimeAsync(20 * 60_000);
  expect(run).toHaveBeenCalledTimes(3);
  expect(scheduler.status().stopped).toBe(true);
  scheduler.dispose();
});

it("reports stopped after one source exhausts retries and another recovers", async () => {
  let twoAttempts = 0;
  const run = vi.fn(async (id: string) => {
    if (id === "two") twoAttempts += 1;
    return [failed("one"), { ...failed("two"), status: twoAttempts === 3 ? "ok" as const : "failed" as const }];
  });
  const scheduler = new RefreshRetryScheduler(run, () => true);
  scheduler.start();
  scheduler.complete([failed("one"), failed("two")]);
  await vi.advanceTimersByTimeAsync(21 * 60_000);
  expect(scheduler.status().nextBySource).toEqual({});
  expect(scheduler.status().stopped).toBe(true);
  scheduler.dispose();
});
