import { test } from "@playwright/test";
import { verifySourceRename } from "./source-rename-scenes";

test.setTimeout(240_000);
for (const theme of ["light", "dark"] as const) {
  test(`desktop source aliases persist without changing snapshots in ${theme} mode`, async ({ page }) => {
    await verifySourceRename(page, theme, false);
  });
}
