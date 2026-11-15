import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

for (const width of [1280, 390]) {
  for (const count of [30, 90, 264] as const) {
    test(`${count} daily changes fit a ${width}px card in light and dark`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      await installTauriBridge(page, { dailyChangesFixture: count });
      await page.goto("/#/overview");
      const panel = page.locator(".t3-daily-panel");
      for (const theme of ["dark", "light"]) {
        if (theme === "light") {
          await page.evaluate(() => localStorage.setItem("track3-ui-theme", "light"));
          await page.reload();
        }
        await expect(panel.locator(".t3-daily-column")).not.toHaveCount(0);
        await expect(panel.locator("h2")).toHaveText(count === 264 ? "Monthly change" : count === 90 ? "Weekly change" : "Daily change");
        await expect(panel).toContainText(count === 30 ? "USD, last 30 days"
          : `${count} changes, grouped by ${count === 90 ? "week" : "month"}`);
        const layout = await panel.evaluate((node) => {
          const boxes = (selector: string) => [...node.querySelectorAll<HTMLElement>(selector)].map((element) => {
            const box = element.getBoundingClientRect();
            return { left: box.left, right: box.right };
          });
          const chart = node.querySelector(".t3-daily-chart")!.getBoundingClientRect();
          const card = node.getBoundingClientRect();
          const dates = [...node.querySelectorAll<HTMLElement>(".t3-daily-x-axis span")].map((element) => ({
            start: Number(element.dataset.start),
            text: element.textContent ?? "",
          }));
          return {
            bars: boxes(".t3-daily-column > span"), labels: boxes(".t3-daily-x-axis span"),
            heading: boxes(".t3-overview-panel-heading > *"), chart: { left: chart.left, right: chart.right },
            card: { left: card.left, right: card.right }, dates,
          };
        });
        expect(layout.bars.length).toBeLessThanOrEqual(width === 390 ? 40 : 60);
        if (count === 30) expect(layout.bars).toHaveLength(30);
        for (const bar of layout.bars) {
          expect(bar.left).toBeGreaterThanOrEqual(layout.chart.left);
          expect(bar.right).toBeLessThanOrEqual(layout.chart.right);
        }
        for (const text of [...layout.labels, ...layout.heading]) {
          expect(text.left).toBeGreaterThanOrEqual(layout.card.left);
          expect(text.right).toBeLessThanOrEqual(layout.card.right);
        }
        for (const boxes of [layout.bars, layout.labels]) {
          for (let index = 1; index < boxes.length; index++) {
            expect(boxes[index].left, `${width}px ${theme}: element ${index} overlaps`).toBeGreaterThanOrEqual(boxes[index - 1].right - 0.1);
          }
        }
        expect(layout.dates.length).toBeGreaterThanOrEqual(2);
        for (let index = 1; index < layout.dates.length; index++) {
          expect(layout.dates[index].start).toBeGreaterThan(layout.dates[index - 1].start);
          expect(layout.dates[index].text).not.toBe(layout.dates[index - 1].text);
        }
        await panel.screenshot({ path: testInfo.outputPath(`daily-${count}-${width}-${theme}.png`) });
      }
    });
  }
}
