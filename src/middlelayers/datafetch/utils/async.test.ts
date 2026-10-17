import { expect, it } from "vitest";
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
