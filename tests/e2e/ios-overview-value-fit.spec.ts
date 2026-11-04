import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";
import { amounts, assertEqualStatGutters, assertValueFits, output } from "./overview-value-fit-scenes";

test("phone and iPad Overview totals fit their cards in both locales", async ({ browser }) => {
  test.setTimeout(120_000);
  mkdirSync(output, { recursive: true });
  for (const width of [390, 820, 1180]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 }, isMobile: true, hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { fidelitySample: "full" });
      await page.goto("/#/overview");
      const value = page.locator(width === 390 ? ".fd-overview-value" : ".t3-total-overview .t3-hero-value");
      const card = page.locator(width === 390 ? ".fd-overview-hero" : ".t3-total-overview .t3-hero-card");
      const divider = width === 390 ? undefined : page.locator(".t3-total-overview .t3-pnl-compact-card > div > div > div").first();
      await expect(value).toContainText("$763,809.27", { timeout: 30_000 });
      for (const locale of ["en", "zh"]) {
        await page.evaluate((locale) => localStorage.setItem("track3-ui-locale", locale), locale);
        await page.reload();
        await expect(value).toBeVisible({ timeout: 30_000 });
        if (width !== 390) await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
        if (width !== 390) await expect(value).toHaveCSS("font-size", "48px");
        if (width !== 390) await assertEqualStatGutters(page.locator(".t3-total-overview .t3-pnl-compact-card > div > div > div"));
        for (const zoom of [1, 1.25, 1.5, 2]) {
          await page.evaluate((zoom) => { document.documentElement.style.setProperty("zoom", String(zoom)); }, zoom);
          for (const amount of amounts) {
            await value.evaluate((element, amount) => { element.textContent = amount; }, amount);
            await assertValueFits(value, card, divider);
            if (zoom === 1 && amount === "$1,653,296.05") {
              await page.screenshot({ path: `${output}/${width === 390 ? "phone" : "ipad"}-${width}-${locale}.png` });
            }
          }
        }
      }
    } finally {
      await context.close();
    }
  }
});

test("other phone hero totals stay inside their own metric columns", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { fidelitySample: "full" });
    for (const [route, selectors] of [
      ["summary", [".fd-summary .fd-primary-stat strong", ".fd-summary .fd-big-value"]],
      ["wallets", [".fd-wallet-main-stat > strong"]],
      ["comparison", [".fd-comparison-kpis > div:first-child strong", ".fd-comparison-kpis > div:nth-child(2) strong", ".fd-comparison-total strong"]],
      ["cost-basis", [".fidelity-kpi-primary .fidelity-kpi-metric:first-child strong", ".fidelity-kpi-primary .fidelity-kpi-metric:nth-child(2) strong", ".fidelity-kpi-secondary > div:nth-child(2) strong"]],
    ] as const) {
      await page.goto(`/#/${route}`);
      await page.waitForLoadState("networkidle");
      for (const selector of selectors) {
        const value = page.locator(selector).first();
        await expect(value).toBeVisible({ timeout: 30_000 });
        await value.evaluate((element) => {
          element.textContent = "−$999,999,999.99";
          if (element.closest(".fidelity-cost-kpis")) element.classList.add("fidelity-long-money");
        });
        const fit = await value.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const parent = element.parentElement!.getBoundingClientRect();
          return { right: range.getBoundingClientRect().right, limit: parent.right,
            scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, inline: getComputedStyle(element).display === "inline" };
        });
        expect(fit.right, `${route} ${selector}`).toBeLessThanOrEqual(fit.limit);
        if (!fit.inline) expect(fit.scrollWidth, `${route} ${selector}`).toBeLessThanOrEqual(fit.clientWidth);
      }
    }
  } finally {
    await context.close();
  }
});
