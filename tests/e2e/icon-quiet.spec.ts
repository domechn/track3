import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./fidelity-scenes";
import { seedComparisonMoversFixture } from "./comparison-movers-scenes";

for (const theme of ["light", "dark"] as const) {
  test(`coin quiet treatment lowers logo chroma in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await installTauriBridge(page, { fidelitySample: "full" });
    await seedComparisonMoversFixture(page);
    await page.goto("/#/comparison");
    await expect(page.locator(".comparison-movers > section li")).toHaveCount(20, { timeout: 60_000 });
    const logo = page.locator(".comparison-movers .t3-asset-icon[data-quiet][data-kind='coin'] img").first();
    await expect(logo).toBeVisible({ timeout: 40_000 });
    const tile = logo.locator("..");
    await tile.scrollIntoViewIfNeeded();
    await expect.poll(async () => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    const quiet = await tile.screenshot();
    await page.addStyleTag({ content: ".t3-asset-icon[data-quiet] img { opacity: 1 !important; filter: none !important; }" });
    const vivid = await tile.screenshot();
    const measure = async (image: Buffer) => page.evaluate(async (encoded) => {
      const bitmap = new Image();
      bitmap.src = `data:image/png;base64,${encoded}`;
      await bitmap.decode();
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      let chroma = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const channels = [pixels[index], pixels[index + 1], pixels[index + 2]];
        chroma += Math.max(...channels) - Math.min(...channels);
      }
      return chroma / (pixels.length / 4);
    }, image.toString("base64"));
    expect(await measure(quiet)).toBeLessThan((await measure(vivid)) * .96);
  });
}
