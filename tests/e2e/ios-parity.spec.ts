import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  reducedMotion: "reduce",
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

const phones = [
  { name: "se", width: 375, height: 667 },
  { name: "14", width: 390, height: 844 },
  { name: "pro-max", width: 430, height: 932 },
];

test("the phone shell applies top and side safe-area insets once", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await expect(page.locator("#app-main-content .mobile-large-title")).toBeVisible();
  await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
  const positions = await page.evaluate(() => {
    const root = document.documentElement;
    const header = document.querySelector<HTMLElement>("#app-top-bar")!;
    const main = document.querySelector<HTMLElement>("#app-main-content")!;
    const title = main.querySelector<HTMLElement>(".mobile-large-title")!;
    const refresh = header.querySelector<HTMLElement>('button[aria-label="Refresh"]')!;
    const originalHeaderHeight = header.getBoundingClientRect().height;
    const originalContentTop = main.getBoundingClientRect().top;
    const originalTitleTop = title.getBoundingClientRect().top;
    const originalRefreshTop = refresh.getBoundingClientRect().top;
    root.style.setProperty("--mobile-safe-top", "47px");
    root.style.setProperty("--mobile-safe-left", "59px");
    root.style.setProperty("--mobile-safe-right", "59px");
    return {
      headerTop: header.getBoundingClientRect().top,
      headerLeft: header.getBoundingClientRect().left,
      contentTop: main.getBoundingClientRect().top,
      contentLeft: main.getBoundingClientRect().left,
      contentRight: innerWidth - main.getBoundingClientRect().right,
      headerHeightDelta: header.getBoundingClientRect().height - originalHeaderHeight,
      contentTopDelta: main.getBoundingClientRect().top - originalContentTop,
      titleTopDelta: title.getBoundingClientRect().top - originalTitleTop,
      refreshTopDelta: refresh.getBoundingClientRect().top - originalRefreshTop,
      refreshRight: innerWidth - refresh.getBoundingClientRect().right,
      contentPaddingLeft: parseFloat(getComputedStyle(main).paddingLeft),
      contentPaddingRight: parseFloat(getComputedStyle(main).paddingRight),
    };
  });
  expect(positions.headerTop).toBe(0);
  expect(positions.headerLeft).toBe(0);
  expect(positions.headerHeightDelta).toBe(0);
  expect(positions.contentTopDelta).toBe(0);
  expect(positions.titleTopDelta).toBe(47);
  expect(positions.refreshTopDelta).toBe(47);
  expect(positions.contentLeft).toBe(0);
  expect(positions.contentRight).toBe(0);
  expect(positions.refreshRight).toBe(59);
  expect(positions.contentPaddingLeft).toBe(59);
  expect(positions.contentPaddingRight).toBe(59);
});

for (const phone of phones) {
  test(`portfolio routes fit iPhone ${phone.name} with native controls`, async ({ page }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height });
    await installTauriBridge(page, { richPortfolio: true });
    mkdirSync("test-results/mobile", { recursive: true });
    for (const [route, title] of [
      ["overview", "Overview"],
      ["history", "History"],
      ["summary", "Analytics"],
      ["wallets", "Wallets"],
      ["comparison", "Comparison"],
      ["cost-basis", "Cost basis"],
      ["more", "More"],
    ]) {
      await page.goto(`/#/${route}`);
      await expect(page.locator("#app-main-content")).toBeVisible();
      if (route === "more") {
        await expect(page.locator(".mobile-more-hub")).toBeVisible();
        await expect(page.getByRole("link", { name: "Rebalance" })).toBeVisible();
      } else {
        await expect(page.locator("#app-main-content h1")).toHaveText(title);
      }
      await expect(page.locator("#app-main-content")).not.toContainText("Loading page");
      await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
      if (route === "summary") {
        await expect(page.getByText("Profit metrics", { exact: true })).toBeAttached();
        await expect(page.getByRole("heading", { name: "Returns" })).toBeAttached();
      }
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("#app-main-content")).not.toContainText("Loading page");
      await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
      await page.screenshot({ path: `test-results/mobile/ios-${phone.name}-${route}.png` });
      if (route === "overview") {
        await page.emulateMedia({ colorScheme: "dark" });
        await page.evaluate(() => localStorage.setItem("track3-ui-theme", "system"));
        await page.reload();
        await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
        await expect(page.locator("html")).toHaveClass(/dark/);
        await page.screenshot({ path: `test-results/mobile/ios-${phone.name}-overview-dark.png` });
        await page.emulateMedia({ colorScheme: "light" });
        await page.reload();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phone.width);
      const tab = page.locator(".mobile-tab-bar");
      const tabBox = (await tab.boundingBox())!;
      expect(tabBox.y + tabBox.height).toBeLessThanOrEqual(phone.height + 1);
      for (const link of await tab.locator("a").all()) {
        const box = (await link.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
      for (const control of await page.locator(
        "#app-top-bar button:visible, .mobile-more-hub a:visible, .mobile-route-heading button:visible",
      ).all()) {
        const box = (await control.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
      const inset = await page.locator("#app-main-content").evaluate((main) => {
        const before = parseFloat(getComputedStyle(main).paddingBottom);
        (main as HTMLElement).style.setProperty("--mobile-safe-bottom", "31px");
        const after = parseFloat(getComputedStyle(main).paddingBottom);
        (main as HTMLElement).style.removeProperty("--mobile-safe-bottom");
        return after - before;
      });
      expect(inset).toBe(31);
      if (route === "summary") {
        await page.getByRole("heading", { name: "Returns" }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/mobile/ios-${phone.name}-profit.png` });
      }
    }
  });

  test(`rebalance disclosures have 44px targets on iPhone ${phone.name}`, async ({ page }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height });
    await installTauriBridge(page, { seedRebalanceProfile: true });
    await page.goto("/#/rebalance");
    await expect(page.getByText("Manual setup", { exact: true })).toBeVisible();
    for (const title of ["Manual setup", "Details"]) {
      const summary = page.locator("summary").filter({ hasText: title });
      if (title === "Details") await summary.scrollIntoViewIfNeeded();
      const box = (await summary.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test(`first launch adds a holding and refreshes on iPhone ${phone.name}`, async ({ page }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height });
    await installTauriBridge(page, { emptyPortfolio: true });
    await page.goto("/#/overview");
    await expect(page.getByText("Your portfolio starts here")).toBeVisible();
    await page.screenshot({ path: `test-results/mobile/ios-${phone.name}-first-launch.png` });
    await page.getByRole("button", { name: "Add your first source" }).click();
    await expect(page).toHaveURL(/#\/settings\/configuration$/);
    await page.getByRole("button", { name: "Add source" }).click();
    await page.getByRole("button", { name: "Add custom asset" }).click();
    const form = page.getByRole("dialog", { name: "Add custom asset" });
    await form.getByRole("textbox", { name: "Symbol" }).fill("ETH");
    await form.getByRole("textbox", { name: "Amount" }).fill("2");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Edit ETH" })).toBeVisible();
    await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "Overview" }).click();
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByRole("alertdialog", { name: "Source status" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phone.width);
  });

  test(`an exchange and wallet can be added on iPhone ${phone.name}`, async ({ page }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height });
    await installTauriBridge(page);
    await page.goto("/#/more");
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("navigation", { name: "Settings sections" })
      .getByRole("link", { name: "Data sources" }).click();

    await page.getByRole("button", { name: "Add source" }).click();
    await page.getByRole("button", { name: "Add wallet" }).click();
    const wallet = page.getByRole("dialog", { name: "Edit data source" });
    await wallet.getByRole("button", { name: "BTC" }).click();
    await wallet.getByRole("textbox", { name: "Alias" }).fill("Long-term BTC");
    await wallet.getByRole("textbox", { name: "Address" }).fill("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
    await wallet.getByRole("button", { name: "Add" }).click();
    await expect(wallet).not.toBeVisible();
    await expect(page.getByRole("region", { name: "Wallet" }).getByRole("button", { name: /^Long-term BTC / })).toBeVisible();

    await page.getByRole("button", { name: "Add exchange" }).click();
    const exchange = page.getByRole("dialog", { name: "Edit data source" });
    await exchange.getByRole("button", { name: "Binance" }).click();
    await exchange.getByRole("textbox", { name: "Alias" }).fill("Portfolio Binance");
    await exchange.getByRole("textbox", { name: "Api Key" }).fill("e2e-api-key");
    await exchange.getByRole("textbox", { name: "Api Secret" }).fill("e2e-api-secret");
    await exchange.getByRole("button", { name: "Add" }).click();
    await expect(exchange).not.toBeVisible();
    await expect(page.getByRole("region", { name: "Exchanges" }).getByRole("button", { name: /^Portfolio Binance / })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", { name: "Wallet" }).getByRole("button", { name: /^Long-term BTC / })).toBeVisible();
    await expect(page.getByRole("region", { name: "Exchanges" }).getByRole("button", { name: /^Portfolio Binance / })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phone.width);
    await page.screenshot({ path: `test-results/mobile/ios-${phone.name}-added-sources.png` });
  });

  test(`Files export restores on iPhone ${phone.name}`, async ({ page }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height });
    const bridge = await installTauriBridge(page);
    await page.goto("/#/settings/data?section=backup");
    await page.getByRole("button", { name: "Share JSON" }).click();
    await expect.poll(bridge.shares).toBe(1);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByText("Export data successfully", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Import", exact: true }).click();
    const confirm = page.getByRole("alertdialog", { name: "Restore data?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Restore" }).click();
    const conflicts = page.getByRole("dialog", { name: "Conflicts Found" });
    await expect(conflicts).toBeVisible();
    await conflicts.getByRole("button", { name: "Ignore" }).click();
    await expect(page.getByText("Import data successfully", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phone.width);
  });

  test(`a goal, rebalance targets, and assistant reply work from More on iPhone ${phone.name}`, async ({ page }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height });
    await installTauriBridge(page, { seedRebalanceProfile: true });
    await page.goto("/#/more");
    await page.getByRole("link", { name: "Goals & Alerts" }).click();
    await page.getByRole("button", { name: "Add alert" }).click();
    const goal = page.getByRole("dialog", { name: "Add alert" });
    await goal.getByRole("spinbutton", { name: "Threshold" }).fill("50000");
    await goal.getByRole("button", { name: "Save rule" }).click();
    await expect(goal).not.toBeVisible();
    const createdRule = page.getByRole("button", { name: "Edit" }).first()
      .locator("xpath=ancestor::div[contains(@class, 'rounded-md')][1]");
    await expect(createdRule).toBeVisible();
    await expect(createdRule).toContainText("$50,000");
    await createdRule.evaluate((rule) => {
      window.scrollTo({ top: window.scrollY + rule.getBoundingClientRect().top - 90, behavior: "auto" });
    });
    await expect.poll(async () => {
      const rule = (await createdRule.boundingBox())!;
      const tabs = (await page.getByRole("navigation", { name: "Tabs" }).boundingBox())!;
      return rule.y >= 80 && rule.y + rule.height <= tabs.y;
    }).toBe(true);
    await page.screenshot({ path: `test-results/mobile/ios-${phone.name}-created-goal.png` });
    await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "More" }).click();
    await page.getByRole("link", { name: "Rebalance" }).click();
    await page.getByText("Manual setup", { exact: true }).click();
    await page.getByRole("button", { name: "Save targets" }).click();
    await expect(page.getByText("Targets saved.")).toBeVisible();
    await page.screenshot({ path: `test-results/mobile/ios-${phone.name}-rebalance.png` });
    await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "More" }).click();
    await page.getByRole("link", { name: "Assistant" }).click();
    await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(1);
    await page.getByRole("textbox", { name: "Ask the assistant..." }).fill("Say hello");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Hello from SSE")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
    const titleRow = (await page.getByTestId("sidebar-toggle").locator("..").boundingBox())!;
    const settings = (await page.getByTestId("chat-open-settings").boundingBox())!;
    expect(settings.x >= titleRow.x + titleRow.width || settings.y >= titleRow.y + titleRow.height).toBe(true);
    await page.screenshot({ path: `test-results/mobile/ios-${phone.name}-assistant.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phone.width);
  });

  test(`language and theme choices persist on iPhone ${phone.name}`, async ({ page }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height });
    await installTauriBridge(page);
    await page.goto("/#/settings/appearance?section=language");
    await page.getByRole("button", { name: "中文" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh");
    await page.goto("/#/settings/appearance?section=theme");
    await page.getByRole("button", { name: "深色" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "外观" })).toBeVisible();
    await page.screenshot({ path: `test-results/mobile/ios-${phone.name}-dark-theme.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phone.width);
  });

  test(`settings choices have labeled tap areas on iPhone ${phone.name}`, async ({ page }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height });
    await installTauriBridge(page);
    await page.goto("/#/settings/configuration?section=currency");
    const switches = page.getByRole("switch");
    await expect(switches).toHaveCount(2);
    for (const control of await switches.all()) {
      const box = (await control.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const group = page.getByRole("switch", { name: /Group stable coins/ });
    const previous = await group.getAttribute("data-state");
    await group.click();
    await expect(group).not.toHaveAttribute("data-state", previous ?? "");

    await page.goto("/#/settings/appearance?section=theme");
    for (const name of ["Follow system", "Light", "Dark", "Green Up / Red Down", "Red Up / Green Down"]) {
      const row = page.getByRole("button", { name });
      await expect(row).toBeVisible();
      const box = (await row.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.goto("/#/settings/appearance?section=language");
    for (const name of ["English", "中文"]) {
      const row = page.getByRole("button", { name });
      const box = (await row.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("button", { name: "中文" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh");

    await page.goto("/#/settings/data?section=backup");
    for (const id of ["exportConfigurationCheckbox", "exportDataCheckbox"]) {
      const label = page.locator(`label[for="${id}"]`);
      const box = (await label.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const backup = page.locator("#exportConfigurationCheckbox");
    const before = await backup.getAttribute("data-state");
    await page.locator('label[for="exportConfigurationCheckbox"]').click();
    await expect(backup).not.toHaveAttribute("data-state", before ?? "");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phone.width);
  });
}
