import { test } from "@playwright/test";
import { captureSyncDetails } from "./sync-details-captures";

test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

for (const theme of ["light", "dark"] as const) {
  for (const locale of ["en", "zh"] as const) {
    for (const width of [390, 320] as const) {
      test(`mobile sync details ${width} ${theme} ${locale}`, async ({ page }) => {
        await captureSyncDetails(page, "mobile", theme, locale, width);
      });
    }
  }
}
