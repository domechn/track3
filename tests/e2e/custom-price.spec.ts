import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

const output = "test-results/custom-price";
const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

async function capture(page: Page, path: string) {
  await page.evaluate(() => document.fonts.ready);
  let image = await page.screenshot({ path, fullPage: true, animations: "disabled" });
  if (image.byteLength < 15_000) {
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    image = await page.screenshot({ path, fullPage: true, animations: "disabled" });
  }
  expect(image.byteLength, path).toBeGreaterThan(15_000);
}

test("custom price screens work in both shells, themes, and languages", async ({ browser }) => {
  test.setTimeout(300_000);
  mkdirSync(output, { recursive: true });
  for (const [width, height, mobile] of [
    [1440, 900, false], [1024, 768, false], [390, 844, true], [834, 1194, true],
  ] as const) for (const theme of ["light", "dark"] as const) for (const locale of ["en", "zh"] as const) {
    const context = await browser.newContext({
      viewport: { width, height }, colorScheme: theme, reducedMotion: "reduce",
      ...(mobile ? { userAgent: iPhoneUserAgent, hasTouch: true, isMobile: true } : {}),
    });
    const page = await context.newPage();
    await page.addInitScript(({ theme, locale }) => {
      localStorage.setItem("track3-ui-theme", theme);
      localStorage.setItem("track3-ui-locale", locale);
    }, { theme, locale });
    await installTauriBridge(page, { richPortfolio: true, customPriceFixture: true });
    const prefix = `${output}/${width}-${theme}-${locale}`;
    await page.goto("/#/settings/configuration?section=sources");
    if (mobile) await page.getByRole("tab").last().click();
    else await page.locator(".t3-settings-source-tabs button").last().click();
    await expect(page.locator('button[aria-label*="NOVA"]').first()).toBeVisible();
    await capture(page, `${prefix}-sources.png`);
    await page.locator('button[aria-label*="NOVA"]').first().click();
    await expect(page.getByRole("radio", { name: locale === "en" ? "Your price" : "自行设定价格" })).toBeVisible();
    await capture(page, `${prefix}-manual.png`);
    await page.getByRole("radio", { name: locale === "en" ? "Follow a listed asset" : "跟随已上市资产" }).click();
    await expect(page.locator("#custom-price-symbol")).toBeVisible();
    await capture(page, `${prefix}-follow.png`);
    if (mobile) await page.getByRole("button", { name: locale === "en" ? "Cancel" : "取消" }).click();
    else await page.keyboard.press("Escape");
    await page.getByRole("button", { name: locale === "en" ? (mobile ? "Add symbol" : "Add Symbol") : "新增币种" }).click();
    await expect(page.getByRole("radio", { name: locale === "en" ? "Market" : "市场价格" })).toBeVisible();
    await capture(page, `${prefix}-add.png`);
    await page.goto("/#/coins/NOVA");
    await expect(page.getByText(locale === "en" ? /Fallback configured, set/ : /已设置后备价格，设置于/)).toBeVisible();
    await capture(page, `${prefix}-coin.png`);
    await page.goto("/#/coins/STBTC");
    await expect(page.getByText(locale === "en" ? /Fallback configured: follows BTC/ : /已设置后备价格：跟随 BTC/)).toBeVisible();
    await capture(page, `${prefix}-follow-coin.png`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await context.close();
  }
});
