import { expect, test, type Browser } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { analyzePage, captureLong } from "./fidelity-analyze-scenes";

test.beforeEach(({}, info) => test.skip(info.project.name !== "mobile"));

async function openWallets(browser: Browser) {
  const { context, page } = await analyzePage(browser, "wallets");
  await expect(page.getByRole("heading", { name: "Wallets", exact: true })).toBeVisible({ timeout: 30_000 });
  return { context, page };
}

test("compact Wallets and Comparison Back controls clear the top safe area", async ({ browser }) => {
  const { context, page } = await openWallets(browser);
  try {
    for (const route of ["wallets", "comparison"]) {
      await page.goto(`/#/${route}`);
      await page.evaluate(() => document.documentElement.style.setProperty("--mobile-safe-top", "59px"));
      const back = page.locator("#app-top-bar .mobile-header-back");
      await expect(back).toBeVisible();
      expect((await back.boundingBox())!.y).toBeGreaterThanOrEqual(59);
    }
  } finally { await context.close(); }
});

test("Wallets all sources uses the approved section order and stored source totals", async ({ browser }) => {
  const { context, page } = await openWallets(browser);
  try {
    await expect(page.getByRole("heading", { name: "Allocation by source" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("$763,809.27").first()).toBeVisible();
    await expect(page.locator(".fd-wallet-head p b")).toHaveText("Binance holds 46.9%");
    const heading = (await page.getByRole("heading", { name: "Wallets", exact: true }).boundingBox())!;
    expect(heading.y).toBe(14);
    expect((await page.locator(".fd-wallet-chips").boundingBox())?.y).toBe(168);
    expect((await page.locator(".fd-wallet-chips").boundingBox())?.height).toBe(136);
    expect((await page.locator(".fd-wallet-chips button").first().boundingBox())?.height).toBe(44);
    expect((await page.locator(".fd-wallet-chips button").first().boundingBox())?.width).toBe(98);
    const allocationY = (await page.locator(".fd-wallet-allocation").boundingBox())!.y;
    expect(allocationY).toBeGreaterThanOrEqual(319);
    expect(allocationY).toBeLessThanOrEqual(321);
    writeFileSync("/tmp/fidelity/wallets/wallets-section-geometry.json", JSON.stringify(await page.evaluate(() =>
      [".fd-wallet-allocation", ".fd-wallet-balances", ".fd-wallet-status", ".fd-wallet-matrix", ".fd-wallet-moved"]
        .map((selector) => {
          const r = document.querySelector(selector)!.getBoundingClientRect();
          return { selector, y: r.y, h: r.height };
        })), null, 2));
    expect((await page.locator(".fd-wallet-balances").boundingBox())?.y).toBe(729);
    expect((await page.locator(".fd-wallet-status").boundingBox())?.y).toBe(1123);
    expect((await page.locator(".fd-wallet-matrix").boundingBox())?.y).toBe(1550);
    expect((await page.locator(".fd-wallet-moved").boundingBox())?.y).toBe(2134);
    await expect(page.locator(".fd-wallet-main-stat > strong")).toHaveCSS("font-size", "32px");
    expect((await page.locator(".fd-wallet-main-stat > strong").boundingBox())?.height).toBe(38);
    expect((await page.locator(".fd-wallet-main-stat > strong").boundingBox())?.y).toBe(391);
    expect((await page.locator(".fd-wallet-kpis > div:first-child > span").boundingBox())?.y).toBe(476);
    expect((await page.locator(".fd-wallet-kpis > div:first-child > b").boundingBox())?.y).toBe(496);
    expect((await page.locator(".fd-wallet-kpis > div:first-child > b").boundingBox())?.height).toBe(38);
    expect((await page.locator(".fd-wallet-kpis > div:first-child > small").boundingBox())?.y).toBe(534);
    expect((await page.locator(".fd-wallet-split").boundingBox())?.y).toBe(606);
    expect((await page.locator(".fd-wallet-kpis > div:nth-child(2) > span").boundingBox())!.height).toBeLessThanOrEqual(18);
    expect((await page.locator(".fd-wallet-kpis > div:last-child > small").boundingBox())!.height).toBeLessThanOrEqual(36);
    await expect(page.getByText("Amounts did not change in this range, so every change here is price movement.")).toHaveCount(0);
    await expect(page.locator(".fd-wallet-matrix-row small [data-tone='gain']").first()).toBeVisible();
    await page.screenshot({ path: "/tmp/fidelity/wallets/wallets-all-phone.png" });
    writeFileSync("/tmp/fidelity/wallets/wallets-all-geometry.json", JSON.stringify(await page.evaluate(() =>
      [".fd-wallet-head", ".fd-wallet-head h1", ".fd-wallet-head p", ".fd-wallet-range", ".fd-wallet-chips", ".fd-wallet-allocation", ".fd-wallet-allocation .fd-card-heading", ".fd-wallet-main-stat", ".fd-wallet-main-stat > strong", ".fd-wallet-kpis", ".fd-wallet-split", ".fd-wallet-legend"]
        .map((selector) => {
          const element = document.querySelector(selector)!;
          const r = element.getBoundingClientRect();
          const s = getComputedStyle(element);
          return { selector, y: r.y, h: r.height, font: s.font, color: s.color, margin: s.margin, padding: s.padding };
        })), null, 2));
    writeFileSync("/tmp/fidelity/wallets/wallets-kpi-geometry.json", JSON.stringify(await page.evaluate(() =>
      [...document.querySelectorAll(".fd-wallet-kpis span,.fd-wallet-kpis b,.fd-wallet-kpis small,.fd-wallet-legend span")]
        .map((element) => {
          const r = element.getBoundingClientRect();
          return { text: element.textContent?.slice(0, 40), x: r.x, y: r.y, w: r.width, h: r.height };
        })), null, 2));
    await captureLong(page, "/tmp/fidelity/wallets/wallets-all-phone-long.png");
  } finally { await context.close(); }
});

test("Wallets changed-period heading is announced as its visible title", async ({ browser }) => {
  const { context, page } = await openWallets(browser);
  try {
    await page.getByRole("radio", { name: "7D" }).click();
    await expect(page.locator(".fd-wallet-moved")).toContainText("7D, all sources");
    await expect(page.locator(".fd-wallet-moved").getByRole("heading", { name: "What moved" })).toBeVisible();
  } finally { await context.close(); }
});

test("Wallets Binance filter shows the source value and balances", async ({ browser }) => {
  const { context, page } = await openWallets(browser);
  try {
    await page.getByRole("button", { name: "Binance", exact: true }).click();
    await expect(page.getByText("$358,418.17").first()).toBeVisible();
    await expect(page.locator(".fd-wallet-allocation .fd-card-heading")).toContainText("Exchange");
    await expect(page.locator(".fd-wallet-allocation .fd-card-heading")).not.toContainText("read-only");
    writeFileSync("/tmp/fidelity/wallets/wallets-binance-geometry.json", JSON.stringify(await page.evaluate(() =>
      [".fd-wallet-allocation", ".fd-wallet-allocation .fd-card-heading", ".fd-wallet-allocation .fd-card-heading > span", ".fd-wallet-main-stat", ".fd-wallet-kpis", ".fd-wallet-split", ".fd-wallet-legend", ".fd-wallet-balances"]
        .map((selector) => {
          const element = document.querySelector(selector)!;
          const r = element.getBoundingClientRect();
          return { selector, x: r.x, y: r.y, w: r.width, h: r.height };
        })), null, 2));
    expect((await page.locator(".fd-wallet-allocation").boundingBox())?.y).toBe(320);
    expect((await page.locator(".fd-wallet-allocation").boundingBox())?.height).toBe(350);
    expect((await page.locator(".fd-wallet-split").boundingBox())?.y).toBe(589);
    expect((await page.locator(".fd-wallet-legend").boundingBox())?.y).toBe(611);
    expect((await page.locator(".fd-wallet-balances").boundingBox())?.y).toBe(682);
    await page.screenshot({ path: "/tmp/fidelity/wallets/wallets-binance-phone.png" });
    await captureLong(page, "/tmp/fidelity/wallets/wallets-binance-phone-long.png");
  } finally { await context.close(); }
});

test("Wallets OKX filter shows failed status and last good values", async ({ browser }) => {
  const { context, page } = await openWallets(browser);
  try {
    await page.getByRole("button", { name: "OKX", exact: true }).click();
    await expect(page.getByText("OKX refresh failed")).toBeVisible();
    expect((await page.locator(".fd-wallet-failure > div").boundingBox())?.x).toBe(61);
    expect((await page.locator(".fd-wallet-failure > button").boundingBox())?.x).toBe(284);
    expect((await page.locator(".fd-wallet-failure > button").boundingBox())?.width).toBe(75);
    writeFileSync("/tmp/fidelity/wallets/wallets-okx-geometry.json", JSON.stringify(await page.evaluate(() =>
      [".fd-wallet-allocation", ".fd-wallet-allocation .fd-card-heading", ".fd-wallet-allocation .fd-card-heading > span", ".fd-wallet-main-stat", ".fd-wallet-kpis", ".fd-wallet-split", ".fd-wallet-legend", ".fd-wallet-balances"]
        .map((selector) => {
          const element = document.querySelector(selector)!;
          const r = element.getBoundingClientRect();
          return { selector, x: r.x, y: r.y, w: r.width, h: r.height };
        })), null, 2));
    expect((await page.locator(".fd-wallet-allocation").boundingBox())?.y).toBe(434);
    expect((await page.locator(".fd-wallet-allocation").boundingBox())?.height).toBe(355);
    expect((await page.locator(".fd-wallet-allocation .fd-card-heading").boundingBox())?.height).toBe(50);
    await expect.poll(async () => (await page.locator(".fd-wallet-allocation.failed-source .fd-wallet-split").boundingBox())?.y).toBe(732);
    expect((await page.locator(".fd-wallet-allocation.failed-source .fd-wallet-legend").boundingBox())?.y).toBe(754);
    expect((await page.locator(".fd-wallet-balances").boundingBox())?.y).toBe(801);
    await expect(page.locator(".fd-wallet-failure")).toContainText("Next automatic try 10:11.");
    await page.screenshot({ path: "/tmp/fidelity/wallets/wallets-okx-phone.png" });
    await captureLong(page, "/tmp/fidelity/wallets/wallets-okx-phone-long.png");
  } finally { await context.close(); }
});

test("narrow phone keeps Wallets and Overview inside the viewport", async ({ browser }) => {
  const { context, page } = await openWallets(browser);
  try {
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(page.locator(".fd-wallets")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await page.goto("/#/overview");
    await expect(page.locator(".fd-overview")).toHaveAttribute("data-state", "ready");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  } finally { await context.close(); }
});

test("Wallets opens with the saved shared date range", async ({ browser }) => {
  test.setTimeout(120_000);
  const { context, page } = await openWallets(browser);
  try {
    await page.evaluate(() => localStorage.setItem("track3-assistant-date-range", '{"from":"2026-10-24","to":"2026-10-31"}'));
    await page.reload();
    await expect(page.locator(".fd-wallet-range").getByRole("radio", { name: "7D" })).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
  } finally { await context.close(); }
});

test("Wallets range selection follows the user to Overview", async ({ browser }) => {
  test.setTimeout(120_000);
  const { context, page } = await openWallets(browser);
  try {
    await expect(page.locator(".fd-wallets")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
    await page.getByRole("radio", { name: "7D" }).click();
    await expect(page.getByRole("radio", { name: "7D" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "Overview" }).click();
    await expect(page.locator(".fd-overview-head").getByRole("radio", { name: "7D" })).toHaveAttribute("aria-checked", "true");
  } finally { await context.close(); }
});

test("Wallets keeps detailed source analysis and wallet change actions available", async ({ browser }) => {
  test.setTimeout(120_000);
  const { context, page } = await openWallets(browser);
  try {
    await page.getByRole("button", { name: "Detailed analysis" }).click();
    await expect(page.getByRole("heading", { name: "Asset changes by source" })).toBeVisible();
    await expect(page.locator(".analyze-source-list li").first()).toBeVisible();
    await expect(page.locator(".wallet-change-mobile-list .mobile-list-row").first()).toBeVisible();
    await page.locator(".wallet-change-mobile-list .mobile-list-row").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  } finally { await context.close(); }
});
