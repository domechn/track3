import { expect, test } from "@playwright/test";
import { assertNoOverflow } from "./layout-audit";
import { seedLayoutFixture } from "./layout-audit-scenes";

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop"));

for (const { width, expanded } of [{ width: 1100, expanded: false }, { width: 1280, expanded: true }]) {
  test(`Summary month amount fits at ${width}px${expanded ? " with expanded sidebar" : ""}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    try {
      await seedLayoutFixture(page, "real");
      await page.goto("/#/summary", { waitUntil: "commit" });
      await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
      if (expanded) await page.getByRole("button", { name: "Expand sidebar" }).click();
      const amount = page.locator(".fidelity-month-card").filter({ hasText: "¥7,823,583" })
        .locator(".text-muted-foreground").filter({ hasText: "Unrecorded changes" });
      await expect(amount).toBeVisible();
      await amount.scrollIntoViewIfNeeded();
      expect((await assertNoOverflow(page)).filter((issue) => issue.rule === "R7")).toEqual([]);
      await page.screenshot({ path: `/tmp/wui40-summary-month-${width}${expanded ? "-expanded" : ""}.png` });
    } finally {
      await context.close();
    }
  });
}
