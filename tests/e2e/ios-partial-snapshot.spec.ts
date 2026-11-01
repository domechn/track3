import { test } from "@playwright/test";
import { capturePartialScreens } from "./partial-snapshot-captures";

test.use({
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

for (const width of [390, 834]) for (const theme of ["light", "dark"] as const) {
  test(`partial snapshot iOS ${width} ${theme}`, async ({ page }) => {
    await capturePartialScreens(page, "ios", width, theme);
  });
}
