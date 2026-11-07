import { expect, test, type Page } from "@playwright/test";
import { installTauriBridge } from "./fidelity-scenes";
import { expectDailyColours } from "./direction-colors-scenes";

const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
test.use({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function checkDailyColours(page: Page, themes: ("dark" | "light")[] = ["dark", "light"]) {
  const chartType = page.viewportSize()?.width === 390 ? "phone" : "ipad";
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
  await installTauriBridge(page, { fidelitySample: "full" });
  for (const theme of themes) {
    await page.goto("/#/overview", { waitUntil: "domcontentloaded" });
    await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await page.reload({ waitUntil: "domcontentloaded" });
    if (chartType === "phone") await expect(page.locator(".fd-overview[data-state='ready']")).toBeVisible({ timeout: 20_000 });
    const before = await expectDailyColours(page, chartType);
    await page.goto("/#/settings/appearance", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Red Up / Green Down" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-quote", "red-up");
    await page.goto("/#/overview", { waitUntil: "domcontentloaded" });
    if (chartType === "phone") await expect(page.locator(".fd-overview[data-state='ready']")).toBeVisible({ timeout: 20_000 });
    const after = await expectDailyColours(page, chartType);
    expect(after.gain).toBe(before.loss);
    expect(after.loss).toBe(before.gain);
    await page.goto("/#/settings/appearance", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Green Up / Red Down" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-quote", "green-up");
  }
}

test("Daily change uses the selected gain and loss colours in both phone themes", async ({ page }) => {
  test.setTimeout(120_000);
  await checkDailyColours(page);
});

test("Wallets source and asset deltas keep their colours in both phone themes", async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
  await installTauriBridge(page, { fidelitySample: "full" });
  for (const theme of ["dark", "light"]) {
    await page.goto("/#/overview", { waitUntil: "domcontentloaded" });
    await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await page.reload({ waitUntil: "domcontentloaded" });
    for (const quote of ["green-up", "red-up"]) {
      if (quote === "red-up") {
        await page.goto("/#/settings/appearance", { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: "Red Up / Green Down" }).click();
      }
      await page.goto("/#/wallets", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Binance", exact: true }).click();
      const header = page.locator(".fd-wallet-main-stat > small");
      const balance = page.locator(".fd-wallet-balance").filter({ hasText: "USDT" }).locator("small:last-child");
      await expect(header).toHaveAttribute("data-tone", "gain");
      await expect(balance).toHaveAttribute("data-tone", "loss");
      const colours = await page.locator(".fd-page").evaluate((root) => {
        const sample = document.createElement("span");
        root.append(sample);
        sample.style.color = "var(--fd-gain)";
        const gain = getComputedStyle(sample).color;
        sample.style.color = "var(--fd-loss)";
        const loss = getComputedStyle(sample).color;
        sample.remove();
        return { gain, loss };
      });
      expect(await header.evaluate((node) => getComputedStyle(node).color)).toBe(colours.gain);
      expect(await balance.evaluate((node) => getComputedStyle(node).color)).toBe(colours.loss);
      if (quote === "red-up") {
        await page.goto("/#/settings/appearance", { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: "Green Up / Red Down" }).click();
      }
    }
  }
});

for (const theme of ["dark", "light"] as const) {
  test(`Daily change uses the selected gain and loss colours on iPad in ${theme}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true,
    });
    try {
      await checkDailyColours(await context.newPage(), [theme]);
    } finally {
      await context.close();
    }
  });
}

test("iPad coin 24h loss follows the quote-colour preference", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { fidelitySample: "full" });
    for (const theme of ["dark", "light"]) {
      await page.goto("/#/overview", { waitUntil: "domcontentloaded" });
      await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.goto("/#/coins/BTC", { waitUntil: "domcontentloaded" });
      const badge = page.locator(".coin-detail-change .mobile-delta-pill");
      await expect(badge).toContainText("-", { timeout: 20_000 });
      await expect(badge).toHaveAttribute("data-tone", "loss", { timeout: 20_000 });
      const before = await badge.evaluate((node) => getComputedStyle(node).color);
      await page.goto("/#/settings/appearance", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Red Up / Green Down" }).click();
      await page.goto("/#/coins/BTC", { waitUntil: "domcontentloaded" });
      await expect(badge).toContainText("-", { timeout: 20_000 });
      await expect(badge).toHaveAttribute("data-tone", "gain", { timeout: 20_000 });
      expect(await badge.evaluate((node) => getComputedStyle(node).color)).not.toBe(before);
      await page.goto("/#/settings/appearance", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Green Up / Red Down" }).click();
    }
  } finally {
    await context.close();
  }
});
