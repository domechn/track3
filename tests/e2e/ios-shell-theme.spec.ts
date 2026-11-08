import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

const channels = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
const luminance = (value: string) => {
  const [r, g, b] = channels(value).map((channel) => {
    const fraction = channel / 255;
    return fraction <= .04045 ? fraction / 12.92 : ((fraction + .055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b;
};
const contrast = (a: string, b: string) => {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
};
const composite = (front: string, back: string) => {
  const alpha = Number(front.match(/[\d.]+/g)?.[3] ?? 1);
  return `rgb(${channels(front).map((channel, index) => Math.round(channel * alpha + channels(back)[index] * (1 - alpha))).join(", ")})`;
};

test("phone tab bar and iPad rail follow light, dark, and system themes", async ({ browser }) => {
  test.setTimeout(180_000);
  for (const width of [390, 820]) {
    const context = await browser.newContext({
      viewport: { width, height: 720 },
      userAgent: width === 390 ? "Track3 iPhone" : "Track3 iPad",
    });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { richPortfolio: true });
      await page.goto("/#/summary", { waitUntil: "domcontentloaded" });
      const nav = page.locator(width === 390 ? ".mobile-tab-bar" : ".mobile-sidebar");
      const reviewPath = process.env.SHELL_REVIEW_SCREENSHOTS;
      if (reviewPath) mkdirSync(reviewPath, { recursive: true });
      for (const [theme, scheme] of [["light", "light"], ["dark", "dark"], ["system", "light"], ["system", "dark"]] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveClass(new RegExp(scheme));
        expect(await page.locator("html").evaluate((node) => getComputedStyle(node).colorScheme)).toBe(scheme);
        await expect(nav).toBeVisible();
        const style = await nav.evaluate((node, width) => {
          const css = getComputedStyle(node);
          const sample = document.createElement("span");
          sample.style.background = "var(--sidebar-background)";
          node.append(sample);
          const token = getComputedStyle(sample).backgroundColor;
          sample.remove();
          return { background: css.backgroundColor, border: width === 390 ? css.borderTopColor : css.borderRightColor, token };
        }, width);
        expect(style.background).toBe(style.token);
        if (scheme === "light") expect(style.background).not.toBe("rgb(13, 13, 14)");
        expect(style.border).not.toBe("rgb(255, 255, 255)");
        const itemPalette = await nav.evaluate((node, width) => {
          const selector = width === 390 ? ".mobile-tab" : ".mobile-rail-item";
          const items = [...node.querySelectorAll<HTMLElement>(selector)];
          const active = items.find((item) => item.getAttribute("aria-current") === "page")!;
          const idle = items.find((item) => item.getAttribute("aria-current") !== "page")!;
          return { activeColor: getComputedStyle(active).color,
            activeBackground: getComputedStyle(active).backgroundColor,
            idleColor: getComputedStyle(idle).color };
        }, width);
        expect(contrast(itemPalette.idleColor, style.background)).toBeGreaterThanOrEqual(3);
        expect(contrast(itemPalette.activeColor, composite(itemPalette.activeBackground, style.background))).toBeGreaterThanOrEqual(4.5);
        if (width === 820) {
          if (await nav.getAttribute("data-collapsed") !== "true") await nav.getByRole("button", { name: "Collapse sidebar" }).click();
          await expect(nav).toHaveCSS("width", "56px");
          if (reviewPath && theme !== "system") await page.screenshot({ path: `${reviewPath}/ipad-${theme}-56.png` });
          await nav.getByRole("button", { name: "Expand sidebar" }).click();
          await expect(nav).toHaveCSS("width", "216px");
          if (reviewPath && theme !== "system") await page.screenshot({ path: `${reviewPath}/ipad-${theme}-216.png` });
        }
        if (width === 390 && reviewPath && theme !== "system") await page.screenshot({ path: `${reviewPath}/phone-${theme}.png` });
      }
      await page.emulateMedia({ colorScheme: "light" });
      await expect(page.locator("html")).toHaveClass(/light/);
      if (width === 820) await expect(nav).toHaveCSS("background-color", "rgb(255, 255, 255)");
    } finally {
      await context.close();
    }
  }
});

test("phone Overview sheet uses the live palette", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Track3 iPhone" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview", { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => (window as typeof window & {
      __e2eInvoke: (command: string, args: { query: string; values: unknown[] }) => Promise<unknown>;
    }).__e2eInvoke("plugin:sql|execute", {
      query: "INSERT INTO alert_history (kind, title, message, value, triggered_at) VALUES (?, ?, ?, ?, ?)",
      values: ["price", "BTC price alert", "Theme fixture alert", 1, "2026-10-31T09:41:00.000Z"],
    }));
    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator(".fd-overview")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
      if (theme === "dark") {
        const alerts = page.locator("#app-top-bar .fd-header-alerts");
        await expect(alerts).toHaveCSS("border-top-color", "rgb(58, 58, 62)");
        await expect(alerts.locator("span")).toHaveCSS("color", "rgb(255, 255, 255)");
      }
      const mini = page.locator(".fd-overview-mini");
      await expect(mini).toBeVisible();
      const miniPalette = await mini.evaluate((node) => {
        const sample = document.createElement("span");
        sample.style.background = "var(--fd-mini-background)";
        node.append(sample);
        const token = getComputedStyle(sample).backgroundColor;
        sample.remove();
        return { background: getComputedStyle(node).backgroundColor, token };
      });
      expect(miniPalette.background).toBe(miniPalette.token);
      await page.getByRole("button", { name: "Custom range" }).click();
      const sheet = page.locator(".fd-overview-date-sheet");
      await expect(sheet).toBeVisible();
      const palette = await sheet.evaluate((node) => {
        const sample = document.createElement("span");
        sample.style.background = "hsl(var(--card))";
        node.append(sample);
        const card = getComputedStyle(sample).backgroundColor;
        sample.style.background = "var(--sheet-handle)";
        const handle = getComputedStyle(sample).backgroundColor;
        sample.remove();
        return { background: getComputedStyle(node).backgroundColor,
          handle: getComputedStyle(node.querySelector(".mobile-sheet-handle")!).backgroundColor, card, tokenHandle: handle };
      });
      expect(palette.background).toBe(palette.card);
      expect(palette.handle).toBe(palette.tokenHandle);
      if (theme === "light") expect(palette.handle).not.toBe("rgb(68, 69, 75)");
      const reviewPath = process.env.SHELL_REVIEW_SCREENSHOTS;
      if (reviewPath) {
        mkdirSync(reviewPath, { recursive: true });
        await page.screenshot({ path: `${reviewPath}/phone-sheet-${theme}.png` });
      }
    }
  } finally {
    await context.close();
  }
});

test("phone Summary loading blocks use the selected theme", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Track3 iPhone" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { richPortfolio: true, slowOverview: true });
    await page.goto("/#/summary", { waitUntil: "domcontentloaded" });
    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await page.reload({ waitUntil: "domcontentloaded" });
      const block = page.locator('.fd-summary[data-state="loading"] .fd-profit-loss .fd-block');
      await expect(block).toBeVisible({ timeout: 30_000 });
      const palette = await block.evaluate((node) => {
        const sample = document.createElement("span");
        sample.style.background = "var(--fd-loading-block)";
        node.append(sample);
        const token = getComputedStyle(sample).backgroundColor;
        sample.remove();
        return { background: getComputedStyle(node).backgroundColor, token };
      });
      expect(palette.background).toBe(palette.token);
    }
  } finally {
    await context.close();
  }
});

test("phone Records pages keep the same tab bar surface", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Track3 iPhone" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/history", { waitUntil: "domcontentloaded" });
    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await page.reload({ waitUntil: "domcontentloaded" });
      for (const route of ["history", "cost-basis"] as const) {
        await page.goto(`/#/${route}`, { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveClass(new RegExp(theme));
        await expect(page.locator(route === "history" ? ".fidelity-history" : ".fidelity-cost")).toBeVisible({ timeout: 60_000 });
        const nav = page.locator(".mobile-tab-bar");
        await expect(nav).toBeVisible();
        const colors = await nav.evaluate((node) => {
          const main = document.querySelector("#app-main-content")!;
          return { background: getComputedStyle(node).backgroundColor, ground: getComputedStyle(main).backgroundColor };
        });
        expect(colors.background).toBe(colors.ground);
      }
    }
  } finally {
    await context.close();
  }
});
