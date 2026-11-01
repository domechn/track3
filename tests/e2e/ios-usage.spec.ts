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
  await expect(status).toContainText("Monthly refresh limit reached", { timeout: 15_000 });
});

test("iOS offers restore without a purchase action", async ({ page }) => {
  const bridge = await installTauriBridge(page, { checkoutFixture: true });
  await page.goto("/#/settings/systemInfo?section=pro");
  await expect(page.getByRole("heading", { name: "Restore purchase" })).toBeVisible();
  await expect(page.getByText(/Manage an existing subscription or restore a purchase/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Subscribe/ })).toHaveCount(0);
  await page.goto("/#/settings/systemInfo");
  await expect(page.getByRole("button", { name: /Subscribe/ })).toHaveCount(0);
  await page.goto("/#/settings/systemInfo?section=about");
  await expect(page.getByRole("button", { name: /Subscribe/ })).toHaveCount(0);
  expect(bridge.checkoutSessions()).toBe(0);
});

test("iOS system card title stays readable without a section", async ({ page }) => {
  await installTauriBridge(page, { checkoutFixture: true });
  await page.goto("/#/settings/systemInfo");
  const title = page.getByTestId("system-info-card").locator("h2, h3").first();
  await expect(title).toHaveText("Track3 Free", { timeout: 15_000 });
  await expect.poll(() => title.evaluate((heading) => parseFloat(getComputedStyle(heading).fontSize))).toBeGreaterThanOrEqual(16);
});

test("iOS manages an active subscription before offering deactivation", async ({ page }) => {
  const bridge = await installTauriBridge(page, { proUsageFixture: true });
  await page.goto("/#/settings/systemInfo?section=pro");
  const manage = page.getByRole("button", { name: "Manage Subscription" });
  const deactivate = page.getByRole("button", { name: "Deactivate license" });
  await expect(manage).toBeVisible();
  await manage.focus();
  await page.keyboard.press("Tab");
  await expect(deactivate).toBeFocused();
  await manage.click();
  await expect.poll(() => bridge.openedUrls()).toContain("https://billing.stripe.test/portal");
});

test("iOS asks before an exhausted Pro wallet refresh", async ({ page }) => {
  await installTauriBridge(page, { quotaExhaustedFixture: true, preflightExhaustedFixture: true });
  await page.goto("/#/overview");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const preflight = page.getByRole("alertdialog", { name: "Refresh limit" });
  await expect(preflight).toContainText("ERC20 wallet refreshes needed: 1; remaining: 0");
  await expect(preflight.getByRole("button", { name: "Continue refresh" })).toBeVisible();
  await preflight.getByRole("button", { name: "Continue refresh" }).click();
  await expect(page.getByRole("alertdialog", { name: "Source status" })).toContainText("Monthly refresh limit reached");
});

test("iOS wallet quick look explains a monthly quota failure", async ({ page }) => {
  await installTauriBridge(page, { quotaExhaustedFixture: true });
  await page.goto("/#/settings/configuration?section=sources");
  await page.getByRole("button", { name: /More actions for ERC20/i }).click();
  await page.getByRole("button", { name: "Quick look" }).click();
  await expect(page.getByText("Monthly refresh limit reached", { exact: true })).toBeVisible();
});
