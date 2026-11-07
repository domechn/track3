import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

test("phone period total keeps its space as the first amount arrives", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 720 },
    userAgent: "Track3 iPhone", hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    await expect(page.locator(".fd-overview[data-state='ready']")).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => {
      const tauri = (window as any).__TAURI_INTERNALS__;
      const original = tauri.invoke;
      let resume!: () => void;
      const gate = new Promise<void>((resolve) => { resume = resolve; });
      (window as any).__resumeLiveTotal = resume;
      tauri.invoke = async (cmd: string, args: any, options: unknown) => {
        if (cmd === "plugin:sql|select" && /as totalValue, uuid, createdAt FROM assets_v2/i.test(args.query)) {
          await gate;
        }
        return original(cmd, args, options);
      };
    });
    await page.getByRole("radiogroup", { name: "Chart range" }).getByRole("radio", { name: "7D" }).click();
    const strip = page.locator("#app-top-bar .mobile-header-total");
    const title = page.locator(".fd-overview-head h1");
    await expect(strip).toBeVisible();
    await expect(strip.locator(".t3-live-skeleton")).toBeVisible();
    await expect(title).toBeVisible();
    const beforeStrip = await strip.boundingBox();
    const beforeDot = await strip.locator(".mobile-header-live-dot").boundingBox();
    const beforeTitle = await title.boundingBox();
    mkdirSync("/tmp/track3-live-shots", { recursive: true });
    await page.screenshot({ path: "/tmp/track3-live-shots/phone-0.png" });
    await page.waitForTimeout(150);
    await page.screenshot({ path: "/tmp/track3-live-shots/phone-150.png" });
    await page.waitForTimeout(250);
    await page.evaluate(() => (window as any).__resumeLiveTotal());
    await page.screenshot({ path: "/tmp/track3-live-shots/phone-400.png" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: "/tmp/track3-live-shots/phone-1000.png" });
    await expect(strip.locator(".mobile-header-total-value")).toContainText("$", { timeout: 30_000 });
    expect(await strip.boundingBox()).toEqual(beforeStrip);
    expect((await strip.locator(".mobile-header-live-dot").boundingBox())!.x).toBeCloseTo(beforeDot!.x, 0);
    expect(await title.boundingBox()).toEqual(beforeTitle);
  } finally {
    await context.close();
  }
});

test("phone header marks a live feed fallback stale without a selected range", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 720 },
    userAgent: "Track3 iPhone", hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    await expect(page.locator(".fd-overview[data-state='ready']")).toBeVisible();
    await page.evaluate(() => {
      const tauri = (window as any).__TAURI_INTERNALS__;
      const original = tauri.invoke;
      let failed = false;
      tauri.invoke = (cmd: string, args: any, options: unknown) => {
        if (!failed && cmd === "plugin:sql|select" && /SELECT \* FROM assets_v2 WHERE 1 = 1 AND createdAt >=/i.test(args.query)) {
          failed = true;
          throw new Error("offline");
        }
        return original(cmd, args, options);
      };
    });
    await page.getByRole("radiogroup", { name: "Chart range" }).getByRole("radio", { name: "All" }).click();
    await expect(page.locator("#app-top-bar .mobile-header-total-value")).toHaveAttribute("data-state", "stale");
    await expect(page.locator("#app-top-bar .mobile-header-total [role='status']"))
      .toHaveAttribute("aria-label", "Live total, Waiting for an update");
    await expect(page.locator("#app-top-bar .mobile-header-total-value")).toContainText("$");
  } finally {
    await context.close();
  }
});
