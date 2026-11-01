import { test } from "@playwright/test";
import { exerciseRecoveryFile } from "./recovery-flow";

test.use({
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("shares encrypted root key and unlocks a later iOS session from the file", async ({ page }) => {
  await exerciseRecoveryFile(page);
});
