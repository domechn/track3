import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test("sidebar Settings opens the same Data sources page as its menu link", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await page.locator("aside").getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/#\/settings\/configuration\?section=sources$/);
  const settings = page.locator(".t3-settings");
  await expect(settings).toHaveAttribute("data-design-section", "sources");
  const menu = settings.getByRole("navigation", { name: "Settings sections" });
  const sources = menu.getByRole("link", { name: "Data sources" });
  await expect(sources).toHaveAttribute("aria-current", "page");
  await expect(menu.locator("[aria-current='page']")).toHaveCount(1);
  await expect(settings.locator(".t3-settings-source-tabs")).toBeVisible();
  await expect(settings.locator(".t3-fidelity-source-page")).toBeAttached();
  await expect(settings.locator(".t3-fidelity-source-skeleton")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  const content = await settings.locator(".t3-settings-content").innerText();
  await sources.click();
  await expect(page).toHaveURL(/#\/settings\/configuration\?section=sources$/);
  await expect.poll(() => settings.locator(".t3-settings-content").innerText()).toBe(content);
  await expect(menu.locator("[aria-current='page']")).toHaveCount(1);
  await expect(sources).toHaveAttribute("aria-current", "page");
});
