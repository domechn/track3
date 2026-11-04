import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";
import { installTauriBridge as installFidelityBridge } from "./fidelity-scenes";

test("desktop brand uses theme colors at 1280 in both rail states", async ({ browser }) => {
  test.setTimeout(120_000);
  const output = "/tmp/track3-brand-shots";
  mkdirSync(output, { recursive: true });
  const colors: string[] = [];
  for (const theme of ["dark", "light"] as const) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }, colorScheme: theme, reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installTauriBridge(page);
      await page.goto("/#/overview");
      const brand = page.getByRole("link", { name: "Track3" });
      const mark = brand.locator("svg");
      await expect(mark.locator("polygon")).toHaveCount(2);
      expect((await brand.boundingBox())!.width).toBeGreaterThanOrEqual(44);
      const fills = await mark.locator("polygon").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).fill));
      colors.push(fills.join("/"));
      expect(fills[0]).not.toBe(fills[1]);
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Loading overview data")).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator(".t3-hero-value")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
      await page.screenshot({ path: `${output}/desktop-1280-${theme}-collapsed.png` });
      await page.keyboard.press("Tab");
      await brand.focus();
      await expect(brand).toHaveCSS("box-shadow", /rgb/);
      await page.getByRole("button", { name: "Expand sidebar" }).click();
      await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
      await expect(page.locator(".t3-desktop-rail").getByText("Track3")).toBeVisible();
      await page.screenshot({ path: `${output}/desktop-1280-${theme}-expanded.png` });
      await page.goto("/#/history");
      await page.getByRole("link", { name: "Track3" }).click();
      await expect(page).toHaveURL(/#\/overview$/);
      await expect(page.locator('link[rel="icon"][media="(prefers-color-scheme: light)"]')).toHaveAttribute("href", "/track3-light.svg");
      await expect(page.locator('link[rel="icon"][media="(prefers-color-scheme: dark)"]')).toHaveAttribute("href", "/track3-dark.svg");
      const favicon = await page.request.get(`/track3-${theme}.svg`);
      expect(favicon.ok()).toBe(true);
      const faviconPoints = [...(await favicon.text()).matchAll(/<polygon points="([^"]+)"/g)].map((match) => match[1]);
      const markPoints = await mark.locator("polygon").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("points")));
      expect(faviconPoints).toEqual(markPoints);
    } finally {
      await context.close();
    }
  }
  expect(colors[0]).not.toBe(colors[1]);
});

test("light desktop onboarding keeps both peaks legible on its dark backdrop", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await installTauriBridge(page, { onboarding: true, emptyPortfolio: true });
  await page.goto("/#/overview");
  const mark = page.locator(".ob-fidelity-brand svg");
  await expect(mark.locator("polygon")).toHaveCount(2);
  await expect(mark).toHaveCSS("background-color", /^rgb\(/);
  mkdirSync("/tmp/track3-brand-shots", { recursive: true });
  await page.screenshot({ path: "/tmp/track3-brand-shots/desktop-guide-light.png" });
});

test("Overview rail keeps Settings clear of the fixed collapse toggle at page bottom", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await installFidelityBridge(page, { fidelitySample: "full" });
  await page.goto("/#/overview");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
  await page.locator("main").evaluate((element) => { element.style.minHeight = "1500px"; });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const settings = await page.getByRole("link", { name: "Settings" }).boundingBox();
  const toggle = await page.getByRole("button", { name: "Expand sidebar" }).boundingBox();
  expect(settings!.y + settings!.height + 8).toBeLessThanOrEqual(toggle!.y);
});
