import { expect, test } from "@playwright/test";
import { seedSettingsA } from "./fidelity-settings-a-scenes";
import { seedSettingsB, settingsBRoute, type SettingsBPage } from "./fidelity-settings-b-scenes";
import { expectSettingsCardsFitContent, expectSettingsSameRowBottoms } from "./settings-card-layout-scenes";

test.use({ viewport: { width: 1600, height: 900 }, colorScheme: "dark", reducedMotion: "reduce" });

test("settings navigation remains visible while long settings content scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 640 });
  await seedSettingsB(page, "backup", "default");
  await page.goto(settingsBRoute.backup);
  const main = page.locator("#app-main-content");
  await expect(page.locator(".t3-b-card").first()).toBeVisible({ timeout: 30_000 });
  const scrollable = await main.evaluate((node) => node.scrollHeight > node.clientHeight);
  expect(scrollable).toBe(true);
  await main.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  expect(await main.evaluate((node) => node.scrollTop)).toBeGreaterThan(120);
  const menu = (await page.locator(".t3-settings-menu").boundingBox())!;
  expect(menu.y).toBeGreaterThanOrEqual(0);
  expect(menu.y + menu.height).toBeLessThanOrEqual(640);
  await expect(page.locator(".t3-settings-menu-link[aria-current='page']")).toBeInViewport();
});

for (const [area, route, selector] of [
  ["sources", "/#/settings/configuration?section=sources", "[data-testid='source-table']"],
  ["currency", "/#/settings/configuration?section=currency", ".t3-fidelity-currency section"],
  ["appearance", "/#/settings/appearance?section=theme", ".t3-fidelity-appearance section"],
  ["language", "/#/settings/appearance?section=language", ".t3-fidelity-language section"],
  ["blacklist", "/#/settings/data?section=blacklist", ".t3-fidelity-blacklist section"],
] as const) {
  test(`${area} cards have content below their last control`, async ({ page }) => {
    await seedSettingsA(page, { page: area, name: "default" });
    await page.goto(route);
    await expect(page.locator(selector).first()).toBeVisible();
    await expectSettingsCardsFitContent(page, selector);
  });
}

for (const area of ["pro", "ai", "backup", "security", "about"] as SettingsBPage[]) {
  test(`${area} cards have content below their last control`, async ({ page }) => {
    await seedSettingsB(page, area, "default");
    await page.goto(settingsBRoute[area]);
    await expect(page.locator(".t3-b-card").first()).toBeVisible();
    await expectSettingsCardsFitContent(page, ".t3-b-card");
  });
}

for (const [area, route, group] of [
  ["sources", "/#/settings/configuration?section=sources", "a"],
  ["currency", "/#/settings/configuration?section=currency", "a"],
  ["appearance", "/#/settings/appearance?section=theme", "a"],
  ["language", "/#/settings/appearance?section=language", "a"],
  ["blacklist", "/#/settings/data?section=blacklist", "a"],
  ["pro", settingsBRoute.pro, "b"],
  ["ai", settingsBRoute.ai, "b"],
  ["backup", settingsBRoute.backup, "b"],
  ["security", settingsBRoute.security, "b"],
  ["about", settingsBRoute.about, "b"],
] as const) {
  for (const width of [1600, 1280, 1100]) test(`${area} cards align within their rows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    if (group === "a") await seedSettingsA(page, { page: area, name: "default" });
    else await seedSettingsB(page, area, "default");
    await page.goto(route);
    const selector = width >= 1500 && area === "sources" ? ".t3-fidelity-source-card"
      : width >= 1500 && area === "currency" ? ".t3-fidelity-currency > *"
        : width >= 1500 && area === "appearance" ? ".t3-fidelity-appearance > section"
          : width >= 1500 && area === "language" ? ".t3-fidelity-language > section"
            : width >= 1500 && area === "blacklist" ? ".t3-fidelity-blacklist > section"
              : width >= 1500 && ["pro", "ai", "backup", "security", "about"].includes(area) ? ".t3-b-grid > .t3-b-card"
                : ".t3-settings-content [data-ui-card]:visible";
    const cards = page.locator(selector);
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    await expectSettingsSameRowBottoms(page, selector);
    if (area === "ai" && width <= 1200) {
      await expectSettingsCardsFitContent(page, ".t3-assistant-settings [data-ui-card]");
    }
  });
}

for (const area of ["appearance", "language"] as const) {
  test(`${area} summary cards fit their content at 1100px`, async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await seedSettingsA(page, { page: area, name: "default" });
    await page.goto(`/#/settings/appearance?section=${area === "appearance" ? "theme" : "language"}`);
    const selector = ".t3-settings-appearance-content > .grid > [data-ui-card]";
    await expect(page.locator(selector).first()).toBeVisible({ timeout: 15_000 });
    await expectSettingsCardsFitContent(page, selector);
  });
}

for (const width of [1280, 1100]) {
  test(`Backup import fits its content at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedSettingsB(page, "backup", "default");
    await page.goto(settingsBRoute.backup);
    const importCard = page.locator("[data-ui-card]:has(h3:text-is('Import Data'))");
    const exportCard = page.locator("[data-ui-card]:has(h3:text-is('Export Data'))");
    await expect(importCard).toBeVisible();
    await expectSettingsCardsFitContent(page, "[data-ui-card]:has(h3:text-is('Import Data'))");
    expect((await importCard.boundingBox())!.y + (await importCard.boundingBox())!.height)
      .toBeLessThan((await exportCard.boundingBox())!.y);
  });
}

for (const width of [1600, 1280, 1100]) {
  test(`sync cards fit content and follow the expected grid at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedSettingsB(page, "sync", "locked");
    await page.goto(settingsBRoute.sync);
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.locator(".t3-sync-passphrase")).toBeVisible({ timeout: 15_000 });
    await expectSettingsCardsFitContent(page, ".sync-settings-page [data-ui-card]");
    const tops = await page.evaluate(() => ({
      connection: document.querySelector(".t3-sync-connection")!.getBoundingClientRect().top,
      connectionBottom: document.querySelector(".t3-sync-connection")!.getBoundingClientRect().bottom,
      passphrase: document.querySelector(".t3-sync-passphrase")!.getBoundingClientRect().top,
    }));
    if (width > 1300) expect(Math.abs(tops.connection - tops.passphrase)).toBeLessThanOrEqual(1);
    else expect(Math.abs(tops.passphrase - tops.connectionBottom - 16)).toBeLessThanOrEqual(1);
  });
}

test("About guide action stays at the card bottom at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedSettingsB(page, "about", "default");
  await page.goto(settingsBRoute.about);
  const card = page.locator(".t3-about-guide");
  await expect(card).toBeVisible();
  const gap = await card.evaluate((element) => element.getBoundingClientRect().bottom -
    element.querySelector("button:last-child")!.getBoundingClientRect().bottom);
  expect(gap).toBeLessThanOrEqual(30);
  await expectSettingsCardsFitContent(page, ".t3-about-guide");
});
