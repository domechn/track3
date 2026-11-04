import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

const phoneAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("phone About and iPad rail show the two-peak brand in both themes", async ({ browser }) => {
  test.setTimeout(180_000);
  const output = "/tmp/track3-brand-shots";
  mkdirSync(output, { recursive: true });
  for (const theme of ["dark", "light"] as const) {
    for (const device of ["phone", "ipad"] as const) {
      const context = await browser.newContext({
        viewport: device === "phone" ? { width: 390, height: 844 } : { width: 834, height: 1112 },
        userAgent: phoneAgent, isMobile: true, hasTouch: true,
        colorScheme: theme, reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage();
        await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
        await installTauriBridge(page);
        await page.goto(device === "phone" ? "/#/settings/systemInfo?section=about" : "/#/history");
        if (device === "phone") {
          const brand = page.locator(".fidelity-b-about-brand");
          await expect(brand.locator("polygon")).toHaveCount(2, { timeout: 30_000 });
          await expect(brand.getByText("Track3")).toBeVisible();
          if (theme === "light") await expect(brand.locator("svg")).toHaveCSS("background-color", /^rgb\(/);
        } else {
          const brand = page.getByRole("link", { name: "Track3" });
          await expect(brand.locator("polygon")).toHaveCount(2, { timeout: 30_000 });
          expect((await brand.boundingBox())!.height).toBeGreaterThanOrEqual(44);
          await brand.click();
          await expect(page).toHaveURL(/#\/overview$/);
          await expect(page.locator("#app-main-content h1")).toHaveText("Overview", { timeout: 30_000 });
        }
        await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
        await page.screenshot({ path: `${output}/${device}-${theme}.png` });
        if (device === "ipad") {
          await page.goto("/#/settings/systemInfo?section=about");
          await expect(page.locator(".fidelity-b-about-brand polygon")).toHaveCount(2, { timeout: 30_000 });
          await page.screenshot({ path: `${output}/ipad-about-${theme}.png` });
        }
      } finally {
        await context.close();
      }
    }
  }
});

test("phone startup lock is checked beside the new brand views", async ({ browser }) => {
  mkdirSync("/tmp/track3-brand-shots", { recursive: true });
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, userAgent: phoneAgent,
      isMobile: true, hasTouch: true, colorScheme: theme, reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installTauriBridge(page, { lockedStartup: true });
      await page.goto("/#/overview");
      await expect(page.getByRole("alert")).toContainText("Track3 is locked");
      await page.screenshot({ path: `/tmp/track3-brand-shots/phone-lock-${theme}.png` });
    } finally {
      await context.close();
    }
  }
});

test("iPad first-run guide retains the Peaks mark in both themes", async ({ browser }) => {
  mkdirSync("/tmp/track3-brand-shots", { recursive: true });
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({
      viewport: { width: 820, height: 1180 }, userAgent: phoneAgent,
      isMobile: true, hasTouch: true, colorScheme: theme, reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installTauriBridge(page, { onboarding: true, emptyPortfolio: true });
      await page.goto("/#/overview");
      const dialog = page.getByTestId("onboarding-dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveCSS("opacity", "1");
      await expect(page.locator(".mobile-rail-brand polygon")).toHaveCount(2);
      await page.screenshot({ path: `/tmp/track3-brand-shots/ipad-onboarding-${theme}.png`, animations: "disabled" });
    } finally {
      await context.close();
    }
  }
});
