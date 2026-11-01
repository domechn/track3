import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

test("desktop hides license devices for an old or failing Pro server", async ({ browser }) => {
  for (const licenseDevices of ["absent", "error"] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const bridge = await installTauriBridge(page, { licenseDevices });
    await page.goto("/#/settings/systemInfo?section=pro");
    await expect(page.getByRole("heading", { name: "Track3 Pro" })).toBeVisible();
    await expect.poll(() => bridge.licenseDeviceRequests()).toBe(1);
    await expect(page.getByRole("region", { name: "Devices on this license" })).toHaveCount(0);
    await context.close();
  }
});

test("desktop shows license devices in both themes and languages", async ({ browser }) => {
  test.setTimeout(300_000);
  mkdirSync("test-results/license-devices", { recursive: true });
  for (const width of [1440, 1024]) for (const theme of ["light", "dark"] as const) for (const locale of ["en", "zh"] as const) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
    const page = await context.newPage();
    await page.addInitScript(({ theme, locale }) => {
      localStorage.setItem("track3-ui-theme", theme);
      localStorage.setItem("track3-ui-locale", locale);
    }, { theme, locale });
    await installTauriBridge(page, { licenseDevices: "present" });
    await page.goto("/#/settings/systemInfo?section=pro");
    const section = page.getByRole("region", { name: locale === "en" ? "Devices on this license" : "此授权的设备" });
    await expect(section).toBeVisible();
    await expect(section).toContainText(locale === "en" ? "2 of 3 device slots" : "已使用 2/3 个设备名额");
    await expect(section).toContainText(locale === "en" ? "This device" : "此设备");
    await expect(section).toContainText("0.9.5");
    await expect(section.getByRole("button")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    const image = await page.screenshot({ path: `test-results/license-devices/desktop-${width}-${theme}-${locale}.png`, fullPage: true, animations: "disabled" });
    expect(image.byteLength).toBeGreaterThan(15_000);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await context.close();
  }
});
