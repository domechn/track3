import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

test.use({
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
  timezoneId: "UTC",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
test.beforeEach(({}, info) => test.skip(info.project.name !== "mobile"));

async function prepare(page: import("@playwright/test").Page) {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.evaluate(async () => {
    const execute = (query: string) =>
      (window as any).__e2eInvoke("plugin:sql|execute", { query, values: [] });
    await execute("INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('CNY', 'Chinese yuan', 'CN¥', 7.1, 1, '2099-01-01T00:00:00.000Z')");
    await execute("INSERT INTO configuration (id, data) VALUES (7, 'CNY')");
  });
  mkdirSync("/tmp/track3-quick-currency", { recursive: true });
}

test("phone Settings header switches the overview currency", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  await page.goto("/#/settings");
  const button = page.locator(".ios-settings-currency-switch").getByRole("button", { name: "Show in USD" });
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await page.screenshot({ path: "/tmp/track3-quick-currency/phone-settings.png" });
  await button.click();
  await expect(page.locator(".ios-settings-currency-switch").getByRole("button", { name: "Show in CNY" }))
    .toHaveAttribute("aria-pressed", "true");
  await page.goto("/#/overview");
  await expect(page.locator(".fd-overview-value")).toContainText("$763,809.27", { timeout: 30_000 });
});

test("iPad rail switches the overview currency in both widths", async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1024 });
  await prepare(page);
  await page.goto("/#/overview");
  const rail = page.locator(".mobile-sidebar");
  const hero = page.locator(".t3-hero-value");
  await expect(hero).toContainText("CN¥", { timeout: 30_000 });
  await expect(rail.getByRole("button", { name: "Show in USD" })).toBeVisible();
  await page.screenshot({ path: "/tmp/track3-quick-currency/ipad-expanded.png" });
  await rail.getByRole("button", { name: "Show in USD" }).click();
  await expect(hero).toContainText("$763,809.27");
  await expect(rail.getByRole("button", { name: "Show in CNY" })).toHaveAttribute("aria-pressed", "true");
  await rail.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(rail.getByRole("button", { name: "Show in CNY" })).toBeVisible();
  await page.screenshot({ path: "/tmp/track3-quick-currency/ipad-collapsed.png" });
});
