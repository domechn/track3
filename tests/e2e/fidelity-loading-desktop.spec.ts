import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

test("Loading desktop captures the real portfolio boot state", async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== "desktop");
  mkdirSync("/tmp/fidelity-desktop/loading", { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 }, colorScheme: "dark",
    reducedMotion: "reduce", timezoneId: "UTC",
  });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.addInitScript(() => {
      const original = (window as any).__e2eInvoke;
      (window as any).__e2eInvoke = async (cmd: string, args: any, ...rest: any[]) => {
        if (cmd === "plugin:sql|select" && /assets_v2/i.test(args.query)) {
          await new Promise((resolve) => setTimeout(resolve, 8000));
        }
        return original(cmd, args, ...rest);
      };
    });
    await page.goto("/#/overview");
    await expect(page.getByRole("status", { name: "Loading overview" })).toBeVisible();
    const kpiBottoms = await page.locator(".t3-desktop-skeleton-kpis > div").evaluateAll((columns) =>
      columns.map((column) => column.lastElementChild!.getBoundingClientRect().bottom));
    expect(Math.max(...kpiBottoms) - Math.min(...kpiBottoms)).toBeLessThan(1);
    await page.screenshot({ path: "/tmp/fidelity-desktop/loading/loading-desktop.png", fullPage: true, animations: "disabled" });
  } finally {
    await context.close();
  }
});
