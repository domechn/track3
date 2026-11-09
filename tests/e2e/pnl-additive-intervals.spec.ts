import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { seedAdditiveProfitHistory, visibleAmount } from "./pnl-additive-scenes";

test("2024 desktop year known P&L equals its months at 1280px", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.setFixedTime(new Date("2024-12-31T12:00:00Z"));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await seedAdditiveProfitHistory(page);
  await page.goto("/#/summary", { waitUntil: "commit", timeout: 120_000 });
  mkdirSync(".local/ui46-final", { recursive: true });
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 60_000 });
  await page.screenshot({ path: ".local/ui46-final/additive-desktop-initial.png", fullPage: true });
  const months = page.locator(".fidelity-month-card");
  await expect(months).toHaveCount(12);
  const values = (await months.locator(".fidelity-month-value").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("title")))).map(visibleAmount);
  const year = page.locator(".fidelity-year-item").filter({ hasText: "2024" });
  await expect(year).toHaveAttribute("data-partial", "true");
  const annual = visibleAmount(await year.locator("strong").first().textContent());
  expect(annual).toBe(409_328);
  expect(Math.abs(annual - values.reduce((sum, value) => sum + value, 0))).toBeLessThanOrEqual(1);
  await expect(months.filter({ has: page.locator(".fidelity-month-head b").getByText("Mar", { exact: true }) })).toHaveAttribute("data-partial", "true");
  await expect(months.locator('[aria-label^="Explain partial profit"]')).toHaveCount(1);
  await expect(page.locator('.fidelity-year-stack [aria-label^="Explain partial profit"]')).toHaveCount(1);
  await expect(year.locator(".fidelity-year-deposits")).toContainText("217,677");
  await page.locator(".fidelity-month-grid").screenshot({ path: ".local/ui46-final/additive-desktop-months.png" });
  await page.locator(".fidelity-year-stack").screenshot({ path: ".local/ui46-final/additive-desktop-year.png" });
  await year.getByRole("button", { name: "Explain partial profit for 2024" }).click();
  await expect(page.locator('[role="tooltip"][data-state="open"]')).toContainText("1 affected month(s)");
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
  await page.screenshot({ path: ".local/ui46-final/additive-desktop-1280.png", fullPage: true });
});
