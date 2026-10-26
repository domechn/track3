import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test("desktop checkout waits, resumes after reload, and activates Pro", async ({ page }) => {
  const bridge = await installTauriBridge(page, { checkoutFixture: true });
  await page.goto("/#/settings/systemInfo");
  await page.getByRole("button", { name: "Subscribe Yearly" }).click();
  await expect(page.getByText(/Waiting for payment/)).toBeVisible();
  expect(bridge.openedUrls()).toContain("https://checkout.stripe.test/session");
  await page.reload();
  await expect(page.getByText(/Waiting for payment/)).toBeVisible();
  await page.getByRole("button", { name: /I've paid.*check again/ }).click();
  await expect(page.getByText(/Waiting for payment/)).toBeVisible();
  bridge.setCheckoutStatus("completed");
  await expect(page.locator("#app-main-content").getByText("Pro subscription activated!", { exact: true })).toBeVisible();
  await expect(page.getByText("Pro", { exact: true }).first()).toBeVisible();
  expect(bridge.checkoutSessions()).toBe(1);
});
