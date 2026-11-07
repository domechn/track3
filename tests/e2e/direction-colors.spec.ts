import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";
import { expectDailyColours } from "./direction-colors-scenes";

test("Daily change uses the selected gain and loss colours in both desktop themes", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriBridge(page, { richPortfolio: true });
  for (const theme of ["dark", "light"]) {
    await page.goto("/#/overview");
    await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await page.reload();
    await page.getByRole("button", { name: "Choose date range" }).click();
    await page.getByLabel("From").fill("13 Oct 2026");
    await page.getByLabel("From").blur();
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.locator(".t3-daily-column")).toHaveCount(9);
    const before = await expectDailyColours(page, "desktop");
    await expect(page.locator(".t3-daily-direction .text-gain")).toHaveText(/Up/);
    await expect(page.locator(".t3-daily-direction .text-loss")).toHaveText(/Down/);
    await page.goto("/#/settings/appearance");
    await page.getByRole("radio", { name: /Red Up \/ Green Down/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-quote", "red-up");
    await page.goto("/#/overview");
    const after = await expectDailyColours(page, "desktop");
    expect(after.gain).toBe(before.loss);
    expect(after.loss).toBe(before.gain);
    await page.goto("/#/settings/appearance");
    await page.getByRole("radio", { name: /Green Up \/ Red Down/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-quote", "green-up");
  }
});
