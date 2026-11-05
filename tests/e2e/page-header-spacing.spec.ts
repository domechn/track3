import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./fidelity-desktop-scenes";

for (const [route, heading, actions] of [
  ["wallets", ".t3-wallet-heading", ".t3-wallet-actions"],
  ["summary", ".fidelity-summary > .fidelity-page-head", ".t3-fidelity-topbar-summary"],
  ["history", ".fidelity-history > .fidelity-page-head", ".fidelity-head-actions"],
  ["cost-basis", ".fidelity-cost > .fidelity-page-head", ".fidelity-head-actions"],
  ["comparison", ".t3-cmp-heading", ".t3-cmp-actions"],
  ["rebalance", ".t3-fidelity-rebalance > .t3-fidelity-head", ".t3-fidelity-stamp"],
  ["goals", ".t3-fidelity-goals > .t3-fidelity-head", ".t3-fidelity-head > button"],
] as const) {
  test(`${route} heading clears its right-side actions at 200% zoom`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("track3-ui-theme", "dark");
      localStorage.setItem("track3-ui-locale", "zh");
    });
    await installTauriBridge(page, { fidelityDesktop: "full" });
    await page.goto(`/#/${route}`);
    const header = page.locator(heading).first();
    await expect(header).toBeVisible();
    await page.evaluate(() => { document.documentElement.style.setProperty("zoom", "2"); });
    const text = await header.locator("p").first().boundingBox();
    const controls = await page.locator(actions).first().boundingBox();
    expect(text).not.toBeNull();
    expect(controls).not.toBeNull();
    expect(text!.x + text!.width <= controls!.x || controls!.x + controls!.width <= text!.x ||
      text!.y + text!.height <= controls!.y || controls!.y + controls!.height <= text!.y).toBe(true);
  });
}
