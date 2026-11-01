import { test } from "@playwright/test";
import { captureSyncDetails } from "./sync-details-captures";

for (const theme of ["light", "dark"] as const) {
  for (const locale of ["en", "zh"] as const) {
    test(`desktop sync details ${theme} ${locale}`, async ({ page }) => {
      await captureSyncDetails(page, "desktop", theme, locale, 1280);
    });
  }
}
