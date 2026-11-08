import { expect, test } from "@playwright/test";
import { assertNoBlankSlabs } from "./layout-audit-scenes";

test("layout audit detects a slab below a short card", async ({ page }) => {
  await page.setContent(`<main id="audit" style="position:relative;width:800px;height:500px">
    <div data-card style="position:absolute;left:0;top:0;width:450px;height:500px"></div>
    <div data-card style="position:absolute;left:466px;top:0;width:334px;height:260px"></div>
  </main>`);
  await expect(assertNoBlankSlabs(page, "#audit")).rejects.toThrow(/blank/);
});

test("layout audit detects almost aligned card edges", async ({ page }) => {
  await page.setContent(`<main id="audit" style="position:relative;width:800px;height:300px">
    <div data-card style="position:absolute;left:0;top:0;width:392px;height:300px"></div>
    <div data-card style="position:absolute;left:408px;top:3px;width:392px;height:297px"></div>
  </main>`);
  await expect(assertNoBlankSlabs(page, "#audit")).rejects.toThrow(/top edges differ/);
});
