import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

test("iPad Overview changes keep long CNY and JPY amounts intact when columns stack", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 820, height: 900 }, isMobile: true, hasTouch: true, reducedMotion: "reduce",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.goto("/#/overview");
    const card = page.locator(".overview-sections .t3-total-overview");
    const amounts = card.locator(".overview-pnl-metric-amount");
    await expect(amounts).toHaveCount(3, { timeout: 30_000 });
    mkdirSync("/tmp/track3-overview-change-no-wrap", { recursive: true });
    for (const width of [820, 1180, 340]) {
      if (width === 340) {
        await card.evaluate((node) => { (node as HTMLElement).style.width = "340px"; });
      } else {
        await card.evaluate((node) => { (node as HTMLElement).style.removeProperty("width"); });
        await page.setViewportSize({ width, height: 900 });
      }
      for (const amount of ["-¥1,028,089.59", "+¥1,028,089,590.00"]) {
        await amounts.evaluateAll((nodes, amount) => nodes.forEach((node) => { node.textContent = amount; }), amount);
        const geometry = await card.locator(".overview-pnl-metric").evaluateAll((cells) => cells.map((cell) => {
          const p = cell.querySelector("p")!;
          const style = getComputedStyle(p);
          const range = document.createRange();
          range.selectNodeContents(p);
          return { height: range.getBoundingClientRect().height, lineHeight: parseFloat(style.lineHeight),
            scrollWidth: p.scrollWidth, clientWidth: p.clientWidth, whiteSpace: style.whiteSpace,
            numeric: style.fontVariantNumeric };
        }));
        expect(geometry).toHaveLength(3);
        for (const line of geometry) {
          expect(line.height).toBeLessThanOrEqual(line.lineHeight * 1.3);
          expect(line.scrollWidth).toBeLessThanOrEqual(line.clientWidth);
          expect(line.whiteSpace).toBe("nowrap");
          expect(line.numeric).toContain("tabular-nums");
        }
        if (width !== 340 && amount.startsWith("-"))
          await card.screenshot({ path: `/tmp/track3-overview-change-no-wrap/ipad-${width}.png` });
      }
    }
  } finally {
    await context.close();
  }
});
