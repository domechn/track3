import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";
import { seedSettingsA } from "./fidelity-settings-a-scenes";
import { seedSettingsB, settingsBRoute, type SettingsBPage } from "./fidelity-settings-b-scenes";

test.use({ viewport: { width: 1600, height: 900 }, colorScheme: "light", reducedMotion: "reduce", timezoneId: "UTC" });

const capture = async (page: import("@playwright/test").Page, name: string) => {
  mkdirSync("/tmp/fidelity-desktop/light", { recursive: true });
  await page.screenshot({ path: `/tmp/fidelity-desktop/light/${name}.png`, fullPage: true });
};

test("assistant remains readable in light theme at desktop widths", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await installTauriBridge(page, { fidelitySample: "full" });
  for (const width of [800, 1400, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/assistant");
    await expect(page.locator(".t3-assistant-page-heading h1")).toBeVisible();
    await expect(page.locator(".t3-assistant-page-heading h1")).not.toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(page.locator('[data-testid="chat-card"]')).toHaveCSS("background-color", "rgb(255, 255, 255)");
    if (width >= 1400) await expect(page.locator(".t3-assistant-context")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await capture(page, `assistant-${width}`);
  }
});

test("wide sync settings remain readable in light theme", async ({ page }) => {
  await seedSettingsB(page, "sync", "default", "light");
  await page.goto("/#/settings/sync");
  await expect(page.getByRole("button", { name: "Skip for now" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.locator(".t3-b-sync-scrim")).toHaveCount(0);
  await expect(page.locator(".t3-settings-design-header h2")).toBeVisible();
  await expect(page.locator(".t3-settings-design-header h2")).not.toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator('label[for="sync-bucket"]')).not.toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator(".t3-settings-menu-link[aria-current='page']")).not.toHaveCSS("color", "rgb(255, 255, 255)");
  await capture(page, "sync-1600");
});

test("wide sources show their table in light theme", async ({ page }) => {
  await seedSettingsA(page, { page: "sources", name: "default", theme: "light" });
  await page.goto("/#/settings/configuration?section=sources");
  await expect(page.getByTestId("source-table")).toBeVisible();
  await expect(page.locator(".t3-fidelity-source-page")).not.toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.getByTestId("source-table")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await capture(page, "sources-1600");
});

for (const area of ["pro", "ai", "backup", "security", "about"] as SettingsBPage[]) {
  test(`${area} settings keep light cards and readable headings`, async ({ page }) => {
    await seedSettingsB(page, area, "default", "light");
    await page.goto(settingsBRoute[area]);
    await expect(page.locator(".t3-settings-design-header h2")).not.toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(page.locator(".t3-settings-content .t3-b-card").first()).toBeVisible();
    await expect(page.locator(".t3-settings-content .t3-b-card").first()).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await capture(page, `${area}-1600`);
  });
}

const lightSettingsA = [
  { area: "currency", route: "/#/settings/configuration?section=currency", selector: '[data-testid="currency-settings"]' },
  { area: "appearance", route: "/#/settings/appearance?section=theme", selector: '[data-testid="theme-preview-grid"]' },
  { area: "language", route: "/#/settings/appearance?section=language", selector: '[data-testid="language-preview"]' },
  { area: "blacklist", route: "/#/settings/data?section=blacklist", selector: '[data-testid="blacklist-table"]' },
] as const;

for (const { area, route, selector } of lightSettingsA) {
  test(`${area} settings stay readable in light theme`, async ({ page }) => {
    await seedSettingsA(page, { page: area, name: "default", theme: "light" });
    await page.goto(route);
    await expect(page.locator(".t3-settings-design-header h2")).not.toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(page.locator(selector)).toBeVisible();
    await expect(page.locator(`${selector} > section`).first()).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await capture(page, `${area}-1600`);
  });
}
