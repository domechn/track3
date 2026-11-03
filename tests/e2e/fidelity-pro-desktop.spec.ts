import { expect, test } from "@playwright/test";
import { seedSettingsB, settingsBRoute, settingsBShot } from "./fidelity-settings-b-scenes";

test.use({ viewport: { width: 1600, height: 777 }, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });

for (const state of ["default", "free", "activating", "exhausted", "expired", "invalid", "deactivate"] as const) {
  test(`Pro ${state} desktop fidelity`, async ({ page }) => {
    await seedSettingsB(page, "pro", state);
    await page.goto(settingsBRoute.pro);
    await expect(page.getByText("What Pro includes", { exact: true })).toBeVisible();
    if (state === "default") {
      await expect(page.locator("#license")).toHaveCSS("font-size", "22px");
      await expect(page.locator(".t3-b-pro-license")).toContainText("Valid. Pro yearly, activated on this device on 14 Mar 2026");
      await expect(page.locator(".t3-b-pro-usage")).toContainText("Resets in 1 day");
      await expect(page.locator(".t3-b-dev-row .t3-b-device-platform svg:visible")).toHaveCount(2);
      await expect(page.locator(".t3-b-dev-row").first().getByRole("button", { name: "Deactivate this device" })).not.toHaveCSS("color", "rgb(255, 255, 255)");
    }
    if (state === "expired") {
      await expect(page.locator(".t3-b-pro-license .t3-b-result")).toContainText("Key recognised, subscription expired");
      await expect(page.locator(".t3-b-dev-row")).toHaveCount(2);
      await expect(page.locator(".t3-b-dev-row").first().getByRole("button", { name: "Deactivate this device" })).toBeVisible();
    }
    if (state === "activating" || state === "invalid") {
      await page.evaluate((scenario) => {
        const original = (window as any).__e2eInvoke;
        (window as any).__e2eInvoke = async (command: string, args: unknown, options: unknown) => {
          if (command === "plugin:http|fetch_send") {
            if (scenario === "activating") return new Promise(() => {});
            const response = await original(command, args, options);
            return { ...response, status: 401, statusText: "Unauthorized" };
          }
          return original(command, args, options);
        };
      }, state);
      await page.locator("#license").fill(state === "invalid" ? "T3P-8F2K-N4VD-6WXA-Q7M5" : "T3P-8F2K-N4VD-6WXA-Q7M4");
      await page.getByRole("button", { name: "Verify" }).click();
      await expect(state === "activating" ? page.getByRole("button", { name: /Activating/ }) : page.locator("#license[aria-invalid=true]")).toBeVisible();
    }
    if (state === "deactivate") {
      await page.getByRole("button", { name: /Deactivate this device/i }).first().click();
      await expect(page.getByRole("alertdialog")).toContainText("ERC20 and TRON wallets keep their last balances and the assistant is paused.");
      await expect(page.getByRole("alertdialog").locator("li")).toHaveCount(3);
      await expect(page.getByRole("alertdialog")).toContainText("1 of 3 devices stays active");
      await expect(page.getByRole("alertdialog")).toHaveCSS("width", "576px");
    }
    await settingsBShot(page, "pro", state);
  });
}
