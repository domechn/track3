import { beforeEach, expect, it, vi } from "vitest";
import { FullRefreshRequiredError } from "@/middlelayers/refresh-error";
import { normalizeSourceStatuses } from "@/middlelayers/source-status";
import { readStoredStatuses, retryRefresh, writeStoredStatuses } from "./source-status-store";

beforeEach(() => localStorage.clear());
it("writes a normalised status array to its existing key", () => {
  writeStoredStatuses([]);
  expect(localStorage.getItem("track3-refresh-source-statuses")).toBe("[]");
  expect(readStoredStatuses()).toEqual([]);
});

it("keeps the mobile live-source callback while desktop carries only prior results", async () => {
  const { desktopRefreshOptions, mobileRefreshOptions } = await import("./source-status-store");
  const last = { failedSources: [], requiresDataSourceAction: false, usedLastKnownData: false, sourceResults: [], portfolioInputGeneration: 7, refreshCreatedAt: "at", snapshotId: "id", snapshotKey: "key" } as Parameters<typeof desktopRefreshOptions>[1];
  expect(desktopRefreshOptions("one", last, [])).toEqual({ retrySourceId: "one", previousSourceResults: [], previousSourceStatuses: [], previousInputGeneration: 7, previousRefreshCreatedAt: "at", previousSnapshotId: "id", previousSnapshotKey: "key" });
  const mobile = mobileRefreshOptions("one", last, [], () => {});
  expect(Object.keys(mobile)).toEqual(["retrySourceId", "onSourceResult", "previousSourceResults", "previousSourceStatuses", "previousInputGeneration", "previousRefreshCreatedAt", "previousSnapshotId", "previousSnapshotKey"]);
});

it("normalizes refresh statuses before writing", async () => {
  const statuses = normalizeSourceStatuses([{ sourceId: "cex:0", label: "Main", status: "failed", detail: "unsafe provider text" }]);
  writeStoredStatuses(statuses);
  expect(localStorage.getItem("track3-refresh-source-statuses")).toBe('[{"sourceId":"cex:0","label":"Main","status":"failed"}]');
});

it("rewrites stored statuses when a saved row has unsafe extra fields", () => {
  localStorage.setItem("track3-refresh-source-statuses", '[{"sourceId":"cex:0","label":"Main","status":"failed","secret":"omit"}]');
  expect(readStoredStatuses()).toEqual([{ sourceId: "cex:0", label: "Main", status: "failed" }]);
  expect(localStorage.getItem("track3-refresh-source-statuses"))
    .toBe('[{"sourceId":"cex:0","label":"Main","status":"failed"}]');
});

it("reports consecutive retry numbers and stops after the allowed attempts", async () => {
  const attempts: number[] = [];
  const retries: number[] = [];
  const failure = new Error("temporary");
  await expect(retryRefresh(async () => {
    attempts.push(attempts.length + 1);
    throw failure;
  }, 3, 0, (attempt) => retries.push(attempt))).rejects.toBe(failure);
  expect(attempts).toEqual([1, 2, 3, 4]);
  expect(retries).toEqual([1, 2, 3]);
});

it.each([
  new FullRefreshRequiredError("refresh"),
  new Error("no configuration found for source"),
])("does not retry an early refresh failure: %s", async (failure) => {
  const fn = vi.fn(async () => { throw failure; });
  const onRetry = vi.fn();
  await expect(retryRefresh(fn, 3, 0, onRetry)).rejects.toBe(failure);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(onRetry).not.toHaveBeenCalled();
});
