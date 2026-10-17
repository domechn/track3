import { expect, it, vi } from "vitest";
import { asyncMap } from "./async";
import { getMemoryCacheInstance } from "./cache";

it("does not cache a late wallet result after the cache is cleared", async () => {
  let finish!: (value: number) => void;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  const cache = getMemoryCacheInstance("data-fetch");
  cache.clearCache();
  const pending = asyncMap(["late-wallet"], () => new Promise<number>((resolve) => {
    finish = resolve;
    markStarted();
  }));
  await started;
  cache.clearCache();
  finish(2);
  expect(await pending).toEqual([2]);
  expect(cache.getCache("late-wallet")).toBeUndefined();
});

it("does not log secret-bearing cache keys on a hit", async () => {
  const key = "sk-abcdefghijklmnop1234567890";
  const cache = getMemoryCacheInstance("data-fetch");
  cache.clearCache();
  const log = vi.spyOn(console, "debug").mockImplementation(() => {});
  try {
    await asyncMap([key], async () => 1);
    await asyncMap([key], async () => 2);
    expect(JSON.stringify(log.mock.calls)).not.toContain(key);
  } finally {
    log.mockRestore();
  }
});
