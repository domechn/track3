import { test } from "@playwright/test";
import { verifySourceRename } from "./source-rename-scenes";

test.setTimeout(240_000);
test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

for (const theme of ["light", "dark"] as const) {
  test(`phone source aliases persist without changing snapshots in ${theme} mode`, async ({ page }) => {
    await verifySourceRename(page, theme, true);
  });
}
