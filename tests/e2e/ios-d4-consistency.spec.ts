import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test("320px Wallets labels and change controls fit without wrapping words", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/wallets");
  await expect(page.locator(".d2-wallets .analyze-source-list li").first()).toBeVisible();
  const tileLabels = await page.locator(".d2-wallets .analyze-source-list-name").evaluateAll((nodes) =>
    nodes.map((node) => ({
      text: node.textContent?.trim(),
      overflow: node.scrollWidth > node.clientWidth,
      wrap: getComputedStyle(node).whiteSpace,
    })));
  expect(tileLabels.length).toBeGreaterThan(0);
  expect(tileLabels.every(({ overflow, wrap }) => !overflow && wrap === "nowrap"), JSON.stringify(tileLabels)).toBe(true);
  await expect(page.getByPlaceholder("Search wallets")).toBeVisible();
  const segments = page.locator(".wallet-change-controls .mobile-segment");
  await expect(segments).toHaveText(["Value", "%", "Volatility"]);
  expect(await segments.evaluateAll((nodes) => nodes.every((node) => {
    const box = node.getBoundingClientRect();
    return getComputedStyle(node).whiteSpace === "nowrap" && box.height <= 44;
  }))).toBe(true);
  const stats = await page.locator(".d2-wallets [data-testid^='stat-']").evaluateAll((nodes) =>
    nodes.filter((node) => node.getAttribute("data-testid") !== "stat-total-value")
      .map((node) => {
        const label = document.createRange();
        label.selectNodeContents(node.firstChild!);
        return { y: node.getBoundingClientRect().y, valueY: node.querySelector("span")!.getBoundingClientRect().y,
          labelLines: label.getClientRects().length };
      }));
  expect(stats).toHaveLength(3);
  expect(stats.every(({ y, valueY, labelLines }) =>
    Math.abs(y - stats[0].y) <= 1 && Math.abs(valueY - stats[0].valueY) <= 1 && labelLines === 1),
  JSON.stringify(stats)).toBe(true);
});

test("Overview uses the shared phone switches", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/overview");
  for (const label of ["Percent", "BTC base"]) {
    const control = page.getByRole("switch", { name: label });
    await expect(control).toHaveClass(/ios-switch/);
    await expect(control).toHaveAttribute("data-state", "unchecked");
    await control.click();
    await expect(control).toHaveAttribute("data-state", "checked");
  }
});

test("startup failure leaves recovery routes and pushed titles reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { richPortfolio: true, failDataQueries: true });
  await page.goto("/#/overview");
  await expect(page.locator(".mobile-data-error")).toContainText("Could not load portfolio data");
  await page.goto("/#/rebalance");
  await expect(page.getByRole("heading", { name: "Rebalance", level: 1 })).toBeVisible();
  await page.goto("/#/settings");
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await page.goto("/#/settings/data?section=backup");
  await expect(page.locator("#app-main-content")).toContainText("Use Documents folder");
});

test("pushed titles and goal editor actions use the same balanced insets", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/wallets");
  await expect(page.locator(".wallet-change-mobile-list")).toBeVisible();
  await page.locator(".wallet-change-mobile-list").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(64);
  const compact = page.locator("#app-top-bar .mobile-compact-title");
  await expect(compact).toBeVisible();
  expect(await compact.evaluate((node) => {
    const bounds = node.getBoundingClientRect();
    return Math.abs(bounds.x + bounds.width / 2 - innerWidth / 2);
  })).toBeLessThanOrEqual(1);
  await page.goto("/#/goals");
  await page.getByRole("button", { name: "Add alert" }).click();
  const editor = page.getByRole("dialog", { name: "Add alert" });
  const cancel = (await editor.getByRole("button", { name: "Cancel" }).boundingBox())!;
  const save = (await editor.getByRole("button", { name: "Save rule" }).boundingBox())!;
  expect(cancel.x).toBe(16);
  expect(Math.abs(375 - save.x - save.width - 16)).toBeLessThanOrEqual(1);
});

test.use({
  isMobile: true, hasTouch: true, reducedMotion: "reduce",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

test("rich dark Analytics drawdown has readable loss text", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/summary");
  await expect(page.locator(".d2-summary")).toHaveAttribute("aria-busy", "false");
  const drawdown = page.locator(".ath-card").getByText("Distance from ATH").locator("..").locator("strong");
  await expect(drawdown).toContainText("−");
  const contrast = await drawdown.evaluate((node) => {
    const rgb = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const luminance = (color: string) => {
      const [r, g, b] = rgb(color).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const foreground = luminance(getComputedStyle(node).color);
    const background = luminance(getComputedStyle(node.closest(".ath-card")!).backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

test("phone titles share one page inset and performance metrics share one layout", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installTauriBridge(page, { richPortfolio: true });
  for (const [route, label] of [
    ["/overview", "Overview"], ["/history", "History"], ["/summary", "Analytics"],
    ["/goals", "Goals & Alerts"], ["/settings", "Settings"],
    ["/settings/configuration?section=sources", "Data sources"],
  ]) {
    await page.goto(`/#${route}`);
    const title = page.locator("#app-main-content h1.ios-large-title:visible").first();
    await expect(title).toHaveText(label);
    await expect.poll(() => title.evaluate((node) => node.getBoundingClientRect().x)).toBe(16);
  }
  await page.goto("/#/overview");
  const metrics = page.locator(".overview-pnl-metric");
  await expect(metrics).toHaveCount(3);
  const layouts = await metrics.evaluateAll((nodes) => nodes.map((node) => ({
    display: getComputedStyle(node).display,
    textAlign: getComputedStyle(node).textAlign,
  })));
  expect(layouts[2]).toEqual(layouts[0]);
  const containment = await metrics.evaluateAll((nodes) => nodes.map((node) => ({
    cell: node.getBoundingClientRect().width,
    text: Math.max(...[...node.children].map((child) => child.getBoundingClientRect().width)),
  })));
  expect(containment.every(({ cell, text }) => text <= cell + 1), JSON.stringify(containment)).toBe(true);
});

test("the three 390px performance metrics align their labels and values", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/overview");
  await expect(page.locator(".overview-pnl-metric")).toHaveCount(3);
  for (const selector of [".overview-pnl-metric > :first-child", ".overview-pnl-metric-value"]) {
    const tops = await page.locator(selector).evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
  }
});

test("phone Goals and Assistant cards use quiet headings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/goals");
  await expect(page.getByRole("heading", { name: "Rules" })).toBeVisible();
  const heading = page.getByRole("heading", { name: "Rules" });
  const style = await heading.evaluate((node) => {
    const computed = getComputedStyle(node);
    const sample = document.createElement("span");
    sample.className = "text-muted-foreground";
    document.body.append(sample);
    const muted = getComputedStyle(sample).color;
    sample.remove();
    return { size: computed.fontSize, weight: computed.fontWeight, color: computed.color, muted };
  });
  expect(style.size).toBe("13px");
  expect(style.weight).toBe("500");
  expect(style.color).toBe(style.muted);
  const setup = page.locator("[data-ai-setup-card] h2");
  await expect(setup).toBeVisible();
  expect(await setup.evaluate((node) => getComputedStyle(node).fontSize)).toBe("13px");
  await page.goto("/#/assistant");
  const insights = page.locator(".assistant-insights-card h3");
  await expect(insights).toBeVisible();
  expect(await insights.evaluate((node) => getComputedStyle(node).fontSize)).toBe("13px");
});
