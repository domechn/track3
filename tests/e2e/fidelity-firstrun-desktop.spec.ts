import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

const output = "/tmp/fidelity-desktop/firstrun";

test("First-run desktop captures empty and one configured source", async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "desktop");
  mkdirSync(output, { recursive: true });

  for (const state of ["empty", "one"] as const) {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      colorScheme: "dark",
      reducedMotion: "reduce",
      timezoneId: "UTC",
    });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
      await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
      await installTauriBridge(page, { emptyPortfolio: true });
      if (state === "one") {
        await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
          query: "INSERT INTO configuration (id, data) VALUES (10, ?)",
          values: ["!ent:e2e:exchanges:\n  - name: binance\n    alias: Binance\n    initParams:\n      apiKey: fake-test-key\n      secret: fake-test-secret\n"],
        }));
      }
      await page.goto("/#/overview");
      if (state === "one") await expect.poll(() => page.evaluate(async () => {
        const configurationPath = "/src/middlelayers/configuration.ts";
        const { getConfiguration } = await import(configurationPath);
        return (await getConfiguration())?.exchanges?.length ?? 0;
      })).toBe(1);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.locator(".t3-fr")).toHaveAttribute("data-mode", state);
      await expect(page.locator(".t3-fr")).toHaveAttribute("aria-busy", "false");
      await page.screenshot({ path: `${output}/firstrun-${state}-desktop.png`, fullPage: true });
      writeFileSync(`${output}/firstrun-${state}-geometry.json`, JSON.stringify(await page.evaluate(() =>
        [...document.querySelectorAll(".t3-fr-heading, .t3-fr-banner, .t3-fr-grid, .t3-fr-card")].map((element) => {
          const bounds = element.getBoundingClientRect();
          return { className: element.className, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
        })), null, 2));
      await expect.soft(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    } finally {
      await context.close();
    }
  }
});
