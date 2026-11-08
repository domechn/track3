import { expect, test } from "@playwright/test";
import { checkTextContrast, openPop } from "./sync-popover-scenes";

test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

for (const theme of ["light", "dark"] as const) {
  for (const [width, height] of [[390, 844], [820, 900]] as const) {
    test(`mobile popover Details geometry ${width}x${height} ${theme}`, async ({ page }) => {
      const popover = await openPop(page, width, height, theme, true);
      const box = (await popover.boundingBox())!;
      if (width <= 699) {
        expect(box.x).toBeLessThanOrEqual(1);
        expect(box.x + box.width).toBeGreaterThanOrEqual(width - 1);
        const tabs = (await page.locator(".mobile-tab-bar").boundingBox())!;
        expect(Math.abs(box.y + box.height - tabs.y)).toBeLessThanOrEqual(1);
      } else {
        expect(box.x).toBeGreaterThanOrEqual(12);
        expect(box.x + box.width).toBeLessThanOrEqual(width - 12);
        expect(box.y + box.height).toBeLessThanOrEqual(height - 12);
      }
      expect(box.y).toBeGreaterThanOrEqual(12);
      expect(box.height).toBeLessThanOrEqual(Math.min(height * .85, 760) + 1);
      const statusLabel = popover.locator(":scope > p.text-xs.text-muted-foreground");
      await expect(statusLabel).toContainText("Synced");
      await expect(statusLabel).toBeInViewport();
      const statusVisibility = await statusLabel.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        const sheet = node.closest(".t3-sync-popover")!;
        return { clear: hit === node || node.contains(hit), hit: hit?.className,
          y: box.y, height: box.height, sheetY: sheet.getBoundingClientRect().y, scrollTop: sheet.scrollTop };
      });
      expect(statusVisibility.clear, JSON.stringify(statusVisibility)).toBe(true);
      const details = popover.locator(".t3-sync-details");
      const padding = await popover.evaluate((node) => {
        const style = getComputedStyle(node);
        return { left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) };
      });
      const detailBox = (await details.boundingBox())!;
      expect(await popover.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      expect(Math.abs(detailBox.x - box.x - padding.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(detailBox.x + detailBox.width - box.x - box.width + padding.right)).toBeLessThanOrEqual(1);
      await checkTextContrast(popover);
      const rows = await details.locator(".t3-sync-details-section").filter({ has: page.getByRole("heading", { name: "Phase timings" }) })
        .locator(".t3-sync-definition-row").evaluateAll((nodes) => nodes.map((node) => {
          const row = node.getBoundingClientRect();
          const label = node.querySelector("dt")!;
          const value = node.querySelector("dd")!;
          return { y: row.y, height: row.height, x: row.x, right: row.right,
            overlap: label.getBoundingClientRect().right > value.getBoundingClientRect().left,
            labelOverflow: label.scrollWidth > label.clientWidth + 1,
            valueOverflow: node.querySelector("dd")!.scrollWidth > node.querySelector("dd")!.clientWidth + 1 };
        }));
      expect(rows).toHaveLength(11);
      for (let index = 0; index < rows.length; index++) {
        expect(rows[index].labelOverflow).toBe(false);
        expect(rows[index].valueOverflow).toBe(false);
        expect(rows[index].overlap).toBe(false);
        expect(Math.abs(rows[index].x - detailBox.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(rows[index].right - detailBox.x - detailBox.width)).toBeLessThanOrEqual(1);
        expect(rows[index].height).toBeGreaterThanOrEqual(31);
        expect(rows[index].height).toBeLessThanOrEqual(33);
        if (index) expect(Math.abs(rows[index].y - rows[index - 1].y - 32)).toBeLessThanOrEqual(1);
      }
      expect(await popover.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
      await expect(popover.locator(".t3-sync-popover-scroll-rail")).toBeVisible();
      await expect(popover.locator(".t3-sync-popover-scroll-fade")).toBeVisible();
      await page.screenshot({ path: `.local/sync-details/mobile-${width}-${theme}-top.png`, animations: "disabled" });
      await popover.evaluate((node) => { node.scrollTop = node.scrollHeight; });
      await expect(popover.locator(".t3-sync-popover-scroll-fade")).toBeHidden();
      await expect(popover.getByRole("heading", { name: "Last sync result" })).toBeInViewport();
      await expect(details.locator(".t3-sync-details-note")).toBeInViewport();
      await expect(details.getByRole("button", { name: "Copy diagnostics" })).toBeInViewport();
      await page.screenshot({ path: `.local/sync-details/mobile-${width}-${theme}-requests.png`, animations: "disabled" });
    });
  }
  test(`phone popover with errors and conflicts remains scrollable ${theme}`, async ({ page }) => {
    const popover = await openPop(page, 390, 844, theme, true, true);
    const box = (await popover.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(12);
    const tabs = (await page.locator(".mobile-tab-bar").boundingBox())!;
    expect(Math.abs(box.y + box.height - tabs.y)).toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(718);
    const details = popover.locator(".t3-sync-details");
    await expect(details.locator(".t3-sync-details-badge")).toHaveText("6");
    await expect(popover.locator(".t3-sync-popover-scroll-rail")).toBeVisible();
    await checkTextContrast(popover);
    await page.screenshot({ path: `.local/sync-details/issues-390-${theme}-top.png`, animations: "disabled" });
    await popover.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await expect(details.locator(".t3-sync-details-note")).toBeInViewport();
    await page.screenshot({ path: `.local/sync-details/issues-390-${theme}-requests.png`, animations: "disabled" });
  });
}
