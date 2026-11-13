import { execFileSync } from "node:child_process";
import { test } from "@playwright/test";

test("PR workflows keep updater signing secrets out of the build", () => {
  execFileSync(process.execPath, ["scripts/workflow-secrets-lint.mjs"], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
});
