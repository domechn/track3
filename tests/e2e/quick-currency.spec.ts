import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce", timezoneId: "UTC" });
test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop"));

test("sidebar switches the app view between preferred CNY and USD", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await page.addInitScript(() => {
    if (!localStorage.getItem("track3-ui-theme")) localStorage.setItem("track3-ui-theme", "dark");
  });
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.evaluate(async () => {
    const execute = (query: string) =>
      (window as any).__e2eInvoke("plugin:sql|execute", { query, values: [] });
    await execute("INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('CNY', 'Chinese yuan', 'CN¥', 7.1, 1, '2099-01-01T00:00:00.000Z')");
    await execute("INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('EUR', 'Euro', '€', 0.9, 1, '2099-01-01T00:00:00.000Z')");
    await execute("INSERT INTO configuration (id, data) VALUES (7, 'CNY')");
  });
  await page.goto("/#/overview");
  const rail = page.locator(".t3-desktop-rail");
  const hero = page.locator(".t3-hero-value");
  const tableAmount = page.locator(".t3-holdings-row").first().locator("span").nth(2);
  await expect(hero).toContainText("CN¥", { timeout: 30_000 });
  await expect(tableAmount).toContainText("CN¥");
  await expect(rail.getByRole("button", { name: "Show in USD" })).toHaveAttribute("aria-pressed", "false");
  mkdirSync("/tmp/track3-quick-currency", { recursive: true });
  await page.screenshot({ path: "/tmp/track3-quick-currency/dark-collapsed.png" });
  await rail.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(rail.getByRole("button", { name: "Show in USD" })).toHaveCSS("height", "36px");
  await page.screenshot({ path: "/tmp/track3-quick-currency/dark-expanded.png" });
  await rail.getByRole("button", { name: "Show in USD" }).click();
  await expect(hero).toContainText("$763,809.27");
  await expect(tableAmount).toContainText("$");
  await expect(rail.getByRole("button", { name: "Show in CNY" })).toHaveAttribute("aria-pressed", "true");
  await expect(rail.locator(".t3-currency-switch-badge")).toHaveClass(/is-overridden/);
  expect(await page.evaluate(() => localStorage.getItem("track3.ui.display-currency-override"))).toBe("USD");
  const preference = await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|select", {
    query: "SELECT data FROM configuration WHERE id = 7", values: [],
  }));
  expect(preference).toEqual([{ data: "CNY" }]);
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
  await expect(page.locator(".fidelity-summary-pnl strong.big")).toContainText("$");
  await page.goto("/#/overview");
  await rail.getByRole("button", { name: "Show in CNY" }).click();
  await expect(hero).toContainText("CN¥");
  await expect(tableAmount).toContainText("CN¥");
  await rail.getByRole("button", { name: "Show in USD" }).click();
  await expect(hero).toContainText("$763,809.27");
  await page.reload();
  await expect(hero).toContainText("$763,809.27", { timeout: 30_000 });
  await expect(rail.getByRole("button", { name: "Show in CNY" })).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => localStorage.setItem("track3-ui-theme", "light"));
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(rail.getByRole("button", { name: "Show in CNY" })).toBeVisible();
  await expect(hero).toContainText("$763,809.27", { timeout: 30_000 });
  await rail.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(rail).toHaveCSS("width", "216px");
  await page.screenshot({ path: "/tmp/track3-quick-currency/light-expanded.png" });
  await rail.getByRole("button", { name: "Collapse sidebar" }).click();
  await page.screenshot({ path: "/tmp/track3-quick-currency/light-collapsed.png" });
  await page.goto("/#/settings/configuration?section=currency");
  const base = page.getByRole("combobox", { name: "Base Currency" });
  await expect(base).toContainText("CNY");
  await base.click();
  await page.getByRole("option", { name: "EUR - Euro" }).click();
  await expect(base).toContainText("EUR");
  await expect(rail.getByRole("button", { name: "Show in USD" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("track3.ui.display-currency-override"))).toBeNull();
  await base.click();
  await page.getByRole("option", { name: "USD - US dollar" }).click();
  await expect(base).toContainText("USD");
  await expect(rail.locator(".t3-currency-switch")).toHaveCount(0);
  expect(errors).toEqual([]);
});
