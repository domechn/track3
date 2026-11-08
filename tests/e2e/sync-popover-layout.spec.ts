import { expect, test } from "@playwright/test";
import { checkTextContrast, openPop } from "./sync-popover-scenes";

for (const theme of ["light", "dark"] as const) {
  for (const [width, height] of [[1280, 720], [1100, 640], [900, 560], [560, 700]] as const) {
    test(`desktop popover Details geometry ${width}x${height} ${theme}`, async ({ page }) => {
      const popover = await openPop(page, width, height, theme);
      const box = (await popover.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(12);
      expect(box.y + box.height).toBeLessThanOrEqual(height - (width <= 560 ? 0 : 12));
      expect(box.height).toBeLessThanOrEqual(Math.min(height * .85, 760) + 1);
      expect(await popover.evaluate((node) => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
      const body = popover.locator(".t3-sync-fidelity-body");
      expect(await body.evaluate((node) => node.getBoundingClientRect().bottom <= node.closest(".t3-sync-popover")!.getBoundingClientRect().bottom)).toBe(true);
      const header = popover.locator(".t3-sync-fidelity > header");
      if (width === 560) {
        expect(await header.evaluate((node) => getComputedStyle(node).display)).toBe("flex");
        expect(parseFloat(await header.locator("span").evaluate((node) => getComputedStyle(node).borderRadius))).toBeGreaterThan(10);
      }
      const row = popover.locator(".t3-sync-fidelity dl > div").first();
      const details = popover.locator(".t3-sync-details");
      const rowBox = (await row.boundingBox())!;
      const detailsBox = (await details.boundingBox())!;
      expect(Math.abs(detailsBox.x - rowBox.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(detailsBox.x + detailsBox.width - rowBox.x - rowBox.width)).toBeLessThanOrEqual(1);
      if (width === 560) {
        const lastRow = (await popover.locator(".t3-sync-fidelity-stats > div").last().boundingBox())!;
        const summary = (await popover.locator(".t3-sync-fidelity-summary").boundingBox())!;
        expect(summary.y - lastRow.y - lastRow.height).toBeGreaterThanOrEqual(12);
        expect(detailsBox.y - summary.y - summary.height).toBeGreaterThanOrEqual(12);
      }
      const statusRows = await popover.locator(".t3-sync-fidelity-stats > div").evaluateAll((nodes) =>
        nodes.map((node) => ({ y: node.getBoundingClientRect().y, height: node.getBoundingClientRect().height,
          divider: getComputedStyle(node).borderTopWidth === "1px" })));
      expect(statusRows).toHaveLength(5);
      for (let index = 0; index < statusRows.length; index++) {
        expect(statusRows[index].height).toBeGreaterThanOrEqual(31);
        expect(statusRows[index].height).toBeLessThanOrEqual(33);
        if (index) {
          expect(statusRows[index].divider).toBe(true);
          expect(Math.abs(statusRows[index].y - statusRows[index - 1].y - 32)).toBeLessThanOrEqual(1);
        }
      }
      const rows = await popover.locator(".t3-sync-details-section").filter({ has: page.getByRole("heading", { name: "Phase timings" }) })
        .locator(".t3-sync-definition-row").evaluateAll((nodes) => nodes.map((node) => {
          const row = node.getBoundingClientRect();
          const label = node.querySelector("dt")!.getBoundingClientRect();
          const value = node.querySelector("dd")!.getBoundingClientRect();
          return { y: row.y, height: row.height, separated: getComputedStyle(node).borderTopWidth === "1px",
            overlap: label.right > value.left, clipped: node.querySelector("dt")!.scrollWidth > node.querySelector("dt")!.clientWidth + 1 ||
              node.querySelector("dd")!.scrollWidth > node.querySelector("dd")!.clientWidth + 1 };
        }));
      expect(rows).toHaveLength(11);
      for (let index = 0; index < rows.length; index++) {
        expect(rows[index].height).toBeGreaterThanOrEqual(31);
        expect(rows[index].height).toBeLessThanOrEqual(33);
        expect(rows[index].overlap).toBe(false);
        expect(rows[index].clipped).toBe(false);
        if (index) {
          expect(rows[index].separated).toBe(true);
          expect(Math.abs(rows[index].y - rows[index - 1].y - 32)).toBeLessThanOrEqual(1);
        }
      }
      await checkTextContrast(popover);
      const scroll = await body.evaluate((node) => ({ height: node.clientHeight, full: node.scrollHeight }));
      expect(scroll.full).toBeGreaterThan(scroll.height);
      await expect(popover.locator(".t3-sync-fidelity-scroll-frame")).toHaveAttribute("data-more-below", "true");
      await expect(popover.locator(".t3-sync-fidelity-scroll-indicator")).toBeVisible();
      const headerBefore = (await header.boundingBox())!.y;
      await page.screenshot({ path: `.local/sync-details/ready-${width}-${theme}-top.png`, animations: "disabled" });
      await body.evaluate((node) => { node.scrollTop = node.scrollHeight; });
      await expect(popover.locator(".t3-sync-fidelity-scroll-frame")).toHaveAttribute("data-more-below", "false");
      expect(Math.abs((await header.boundingBox())!.y - headerBefore)).toBeLessThanOrEqual(1);
      await expect(popover.locator(".t3-sync-details-note")).toBeInViewport();
      await expect(popover.locator(".t3-sync-details-panel").getByRole("button", { name: "Copy diagnostics" })).toBeInViewport();
      await page.screenshot({ path: `.local/sync-details/ready-${width}-${theme}-requests.png`, animations: "disabled" });
    });
  }
  test(`desktop popover with errors and conflicts remains scrollable ${theme}`, async ({ page }) => {
    const popover = await openPop(page, 1280, 720, theme, false, true);
    const box = (await popover.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(12);
    expect(box.y + box.height).toBeLessThanOrEqual(708);
    expect(box.height).toBeLessThanOrEqual(613);
    const details = popover.locator(".t3-sync-details");
    await expect(details.locator(".t3-sync-details-badge")).toHaveText("6");
    await expect(details.getByRole("heading", { name: "Errors" })).toBeVisible();
    await expect(details.getByRole("heading", { name: "Conflicts" })).toBeVisible();
    expect(await popover.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await expect(popover.locator(".t3-sync-popover-scroll-rail")).toBeVisible();
    await checkTextContrast(popover);
    await page.screenshot({ path: `.local/sync-details/issues-1280-${theme}-top.png`, animations: "disabled" });
    await popover.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await expect(details.locator(".t3-sync-details-note")).toBeInViewport();
    await page.screenshot({ path: `.local/sync-details/issues-1280-${theme}-requests.png`, animations: "disabled" });
  });
  test(`desktop sync popover is a bottom sheet at 500px ${theme}`, async ({ page }) => {
    const popover = await openPop(page, 500, 700, theme);
    const box = (await popover.boundingBox())!;
    expect(box.x).toBeLessThanOrEqual(1);
    expect(box.x + box.width).toBeGreaterThanOrEqual(499);
    expect(Math.abs(box.y + box.height - 700)).toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(595 + 1);
  });
}

test("wide sync popover honors the space reported by Radix", async ({ page }) => {
  const popover = await openPop(page, 1600, 560, "light", false, true);
  await expect(popover).toHaveClass(/t3-b-sync-popover/);
  const maxHeight = await popover.evaluate((node) => {
    node.style.setProperty("--radix-popover-content-available-height", "200px");
    return getComputedStyle(node).maxHeight;
  });
  expect(maxHeight).toBe("200px");
});
