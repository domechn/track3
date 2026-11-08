import { expect, test } from "@playwright/test";
import { seedAdditiveProfitHistory } from "./pnl-additive-scenes";

test("phone Summary limits the partial P&L badge to the selected range", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    timezoneId: "UTC", reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2024-12-31T12:00:00Z"));
    await seedAdditiveProfitHistory(page);
    await page.goto("/#/summary", { waitUntil: "commit", timeout: 120_000 });
    const card = page.locator(".fd-profit-loss");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
    await expect(card.getByRole("button", { name: /Explain partial profit/ })).toHaveCount(1);
    await page.getByRole("radio", { name: "90D" }).click();
    await expect(card.locator(".fd-primary-stat strong")).not.toHaveText("—");
    await expect(card.getByRole("button", { name: /Explain partial profit/ })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
