import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

test("opening Live total reserves the strip and leaves the page title in place", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/overview");
  const title = page.getByRole("heading", { name: "Overview" }).first();
  await expect(title).toBeVisible();
  const strip = page.getByRole("button", { name: "Live total" });
  const beforeStrip = await strip.boundingBox();
  const beforeTitle = await title.boundingBox();
  const label = (await strip.locator(".t3-live-label").first().boundingBox())!;
  const dot = (await strip.locator(".t3-live-dot").boundingBox())!;
  expect(dot.x - label.x - label.width).toBeGreaterThanOrEqual(0);
  expect(dot.x - label.x - label.width).toBeLessThanOrEqual(16);
  await page.evaluate(() => {
    const tauri = (window as any).__TAURI_INTERNALS__;
    const original = tauri.invoke;
    tauri.invoke = async (cmd: string, args: any, options: unknown) => {
      if (cmd === "plugin:sql|select" && /SELECT \* FROM assets_v2 WHERE 1 = 1 AND createdAt >=/i.test(args.query)) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      return original(cmd, args, options);
    };
  });
  mkdirSync("/tmp/track3-live-shots", { recursive: true });
  await strip.click();
  await page.screenshot({ path: "/tmp/track3-live-shots/desktop-0.png" });
  await page.waitForTimeout(150);
  await page.screenshot({ path: "/tmp/track3-live-shots/desktop-150.png" });
  await page.waitForTimeout(250);
  await page.screenshot({ path: "/tmp/track3-live-shots/desktop-400.png" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "/tmp/track3-live-shots/desktop-1000.png" });
  await expect(strip.locator(".t3-live-amount")).toContainText("$", { timeout: 30_000 });
  const maskDuration = await page.locator(".t3-live-popover .backdrop-blur-md")
    .evaluate((node) => parseFloat(getComputedStyle(node).transitionDuration));
  expect(maskDuration).toBeLessThanOrEqual(0.2);
  const afterStrip = await strip.boundingBox();
  const afterTitle = await title.boundingBox();
  expect(afterStrip).toEqual(beforeStrip);
  expect(afterTitle).toEqual(beforeTitle);
});

test("an initial live query error never presents zero as the portfolio total", async ({ page }) => {
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/overview");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.evaluate(() => {
    const tauri = (window as any).__TAURI_INTERNALS__;
    const original = tauri.invoke;
    tauri.invoke = async (cmd: string, args: any, options: unknown) => {
      if (cmd === "plugin:sql|select" && /SELECT \* FROM assets_v2 WHERE 1 = 1 AND createdAt >=/i.test(args.query)) throw new Error("offline");
      return original(cmd, args, options);
    };
  });
  await page.getByRole("button", { name: "Live total" }).click();
  await expect(page.getByRole("status", { name: "Live total, Unavailable" })).toBeVisible();
  await expect(page.locator(".t3-live-popover")).toContainText("Unavailable");
  await expect(page.locator(".t3-live-popover")).not.toContainText("$0.00");
});
