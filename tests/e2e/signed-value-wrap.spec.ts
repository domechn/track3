import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";
import { expectSignedValuesOnOneLine } from "./signed-value-scenes";

const phone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const routes = ["overview", "summary", "comparison", "history", "wallets"] as const;
const roots = {
  desktop: [".t3-overview-grid", ".fidelity-summary", ".t3-cmp-legacy", ".fidelity-history", ".t3-wallet-legacy"],
  phone: [".fd-overview", ".fd-summary", ".fd-comparison", ".d2-history", ".fd-wallets"],
} as const;
const output = "/tmp/track3-signed-value-wrap";

async function expectSharedMoverTrack(page: Page, selector: string) {
  const boxes = await page.locator(selector).evaluateAll((elements) => elements.map((element) => {
    const { left, width } = element.getBoundingClientRect();
    return { left, width };
  }));
  expect(boxes.length, `${selector}: rows in the card`).toBeGreaterThan(1);
  for (const box of boxes.slice(1)) {
    expect(Math.abs(box.left - boxes[0].left), `${selector}: common track start`).toBeLessThanOrEqual(1);
    expect(Math.abs(box.width - boxes[0].width), `${selector}: common track width`).toBeLessThanOrEqual(1);
  }
}

test("signed amounts stay on one line in the real-scale fixture", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  test.setTimeout(550_000);
  mkdirSync(output, { recursive: true });
  for (const width of [1100, 1280, 390]) {
    for (const theme of ["dark", "light"] as const) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        ...(width === 390 ? { userAgent: phone, isMobile: true, hasTouch: true } : {}),
      });
      try {
        const page = await context.newPage();
        await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
        await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
        await installTauriBridge(page, { fidelitySample: "full" });
        for (const [index, route] of routes.entries()) {
          await page.goto(`/#/${route}`);
          await page.waitForLoadState("networkidle");
          const root = page.locator(roots[width === 390 ? "phone" : "desktop"][index]);
          await expect(root).toBeVisible({ timeout: 40_000 });
          if (["summary", "history"].includes(route) || (["comparison", "wallets"].includes(route) && width === 390)) {
            await expect(root).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
          }
          await expectSignedValuesOnOneLine(page, `${route} ${width}px ${theme}`);
          if (route === "overview") {
            await expectSharedMoverTrack(page, width === 390 ? ".fd-overview-mover > button" : ".t3-moved-list .t3-moved-track");
            const amount = page.locator(width === 390
              ? ".fd-overview-mover > a:last-child strong"
              : ".t3-moved-list li > strong").first();
            await expect(amount).toBeVisible();
            await amount.evaluate((element) => { element.textContent = "−¥12,345,678.90"; });
            await expect(amount).toHaveCSS("white-space", "nowrap");
            await expectSignedValuesOnOneLine(page, `long JPY amount ${width}px ${theme}`);
            await expectSharedMoverTrack(page, width === 390 ? ".fd-overview-mover > button" : ".t3-moved-list .t3-moved-track");
            const fit = await amount.evaluate((element) => ({
              right: element.getBoundingClientRect().right,
              cardRight: element.closest(".fd-card, .t3-overview-panel")!.getBoundingClientRect().right,
            }));
            expect(fit.right, `long JPY amount fits the ${width}px card`).toBeLessThanOrEqual(fit.cardRight);
            await expect(amount).toHaveText("−¥12,345,678.90");
            const panel = page.locator(width === 390 ? ".fd-overview-moved" : ".t3-moved-panel");
            await panel.screenshot({ path: `${output}/what-moved-${width}-${theme}.png`, animations: "disabled" });
          }
          if (route === "wallets" && width === 390) {
            await expectSharedMoverTrack(page, ".fd-wallet-mover > span");
          }
        }
      } finally {
        await context.close();
      }
    }
  }
});

test("desktop wallet movers share one track scale", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/#/wallets");
  await expect(page.locator(".t3-wallet-fidelity")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  await expectSharedMoverTrack(page, ".t3-wallet-mover-track");
});
