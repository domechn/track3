import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test("desktop starts dark without storing a theme and preserves a stored light theme", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("track3-ui-theme"))).toBeNull();
  await page.evaluate(() => localStorage.setItem("track3-ui-theme", "light"));
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  expect(await page.evaluate(() => localStorage.getItem("track3-ui-theme"))).toBe("light");
});

test("desktop rail keeps routes and exposes grouped labelled navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriBridge(page);
  await page.goto("/#/overview");
  const rail = page.locator("aside");
  await expect(rail.getByText("Analyze", { exact: true })).toBeVisible();
  await expect(rail.getByText("Manage", { exact: true })).toBeVisible();
  await expect(rail).toHaveCSS("width", "216px");
  await rail.getByRole("link", { name: "Cost basis" }).click();
  await expect(page).toHaveURL(/#\/cost-basis$/);
  await rail.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(rail).toHaveCSS("width", "56px");
  await rail.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(rail).toHaveCSS("width", "216px");
});

test("shared controls use Terminal geometry in both themes", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/overview");
  for (const theme of ["dark", "light"]) {
    await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await expect(page.locator("[data-ui-card]").first()).toHaveCSS("border-radius", "6px");
    await expect(page.getByRole("button", { name: "Refresh" })).toHaveCSS("border-radius", "999px");
    expect(await page.locator("body").evaluate((node) => getComputedStyle(node).fontFamily)).toContain("Public Sans");
  }
});
