import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";
import { amounts, assertEqualStatGutters, assertValueFits, output } from "./overview-value-fit-scenes";

test("desktop Overview total fits beside its divider at all supported widths and zooms", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "desktop");
  mkdirSync(output, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/#/overview");
  const value = page.locator(".t3-total-overview .t3-hero-value");
  const card = page.locator(".t3-total-overview .t3-hero-card");
  const divider = page.locator(".t3-total-overview .t3-pnl-compact-card > div > div > div").first();
  await expect(value).toContainText("$763,809.27", { timeout: 30_000 });
  for (const locale of ["en", "zh"]) {
    await page.evaluate((locale) => localStorage.setItem("track3-ui-locale", locale), locale);
    await page.reload();
    await expect(value).toBeVisible();
    // CSS zoom stresses text fit; viewport widths cover media-query changes.
    for (const zoom of [1, 1.25, 1.5, 2]) {
      await page.evaluate((zoom) => { document.documentElement.style.setProperty("zoom", String(zoom)); }, zoom);
      for (const width of [900, 1024, 1280, 1440, 1920, 2560]) {
        await page.setViewportSize({ width, height: 900 });
        await assertEqualStatGutters(page.locator(".t3-total-overview .t3-pnl-compact-card > div > div > div"));
        for (const amount of amounts) {
          await value.evaluate((element, amount) => { element.textContent = amount; }, amount);
          await assertValueFits(value, card, divider);
          if (zoom === 1 && width === 1280 && amount === "$1,653,296.05") {
            await page.screenshot({ path: `${output}/desktop-1280-${locale}.png` });
          }
        }
      }
    }
  }
});

test("other desktop hero totals fit their own metric columns", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
  await installTauriBridge(page, { fidelitySample: "full" });
  for (const [route, selectors] of [
    ["summary", [".fidelity-summary-pnl-kpis > div:first-child strong", ".fidelity-ath-value"]],
    ["wallets", [".t3-wallet-kpis > div:first-child strong"]],
    ["comparison", [".t3-cmp-kpis > div:first-child strong", ".t3-cmp-kpis > div:nth-child(2) strong"]],
    ["cost-basis", [".fidelity-cost-kpi-row .fidelity-metric:first-child strong", ".fidelity-cost-kpi-row .fidelity-metric:nth-child(2) strong"]],
  ] as const) {
    await page.goto(`/#/${route}`);
    await page.waitForLoadState("networkidle");
    for (const zoom of [1, 1.5, 2]) {
      await page.evaluate((zoom) => { document.documentElement.style.setProperty("zoom", String(zoom)); }, zoom);
      for (const width of route === "wallets" || route === "comparison" ? [1440] : [900, 1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const selector of selectors) {
          const value = page.locator(selector).first();
          await expect(value).toBeVisible({ timeout: 30_000 });
          await value.evaluate((element) => {
            element.textContent = "−$999,999,999.99";
            if (element.matches(".fidelity-summary-pnl-kpis strong.big")) element.classList.add("fidelity-long-money");
          });
          const fit = await value.evaluate((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            const parent = element.parentElement!.getBoundingClientRect();
            const card = element.closest(".fidelity-card, .t3-wallet-card, .t3-cmp-card, .fidelity-cost-kpis")!.getBoundingClientRect();
            return { right: range.getBoundingClientRect().right, limit: Math.min(parent.right, card.right - 16),
              scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, inline: getComputedStyle(element).display === "inline" };
          });
          expect(fit.right, `${route} ${selector} at ${width}px/${zoom}×`).toBeLessThanOrEqual(fit.limit);
          if (!fit.inline) expect(fit.scrollWidth, `${route} ${selector} at ${width}px/${zoom}×`).toBeLessThanOrEqual(fit.clientWidth);
        }
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [route, selector] of [
    ["wallets", ".t3-wallet-legacy [data-testid='stat-total-value'] span"],
    ["comparison", ".t3-cmp-legacy p[title]"],
    ["cost-basis", ".fidelity-cost-kpi-row .fidelity-metric:nth-child(2) strong"],
  ] as const) {
    await page.goto(`/#/${route}`);
    const value = page.locator(selector).first();
    await expect(value).toBeVisible({ timeout: 30_000 });
    await value.evaluate((element) => { element.textContent = "−$999,999,999.99"; });
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
});
