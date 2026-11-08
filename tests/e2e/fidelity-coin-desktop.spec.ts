import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { installTauriBridge } from "./fidelity-desktop-scenes";
import AxeBuilder from "@axe-core/playwright";

test.use({ viewport: { width: 1600, height: 1000 }, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });

test("coin toolbar stays opaque and separate from scrolled content at 1440px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-hero")).toBeVisible();
  await page.locator("#app-main-content").evaluate((element) => { element.scrollTop = 150; });
  const toolbar = page.locator(".t3-fidelity-topbar-coin");
  const main = page.locator("#app-main-content");
  const toolbarBox = (await toolbar.boundingBox())!;
  const mainBox = (await main.boundingBox())!;
  expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(mainBox.y);
  await expect(toolbar).toHaveCSS("background-color", "rgb(12, 12, 13)");
  mkdirSync("/tmp/wui18-evidence", { recursive: true });
  await page.screenshot({ path: "/tmp/wui18-evidence/coin-1440-scrolled.png", animations: "disabled" });
});

async function saveOverlayFullPage(page: import("@playwright/test").Page, background: Buffer, viewport: Buffer, path: string) {
  const data = await page.evaluate(async ({ base, overlay }) => {
    const load = (image: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = `data:image/png;base64,${image}`;
    });
    const [body, window] = await Promise.all([load(base), load(overlay)]);
    const canvas = document.createElement("canvas");
    canvas.width = body.width;
    canvas.height = body.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not compose the full-page capture");
    context.drawImage(body, 0, 0);
    context.drawImage(window, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1];
  }, { base: background.toString("base64"), overlay: viewport.toString("base64") });
  writeFileSync(path, Buffer.from(data, "base64"));
}

for (const state of ["btc", "btc-edit", "btc-price", "btc-sheet", "nvda", "nova", "nova-edit"] as const) {
  test(`coin ${state} matches the desktop section structure`, async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
    await installTauriBridge(page, { fidelityDesktop: state.startsWith("nova") ? "nova" : "full" });
    const symbol = state.startsWith("btc") ? "BTC" : state === "nvda" ? "NVDA" : "NOVA";
    await page.goto(`/#/coins/${symbol}${symbol === "NVDA" ? "?assetType=stock" : ""}`);
    await expect(page.locator(".analyze-coin")).toBeVisible({ timeout: 40_000 });
    await expect(page.locator(".t3-fidelity-sidebar nav a[href='#/goals']")).toHaveAttribute("aria-label", /2 unread/);
    await expect(page.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeVisible();
    await expect(page.locator(".coin-fidelity-transactions tbody tr")).toHaveCount(symbol === "BTC" ? 8 : symbol === "NVDA" ? 3 : 2);
    await expect(page.locator(".coin-fidelity-sources table").first().locator("tbody tr"))
      .toHaveCount(symbol === "BTC" ? 3 : 2, { timeout: 40_000 });
    if (state.startsWith("nova")) await expect(page.locator(".coin-fidelity-custom")).toBeVisible();
    if (state === "nova") {
      expect((await page.locator(".coin-fidelity-crumb").boundingBox())!.y).toBe(69);
      expect((await page.locator(".coin-fidelity-hero").boundingBox())!.y).toBe(159);
      expect((await page.locator(".coin-fidelity-hero").boundingBox())!.width).toBe(1473);
    }
    if (symbol !== "NOVA") await expect(page.locator(".coin-fidelity-plot [data-point]").first()).toHaveAttribute("aria-label", /1 Oct 2026.*\$/);
    if (state === "btc") {
      await expect(page.locator(".coin-fidelity-metrics.bottom")).toContainText("$51,762.65");
      await expect(page.locator(".coin-fidelity-metrics.bottom")).toContainText("23.3% above");
      const sourceHeader = await page.locator(".coin-fidelity-sources table").first().locator("th").first().boundingBox();
      const sourceRow = await page.locator(".coin-fidelity-sources table").first().locator("td").first().boundingBox();
      const lotsHeading = await page.getByRole("heading", { name: "Open lots" }).boundingBox();
      const chartHeading = await page.getByRole("heading", { name: "Value of holdings" }).boundingBox();
      const coinHeading = await page.locator(".coin-fidelity-heading h1").boundingBox();
      const secondMetric = page.locator(".coin-fidelity-metrics.top .coin-fidelity-metric").nth(1);
      const secondLabel = await secondMetric.locator("span").boundingBox();
      const secondValue = await secondMetric.locator("strong").boundingBox();
      const secondNote = await secondMetric.locator("small").boundingBox();
      const chartCard = await page.locator(".coin-fidelity-chart").boundingBox();
      const sourcesCard = await page.locator(".coin-fidelity-sources").boundingBox();
      const lotsCard = await page.locator(".coin-fidelity-lots").boundingBox();
      const transactionCard = await page.locator(".coin-fidelity-transactions").boundingBox();
      expect(sourceHeader?.x).toBeCloseTo(973.58, 0);
      expect(await page.locator(".coin-fidelity-sources table").first().evaluate((node) => getComputedStyle(node).tableLayout)).toBe("auto");
      expect(sourceHeader?.width).toBeGreaterThan(223);
      expect(sourceHeader?.width).toBeLessThan(224);
      expect(sourceRow?.y).toBeCloseTo(517.5, 0);
      expect(lotsHeading?.y).toBeCloseTo((lotsCard?.y ?? 0) + 21, 0);
      expect(lotsCard?.x).toBeCloseTo(chartCard?.x ?? 0, 0);
      expect(lotsCard?.y).toBeCloseTo((chartCard?.y ?? 0) + (chartCard?.height ?? 0) + 16, 0);
      expect(chartHeading?.y).toBeCloseTo(466, 0);
      expect(coinHeading?.y).toBeCloseTo(91, 0);
      expect(secondLabel?.x).toBeCloseTo(362.5, 0);
      expect(secondValue?.y).toBeCloseTo(200, 0);
      expect(secondNote?.y).toBeCloseTo(228, 0);
      expect(chartCard?.height).toBeCloseTo(554, 0);
      expect(transactionCard?.y).toBeCloseTo(Math.max((sourcesCard?.y ?? 0) + (sourcesCard?.height ?? 0),
        (lotsCard?.y ?? 0) + (lotsCard?.height ?? 0)) + 16, 0);
    }
    if (state === "btc-price") {
      await page.getByRole("button", { name: "Price" }).click();
      await page.getByRole("button", { name: "7D" }).click();
      await expect(page.getByRole("heading", { name: "Price", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Price" })).toHaveClass(/active/);
      await expect(page.getByRole("button", { name: "7D" })).toHaveClass(/active/);
      await expect(page.getByRole("button", { name: "Price" })).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".coin-fidelity-chart-controls > .coin-fidelity-controls")).toHaveCount(2);
      await expect(page.locator(".coin-fidelity-chart-stats")).not.toContainText("2026");
    }
    const overlayState = state.endsWith("edit") || state === "btc-sheet";
    const fullPageBackground = overlayState ? await page.locator("body").screenshot({ animations: "disabled" }) : undefined;
    if (state.endsWith("edit")) await page.getByRole("button", { name: /Edit.*transaction/i }).nth(state === "btc-edit" ? 2 : 1).click();
    if (state === "nova-edit") {
      await page.getByRole("dialog", { name: "Edit transaction" }).getByRole("button", { name: "Buy" }).click();
      await expect(page.getByRole("dialog", { name: "Edit transaction" }).getByRole("button", { name: "Buy" })).toHaveAttribute("aria-pressed", "true");
      await page.locator("#fidelity-edit-price").fill("0.3600");
    }
    if (state === "btc-sheet") await page.getByRole("button", { name: /Transaction details/i }).nth(1).click();
    if (state === "btc-sheet") await expect(page.getByRole("dialog", { name: /Sell 0.3500 BTC/ })).toBeVisible();
    if (state.endsWith("edit") || state === "btc-sheet") await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const dir = process.env.WUI18_CAPTURE_DIR ?? "/tmp/fidelity-desktop/coin";
    mkdirSync(dir, { recursive: true });
    if (overlayState) {
      const viewport = await page.screenshot({ path: `${dir}/coin-${state}-desktop.png`, animations: "disabled" });
      if (state === "btc-sheet") await expect(page.getByRole("dialog", { name: /Sell 0.3500 BTC/ })).toBeVisible();
      await saveOverlayFullPage(page, fullPageBackground!, viewport, `${dir}/coin-${state}-desktop-fullpage.png`);
    } else {
      await page.locator("body").screenshot({ path: `${dir}/coin-${state}-desktop.png`, animations: "disabled" });
    }
    if (state.endsWith("edit")) {
      await expect(page.getByRole("dialog", { name: "Edit transaction" })).toBeVisible();
      if (state === "btc-edit") await expect(page.locator("#fidelity-edit-price")).toHaveValue("58,200.00");
    } else if (state === "btc-sheet") {
      await expect(page.getByRole("dialog", { name: /Sell 0.3500 BTC/ })).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: "Position" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Holdings by source" })).toBeVisible();
      if (state === "btc-price") await expect(page.locator(".coin-fidelity-xlabels span")).toHaveText(["24 Oct", "26 Oct", "28 Oct", "31 Oct"]);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1600);
    if (state === "nova-edit") {
      await page.getByRole("dialog", { name: "Edit transaction" }).getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("dialog", { name: "Edit transaction" })).toBeHidden();
      await expect(page.locator(".coin-fidelity-transactions tbody tr").last()).toContainText("Buy");
      await expect(page.locator(".coin-fidelity-transactions tbody tr").last()).toContainText("$0.3600");
    }
  });
}

test("editing only a NOVA transaction type preserves its stored price", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await installTauriBridge(page, { fidelityDesktop: "nova" });
  await page.goto("/#/coins/NOVA");
  await expect(page.locator(".coin-fidelity")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Edit.*transaction/i }).first().click();
  const dialog = page.getByRole("dialog", { name: "Edit transaction" });
  await expect(dialog.locator("#fidelity-edit-price")).toHaveValue("0.3950");
  await dialog.getByRole("button", { name: "Sell" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".coin-fidelity-transactions tbody tr").first()).toContainText("$0.3950");
});

test("NOVA asset context cannot discard a pending transaction edit", async ({ page }) => {
  const bridge = await installTauriBridge(page, { fidelityDesktop: "nova" });
  await page.goto("/#/coins/NOVA");
  await expect(page.locator(".coin-fidelity-transactions tbody tr")).toHaveCount(2, { timeout: 40_000 });
  await page.getByRole("button", { name: /Edit.*transaction/i }).last().click();
  const dialog = page.getByRole("dialog", { name: "Edit transaction" });
  await dialog.getByRole("button", { name: "Buy" }).click();
  await dialog.locator("#fidelity-edit-price").fill("0.3600");
  await expect(dialog.locator(".coin-fidelity-custom-warning")).toContainText("and the current price below");
  const settings = dialog.locator(".coin-fidelity-custom-settings");
  await expect(settings.getByRole("button")).toHaveCount(0);
  await expect(settings.getByLabel("Asset type")).toHaveText("Crypto");
  await expect(settings.getByLabel("Current price")).toContainText("$0.4210");
  await expect(settings.getByLabel("Current price")).toHaveAttribute("title", /Set current price after this edit/);
  await expect(settings.getByText("Crypto")).toBeVisible();
  await expect(settings.getByText("$0.4210")).toBeVisible();
  await settings.getByText("Crypto").click();
  await settings.getByText("$0.4210").click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#fidelity-edit-price")).toHaveValue("0.3600");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  expect((await bridge.transactionValues("NOVA"))[1]).toMatchObject({ txnType: "buy", price: 0.36 });
});

test("edit price accepts typed input and rejects an empty save without changing the transaction", async ({ page }) => {
  const bridge = await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  const row = page.locator(".coin-fidelity-transactions tbody tr").first();
  await expect(row).toContainText("$58,634.52", { timeout: 40_000 });
  await row.getByRole("button", { name: /Edit.*transaction/i }).click();
  const dialog = page.getByRole("dialog", { name: "Edit transaction" });
  const input = dialog.locator("#fidelity-edit-price");
  await input.fill("");
  await expect(input).toHaveValue("");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeVisible();
  expect((await bridge.transactionValues("BTC"))[0].price).toBe(58634.52);
  await input.fill("60,000.00");
  await expect(input).toHaveValue("60,000.00");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  expect((await bridge.transactionValues("BTC"))[0].price).toBe(60000);
});

test("BTC edit opens with price focused and keeps typed price when changing type", async ({ page }) => {
  const bridge = await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-transactions tbody tr")).toHaveCount(8, { timeout: 40_000 });
  await page.getByRole("button", { name: /Edit.*transaction/i }).nth(2).click();
  const dialog = page.getByRole("dialog", { name: "Edit transaction" });
  const input = dialog.locator("#fidelity-edit-price");
  await expect(input).toBeFocused();
  // The shared accent token rounds a few channels differently from the old fixed hex.
  expect(await dialog.locator(".coin-fidelity-price-input").evaluate((node) => getComputedStyle(node).boxShadow))
    .toBe("rgba(72, 136, 213, 0.14) 0px 0px 0px 3px");
  await input.fill("60,000.00");
  await dialog.getByRole("button", { name: "Sell" }).click();
  await expect(input).toHaveValue("60,000.00");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  expect((await bridge.transactionValues("BTC"))[2]).toMatchObject({ price: 60000, txnType: "sell" });
});

test("edit dialog uses the source form surfaces and NOVA banner", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "nova" });
  await page.goto("/#/coins/NOVA");
  await expect(page.locator(".coin-fidelity-transactions tbody tr")).toHaveCount(2, { timeout: 40_000 });
  await page.getByRole("button", { name: /Edit.*transaction/i }).last().click();
  const dialog = page.getByRole("dialog", { name: "Edit transaction" });
  const styles = await dialog.evaluate((node) => {
    const css = (selector: string) => getComputedStyle(node.querySelector(selector)!);
    return {
      summary: [css(".coin-fidelity-imported").backgroundColor, css(".coin-fidelity-imported").borderColor, css(".coin-fidelity-imported").color],
      summaryLabel: css(".coin-fidelity-imported strong").color,
      price: [css(".coin-fidelity-price-input").backgroundColor, css(".coin-fidelity-price-input > span").color, css(".coin-fidelity-price-input small").color],
      banner: [css(".coin-fidelity-custom-warning").fontSize, css(".coin-fidelity-custom-warning").color, css(".coin-fidelity-custom-warning strong").color],
      asset: [css(".coin-fidelity-custom-settings output").backgroundColor, css(".coin-fidelity-custom-settings output").borderColor, css(".coin-fidelity-custom-settings output small").fontSize, css(".coin-fidelity-custom-settings output small").color],
    };
  });
  // Shared HSL tokens round to the RGB values below; the surfaces and hierarchy stay the same.
  expect(styles).toEqual({
    summary: ["rgb(10, 10, 11)", "rgb(35, 35, 37)", "rgb(180, 182, 187)"],
    summaryLabel: "rgb(255, 255, 255)",
    price: ["rgb(10, 10, 11)", "rgb(154, 156, 162)", "rgb(154, 156, 162)"],
    banner: ["13px", "rgb(255, 255, 255)", "rgb(255, 255, 255)"],
    asset: ["rgb(10, 10, 11)", "rgb(59, 59, 63)", "13px", "rgb(154, 156, 162)"],
  });
  expect((await dialog.locator(".coin-fidelity-custom-warning svg").boundingBox())!.width).toBe(18);
});

test("Coin rail, chart ranges and transaction filter follow source positions", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-transactions tbody tr")).toHaveCount(8, { timeout: 40_000 });
  await page.evaluate(() => document.fonts.ready);
  const rail = await page.locator(".t3-fidelity-sidebar nav a svg").evaluateAll((nodes) =>
    nodes.slice(0, 9).map((node) => node.getBoundingClientRect().y));
  expect(rail).toEqual([79, 136, 180, 224, 268, 325, 369, 413, 457]);
  const range = (await page.locator(".coin-fidelity-chart-controls .coin-fidelity-controls").nth(1).boundingBox())!;
  expect([range.x, range.width]).toEqual([823.578125, 92]);
  const filter = (await page.locator(".coin-fidelity-transactions .coin-fidelity-controls").boundingBox())!;
  const filterButtons = await page.locator(".coin-fidelity-transactions .coin-fidelity-controls button").evaluateAll((nodes) =>
    nodes.map((node) => { const box = node.getBoundingClientRect(); return [box.x, box.width]; }));
  expect(filterButtons).toEqual([[1200, 52], [1252, 57], [1309, 58], [1367, 78], [1445, 89]]);
  expect([filter.x, filter.width]).toEqual([1198, 338]);
  expect((await page.locator(".coin-fidelity-transactions").boundingBox())!.height).toBe(556.5);
  expect((await page.locator(".coin-fidelity-position-header h2").boundingBox())!.y).toBe(299);
  expect((await page.locator(".coin-fidelity-metrics.bottom").boundingBox())!.y).toBe(337);
  expect((await page.locator(".coin-fidelity-transactions tbody tr").first().boundingBox())!.y -
    (await page.locator(".coin-fidelity-transactions").boundingBox())!.y).toBe(89.5);
});

test("NOVA Position aligns with the common source strip", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "nova" });
  await page.goto("/#/coins/NOVA");
  await expect(page.locator(".coin-fidelity-custom")).toBeVisible({ timeout: 40_000 });
  expect((await page.locator(".coin-fidelity-position-header h2").boundingBox())!.y).toBe(299);
  expect((await page.locator(".coin-fidelity-metrics.bottom").boundingBox())!.y).toBe(337);
  const lots = (await page.locator(".coin-fidelity-lots").boundingBox())!;
  const transactions = (await page.locator(".coin-fidelity-transactions").boundingBox())!;
  expect(transactions.y).toBeCloseTo(lots.y + lots.height + 16, 0);
});

test("Coin header separates the update stamp, range picker, and refresh control", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity")).toBeVisible({ timeout: 40_000 });
  const refresh = (await page.locator(".t3-fidelity-topbar .t3-refresh-button").boundingBox())!;
  const stamp = (await page.locator(".t3-fidelity-stamp").boundingBox())!;
  const date = (await page.locator(".t3-fidelity-topbar .t3-date-trigger").boundingBox())!;
  expect(date.x - stamp.x - stamp.width).toBeCloseTo(10, 0);
  expect(refresh.x - date.x - date.width).toBeCloseTo(10, 0);
  expect(refresh.x + refresh.width).toBeLessThanOrEqual(1600);
});

test("Coin transaction dates, counts and pills use the source numeric type and tokens", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-transactions tbody tr")).toHaveCount(8, { timeout: 40_000 });
  const styles = await page.locator(".coin-fidelity").evaluate((root) => {
    const style = (selector: string) => getComputedStyle(root.querySelector(selector)!);
    const pill = style(".coin-fidelity-transactions .t3-tag");
    const pillBox = root.querySelector(".coin-fidelity-transactions .t3-tag")!.getBoundingClientRect();
    return {
      dateFigures: style(".coin-fidelity-detail-link").fontVariantNumeric,
      countFigures: style(".coin-fidelity-transactions .coin-fidelity-controls button").fontVariantNumeric,
      pill: [pillBox.height, pill.padding, pill.fontWeight],
      colors: [pill.color, pill.backgroundColor],
    };
  });
  expect(styles).toMatchObject({
    dateFigures: "tabular-nums",
    countFigures: "tabular-nums",
    pill: [20, "0px 6px", "500"],
  });
  const luminance = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).reduce((sum, value, index) => {
    const channel = Number(value) / 255;
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  const [low, high] = styles.colors.map(luminance).sort((a, b) => a - b);
  expect((high + 0.05) / (low + 0.05)).toBeGreaterThanOrEqual(4.5);
});

test("Coin captions, table headings and transaction notes use the source faint colour", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-sources tbody tr").first()).toBeVisible({ timeout: 40_000 });
  await expect(page.locator(".coin-fidelity-detail-link small").first()).toBeVisible({ timeout: 40_000 });
  const colours = await page.locator(".coin-fidelity").evaluate((root) =>
    [".coin-fidelity-sources th", ".coin-fidelity-sources .coin-fidelity-section-head small",
      ".coin-fidelity-lots .coin-fidelity-section-head small", ".coin-fidelity-detail-link small", ".coin-fidelity-transactions > p",
      ".coin-fidelity-position-header > div"].map((selector) => {
      const node = root.querySelector(selector);
      if (!node) throw new Error(`Missing ${selector}`);
      return getComputedStyle(node).color;
    }));
  // --faint rounds to rgb(154, 156, 162) in Chromium.
  expect(colours).toEqual(["rgb(154, 156, 162)", "rgb(154, 156, 162)", "rgb(154, 156, 162)",
    "rgb(154, 156, 162)", "rgb(154, 156, 162)", "rgb(154, 156, 162)"]);
  const chart = (await page.locator(".coin-fidelity-chart").boundingBox())!;
  const lots = (await page.locator(".coin-fidelity-lots").boundingBox())!;
  expect(lots.x).toBeCloseTo(chart.x, 0);
  expect(lots.y).toBeCloseTo(chart.y + chart.height + 16, 0);
  expect((await page.locator(".coin-fidelity-sources .coin-fidelity-section-head small").boundingBox())!.y).toBe(463);
});

test("Coin change notes, chart values and source tags use the source ink", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-sources tbody tr").first()).toBeVisible({ timeout: 40_000 });
  await expect(page.locator(".coin-fidelity-metrics.top .coin-fidelity-metric:nth-child(2) small")).toContainText("$32.91", { timeout: 40_000 });
  await expect(page.locator(".coin-fidelity-chart-stats .coin-fidelity-metric:first-child strong")).toBeVisible({ timeout: 40_000 });
  const ink = await page.locator(".coin-fidelity").evaluate((root) => {
    const color = (selector: string) => getComputedStyle(root.querySelector(selector)!).color;
    return {
      change: [color(".coin-fidelity-metrics.top .coin-fidelity-metric:nth-child(2) strong"),
        color(".coin-fidelity-metrics.top .coin-fidelity-metric:nth-child(2) small")],
      chartNote: color(".coin-fidelity-chart .coin-fidelity-section-head p"),
      sourceTag: color(".coin-fidelity-sources td small"),
      high: color(".coin-fidelity-chart-stats .coin-fidelity-metric:first-child strong"),
      since: [color(".coin-fidelity-chart-stats .coin-fidelity-metric:last-child strong"),
        color(".coin-fidelity-chart-stats .coin-fidelity-metric:last-child small")],
    };
  });
  // --muted-foreground and --faint differ by one RGB channel from the source hex.
  expect(ink.change[1]).toBe("rgb(180, 182, 187)");
  expect(ink.chartNote).toBe("rgb(180, 182, 187)");
  expect(ink.sourceTag).toBe("rgb(154, 156, 162)");
  expect(ink.high).toBe("rgb(154, 156, 162)");
  expect(ink.since).toEqual(["rgb(154, 156, 162)", "rgb(180, 182, 187)"]);
  expect((await page.locator(".coin-fidelity-chart-stats .coin-fidelity-metric:first-child strong").boundingBox())!.y).toBe(933);
});

test("Coin rail separators, range segments and chevron use the source geometry", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-chart-controls")).toBeVisible({ timeout: 40_000 });
  const separators = await page.locator(".t3-fidelity-nav-group").evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().y));
  const segment = page.locator(".coin-fidelity-chart-controls .coin-fidelity-controls").nth(1);
  const first = (await segment.locator("button").first().boundingBox())!;
  const second = (await segment.locator("button").last().boundingBox())!;
  const chevron = await page.locator(".coin-fidelity-position-header > div").evaluate((node) => {
    const style = getComputedStyle(node, "::after");
    return [style.width, style.height, style.borderRightWidth, style.borderBottomWidth];
  });
  expect(separators).toEqual([116, 305]);
  expect([first.width, second.x]).toEqual([40, first.x + 40]);
  expect(chevron).toEqual(["7px", "7px", "1px", "1px"]);
});

test("Coin edit title and field labels use the source typography", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "nova" });
  await page.goto("/#/coins/NOVA");
  await expect(page.locator(".coin-fidelity-transactions tbody tr")).toHaveCount(2, { timeout: 40_000 });
  await page.getByRole("button", { name: /Edit.*transaction/i }).last().click();
  const dialog = page.getByRole("dialog", { name: "Edit transaction" });
  const type = await dialog.evaluate((root) => {
    const title = root.querySelector("h2")!;
    const titleStyle = getComputedStyle(title);
    const text = document.createRange();
    text.selectNodeContents(title);
    return {
      title: [text.getBoundingClientRect().width, titleStyle.letterSpacing, titleStyle.fontVariantNumeric],
      labels: [...root.querySelectorAll("label")].map((label) => getComputedStyle(label).fontWeight),
    };
  });
  expect(type.title).toEqual([135, "normal", "normal"]);
  expect(type.labels).toEqual(["500", "500", "500", "500"]);
});

test("stock assets retain their type and broker wording", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/NVDA?assetType=stock");
  await expect(page.locator(".coin-fidelity-stock")).toBeVisible({ timeout: 40_000 });
  await expect(page.locator(".coin-fidelity-heading h1")).toContainText("Stock");
  await expect(page.locator(".coin-fidelity-heading p")).toHaveText("Held at Interactive Brokers");
  await expect(page.locator(".coin-fidelity-metrics.top .coin-fidelity-metric").nth(1).locator("strong")).toHaveText("−1.45%");
});

test("stock transaction details use share precision and name the date", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/NVDA?assetType=stock");
  const detail = page.getByRole("button", { name: /Transaction details 15 Jul 2026 Sell/ });
  await expect(detail).toBeVisible({ timeout: 40_000 });
  await detail.click();
  await expect(page.getByRole("dialog", { name: "Sell 30 NVDA" })).toBeVisible();
});

for (const [symbol, rowIndex, dialogY, dialogHeight, titleY, priceY, saveY] of [
  ["BTC", 2, 283, 434, 309, 566, 658],
  ["NOVA", 1, 162.5, 675, 188.5, 539.5, 778.5],
] as const) {
  test(`${symbol} edit dialog follows the source form geometry`, async ({ page }) => {
    await installTauriBridge(page, { fidelityDesktop: symbol === "BTC" ? "full" : "nova" });
    await page.goto(`/#/coins/${symbol}`);
    await expect(page.locator(".coin-fidelity-transactions tbody tr").first()).toBeVisible({ timeout: 40_000 });
    await page.getByRole("button", { name: /Edit.*transaction/i }).nth(rowIndex).click();
    const dialog = page.getByRole("dialog", { name: "Edit transaction" });
    if (symbol === "NOVA") {
      await dialog.getByRole("button", { name: "Buy" }).click();
      await dialog.locator("#fidelity-edit-price").fill("0.3600");
    }
    await page.evaluate(() => document.fonts.ready);
    expect((await dialog.boundingBox())!.width).toBe(540);
    expect((await dialog.boundingBox())!.y).toBeCloseTo(dialogY, 0);
    expect((await dialog.boundingBox())!.height).toBeCloseTo(dialogHeight, 0);
    expect((await dialog.locator("h2").boundingBox())!.y).toBeCloseTo(titleY, 0);
    expect((await dialog.locator(".coin-fidelity-price-input").boundingBox())!.y).toBeCloseTo(priceY, 0);
    expect(await dialog.locator("#fidelity-edit-price").evaluate((node) =>
      node.getBoundingClientRect().x + parseFloat(getComputedStyle(node).paddingLeft))).toBeCloseTo(585, 0);
    expect(await dialog.locator(".coin-fidelity-price-input small").evaluate((node) => getComputedStyle(node).fontSize)).toBe("13px");
    expect((await dialog.getByRole("button", { name: "Save" }).boundingBox())!.y).toBeCloseTo(saveY, 0);
  });
}

test("coin layout keeps refresh and date controls visible at the default width", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose date range" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1400);
});

test("coin transactions follow a date range selected in the calendar", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-transactions tbody tr")).toHaveCount(8, { timeout: 40_000 });
  await expect(page.locator(".coin-fidelity-plot > b")).toHaveText("$205,738");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: "Choose date range" }).click();
  await page.getByRole("button", { name: "Last 10 Times" }).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.locator(".coin-fidelity-transactions tbody tr")).toHaveCount(0, { timeout: 40_000 });
});

test("a BTC edit in the real dialog refreshes the transaction row", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  const row = page.locator(".coin-fidelity-transactions tbody tr").first();
  await expect(row).toContainText("$58,634.52", { timeout: 40_000 });
  await row.getByRole("button", { name: /Edit.*transaction/i }).click();
  const dialog = page.getByRole("dialog", { name: "Edit transaction" });
  await dialog.locator("#fidelity-edit-price").fill("60,000.00");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("$60,000.00");
});

test("a failed combined edit leaves both transaction fields unchanged", async ({ page }) => {
  const bridge = await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  const row = page.locator(".coin-fidelity-transactions tbody tr").first();
  await expect(row).toContainText("$58,634.52", { timeout: 40_000 });
  await row.getByRole("button", { name: /Edit.*transaction/i }).click();
  const dialog = page.getByRole("dialog", { name: "Edit transaction" });
  await dialog.getByRole("button", { name: "Sell" }).click();
  await dialog.locator("#fidelity-edit-price").fill("60,000.00");
  await bridge.failNextTransactionEdit("price");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeVisible();
  expect((await bridge.transactionValues("BTC"))[0]).toMatchObject({ price: 58634.52, txnType: "buy" });
});

test("a failed type change restores the original price in a combined edit", async ({ page }) => {
  const bridge = await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  const row = page.locator(".coin-fidelity-transactions tbody tr").first();
  await expect(row).toContainText("$58,634.52", { timeout: 40_000 });
  await row.getByRole("button", { name: /Edit.*transaction/i }).click();
  const dialog = page.getByRole("dialog", { name: "Edit transaction" });
  await dialog.getByRole("button", { name: "Sell" }).click();
  await dialog.locator("#fidelity-edit-price").fill("60,000.00");
  await bridge.failNextTransactionEdit("type");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeVisible();
  await expect.poll(async () => (await bridge.transactionValues("BTC"))[0]).toMatchObject({ price: 58634.52, txnType: "buy" });
});

test("sell details retain that sale's realized gain outside the position range", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-sources table tbody tr").first()).toBeVisible({ timeout: 40_000 });
  await page.getByRole("combobox", { name: "Position" }).selectOption("30d");
  await page.getByRole("button", { name: /Transaction details/i }).nth(1).click();
  const sheet = page.getByRole("dialog", { name: /Sell 0.3500 BTC/ });
  await expect(sheet).toContainText("Realized (FIFO)");
  await expect(sheet.locator("button").last().locator("svg path")).toHaveAttribute("d", "M4 4l10 10M14 4L4 14");
  await expect(sheet).toContainText("+$15,610.00");
  expect((await sheet.locator("h2").boundingBox())!.y).toBeCloseTo(29, 0);
  expect((await sheet.locator("button").last().boundingBox())!.width).toBe(34);
  expect((await sheet.locator(".t3-tag").boundingBox())!.height).toBe(20);
  expect(await sheet.locator(".coin-fidelity-sheet-row").first().evaluate((node) => getComputedStyle(node).borderTopWidth)).toBe("0px");
  expect(await sheet.locator(".coin-fidelity-sheet-row").nth(1).evaluate((node) => {
    const style = getComputedStyle(node);
    return [style.borderTopWidth, style.borderTopColor, style.borderBottomWidth];
  })).toEqual(["1px", "rgb(24, 23, 28)", "0px"]); // --rule rounds differently from the old fixed row color.
  await expect(sheet.locator(".coin-fidelity-sheet-row").filter({ hasText: "Reference" })).toContainText("–");
  expect((await sheet.locator(".coin-fidelity-sheet-row").first().boundingBox())!.y).toBeCloseTo(100, 0);
  const editAction = (await sheet.getByRole("button", { name: "Edit type or price" }).boundingBox())!;
  expect(editAction.y).toBeCloseTo(432, 0);
  expect(editAction.height).toBe(34);
});

test("light theme uses readable Coin cards", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-sources table tbody tr").first()).toBeVisible({ timeout: 40_000 });
  const background = await page.locator(".coin-fidelity-card").first().evaluate((card) => getComputedStyle(card).backgroundColor);
  expect(background).toBe("rgb(255, 255, 255)");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => `${node.target.join(" ")} ${node.html}`).join(", ")}`)).toEqual([]);
});

test("light theme keeps NOVA edit fields on the light sunken surface", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await installTauriBridge(page, { fidelityDesktop: "nova" });
  await page.goto("/#/coins/NOVA");
  await expect(page.locator(".coin-fidelity-transactions tbody tr")).toHaveCount(2, { timeout: 40_000 });
  await page.getByRole("button", { name: /Edit.*transaction/i }).last().click();
  const dialog = page.getByRole("dialog", { name: "Edit transaction" });
  const surfaces = await dialog.evaluate((node) => {
    const color = (selector: string) => getComputedStyle(node.querySelector(selector)!).backgroundColor;
    return [color(".coin-fidelity-imported"), color(".coin-fidelity-price-input"), color(".coin-fidelity-custom-settings output")];
  });
  expect(surfaces[1]).toBe(surfaces[0]);
  expect(surfaces[2]).toBe(surfaces[0]);
});

test("coin figures, source tags and sheet gain use the reference typography and quote colour", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-sources tbody tr").first()).toBeVisible({ timeout: 40_000 });
  expect(await page.locator(".coin-fidelity-metrics.top strong.primary").evaluate((node) => getComputedStyle(node).fontVariantNumeric)).toBe("normal");
  expect(await page.locator(".coin-fidelity-chart-stats strong").first().evaluate((node) => {
    const style = getComputedStyle(node);
    return [style.fontSize, style.fontWeight];
  })).toEqual(["17px", "500"]);
  expect(await page.locator(".coin-fidelity-sources td small").first().evaluate((node) => getComputedStyle(node).fontSize)).toBe("12px");
  await page.getByRole("button", { name: /Transaction details/i }).nth(1).click();
  const sheet = page.getByRole("dialog", { name: /Sell 0.3500 BTC/ });
  expect(await sheet.locator(".coin-fidelity-sheet-row").last().evaluate((node) => node.getBoundingClientRect().height)).toBe(44);
  expect(await sheet.locator(".coin-fidelity-sheet-row strong.positive").evaluate((node) => getComputedStyle(node).color)).toBe("rgb(95, 196, 155)");
});

test("sell sheet rows use the source subtitle, label and value typography", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-transactions tbody tr")).toHaveCount(8, { timeout: 40_000 });
  await page.getByRole("button", { name: /Transaction details/i }).nth(1).click();
  const sheet = page.getByRole("dialog", { name: /Sell 0.3500 BTC/ });
  expect(await sheet.evaluate((node) => {
    const subtitle = getComputedStyle(node.querySelector("p")!);
    const label = getComputedStyle(node.querySelector(".coin-fidelity-sheet-row > span")!);
    const value = getComputedStyle(node.querySelector(".coin-fidelity-sheet-row strong")!);
    return [subtitle.fontSize, subtitle.color, label.color, value.fontWeight];
  })).toEqual(["12px", "rgb(180, 182, 187)", "rgb(154, 156, 162)", "400"]); // Shared token RGB.
});

test("edit price digits and changed pill use the source type", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-transactions tbody tr")).toHaveCount(8, { timeout: 40_000 });
  await page.getByRole("button", { name: /Edit.*transaction/i }).nth(2).click();
  const dialog = page.getByRole("dialog", { name: "Edit transaction" });
  await dialog.getByRole("button", { name: "Sell" }).click();
  expect(await dialog.locator("#fidelity-edit-price").evaluate((node) => getComputedStyle(node).fontVariantNumeric)).toBe("tabular-nums");
  const changedTag = await dialog.locator("label .t3-tag").evaluate((node) => {
    const style = getComputedStyle(node);
    const parse = (value: string) => {
      const values = [...value.matchAll(/[\d.]+/g)].map(([number]) => Number(number));
      return {
        channels: value.startsWith("color(srgb ") ? values.slice(0, 3).map((channel) => channel * 255) : values.slice(0, 3),
        alpha: values[3] ?? 1,
      };
    };
    const paint = parse(style.backgroundColor);
    const surface = parse(getComputedStyle(node.closest('[role="dialog"]')!).backgroundColor);
    const background = paint.channels.map((channel, index) =>
      channel * paint.alpha + surface.channels[index] * (1 - paint.alpha));
    const light = (value: number) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (channels: number[]) => channels.reduce((sum, channel, index) =>
      sum + [0.2126, 0.7152, 0.0722][index] * light(channel), 0);
    const [low, high] = [luminance(background), luminance(parse(style.color).channels)].sort((a, b) => a - b);
    return { fontSize: style.fontSize, radius: style.borderRadius, contrast: (high + 0.05) / (low + 0.05) };
  });
  expect(changedTag).toMatchObject({ fontSize: "11px", radius: "999px" });
  expect(changedTag.contrast).toBeGreaterThanOrEqual(4.5);
  await expect(dialog.locator("label .t3-tag")).toHaveAttribute("data-tone", "accent");
});

test("coin heading type tag uses a light surface in light theme", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  const tag = page.locator(".coin-fidelity-heading h1 b");
  await expect(tag).toBeVisible({ timeout: 40_000 });
  await expect(tag).toHaveClass(/t3-tag/);
  const background = await tag.evaluate((node) =>
    [...getComputedStyle(node).backgroundColor.matchAll(/\d+/g)].slice(0, 3).map(([value]) => Number(value)));
  expect(Math.min(...background)).toBeGreaterThan(190);
});

test("Coin change signs and segments use the source glyph and tokens", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-metrics.top .coin-fidelity-metric").nth(1).locator("strong"))
    .toHaveText("−0.05%", { timeout: 40_000 });
  const chart = page.locator(".coin-fidelity-chart-controls .coin-fidelity-controls").first();
  const segmentStyles = await chart.evaluate((node) => {
    const track = getComputedStyle(node);
    const active = getComputedStyle(node.querySelector("button.active")!);
    const inactive = getComputedStyle(node.querySelector("button:not(.active)")!);
    return [track.backgroundColor, active.backgroundColor, active.color, inactive.color];
  });
  expect(segmentStyles).toEqual([
    "rgb(26, 26, 30)", "rgba(72, 136, 213, 0.16)", "rgb(255, 255, 255)", "rgb(155, 157, 163)",
  ]);
  await page.getByRole("button", { name: /Edit.*transaction/i }).first().click();
  const dialog = page.getByRole("dialog", { name: "Edit transaction" });
  const type = dialog.locator(".coin-fidelity-type");
  expect((await type.boundingBox())!.height).toBe(32);
  expect((await type.locator("button").first().boundingBox())!.height).toBe(28);
});

test("Coin edit muted copy, summary spacing and Reset weight match the source", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-transactions tbody tr")).toHaveCount(8, { timeout: 40_000 });
  await page.getByRole("button", { name: /Edit.*transaction/i }).first().click();
  const dialog = page.getByRole("dialog", { name: "Edit transaction" });
  expect(await dialog.evaluate((node) => {
    const color = (selector: string) => getComputedStyle(node.querySelector(selector)!).color;
    return [
      color("p"), color(".coin-fidelity-hint"), color(".coin-fidelity-value-hint"),
      getComputedStyle(node.querySelector(".coin-fidelity-imported")!).gap,
      getComputedStyle(node.querySelector(".coin-fidelity-dialog-actions > button:first-child")!).fontWeight,
    ];
  })).toEqual(["rgb(180, 182, 187)", "rgb(154, 156, 162)", "rgb(154, 156, 162)", "10px", "500"]); // Shared token RGB.
});

test("NOVA's Position divider starts at the reference height", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "nova" });
  await page.goto("/#/coins/NOVA");
  await expect(page.locator(".coin-fidelity-custom")).toBeVisible({ timeout: 40_000 });
  expect((await page.locator(".coin-fidelity-metrics.top").boundingBox())!.y +
    (await page.locator(".coin-fidelity-metrics.top").boundingBox())!.height).toBeCloseTo(276, 0);
});

test("named BTC wallet is described with its article", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-sources tbody tr").first()).toBeVisible({ timeout: 40_000 });
  await expect(page.locator(".coin-fidelity-heading p")).toHaveText("Held on Binance and a Ledger cold wallet");
});

test("a custom follow quote is presented as a current price", async ({ page }) => {
  await installTauriBridge(page, { customPriceFixture: true });
  await page.goto("/#/coins/STBTC");
  await expect(page.locator(".coin-fidelity-custom")).toBeVisible({ timeout: 40_000 });
  await expect(page.locator(".coin-fidelity-metrics.top .coin-fidelity-metric").first()).toContainText("Current price");
  await expect(page.locator(".coin-fidelity-metrics.top .coin-fidelity-metric").first()).not.toContainText("Manual price");
});

test("an invalid configured quote does not label the asset manual", async ({ page }) => {
  await installTauriBridge(page, { customPriceFixture: "invalid" });
  await page.goto("/#/coins/NOVA");
  await expect(page.locator(".coin-fidelity")).toBeVisible({ timeout: 40_000 });
  await expect(page.locator(".coin-fidelity")).not.toHaveClass(/coin-fidelity-custom/);
});

test("Coin subtitle and cost basis action follow the source heading grid", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-heading")).toBeVisible({ timeout: 40_000 });
  expect((await page.locator(".coin-fidelity-heading p").boundingBox())!.y).toBeCloseTo(125, 0);
  const action = (await page.locator(".coin-fidelity-heading > button").boundingBox())!;
  expect(action.y).toBeCloseTo(109, 0);
  expect(action.x).toBeCloseTo(1408, 0);
});

test("Coin chart, tables and transaction heading use the source geometry", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-transactions tbody tr")).toHaveCount(8, { timeout: 40_000 });
  const crumb = page.locator(".coin-fidelity-crumb");
  expect((await crumb.locator("svg").count())).toBe(2);
  expect(await page.locator(".coin-fidelity-transactions tbody tr").nth(5).locator("td").first().evaluate((node) =>
    getComputedStyle(node).fontVariantNumeric)).toBe("tabular-nums");
  const lots = (await page.locator(".coin-fidelity-lots").boundingBox())!;
  const chart = (await page.locator(".coin-fidelity-chart").boundingBox())!;
  const transactions = (await page.locator(".coin-fidelity-transactions").boundingBox())!;
  expect(transactions.y).toBeCloseTo(Math.max(chart.y + chart.height, lots.y + lots.height) + 16, 0);
  expect((await page.locator(".coin-fidelity-plot svg").boundingBox())!.x).toBeCloseTo(149.2, 0);
  expect(await page.locator(".coin-fidelity-plot svg path").evaluate((node) => node.getBoundingClientRect().width)).toBeCloseTo(696.6, 0);
  expect(await page.locator(".coin-fidelity-plot svg path").evaluate((node) => {
    const style = getComputedStyle(node);
    return { width: style.strokeWidth, cap: style.strokeLinecap, join: style.strokeLinejoin };
  })).toEqual({ width: "2px", cap: "round", join: "round" });
  expect((await page.locator(".coin-fidelity-chart:not(.coin-fidelity-manual-history) .coin-fidelity-xlabels span").nth(5).boundingBox())!.x).toBeCloseTo(709.5, 0);
  const plot = page.locator(".coin-fidelity-plot");
  const textTop = (selector: string, last = false) => (last ? page.locator(selector).last() : page.locator(selector).first()).evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect().y;
  });
  expect(await textTop(".coin-fidelity-ylabels span")).toBe(517);
  expect(await textTop(".coin-fidelity-ylabels span", true)).toBe(851);
  expect(await textTop(".coin-fidelity-xlabels span")).toBe(864);
  expect(await page.locator(".coin-fidelity-chart-stats").evaluate((node) => ({
    y: node.getBoundingClientRect().y, color: getComputedStyle(node).borderTopColor,
  }))).toEqual({ y: 898, color: "rgb(35, 35, 37)" }); // --border rounds by one channel.
  const label = await page.locator(".coin-fidelity-plot > b").evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const box = range.getBoundingClientRect();
    return { x: box.x, y: box.y };
  });
  expect(label.x).toBeCloseTo(851.8, 0);
  expect(label.y).toBeCloseTo(552.6, 0);
});

test("NOVA zero figures, final price row and price suffix match the source", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "nova" });
  await page.goto("/#/coins/NOVA");
  await expect(page.locator(".coin-fidelity-custom")).toBeVisible({ timeout: 40_000 });
  const values = page.locator(".coin-fidelity-metrics.bottom .coin-fidelity-metric strong");
  for (const index of [2, 3, 4, 5]) {
    expect(await values.nth(index).evaluate((node) => getComputedStyle(node).color)).toBe("rgb(154, 156, 162)");
  }
  for (const node of [
    page.locator(".coin-fidelity-price-history-row").last().locator("span"),
    page.locator(".coin-fidelity-transactions tbody tr").last().locator("td").nth(3),
  ]) expect(await node.evaluate((element) => getComputedStyle(element).color)).toBe("rgb(154, 156, 162)");
  await expect(page.locator(".coin-fidelity-sources table tbody tr").last().locator("td").last()).toHaveText("100.0%");
  const priceRows = page.locator(".coin-fidelity-price-history-row");
  expect(await priceRows.first().evaluate((node) => getComputedStyle(node).borderTopWidth)).toBe("0px");
  expect(await priceRows.nth(1).evaluate((node) => {
    const style = getComputedStyle(node);
    return { width: style.borderTopWidth, color: style.borderTopColor };
  })).toEqual({ width: "1px", color: "rgb(24, 23, 28)" }); // --rule rounds from the source hex.
  expect(await priceRows.last().evaluate((node) => getComputedStyle(node).borderBottomWidth)).toBe("0px");
  expect(await page.locator(".coin-fidelity-set-price").evaluate((node) => {
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height, display: style.display, gap: style.gap, padding: style.padding, weight: style.fontWeight, color: style.color };
  })).toEqual({ x: 105, y: 771, width: 136, height: 28, display: "block", gap: "8px", padding: "0px 11px", weight: "500", color: "rgb(154, 156, 162)" }); // --faint RGB.
  await page.getByRole("button", { name: /Edit.*transaction/i }).last().click();
  expect(await page.locator(".coin-fidelity-price-input small").evaluate((node) => getComputedStyle(node).fontSize)).toBe("13px");
});

test("Coin chart controls and source tags match source positioning", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-sources tbody tr").first()).toBeVisible({ timeout: 40_000 });
  expect((await page.locator(".coin-fidelity-chart-controls .coin-fidelity-controls").first().boundingBox())!.x).toBeCloseTo(699.6, 0);
  const range = (await page.locator(".coin-fidelity-position-header select").boundingBox())!;
  expect(range.x).toBeCloseTo(1405, 0);
  expect(range.y).toBe(295);
  expect(range.width).toBe(131);
  expect(range.height).toBe(30);
  expect(await page.locator(".coin-fidelity-position-header select").evaluate((node) => {
    const css = getComputedStyle(node);
    return { background: css.backgroundColor, border: css.borderColor, radius: css.borderRadius, padding: css.padding };
  })).toEqual({ background: "rgb(10, 10, 11)", border: "rgb(59, 59, 63)", radius: "6px", padding: "0px 28px 0px 12px" }); // --control RGB.
  await expect(page.locator(".coin-fidelity-sources tbody tr").first()).toContainText("Ledger cold wallet");
  await expect(page.locator(".coin-fidelity-sources td small").first()).toHaveCSS("margin-left", "5px");
});

test("NVDA chart reserves the smaller axis and end-label widths", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/NVDA?assetType=stock");
  await expect(page.locator(".coin-fidelity-plot svg path")).toBeVisible({ timeout: 40_000 });
  await expect(page.locator(".coin-fidelity-plot > b")).toHaveText("$31,075");
  await page.evaluate(() => document.fonts.ready);
  expect((await page.locator(".coin-fidelity-plot svg").boundingBox())!.x).toBeCloseTo(141.2, 0);
  expect(await page.locator(".coin-fidelity-plot svg path").evaluate((node) => node.getBoundingClientRect().width)).toBeCloseTo(712.6, 0);
  expect((await page.locator(".coin-fidelity-xlabels span").nth(5).boundingBox())!.x).toBeCloseTo(714.8, 0);
});

test("NVDA gridlines land on the source pixel rows", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.goto("/#/coins/NVDA?assetType=stock");
  await expect(page.locator(".coin-fidelity-plot svg path")).toBeVisible({ timeout: 40_000 });
  const image = await page.screenshot();
  const rows = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(145, 524, 3, 167).data;
    return Array.from({ length: 167 }, (_, index) => index + 524)
      .filter((_, index) => [0, 1, 2].filter((column) => {
        const pixel = (index * 3 + column) * 4;
        return pixels[pixel] === 35 && pixels[pixel + 1] === 35 && pixels[pixel + 2] === 37;
      }).length >= 2);
  }, image.toString("base64"));
  // A chart mark can cover one column; require two exact border pixels at every source row.
  expect(rows).toEqual([524, 565, 607, 648, 690]);
});

for (const [symbol, sourceQuantityX] of [["BTC", 1197.1], ["NVDA", 1206.6], ["NOVA", 1156.9]] as const) {
  test(`${symbol} source columns size themselves to their content`, async ({ page }) => {
    await installTauriBridge(page, { fidelityDesktop: symbol === "NOVA" ? "nova" : "full" });
    await page.goto(`/#/coins/${symbol}${symbol === "NVDA" ? "?assetType=stock" : ""}`);
    const table = page.locator(".coin-fidelity-sources table").first();
    await expect(table.locator("tbody tr").first()).toBeVisible({ timeout: 40_000 });
    expect(await table.evaluate((node) => getComputedStyle(node).tableLayout)).toBe("auto");
    expect((await table.locator("th").nth(1).boundingBox())!.x).toBeCloseTo(sourceQuantityX, 0);
  });
}
