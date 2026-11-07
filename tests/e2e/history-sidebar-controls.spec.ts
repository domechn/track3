import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./fidelity-bridge-captures";

test.use({ viewport: { width: 1280, height: 900 } });

for (const theme of ["dark", "light"] as const) {
  test(`History footer distinguishes filters from Settings in ${theme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await installTauriBridge(page, { fidelityRecords: "history-empty" });
    await page.goto("/#/history");
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();

    const rail = page.locator("aside.t3-desktop-rail");
    const filters = rail.getByRole("button", { name: "History filters" });
    const settings = rail.getByRole("link", { name: "Settings" });
    const panel = page.locator("#t3-records-toolbar-panel");
    await expect(filters).toHaveCount(1);
    await expect(settings).toHaveCount(1);
    await expect(filters).toHaveAttribute("aria-expanded", "false");
    await expect(filters).toHaveAttribute("aria-pressed", "false");
    await expect(panel).toBeHidden();
    expect(await filters.locator("svg").innerHTML()).not.toBe(await settings.locator("svg").innerHTML());
    await filters.hover();
    await expect(page.getByRole("tooltip")).toContainText("History filters");
    await page.screenshot({ path: `/tmp/history-sidebar-${theme}-collapsed.png`, animations: "disabled" });

    await filters.click();
    await expect(filters).toHaveAttribute("aria-expanded", "true");
    await expect(filters).toHaveAttribute("aria-pressed", "true");
    await expect(panel).toBeVisible();
    await filters.click();
    await expect(filters).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();

    await rail.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(filters).toContainText("History filters");
    await expect(settings).toContainText("Settings");
    expect(await filters.locator("svg").innerHTML()).not.toBe(await settings.locator("svg").innerHTML());
    await page.screenshot({ path: `/tmp/history-sidebar-${theme}-expanded.png`, animations: "disabled" });
    await settings.click();
    await expect(page).toHaveURL(/#\/settings/);
  });
}
