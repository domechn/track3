import { test } from "@playwright/test";
import { capturePartialScreens } from "./partial-snapshot-captures";

test.use({ reducedMotion: "reduce" });

for (const width of [1440, 1024]) for (const theme of ["light", "dark"] as const) {
  test(`partial snapshot desktop ${width} ${theme}`, async ({ page }) => {
    await capturePartialScreens(page, "desktop", width, theme);
  });
}
