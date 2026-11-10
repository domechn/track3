import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop"));

for (const height of [560, 720]) {
  test(`Wallet Type shows every option after editing inside the ${height}px dialog`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height });
    await installTauriBridge(page);
    await page.goto("/#/settings/configuration?section=sources");
    await page.locator(".t3-settings-source-tabs").getByRole("button", { name: /^Wallets \d+$/ }).click();
    await page.getByRole("button", { name: "Add Wallet Configuration" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Wallet Configuration" });
    await dialog.getByRole("textbox", { name: "Alias" }).fill("Cold wallet");
    await dialog.getByRole("combobox", { name: "Type" }).click();

    const options = page.getByRole("listbox").getByRole("option");
    await expect(options).toHaveCount(7);
    await expect(options.last()).toContainText("SUI");
    expect(await options.first().evaluate((node) => node.closest("[role=dialog]"))).toBeNull();
    expect(await options.evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return rect.top >= 0 && rect.bottom <= innerHeight && node.contains(hit);
    }))).toEqual([true, true, true, true, true, true, true]);
    await options.last().click();
    await expect(dialog.getByRole("combobox", { name: "Type" })).toContainText("SUI");
  });
}
