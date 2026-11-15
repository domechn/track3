import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-captures";

const output = "/tmp/overview-date-ticks";

test("Overview date ticks fit the chart at desktop and narrow widths", async ({ browser }) => {
  test.setTimeout(180_000);
  mkdirSync(output, { recursive: true });

  for (const count of [15, 80, 1000]) {
    const context = await browser.newContext({
      viewport: { width: 1100, height: 900 },
      colorScheme: "dark",
      reducedMotion: "reduce",
      timezoneId: "UTC",
    });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-11-15T12:00:00Z"));
      await installTauriBridge(page);
      await page.evaluate(async (count) => {
        const invoke = (window as any).__e2eInvoke as
          (command: string, args: { query: string; values: unknown[] }) => Promise<unknown>;
        await invoke("plugin:sql|execute", { query: "DELETE FROM assets_v2", values: [] });
        await invoke("plugin:sql|execute", {
          query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '5000')", values: [],
        });
        const end = Date.parse("2026-11-15T12:00:00Z");
        const spanDays = count === 1000 ? 15 : count - 1;
        for (let offset = 0; offset < count; offset += 50) {
          const values: unknown[] = [];
          const rows = Math.min(50, count - offset);
          for (let i = 0; i < rows; i++) {
            const index = offset + i;
            const createdAt = new Date(end - spanDays * 86400000 +
              index / (count - 1) * spanDays * 86400000).toISOString();
            const value = 9_000_000 + Math.round(index / (count - 1) * 1_000_000);
            values.push(`date-tick-${index}`, createdAt, "wallet-1", "crypto", "BTC", 1, value, value);
          }
          await invoke("plugin:sql|execute", {
            query: `INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
              VALUES ${Array.from({ length: rows }, () => "(?, ?, ?, ?, ?, ?, ?, ?)").join(",")}`,
            values,
          });
        }
      }, count);
      await page.goto("/#/overview");
      await expect(page.locator(".t3-chart-end-value")).toBeVisible({ timeout: 30_000 });

      for (const width of [1100, 1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(100);
        const chart: {
          x: { index: number; text: string; center: number; width: number }[];
          points: number; tagY: number; tagHeight: number; visibleY: number[];
        } = await page.locator(".t3-hero-chart canvas").evaluate(async (canvas: HTMLCanvasElement) => {
          const source = await fetch("/src/components/total-value-and-change.tsx").then((response) => response.text());
          const moduleUrl = source.match(/from "(\/node_modules\/\.vite\/deps\/chart__js\.js[^"]*)"/)?.[1];
          if (!moduleUrl) throw new Error("Chart.js module URL was not found");
          const { Chart } = await import(/* @vite-ignore */ moduleUrl);
          const instance = Chart.getChart(canvas);
          if (!instance) throw new Error("Overview Chart.js instance was not found");
          const scale = instance.scales.x;
          const ctx = canvas.getContext("2d")!;
          ctx.font = '12px "Public Sans Variable", "Public Sans", system-ui, sans-serif';
          const x = scale.ticks.filter((tick: { label?: string }) => tick.label)
            .map((tick: { value: number; label: string }) => ({
              index: tick.value,
              text: tick.label,
              center: scale.getPixelForValue(tick.value),
              width: ctx.measureText(tick.label).width + 12,
            }));
          const tag = canvas.parentElement!.querySelector(".t3-chart-end-value")!.getBoundingClientRect();
          const canvasBox = canvas.getBoundingClientRect();
          const visibleY = instance.scales.y.ticks.filter((tick: { label?: string }) => tick.label)
            .map((tick: { value: number }) => canvasBox.y + instance.scales.y.getPixelForValue(tick.value));
          return {
            x, points: instance.data.labels.length,
            tagY: tag.y + tag.height / 2, tagHeight: tag.height, visibleY,
          };
        });
        expect(chart.x[0]?.index).toBe(0);
        expect(chart.x.at(-1)?.index).toBe(chart.points - 1);
        expect(new Set(chart.x.map(({ text }) => text)).size).toBe(chart.x.length);
        for (let i = 1; i < chart.x.length; i++) {
          const before = chart.x[i - 1];
          const after = chart.x[i];
          expect(after.center - after.width / 2 - before.center - before.width / 2).toBeGreaterThanOrEqual(0);
        }
        for (const y of chart.visibleY) {
          expect(Math.abs(y - chart.tagY)).toBeGreaterThanOrEqual(chart.tagHeight / 2 + 11);
        }
        if (count === 1000 && width === 1100) {
          await page.locator(".t3-grid-hero").screenshot({ path: `${output}/dark.png` });
          await page.evaluate(() => localStorage.setItem("track3-ui-theme", "light"));
          await page.reload();
          await expect(page.locator(".t3-chart-end-value")).toBeVisible({ timeout: 30_000 });
          await page.locator(".t3-grid-hero").screenshot({ path: `${output}/light.png` });
        }
      }
    } finally {
      await context.close();
    }
  }
});
