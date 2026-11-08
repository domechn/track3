import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

const color = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
const luminance = (value: string) => {
  const [r, g, b] = color(value).map((channel) => {
    const fraction = channel / 255;
    return fraction <= .04045 ? fraction / 12.92 : ((fraction + .055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b;
};
const contrast = (a: string, b: string) => {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
};
const over = (foreground: string, background: string) => {
  const alpha = Number(foreground.match(/[\d.]+/g)?.[3] ?? 1);
  return `rgb(${color(foreground).map((channel, index) => Math.round(channel * alpha + color(background)[index] * (1 - alpha))).join(", ")})`;
};

test("desktop rail follows light, dark, and system palettes in both widths", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/summary", { waitUntil: "domcontentloaded" });
  const rail = page.locator(".t3-desktop-rail");
  for (const [theme, scheme] of [["light", "light"], ["dark", "dark"], ["system", "light"], ["system", "dark"]] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(new RegExp(scheme));
    expect(await page.locator("html").evaluate((node) => getComputedStyle(node).colorScheme)).toBe(scheme);
    for (const width of [56, 216]) {
      if (width === 216) await rail.getByRole("button", { name: "Expand sidebar" }).click();
      await expect(rail).toHaveCSS("width", `${width}px`);
      const palette = await rail.evaluate((node) => {
        const css = getComputedStyle(node);
        const sample = document.createElement("span");
        sample.style.background = "var(--sidebar-background)";
        node.append(sample);
        const tokenBackground = getComputedStyle(sample).backgroundColor;
        sample.remove();
        const links = [...node.querySelectorAll<HTMLElement>("nav a")];
        const active = links.find((link) => link.getAttribute("aria-current") === "page")!;
        const idle = links.find((link) => !link.getAttribute("aria-current"))!;
        return {
          background: css.backgroundColor, tokenBackground, border: css.borderRightColor,
          activeBackground: getComputedStyle(active).backgroundColor, activeColor: getComputedStyle(active).color,
          idleColor: getComputedStyle(idle).color,
          divider: getComputedStyle(node.children[node.children.length - 2]).borderTopColor,
          chevron: getComputedStyle(node.querySelector<HTMLElement>("button:last-child")!).color,
        };
      });
      expect(palette.background).toBe(palette.tokenBackground);
      if (scheme === "light") expect(palette.background).not.toBe("rgb(13, 13, 14)");
      expect(contrast(palette.idleColor, palette.background)).toBeGreaterThanOrEqual(3);
      expect(contrast(palette.activeColor, over(palette.activeBackground, palette.background)), JSON.stringify({ scheme, theme, width, palette })).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette.chevron, palette.background)).toBeGreaterThanOrEqual(3);
      expect(palette.border).not.toBe("rgb(255, 255, 255)");
      expect(palette.divider).not.toBe("rgb(255, 255, 255)");
      if (width === 56) {
        const idle = rail.locator('nav a:not([aria-current="page"])').first();
        await idle.hover();
        const hover = await idle.evaluate((node) => {
          const sample = document.createElement("span");
          sample.style.background = "var(--sidebar-hover-bg)";
          node.append(sample);
          const token = getComputedStyle(sample).backgroundColor;
          sample.remove();
          return { background: getComputedStyle(node).backgroundColor, token };
        });
        expect(hover.background).toBe(hover.token);
        await page.mouse.move(500, 500);
      }
      if (width === 216) await rail.getByRole("button", { name: "Collapse sidebar" }).click();
    }
  }
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(rail).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("settings changes the desktop rail without reloading", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await installTauriBridge(page);
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await page.goto("/#/settings/appearance?section=theme");
  const rail = page.locator(".t3-desktop-rail");
  await expect(rail).toBeVisible();
  await page.evaluate(() => { (window as typeof window & { themeProbe?: number }).themeProbe = 1; });
  await page.locator('.t3-fidelity-appearance .theme-choice').filter({ hasText: "Light" }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  expect(await rail.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgb(13, 13, 14)");
  expect(await page.evaluate(() => (window as typeof window & { themeProbe?: number }).themeProbe)).toBe(1);
});

test("dark Summary range keeps a visible selected pill", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/summary", { waitUntil: "domcontentloaded" });
  const ranges = page.locator(".t3-fidelity-ranges");
  await expect(ranges).toBeVisible();
  const colors = await ranges.evaluate((node) => ({
    track: getComputedStyle(node).backgroundColor,
    selected: getComputedStyle(node.querySelector('[aria-pressed="true"]')!).backgroundColor,
  }));
  expect(colors.selected).not.toBe(colors.track);
});

test("Summary, Overview, and Settings keep the shell palette across navigation", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await installTauriBridge(page, { richPortfolio: true, slowOverview: true });
  await page.goto("/#/summary", { waitUntil: "domcontentloaded" });
  const rail = page.locator(".t3-desktop-rail");
  const reviewPath = process.env.SHELL_REVIEW_SCREENSHOTS;
  if (reviewPath) mkdirSync(reviewPath, { recursive: true });
  for (const theme of ["light", "dark"] as const) {
    await rail.locator('a[href="#/summary"]').click();
    await expect(page).toHaveURL(/#\/summary$/);
    await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await expect(page.locator('.fidelity-summary[aria-busy="true"]')).toBeVisible({ timeout: 30_000 });
    if (reviewPath) {
      await page.screenshot({ path: `${reviewPath}/summary-${theme}-loading-56.png` });
      await rail.getByRole("button", { name: "Expand sidebar" }).click();
      await expect(rail).toHaveCSS("width", "216px");
      await page.screenshot({ path: `${reviewPath}/summary-${theme}-loading-216.png` });
      await rail.getByRole("button", { name: "Collapse sidebar" }).click();
    }
    for (const route of ["summary", "overview", "settings"] as const) {
      if (route !== "summary") await rail.locator(`a[href="#/${route}"]`).last().click();
      await expect(page).toHaveURL(new RegExp(`#/${route}$`));
      await expect(rail).toBeVisible();
      if (route === "summary") await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
      if (route === "overview") {
        await expect(page.locator(".t3-overview-grid")).toBeVisible({ timeout: 30_000 });
        await expect(page.locator(".t3-overview-heading").locator("xpath=..")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
      }
      if (route === "settings") await expect(page.locator(".t3-settings-content")).toBeVisible({ timeout: 30_000 });
      await expect(rail.locator('a[aria-current="page"]')).toHaveAttribute("href", `#/${route}`, { timeout: 30_000 });
      for (const width of [56, 216]) {
        if (width === 216) await rail.getByRole("button", { name: "Expand sidebar" }).click();
        await expect(rail).toHaveCSS("width", `${width}px`);
        expect(await rail.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
          theme === "light" ? "rgb(255, 255, 255)" : "rgb(13, 13, 14)",
        );
        if (theme === "light") {
          const active = rail.locator('a[aria-current="page"]');
          const token = await active.evaluate((node) => {
            const sample = document.createElement("span");
            sample.style.background = "var(--sidebar-active-bg)";
            node.append(sample);
            const value = getComputedStyle(sample).backgroundColor;
            sample.remove();
            return value;
          });
          await expect(active).toHaveCSS("background-color", token);
        }
        if (reviewPath) await page.screenshot({ path: `${reviewPath}/${route}-${theme}-${width}.png` });
        if (width === 216) await rail.getByRole("button", { name: "Collapse sidebar" }).click();
      }
    }
  }
});
