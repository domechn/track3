import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

test("iOS Pro screen shows usage and an exhausted wallet shows quota status", async ({ page }) => {
  await installTauriBridge(page, { proUsageFixture: true, quotaExhaustedFixture: true });
  await page.goto("/#/settings/systemInfo?section=pro");
  await expect(page.getByText("ERC20 wallet refreshes")).toBeVisible();
  await expect(page.getByText("TRON wallet refreshes")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "ERC20 wallet refreshes" })).toHaveAttribute("aria-valuenow", "12");
  await page.goto("/#/overview");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const status = page.getByRole("alertdialog", { name: "Source status" });
  await expect(status).toContainText("Monthly refresh limit reached", { timeout: 90_000 });
});

test("iOS wallet quick look explains a monthly quota failure", async ({ page }) => {
  await installTauriBridge(page, { quotaExhaustedFixture: true });
  await page.goto("/#/settings/configuration?section=sources");
  await page.getByRole("button", { name: /More actions for ERC20/i }).click();
  await page.getByRole("button", { name: "Quick look" }).click();
  await expect(page.getByText("Monthly refresh limit reached")).toBeVisible();
});
