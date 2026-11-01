import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

test.use({ reducedMotion: "reduce" });

for (const width of [1440, 1024]) for (const theme of ["light", "dark"] as const) {
  test(`History edit log desktop ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
    await installTauriBridge(page, { richPortfolio: true, freshReviewData: true, seedEditLog: true });
    mkdirSync("test-results/edit-log", { recursive: true });
    await page.goto("/#/history");
    await expect(page.getByText("Edited", { exact: true })).toBeVisible();
    await expect(page.locator("[data-testid=history-content][aria-busy=true]")).toHaveCount(0);
    await page.screenshot({ path: `test-results/edit-log/desktop-${width}-${theme}-list.png` });
    await page.getByRole("combobox", { name: "History filter" }).click();
    await page.getByRole("option", { name: "Edited" }).click();
    await expect(page.getByTestId("history-snapshot-row")).toHaveCount(1);
    await page.getByTestId("history-snapshot-row").click();
    await expect(page.getByRole("region", { name: "Edit log" })).toContainText("Restored asset ETH");
    await page.screenshot({ path: `test-results/edit-log/desktop-${width}-${theme}-detail.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
