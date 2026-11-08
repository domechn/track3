import { expect, test } from "@playwright/test";
import { expectSummaryTopGeometry, seedElevenAssetSummary } from "./summary-top-list-layout-scenes";

for (const width of [820, 1280]) for (const theme of ["dark", "light"] as const) {
  test(`desktop Summary top lists fit ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), theme);
    await seedElevenAssetSummary(page);
    await page.goto("/#/summary");
    await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
    await expectSummaryTopGeometry(page, 36);
    const typography = await page.locator(".summary-top-row").first().evaluate((row) => ({
      percentSize: getComputedStyle(row.querySelector("small")!).fontSize,
      amountWeight: getComputedStyle(row.querySelector("strong")!).fontWeight,
    }));
    expect(typography).toEqual({ percentSize: "13px", amountWeight: "400" });
    await page.locator(".fidelity-leaders").scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `/tmp/summary-top-desktop-${width}-${theme}.png`, animations: "disabled" });
  });
}

test("touch Summary rows have 44px targets at 820px", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 820, height: 900 }, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedElevenAssetSummary(page);
    await page.goto("/#/summary");
    await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
    await expectSummaryTopGeometry(page, 44);
  } finally { await context.close(); }
});

test("desktop Summary includes unrecorded quantity additions in the loss percentage", async ({ page }) => {
  await seedElevenAssetSummary(page, false);
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  await expect(page.locator(".summary-top-row").filter({ has: page.locator('.t3-asset-label-name:text-is("1211.HK")') }).locator("small"))
    .toHaveText("−94.5%");
});
