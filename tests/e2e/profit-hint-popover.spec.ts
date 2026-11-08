import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installProfitHintHistory } from "./profit-hint-scenes";

const out = ".local/profit-hint-popover";

async function checkHint(page: Page, badge: Locator) {
  await expect(badge).toHaveAttribute("aria-expanded", "true");
  const contentId = await badge.getAttribute("aria-describedby");
  expect(contentId).toBeTruthy();
  const hint = page.locator(`[id="${contentId}"]`);
  await expect(hint).toBeVisible();
  const tooltips = page.getByRole("tooltip");
  await expect(tooltips).toHaveCount(1);
  await expect(hint).toContainText("ETH");
  await expect(hint).toContainText("Pair the withdrawal in History");
  await expect(hint).not.toContainText("P&L %");
  const geometry = await hint.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      left: box.left, right: box.right, top: box.top, bottom: box.bottom,
      border: parseFloat(style.borderTopWidth), radius: parseFloat(style.borderTopLeftRadius),
      background: style.backgroundColor, shadow: style.boxShadow,
      z: Number(style.zIndex), width: box.width, height: box.height,
    };
  });
  expect(geometry.border).toBeGreaterThanOrEqual(1);
  expect(geometry.radius).toBe(6);
  expect(geometry.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(geometry.shadow).not.toBe("none");
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(geometry.bottom).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(geometry.width).toBeLessThanOrEqual(360);
  expect(geometry.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.4);
  expect(geometry.z).toBeGreaterThan(50);
}

async function checkYearCards(page: Page, width: number, theme: string) {
  const panel = page.locator(".fidelity-year-section");
  const cards = panel.locator(".fidelity-year-item");
  await expect(cards).toHaveCount(3);
  for (const year of ["2026", "2025", "2024"]) {
    const card = cards.filter({ has: page.locator(".fidelity-year-head b").getByText(year, { exact: true }) });
    const measurements = await card.evaluate((node) => {
      const amount = node.querySelector("strong")!;
      const deposits = node.querySelector(".fidelity-year-deposits span:last-child")!;
      const foot = node.querySelector(".fidelity-year-foot")!;
      return [amount, deposits, foot].map((item) => item.getBoundingClientRect().height / parseFloat(getComputedStyle(item).lineHeight));
    });
    expect(measurements[0], `${year} amount must stay on one line`).toBeLessThanOrEqual(1.1);
    expect(measurements[1], `${year} deposits must stay on one line`).toBeLessThanOrEqual(1.1);
    expect(measurements[2], `${year} counts must not wrap word by word`).toBeLessThanOrEqual(3);
  }
  const current = cards.first();
  await expect(current).toHaveAttribute("data-partial", "true");
  await current.hover();
  const badge = current.getByRole("button", { name: "Explain partial profit for 2026" });
  await checkHint(page, badge);
  const hintBox = (await page.locator(`[id="${await badge.getAttribute("aria-describedby")}"]`).boundingBox())!;
  const cardBox = (await current.boundingBox())!;
  expect(hintBox.y + hintBox.height <= cardBox.y || hintBox.y >= cardBox.y + cardBox.height
    || hintBox.x + hintBox.width <= cardBox.x || hintBox.x >= cardBox.x + cardBox.width).toBe(true);
  await badge.focus();
  await expect(page.getByRole("tooltip")).toHaveCount(1);
  await page.screenshot({ path: `${out}/desktop-${width}-${theme}-year-tooltip.png` });
  await panel.screenshot({ path: `${out}/desktop-${width}-${theme}-years.png` });
  const afterScrollHint = (await page.getByRole("tooltip").boundingBox())!;
  const afterScrollCard = (await current.boundingBox())!;
  expect(afterScrollHint.x).toBeGreaterThanOrEqual(0);
  expect(afterScrollHint.y).toBeGreaterThanOrEqual(0);
  expect(afterScrollHint.x + afterScrollHint.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(afterScrollHint.y + afterScrollHint.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(afterScrollHint.y + afterScrollHint.height <= afterScrollCard.y
    || afterScrollHint.y >= afterScrollCard.y + afterScrollCard.height
    || afterScrollHint.x + afterScrollHint.width <= afterScrollCard.x
    || afterScrollHint.x >= afterScrollCard.x + afterScrollCard.width).toBe(true);
}

for (const width of [1100, 1280, 1440]) for (const theme of ["dark", "light"] as const) {
  test(`desktop ${width} ${theme} month and three-year hints stay boxed and separate`, async ({ browser }) => {
    test.setTimeout(180_000);
    mkdirSync(out, { recursive: true });
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: "reduce", timezoneId: "UTC" });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installProfitHintHistory(page);
      await page.goto("/#/summary");
      await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
      const panel = page.locator(".fidelity-period-card").first();
      for (const month of ["Jun", "Jul", "Aug"]) {
        const card = panel.locator(".fidelity-month-card").filter({ has: page.locator(".fidelity-month-head b").getByText(month, { exact: true }) });
        await expect(card).toHaveAttribute("data-partial", "true");
        await card.hover();
        const badge = card.getByRole("button", { name: `Explain partial profit for ${month}` });
        await checkHint(page, badge);
        const hintBox = (await page.locator(`[id="${await badge.getAttribute("aria-describedby")}"]`).boundingBox())!;
        const cardBox = (await card.boundingBox())!;
        expect(hintBox.y + hintBox.height <= cardBox.y || hintBox.y >= cardBox.y + cardBox.height
          || hintBox.x + hintBox.width <= cardBox.x || hintBox.x >= cardBox.x + cardBox.width).toBe(true);
        await page.screenshot({ path: `${out}/desktop-${width}-${theme}-${month}.png` });
      }
      await panel.getByRole("button", { name: "How P&L % is calculated" }).click();
      await expect(page.getByRole("tooltip")).toHaveCount(1);
      await expect(page.getByRole("tooltip")).toContainText("opening value plus recorded buys and deposits");
      await page.locator(".fidelity-year-section").getByRole("button", { name: "How P&L % is calculated" }).click();
      await expect(page.getByRole("tooltip")).toContainText("BTC");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await checkYearCards(page, width, theme);
    } finally {
      await context.close();
    }
  });
}
