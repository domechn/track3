import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";
import { installTauriBridge as installDesktopFidelityBridge } from "./fidelity-desktop-scenes";

test("Overview keeps sync, alerts, and range controls pinned above its content", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriBridge(page, { seedLockedSync: true });
  await page.goto("/#/overview");
  await expect(page.locator(".t3-overview-grid")).toBeVisible({ timeout: 40_000 });
  await expect(page.locator(".desktop-sync-status-indicator")).toBeVisible();
  const liveTrigger = page.locator(".t3-live-trigger");
  await expect(liveTrigger).toBeVisible();
  const live = await liveTrigger.boundingBox();
  const sync = await page.locator(".desktop-sync-status-indicator").boundingBox();
  const bell = await page.locator(".t3-topbar-bell").boundingBox();
  const date = await page.locator(".t3-date-trigger").boundingBox();
  expect(live!.x + live!.width).toBeLessThanOrEqual(sync!.x);
  expect(sync!.y).toBe(7);
  expect(bell!.y).toBe(10);
  expect(date!.y + date!.height).toBeLessThanOrEqual((await page.locator("#app-main-content").boundingBox())!.y);
  await page.getByRole("button", { name: "Continue without sync" }).click();
  await expect(page.locator(".t3-sync-lock-dialog")).toHaveCount(0);
  for (const width of [800, 1100, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    const syncAtWidth = await page.locator(".desktop-sync-status-indicator").boundingBox();
    const bellAtWidth = await page.locator(".t3-topbar-bell").boundingBox();
    const mainAtWidth = await page.locator("#app-main-content").boundingBox();
    expect(syncAtWidth!.y + syncAtWidth!.height).toBeLessThanOrEqual(mainAtWidth!.y);
    expect(bellAtWidth!.y + bellAtWidth!.height).toBeLessThanOrEqual(mainAtWidth!.y);
    expect(width - syncAtWidth!.x - syncAtWidth!.width).toBeCloseTo(68, 0);
    expect(width - bellAtWidth!.x - bellAtWidth!.width).toBeCloseTo(28, 0);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const beforeScroll = await page.locator(".desktop-sync-status-indicator").boundingBox();
  const bellBeforeScroll = await page.locator(".t3-topbar-bell").boundingBox();
  await page.mouse.move(800, 500);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => document.getElementById("app-main-content")!.scrollTop)).toBeGreaterThan(0);
  const afterScroll = await page.locator(".desktop-sync-status-indicator").boundingBox();
  const bellAfterScroll = await page.locator(".t3-topbar-bell").boundingBox();
  expect(afterScroll!.y).toBeCloseTo(beforeScroll!.y, 0);
  expect(bellAfterScroll!.y).toBeCloseTo(bellBeforeScroll!.y, 0);
});

test("sync unlock dialog has the same dimensions and corners at desktop widths", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriBridge(page, { seedLockedSync: true });
  await page.goto("/#/overview");
  const dialog = page.locator(".t3-sync-lock-dialog");
  await expect(dialog).toBeVisible();
  const standard = await dialog.evaluate((node) => {
    const style = getComputedStyle(node);
    return { width: style.width, radius: style.borderTopLeftRadius };
  });
  await page.setViewportSize({ width: 1600, height: 900 });
  const wide = await dialog.evaluate((node) => {
    const style = getComputedStyle(node);
    return { width: style.width, radius: style.borderTopLeftRadius };
  });
  expect(wide).toEqual(standard);
});

test("expanded sidebar leaves the Summary, Cost basis, History, and Coin content visible", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await installTauriBridge(page);
  for (const route of ["/summary", "/cost-basis", "/history", "/coins/BTC"]) {
    await page.goto(`/#${route}`);
    const expand = page.getByRole("button", { name: "Expand sidebar" });
    if (await expand.isVisible()) await expand.click();
    const heading = page.locator("#app-main-content h1").first();
    await expect(heading).toBeVisible();
    await expect.poll(async () => {
      const sidebar = await page.locator("aside").first().boundingBox();
      const title = await heading.boundingBox();
      return !!sidebar && !!title && title.x >= sidebar.x + sidebar.width;
    }).toBe(true);
    if (route === "/cost-basis" || route === "/history") {
      const sidebar = await page.locator("aside").first().boundingBox();
      const toolbar = await page.locator(".t3-records-toolbar").boundingBox();
      expect(toolbar!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width);
    }
  }
});

test("Coin gains and losses follow the red-up quote preference", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await installDesktopFidelityBridge(page, { fidelityDesktop: "full" });
  await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
    query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (8, '1')", values: [],
  }));
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity")).toBeVisible();
  await expect(page.locator(".coin-fidelity")).toHaveClass(/fidelity-reverse/);
  const positive = page.locator(".coin-fidelity .positive").first();
  const negative = page.locator(".coin-fidelity .negative").first();
  const expected = await page.evaluate(() => {
    const sample = document.createElement("span");
    document.body.append(sample);
    sample.style.color = "hsl(var(--negative))";
    const gain = getComputedStyle(sample).color;
    sample.style.color = "hsl(var(--positive))";
    const loss = getComputedStyle(sample).color;
    sample.remove();
    return { gain, loss };
  });
  await expect(positive).toHaveCSS("color", expected.gain);
  await expect(negative).toHaveCSS("color", expected.loss);
});

test("toast tones keep one icon and clear their close buttons on desktop", async ({ page }) => {
  await installTauriBridge(page);
  for (const width of [1100, 1440, 1600]) for (const route of ["/overview", "/history", "/settings/appearance"]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/#${route}`);
    for (const [tone, border] of [
      ["success", "rgb(95, 196, 155)"], ["info", "rgb(72, 136, 213)"],
      ["warning", "rgb(216, 163, 65)"], ["error", "rgb(239, 103, 128)"],
    ]) {
      await page.evaluate(async (next) => {
        const toastModule = "/src/components/ui/use-toast.ts";
        const { toast } = await import(toastModule);
        toast({ title: "Integration tone", tone: next as "success" | "info" | "warning" | "error" });
      }, tone);
      const item = page.locator(`.desktop-toast-viewport .t3-fidelity-toast-${tone}`).first();
      await expect(item).toBeVisible();
      if (width >= 1400) await expect(item).toHaveCSS("border-left-color", border);
      expect(await item.evaluate((node) => getComputedStyle(node, "::before").content)).toBe("none");
      await expect(item.locator(".t3-fidelity-toast-icon svg")).toHaveCount(1);
      const text = await item.locator(".t3-fidelity-toast-text").boundingBox();
      const close = await item.locator("[toast-close]").boundingBox();
      expect(text!.x + text!.width).toBeLessThanOrEqual(close!.x);
    }
  }
});
