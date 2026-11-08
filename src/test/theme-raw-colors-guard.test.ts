import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test } from "vitest";

test("shell styles contain no unexplained raw colors", () => {
  const result = spawnSync(process.execPath, [resolve("scripts/theme-raw-colors-guard.mjs")], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
}, 30_000);

test("shell color guard catches new raw colors", () => {
  const result = spawnSync(process.execPath, ["--test", resolve("scripts/theme-raw-colors-guard.test.mjs")], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
}, 30_000);
