import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

for (const width of [1440, 1024]) {
  test(`desktop Goals editor is a right drawer at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installTauriBridge(page);
    await page.goto("/#/goals");
    await expect(page.getByText("No rules yet")).toBeVisible();
    await page.getByRole("spinbutton", { name: "Threshold" }).fill("100");
    await page.getByRole("button", { name: "Save rule" }).click();
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await page.getByRole("button", { name: "New rule" }).click();

    const drawer = page.getByRole("dialog", { name: "New rule" });
    await expect(drawer).toBeVisible();
    const entry = await drawer.evaluate((node) => {
      const element = node as HTMLElement;
      element.style.animationName = "none";
      void element.offsetWidth;
      element.style.removeProperty("animation-name");
      const animation = node.getAnimations()[0];
      if (!animation) return null;
      animation.pause();
      animation.currentTime = 0;
      const box = node.getBoundingClientRect();
      const start = { x: box.x, y: box.y };
      animation.finish();
      return start;
    });
    await expect.poll(async () => {
      const box = await drawer.boundingBox();
      return box && { x: box.x, y: box.y, width: box.width, right: box.x + box.width };
    }).toEqual({ x: width - 440, y: 0, width: 440, right: width });
    expect(entry).not.toBeNull();
    expect(entry!.x).toBeGreaterThanOrEqual(width - 1);
    expect(entry!.x).toBeLessThanOrEqual(width + 1);
    expect(entry!.y).toBe(0);
  });
}
