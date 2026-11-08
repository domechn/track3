import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installProfitHintHistory } from "./profit-hint-scenes";
import { installTauriBridge as installFidelityBridge } from "./fidelity-scenes";

const out = ".local/profit-hint-popover";
const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("phone full year leaves room for the breakdown control", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, userAgent: iPhoneUserAgent,
    isMobile: true, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC",
  });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installFidelityBridge(page, { fidelitySample: "full" });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
    const geometry = await page.locator(".fd-year[data-partial='false']").first().evaluate((card) => {
      const box = card.getBoundingClientRect();
      const amount = card.querySelector("strong")!.getBoundingClientRect();
      const deposits = card.querySelector(".fd-year-deposit")!.getBoundingClientRect();
      const foot = card.querySelector(".fd-year-foot")!.getBoundingClientRect();
      return {
        amount: Math.round(amount.top - box.top),
        deposits: Math.round(deposits.top - box.top),
        footerGap: Math.round(foot.top - deposits.bottom),
        height: Math.round(box.height),
      };
    });
    expect(geometry).toEqual({ amount: 38, deposits: 106, footerGap: 46, height: 200 });
    expect((await page.locator(".fd-year[data-partial='false']").first()
      .getByRole("button", { name: "Recorded inflow breakdown" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  } finally {
    await context.close();
  }
});

test("phone Jun, Jul, Aug partial hints stay boxed and inside the screen", async ({ browser }) => {
  test.setTimeout(180_000);
  mkdirSync(out, { recursive: true });
  for (const theme of ["dark", "light"] as const) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, userAgent: iPhoneUserAgent,
      isMobile: true, hasTouch: true, colorScheme: theme, reducedMotion: "reduce", timezoneId: "UTC",
    });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installProfitHintHistory(page);
      await page.goto("/#/summary");
      await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
      const panel = page.locator(".fd-profit-summary");
      for (const month of ["Jun", "Jul", "Aug"]) {
        const card = panel.locator(".fd-month").filter({ has: page.locator(".fd-month-top b").getByText(month, { exact: true }) });
        await expect(card).toHaveAttribute("data-partial", "true");
        await card.hover();
        const badge = card.getByRole("button", { name: `Explain partial profit for ${month}` });
        await expect(badge).toHaveAttribute("aria-expanded", "true");
        await expect(page.getByRole("tooltip")).toHaveCount(1);
        await expect(page.getByRole("tooltip")).toContainText("ETH");
        await page.keyboard.press("Escape");
        await badge.tap();
        await expect(page.getByRole("tooltip")).toHaveCount(1);
        const hint = page.getByRole("tooltip");
        await expect(hint).toContainText("ETH");
        await expect(hint).not.toContainText("P&L %");
        const box = (await hint.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(390);
        expect(box.y + box.height).toBeLessThanOrEqual(844);
        const cardBox = (await card.boundingBox())!;
        expect(box.y + box.height <= cardBox.y || box.y >= cardBox.y + cardBox.height
          || box.x + box.width <= cardBox.x || box.x >= cardBox.x + cardBox.width).toBe(true);
        await page.screenshot({ path: `${out}/phone-390-${theme}-${month}.png` });
        expect(await hint.evaluate((node) => getComputedStyle(node).borderTopWidth)).toBe("1px");
        expect(await hint.evaluate((node) => getComputedStyle(node).borderTopLeftRadius)).toBe("6px");
        expect(await hint.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
      }
      await panel.getByRole("button", { name: "How P&L % is calculated" }).tap();
      await expect(page.getByRole("tooltip")).toHaveCount(1);
      await expect(page.getByRole("tooltip")).toContainText("opening value plus recorded buys and deposits");
      const years = page.locator(".fd-years");
      const cards = years.locator(".fd-year");
      await expect(cards).toHaveCount(3);
      for (const year of ["2026", "2025", "2024"]) {
        const card = cards.filter({ has: page.locator(".fd-month-top b").getByText(year, { exact: true }) });
        const lines = await card.evaluate((node) => {
          const amount = node.querySelector("strong")!;
          const deposits = node.querySelector(".fd-year-deposit span")!;
          const foot = node.querySelector(".fd-year-foot")!;
          return [amount, deposits, foot].map((item) => item.getBoundingClientRect().height / parseFloat(getComputedStyle(item).lineHeight));
        });
        expect(lines[0], `${year} amount`).toBeLessThanOrEqual(1.1);
        expect(lines[1], `${year} deposits`).toBeLessThanOrEqual(1.1);
        expect(lines[2], `${year} counts`).toBeLessThanOrEqual(3);
      }
      await cards.first().hover();
      const yearBadge = cards.first().getByRole("button", { name: "Explain partial profit for 2026" });
      await expect(yearBadge).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("tooltip")).toHaveCount(1);
      await expect(page.getByRole("tooltip")).toContainText("Pair the withdrawal in History");
      const hintBox = (await page.getByRole("tooltip").boundingBox())!;
      const cardBox = (await cards.first().boundingBox())!;
      expect(hintBox.x).toBeGreaterThanOrEqual(0);
      expect(hintBox.y).toBeGreaterThanOrEqual(0);
      expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(390);
      expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(844);
      expect(hintBox.y + hintBox.height <= cardBox.y || hintBox.y >= cardBox.y + cardBox.height
        || hintBox.x + hintBox.width <= cardBox.x || hintBox.x >= cardBox.x + cardBox.width).toBe(true);
      await page.screenshot({ path: `${out}/phone-390-${theme}-year-tooltip.png` });
      await years.screenshot({ path: `${out}/phone-390-${theme}-years.png` });
      await cards.first().evaluate((node) => node.scrollIntoView({ block: "start" }));
      const nearTopCard = (await cards.first().boundingBox())!;
      expect(nearTopCard.y).toBeLessThan(110);
      await cards.first().hover({ force: true });
      await expect(yearBadge).toHaveAttribute("aria-expanded", "true");
      const flippedHint = (await page.getByRole("tooltip").boundingBox())!;
      const flippedCard = (await cards.first().boundingBox())!;
      expect(flippedHint.y).toBeGreaterThanOrEqual(flippedCard.y + flippedCard.height);
      expect(flippedHint.y + flippedHint.height).toBeLessThanOrEqual(844);
      await page.screenshot({ path: `${out}/phone-390-${theme}-year-flipped.png` });
    } finally {
      await context.close();
    }
  }
});
