import "./fidelity-summary.spec";
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

for (const fixture of ["twenty-months", "five-in-one-month"] as const) {
  test(`phone Summary P&L labels fit with ${fixture}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: "Asia/Tokyo", reducedMotion: "reduce",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
      await installTauriBridge(page, { fidelitySample: "full" });
      if (fixture === "five-in-one-month") {
        await page.evaluate(() => (window as any).__e2eInvoke("plugin:sql|execute", {
          query: "DELETE FROM assets_v2 WHERE uuid NOT IN ('fidelity-day-26', 'fidelity-day-27', 'fidelity-day-28', 'fidelity-day-29', 'fidelity-day-30')",
          values: [],
        }));
      } else {
        await page.evaluate(async () => {
          for (const month of [3, 4, 5, 6]) {
            await (window as any).__e2eInvoke("plugin:sql|execute", {
              query: `INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
                SELECT ?, ?, wallet, asset_type, symbol, amount, value, price FROM assets_v2 WHERE uuid = 'fidelity-start'`,
              values: [`fidelity-2025-${String(month).padStart(2, "0")}`, `2025-${String(month).padStart(2, "0")}-28T09:41:00.000Z`],
            });
          }
        });
      }
      await page.goto("/#/summary");
      for (const theme of ["dark", "light"]) {
        await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
        await page.reload();
        await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 50_000 });
        await expect(page.locator("html")).toHaveClass(new RegExp(theme));
        await expect(page.locator(".fd-summary").locator("..")).toHaveCSS("opacity", "1");
        const boxes = await page.locator(".fd-summary-chart").evaluate((svg) => {
          const chart = svg.getBoundingClientRect();
          const card = svg.closest(".fd-card")!.getBoundingClientRect();
          const labels = [...svg.querySelectorAll("[data-date-tick]")].map((node) => {
            const box = node.getBoundingClientRect();
            return { text: node.textContent, left: box.left, right: box.right };
          });
          const end = svg.querySelector("[data-direction-end]")!.getBoundingClientRect();
          const best = [...svg.querySelectorAll("text")].find((node) => node.textContent?.includes("Best month"))?.getBoundingClientRect();
          return { chartLeft: chart.left, chartRight: chart.right, cardRight: card.right,
            labels, endLeft: end.left, endRight: end.right,
            bestLeft: best?.left, bestRight: best?.right };
        });
        expect(new Set(boxes.labels.map(({ text }) => text)).size).toBe(boxes.labels.length);
        for (const [index, label] of boxes.labels.entries()) {
          expect(label.left).toBeGreaterThanOrEqual(boxes.chartLeft - 1);
          expect(label.right).toBeLessThanOrEqual(boxes.chartRight + 1);
          if (index) expect(label.left - boxes.labels[index - 1].right).toBeGreaterThanOrEqual(54);
        }
        expect(boxes.endLeft).toBeGreaterThanOrEqual(boxes.chartLeft);
        expect(boxes.endRight).toBeLessThanOrEqual(boxes.cardRight - 8);
        if (boxes.bestLeft !== undefined && boxes.bestRight !== undefined) {
          expect(boxes.bestLeft).toBeGreaterThanOrEqual(boxes.chartLeft);
          expect(boxes.bestRight).toBeLessThanOrEqual(boxes.chartRight);
        }
        mkdirSync("/tmp/summary-pnl-chart", { recursive: true });
        await page.locator(".fd-summary > .fd-card").first().screenshot({ path: `/tmp/summary-pnl-chart/phone-${fixture}-${theme}.png` });
      }
    } finally { await context.close(); }
  });
}
