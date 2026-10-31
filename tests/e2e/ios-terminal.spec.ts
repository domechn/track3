import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { installTauriBridge } from "./tauri-bridge";

const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
test.use({ userAgent: iPhoneUserAgent, isMobile: true, hasTouch: true });

test("phone starts dark without storing a theme and preserves a stored light theme", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("track3-ui-theme"))).toBeNull();
  await page.evaluate(() => localStorage.setItem("track3-ui-theme", "light"));
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  expect(await page.evaluate(() => localStorage.getItem("track3-ui-theme"))).toBe("light");
});

test("phone quote preference flips numeric gain without changing the displayed value", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/summary");
  const gain = page.locator(".d2-summary .profit-metric-value[data-tone='gain']").first();
  await expect(gain).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-quote", "green-up");
  const before = await gain.evaluate((node) => ({ text: node.textContent, color: getComputedStyle(node).color }));
  await page.goto("/#/settings/appearance");
  await page.getByRole("button", { name: "Red Up / Green Down" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-quote", "red-up");
  await page.goto("/#/summary");
  await expect(gain).toBeVisible();
  const after = await gain.evaluate((node) => ({ text: node.textContent, color: getComputedStyle(node).color }));
  expect(after.text).toBe(before.text);
  expect(after.color).not.toBe(before.color);
});

test("phone Sync keeps grouped card styling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page);
  await page.goto("/#/settings/sync");
  const card = page.locator(".ios-d3-sync-settings > .glass").first();
  await expect(card).toBeVisible();
  await expect(card.locator("h3")).toBeHidden();
  await expect(card.locator("input").first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

test("phone and iPad keep unpadded portfolio cards flat", async ({ page }) => {
  await installTauriBridge(page, { richPortfolio: true });
  for (const width of [390, 834]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/#/overview");
    const hero = page.locator(".mobile-hero-card");
    const label = hero.locator(".mobile-hero-header h3");
    await expect(label).toBeVisible();
    const cardBox = await hero.boundingBox();
    const labelBox = await label.boundingBox();
    const borderWidth = await hero.evaluate((node) => parseFloat(getComputedStyle(node).borderLeftWidth));
    expect(cardBox).not.toBeNull();
    expect(labelBox).not.toBeNull();
    expect(borderWidth === 0 || labelBox!.x - cardBox!.x >= 16).toBe(true);
    await expect(hero).toHaveCSS("border-left-width", "0px");

    await page.goto("/#/history");
    const records = page.locator(".history-records-card");
    await expect(records).toBeVisible();
    await expect(records).toHaveCSS("border-left-width", "0px");

    await page.goto("/#/summary");
    const metrics = page.locator(".profit-metrics-card");
    await expect(metrics).toBeVisible();
    await expect(metrics).toHaveCSS("border-left-width", "0px");

    await page.goto("/#/comparison");
    const controls = page.locator(".comparison-controls-card");
    await expect(controls).toBeVisible();
    await expect(controls).toHaveCSS("border-left-width", "0px");
  }
});

test("phone loading skeleton animates until reduced motion is requested", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { richPortfolio: true, slowOverview: true });
  await page.goto("/#/overview");
  const skeleton = page.locator(".overview-skeleton .mobile-skeleton").first();
  await expect(skeleton).toBeVisible();
  await expect(skeleton).toHaveCSS("animation-name", "mobile-shimmer");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(skeleton).toHaveCSS("animation-name", "none");
});

test("phone light gain text uses the readable positive token", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await page.goto("/#/wallets");
  const gain = page.locator(".wallet-change-mobile-list .text-emerald-500").first();
  await expect(gain).toBeVisible();
  await expect(gain).toHaveCSS("color", "rgb(31, 122, 89)");
});

test("phone landscape tab bar keeps its compact height", async ({ page }) => {
  await page.setViewportSize({ width: 932, height: 430 });
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await expect(page.locator(".mobile-tab-bar")).toHaveCSS("height", "48px");
});

test("phone More badge clears the icon and tabs retain a safe area", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page);
  await page.evaluate(async (schema) => {
    const invoke = (window as any).__e2eInvoke;
    await invoke("plugin:sql|execute", { query: schema });
    for (let index = 0; index < 2; index++) {
      await invoke("plugin:sql|execute", {
        query: "INSERT INTO alert_history (kind, title, message, value, triggered_at) VALUES (?, ?, ?, ?, ?)",
        values: ["total_value_target", `Alert ${index + 1}`, "Portfolio value moved", 1, "2026-08-01T00:00:00.000Z"],
      });
    }
  }, readFileSync(resolve("src-tauri/migrations/init/alerts_up.sql"), "utf8"));
  await page.goto("/#/goals");
  const tab = page.locator(".mobile-tab-bar .mobile-tab").last();
  await expect(tab).toBeVisible();
  await expect(tab.locator(".mobile-tab-badge")).toHaveText("2");
  const icon = await tab.locator("svg").boundingBox();
  const badge = await tab.locator(".mobile-tab-badge").boundingBox();
  expect(badge).not.toBeNull();
  expect(icon).not.toBeNull();
  expect(badge!.x).toBeGreaterThanOrEqual(icon!.x + icon!.width);
  await expect(page.locator(".mobile-tab-bar")).toHaveCSS("height", "60px");
});
