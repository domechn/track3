import { expect, test, type Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

test("iPhone bridge rejects desktop-only plugins", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/settings/appearance?section=theme");
  const results = await page.evaluate(async () => Promise.allSettled([
    "plugin:process|relaunch",
    "plugin:updater|check",
    "plugin:shell|open",
  ].map((cmd) => (window as any).__TAURI_INTERNALS__.invoke(cmd))));
  expect(results.map((result) => result.status)).toEqual(["rejected", "rejected", "rejected"]);
});

test("iPhone Backup export row keeps its detail below the category name", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/settings/data?section=backup");
  const labels = page.locator(".ios-d3-backup-actions .ios-d3-setting-switch-row").first().locator("label span");
  const title = (await labels.nth(0).boundingBox())!;
  const detail = (await labels.nth(1).boundingBox())!;
  expect(detail.y).toBeGreaterThanOrEqual(title.y + title.height);
});

test("More opens every iPhone settings section through the Settings hub", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page);
  await page.goto("/#/more");
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.locator("#app-main-content h1")).toHaveCount(1);
  const sections = page.getByRole("navigation", { name: "Settings sections" });
  const sectionLink = (title: string) => sections.getByRole("link").filter({
    has: page.locator(".mobile-list-label", { hasText: new RegExp(`^${title}$`) }),
  });
  for (const title of [
    "Data sources", "Currency & display", "Appearance", "Language", "Blacklist",
    "Pro & license", "AI assistant", "Security", "Backup & data", "Backup & sync", "About",
  ]) {
    const link = sectionLink(title);
    await expect(link).toBeVisible();
    await expect(link).toHaveClass(/mobile-list-row/);
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await sectionLink("Language").click();
  await expect(page.getByRole("heading", { level: 1, name: "Language" })).toBeVisible();
  await expect(page.locator("#app-top-bar .mobile-compact-title")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(1);
  await page.locator("#app-top-bar").getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await page.locator("#app-top-bar").getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/#\/more$/);
});

test("iPhone settings hub shows saved preference values", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("track3-ui-theme", "dark");
    localStorage.setItem("track3-ui-locale", "en");
  });
  await installTauriBridge(page);
  await page.goto("/#/settings");
  const menu = page.getByRole("navigation", { name: "Settings sections" });
  await expect(menu.getByRole("link", { name: "Currency & display" })).toContainText("USD");
  await expect(menu.getByRole("link", { name: "Language" })).toContainText("English");
  await expect(menu.getByRole("link", { name: "Appearance" })).toContainText("Dark");
});

test("iPhone can add a custom asset from an empty sources page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { emptyPortfolio: true });
  await page.goto("/#/settings/configuration?section=sources");
  await page.getByRole("button", { name: "Add source" }).click();
  await page.getByRole("button", { name: "Add custom asset" }).click();
  await expect(page.getByRole("dialog", { name: "Add custom asset" })).toBeVisible();
});

test("iPhone custom asset editor stays closed after switching source tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { emptyPortfolio: true });
  await page.goto("/#/settings/configuration?section=sources");
  await page.getByRole("button", { name: "Add source" }).click();
  await page.getByRole("button", { name: "Add custom asset" }).click();
  const editor = page.getByRole("dialog", { name: "Add custom asset" });
  await editor.getByRole("textbox", { name: "Symbol" }).fill("GOLD");
  await editor.getByRole("textbox", { name: "Amount" }).fill("2");
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor).toHaveCount(0);
  await page.getByRole("tab", { name: "Exchanges" }).click();
  await page.getByRole("tab", { name: "Custom assets" }).click();
  await page.waitForTimeout(300);
  await expect(editor).toHaveCount(0);
  await page.evaluate(() => { location.hash = "#/settings/configuration?section=currency"; });
  await expect(page.getByRole("heading", { name: "Currency", exact: true }).first()).toBeVisible();
  await page.evaluate(() => { location.hash = "#/settings/configuration?section=sources"; });
  await expect(page.getByRole("tab", { name: "Custom assets" })).toBeVisible();
  await page.waitForTimeout(300);
  await expect(editor).toHaveCount(0);
});

test("an edge swipe returns from a settings page to the Settings hub", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page);
  await page.goto("/#/more");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("navigation", { name: "Settings sections" })
    .getByRole("link", { name: "Language" }).click();
  await expect(page).toHaveURL(/#\/settings\/appearance\?section=language$/);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart", touchPoints: [{ x: 20, y: 250 }],
  });
  for (const x of [40, 80, 120, 160]) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove", touchPoints: [{ x, y: 250 }],
    });
    await page.waitForTimeout(30);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd", touchPoints: [],
  });
  await expect(page).toHaveURL(/#\/settings$/);
});

test("an edge swipe inside a source editor leaves the form open", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page);
  await page.goto("/#/settings/configuration?section=sources");
  await page.getByRole("button", { name: "Add source" }).click();
  await page.getByRole("button", { name: "Add exchange" }).click();
  const editor = page.getByRole("dialog", { name: "Edit data source" });
  await expect(editor).toBeVisible();
  expect((await editor.boundingBox())!.y).toBe(0);
  expect(await page.evaluate(() => document.elementFromPoint(100, 15)?.closest('[role="dialog"]')?.getAttribute("aria-label"))).toBe("Edit data source");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart", touchPoints: [{ x: 20, y: 250 }],
  });
  for (const x of [40, 80, 120, 160]) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove", touchPoints: [{ x, y: 250 }],
    });
    await page.waitForTimeout(30);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd", touchPoints: [],
  });
  await expect(editor).toBeVisible();
  await expect(page).toHaveURL(/#\/settings\/configuration\?section=sources$/);
});

test("iPhone source tabs show one saved category at a time", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/settings/configuration?section=sources");
  const tabs = page.getByRole("tablist", { name: "Data sources" });
  await expect(tabs).toBeVisible();
  await expect(page.getByRole("region", { name: "Exchanges" })).toBeVisible();
  await tabs.getByRole("tab", { name: "Wallets" }).click();
  await expect(page.getByRole("region", { name: "Wallets" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Exchanges" })).toHaveCount(0);
});

test("locked sync status stays clear of the More tab and tab bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { seedLockedSync: true });
  await page.goto("/#/overview");
  const pill = page.getByRole("button", { name: "Sync locked" });
  await expect(pill).toBeVisible();
  const pillBox = (await pill.boundingBox())!;
  const tabBox = (await page.locator(".mobile-tab-bar").boundingBox())!;
  expect(pillBox.y + pillBox.height).toBeLessThanOrEqual(tabBox.y);
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "More" }).click();
  await expect(page).toHaveURL(/#\/more$/);
});

test("switching iPhone tabs uses the native haptic bridge", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const bridge = await installTauriBridge(page);
  await page.goto("/#/overview");
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "History" }).click();
  await expect(page).toHaveURL(/#\/history$/);
  await expect.poll(bridge.haptics).toBe(1);
});

test("More and source selections use the native haptic bridge", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const bridge = await installTauriBridge(page);
  await page.goto("/#/more");
  await page.getByRole("link", { name: "Settings" }).click();
  await expect.poll(bridge.haptics).toBe(1);
  await page.getByRole("link", { name: "Data sources" }).click();
  await expect.poll(bridge.haptics).toBe(2);
  await page.getByRole("button", { name: "Add source" }).click();
  await page.getByRole("button", { name: "Add exchange" }).click();
  await expect.poll(bridge.haptics).toBe(3);
});

test("the chat composer stays above the tab bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page);
  await page.goto("/#/assistant");
  const composer = page.getByRole("textbox", { name: "Ask the assistant..." });
  await expect(composer).toBeVisible();
  const tabTop = (await page.locator(".mobile-tab-bar").boundingBox())!.y;
  const composerBottom = (await composer.boundingBox())!;
  expect(composerBottom.y + composerBottom.height).toBeLessThanOrEqual(tabTop);
});

for (const width of [375, 390, 430]) {
  test(`iPhone settings and source forms stay within ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await installTauriBridge(page);
    await page.goto("/#/settings");
    await expect(page.getByRole("link", { name: "Data sources" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("link", { name: "Data sources" }).click();
    await page.getByRole("button", { name: "Add source" }).click();
    await expect(page.getByRole("button", { name: "Add exchange" })).toBeVisible();
    await page.getByRole("button", { name: "Add exchange" }).click();
    await page.getByRole("button", { name: "Binance" }).click();
    await expect(page.getByRole("textbox", { name: "Api Key" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.goto("/#/settings/data?section=backup");
    await expect(page.getByRole("button", { name: "Share JSON" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.goto("/#/settings/appearance?section=language");
    await expect(page.getByRole("heading", { level: 1, name: "Language" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

  test(`remaining iPhone settings pages stay reachable within ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await installTauriBridge(page);
    for (const [path, title, content] of [
      ["/settings/configuration?section=currency", "Currency", "Base currency"],
      ["/settings/appearance?section=theme", "Appearance", "Follow system"],
      ["/settings/data?section=blacklist", "Blacklist", "Token Blacklist"],
      ["/settings/systemInfo?section=pro", "Pro and license", "Track3 Pro"],
      ["/settings/assistant", "AI assistant", "Endpoint"],
      ["/settings/data?section=security", "Security", "App lock"],
      ["/settings/sync", "Backup and sync", "S3 endpoint"],
      ["/settings/systemInfo?section=about", "About", "App Version"],
    ]) {
      await page.goto(`/#${path}`);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.locator("#app-main-content h1")).toHaveCount(1);
      await expect(page.getByText(content, { exact: true }).last()).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });

  test(`assistant, alert editor and rebalance fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await installTauriBridge(page);
    await page.goto("/#/assistant");
    await expect(page.getByRole("textbox", { name: "Ask the assistant..." })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.goto("/#/goals");
    await expect(page.getByRole("heading", { level: 1, name: "Goals & Alerts" })).toBeVisible();
    await expect(page.locator("#app-main-content h1")).toHaveCount(1);
    await page.getByRole("button", { name: "Add alert" }).click();
    await expect(page.getByRole("dialog", { name: "Add alert" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.goto("/#/rebalance");
    await expect(page.getByRole("heading", { level: 1, name: "Rebalance" })).toBeVisible();
    await expect(page.locator("#app-main-content h1")).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

  test(`refresh progress sheet fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await installTauriBridge(page);
    await page.goto("/#/overview");
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByRole("alertdialog", { name: "Source status" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test("custom asset source picker opens from the bottom of the iPhone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 812 });
  await installTauriBridge(page);
  await page.goto("/#/settings/configuration?section=sources");
  await page.getByRole("tab", { name: "Custom assets" }).click();
  await page.getByRole("button", { name: "More actions for BTC" }).click();
  await page.getByRole("button", { name: "Attach to" }).click();
  const picker = page.getByRole("dialog", { name: "Attach to" });
  await expect(picker).toBeVisible();
  const box = await picker.boundingBox();
  expect(box!.y).toBeGreaterThan(400);
});

test("rebalance suggestions use readable cards at 375px when a profile has data", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await installTauriBridge(page, { seedRebalanceProfile: true });
  await page.goto("/#/rebalance");
  await page.getByText("Details", { exact: true }).click();
  const cards = page.getByRole("list", { name: "Suggested trades" });
  await expect(cards).toBeVisible();
  await expect(page.getByRole("table", { name: "Suggested trades" })).toHaveCount(0);
  const btc = cards.getByRole("listitem", { name: "BTC" });
  await expect(btc).toContainText("Current");
  await expect(btc).toContainText("Target");
  await expect(btc).toContainText("Sell");
  await expect(btc).toContainText("Value");
  await expect(btc).toContainText("Quantity");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("collapsed rebalance header shows its full title at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await installTauriBridge(page);
  await page.goto("/#/rebalance");
  await expect(page.getByRole("heading", { level: 1, name: "Rebalance" })).toBeVisible();
  await expect(page.getByText("Trade options", { exact: true })).toBeAttached();
  await page.evaluate(() => window.scrollTo(0, 180));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(64);
  const title = page.locator("#app-top-bar .ios-d3-pushed-title");
  await expect(title).toBeVisible();
  expect(await title.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
});
