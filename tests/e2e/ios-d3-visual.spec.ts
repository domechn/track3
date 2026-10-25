import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

test.use({
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
  deviceScaleFactor: 2,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

const phones = [
  { name: "mini", width: 320, height: 568 },
  { name: "se", width: 375, height: 667 },
  { name: "14", width: 390, height: 844 },
  { name: "pro-max", width: 430, height: 932 },
];
const settings = [
  ["settings", "/settings", "Settings"],
  ["sources", "/settings/configuration?section=sources", "Data sources"],
  ["currency", "/settings/configuration?section=currency", "Currency"],
  ["appearance", "/settings/appearance?section=theme", "Appearance"],
  ["language", "/settings/appearance?section=language", "Language"],
  ["blacklist", "/settings/data?section=blacklist", "Blacklist"],
  ["security", "/settings/data?section=security", "Security"],
  ["backup", "/settings/data?section=backup", "Backup"],
  ["pro", "/settings/systemInfo?section=pro", "Pro and license"],
  ["about", "/settings/systemInfo?section=about", "About"],
  ["assistant-settings", "/settings/assistant", "AI assistant"],
  ["sync-settings", "/settings/sync", "Backup and sync"],
] as const;

async function capture(page: Page, phone: string, theme: string, name: string) {
  await expect(page.locator("#app-main-content")).not.toContainText("Loading page");
  await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const image = await page.screenshot({ path: `test-results/mobile/d3-${phone}-${theme}-${name}.png` });
  const width = page.viewportSize()!.width;
  expect(image.readUInt32BE(16)).toBe(width * 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

for (const phone of phones) for (const theme of ["light", "dark"] as const) {
  test(`D3 screens are reachable and captured on iPhone ${phone.name} in ${theme}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: phone.width, height: phone.height });
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
    await installTauriBridge(page, undefined, false, true, false, false, true, false, false, true, true);
    mkdirSync("test-results/mobile", { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    for (const [name, route, title] of settings) {
      await page.goto(`/#${route}`);
      await expect(page.locator("#app-main-content h1")).toHaveText(title);
      await capture(page, phone.name, theme, name);
      if (name === "currency") {
        await expect(page.getByRole("button", { name: /Base currency.*USD/ })).toBeVisible();
        await expect(page.getByRole("button", { name: /Count of results/ })).toBeVisible();
      }
      if (name === "backup") {
        const folderActions = page.locator(".ios-d3-backup-folder-actions");
        await folderActions.evaluate((element) => element.scrollIntoView({ block: "center" }));
        const card = await folderActions.locator("xpath=ancestor::*[contains(@class, 'ios-d3-auto-backup-setting')]").boundingBox();
        for (const button of await folderActions.getByRole("button").all()) {
          const bounds = await button.boundingBox();
          expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(card!.x + card!.width);
        }
        const folderLabel = await folderActions.getByRole("button", { name: "Use Documents folder" }).evaluate((element) => {
          const style = getComputedStyle(element);
          return { height: element.getBoundingClientRect().height, lineHeight: Number.parseFloat(style.lineHeight) };
        });
        expect(folderLabel.height).toBeLessThan(folderLabel.lineHeight * 2 + 18);
        await capture(page, phone.name, theme, "backup-folder");
      }
    }
    await page.goto("/#/settings/configuration?section=sources");
    await expect(page.getByRole("button", { name: "More actions for Main exchange" })).toBeVisible();
    await page.getByRole("button", { name: "More actions for Main exchange" }).click();
    await page.screenshot({ path: `test-results/mobile/d3-${phone.name}-${theme}-source-actions.png` });
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Add exchange" }).click();
    await expect(page.getByRole("dialog", { name: "Edit data source" })).toBeVisible();
    await expect(page.locator(".ios-d3-editor-intro .ios-d3-source-avatar")).toHaveCount(0);
    await page.screenshot({ path: `test-results/mobile/d3-${phone.name}-${theme}-source-provider.png` });
    await page.getByRole("button", { name: "Binance" }).click();
    await expect(page.getByRole("textbox", { name: "API key" })).toHaveAttribute("placeholder", "Required");
    await expect(page.locator(".ios-d3-editor-intro")).toContainText("Binance");
    const paste = await page.getByRole("button", { name: "Paste", exact: true }).last().boundingBox();
    const reveal = await page.getByRole("button", { name: "Hold to reveal API secret" }).boundingBox();
    expect(reveal!.x).toBeGreaterThan(paste!.x);
    await page.screenshot({ path: `test-results/mobile/d3-${phone.name}-${theme}-source-credentials.png` });
    await page.getByRole("dialog", { name: "Edit data source" }).getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Add symbol" }).click();
    const cancel = await page.getByRole("dialog", { name: "Add custom asset" }).getByRole("button", { name: "Cancel" }).boundingBox();
    expect(cancel!.x).toBeLessThan(60);
    const customEditor = page.getByRole("dialog", { name: "Add custom asset" });
    await expect(customEditor.locator(".ios-d3-editor-nav").getByRole("button", { name: "Save" })).toBeVisible();
    await page.screenshot({ path: `test-results/mobile/d3-${phone.name}-${theme}-custom-asset-editor.png` });
    await page.getByRole("dialog", { name: "Add custom asset" }).getByRole("button", { name: "Cancel" }).click();

    await page.goto("/#/more");
    await capture(page, phone.name, theme, "more");
    await page.goto("/#/goals");
    await page.getByRole("button", { name: "Add alert" }).click();
    const saveRule = await page.getByRole("dialog", { name: "Add alert" }).getByRole("button", { name: "Save rule" }).boundingBox();
    const cancelRule = await page.getByRole("dialog", { name: "Add alert" }).getByRole("button", { name: "Cancel" }).evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(cancelRule).toBeGreaterThanOrEqual(17);
    const goalNav = await page.locator(".ios-d3-goal-editor-nav").boundingBox();
    expect(saveRule!.y + saveRule!.height).toBeLessThanOrEqual(goalNav!.y + goalNav!.height);
    const cancelAction = await page.getByRole("dialog", { name: "Add alert" }).getByRole("button", { name: "Cancel" }).boundingBox();
    const ruleTitle = await page.locator(".ios-d3-goal-editor-nav h2").boundingBox();
    expect(ruleTitle!.x - (cancelAction!.x + cancelAction!.width)).toBeGreaterThanOrEqual(8);
    expect(saveRule!.x - (ruleTitle!.x + ruleTitle!.width)).toBeGreaterThanOrEqual(8);
    await page.screenshot({ path: `test-results/mobile/d3-${phone.name}-${theme}-goal-editor.png` });
    await page.getByRole("dialog", { name: "Add alert" }).getByRole("spinbutton", { name: "Threshold" }).fill("90000");
    await page.getByRole("dialog", { name: "Add alert" }).getByRole("button", { name: "Save rule" }).click();
    await expect(page.getByRole("dialog", { name: "Add alert" })).not.toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, phone.name, theme, "goals");
    await expect(page.locator(".ios-d3-goals-add")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    for (const chip of await page.locator(".ios-d3-goals [data-ai-setup-suggestion]").all()) {
      const bounds = await chip.boundingBox();
      const card = await chip.locator("xpath=ancestor::*[@data-ai-setup-card]").boundingBox();
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(card!.x + card!.width);
    }
    await expect(page.getByRole("progressbar", { name: /Portfolio value goal/i })).toBeVisible();
    await expect(page.locator(".ios-d3-goal-rule").first()).toContainText("$90,000.00");
    await expect(page.locator(".ios-d3-goal-rule").first()).not.toContainText("USD");
    await page.locator(".ios-d3-goal-rule").first().evaluate((element) => element.scrollIntoView({ block: "start" }));
    const goalProgress = await page.locator(".ios-d3-goal-rule").first().getByRole("progressbar").boundingBox();
    const goalTabBar = await page.locator(".mobile-tab-bar").boundingBox();
    const goalTopBar = await page.locator("#app-top-bar").boundingBox();
    expect(goalProgress!.y).toBeGreaterThanOrEqual(goalTopBar!.y + goalTopBar!.height);
    expect(goalProgress!.y + goalProgress!.height).toBeLessThanOrEqual(goalTabBar!.y);
    await capture(page, phone.name, theme, "goal-progress");

    await page.goto("/#/rebalance");
    await expect(page.getByRole("heading", { level: 1, name: "Rebalance" })).toBeVisible();
    await capture(page, phone.name, theme, "rebalance");
    for (const chip of await page.locator(".ios-d3-rebalance [data-ai-setup-suggestion]").all()) {
      const bounds = await chip.boundingBox();
      const card = await chip.locator("xpath=ancestor::*[@data-ai-setup-card]").boundingBox();
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(card!.x + card!.width);
    }
    await page.getByText("Manual setup", { exact: true }).click();
    await page.locator(".ios-d3-target").first().scrollIntoViewIfNeeded();
    await capture(page, phone.name, theme, "rebalance-targets");
    await page.locator(".ios-d3-trade").first().scrollIntoViewIfNeeded();
    const buy = page.locator(".ios-d3-buy .ios-d3-trade-value").first();
    const sell = page.locator(".ios-d3-sell .ios-d3-trade-value").first();
    await expect(buy).toContainText(/^\+\$[0-9]/);
    await expect(sell).toContainText(/^−\$[0-9]/);
    await expect(buy).toContainText("$");
    expect(await buy.evaluate((node) => node.getClientRects().length === 1 &&
      node.getBoundingClientRect().height < Number.parseFloat(getComputedStyle(node).lineHeight) * 1.5)).toBe(true);
    expect(await buy.evaluate((element) => getComputedStyle(element).color)).not.toBe(await sell.evaluate((element) => getComputedStyle(element).color));
    const tradeSymbol = page.locator(".ios-d3-trade .ios-d3-trade-symbol").first();
    const symbolBounds = await tradeSymbol.boundingBox();
    const tradeBounds = await page.locator(".ios-d3-trade").first().boundingBox();
    expect(symbolBounds!.x + symbolBounds!.width).toBeLessThanOrEqual(tradeBounds!.x + tradeBounds!.width);
    await capture(page, phone.name, theme, "rebalance-trades");
    await page.goto("/#/assistant");
    await expect(page.getByRole("textbox", { name: "Ask the assistant..." })).toBeVisible();
    await expect(page.locator(".ios-d3-chat-header")).toContainText("Assistant");
    await expect(page.locator(".assistant-insights-card")).toHaveCSS("border-radius", "16px");
    await expect(page.locator(".assistant-insights-card")).toContainText("$7,298.27");
    for (const action of await page.locator(".assistant-insights-card button, .assistant-insights-card a").all()) {
      const bounds = await action.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    const insightFill = await page.locator(".assistant-insights-card").evaluate((node) => getComputedStyle(node).backgroundColor);
    await expect(page.locator(".ios-d3-chat-composer")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await capture(page, phone.name, theme, "assistant-empty");
    const chatHeader = await page.locator(".ios-d3-chat-header").boundingBox();
    const backAction = await page.locator("#app-top-bar .mobile-header-back").boundingBox();
    const sessionsAction = await page.getByTestId("sidebar-toggle").boundingBox();
    const chatTitle = await page.locator(".ios-d3-chat-header h3").boundingBox();
    expect(sessionsAction!.x - (backAction!.x + backAction!.width)).toBeGreaterThanOrEqual(8);
    expect(chatTitle!.x - (sessionsAction!.x + sessionsAction!.width)).toBeGreaterThanOrEqual(8);
    const firstSuggestion = await page.getByTestId("chat-example-summary").boundingBox();
    const composer = await page.locator(".ios-d3-chat-composer").boundingBox();
    if (phone.width >= 390) {
      const insights = await page.locator(".assistant-insights-card").boundingBox();
      expect(insights!.y + insights!.height).toBeLessThanOrEqual(composer!.y);
    }
    expect(chatHeader!.height).toBeLessThanOrEqual(56);
    expect(firstSuggestion!.y + firstSuggestion!.height).toBeLessThanOrEqual(composer!.y);
    await page.getByRole("textbox", { name: "Ask the assistant..." }).fill("How is my portfolio doing?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.locator('.ios-d3-chat-bubble[data-streaming="true"] .markdown-content')).toBeVisible({ timeout: 1500 });
    await page.screenshot({ path: `test-results/mobile/d3-${phone.name}-${theme}-assistant-streaming.png` });
    await expect(page.getByText("Portfolio check")).toBeVisible();
    await expect(page.locator(".ios-d3-chat-bubble").last()).toContainText("AAPL is above its cost basis");
    await expect(page.getByText("Thinking", { exact: true })).toHaveCount(0);
    const reply = await page.getByText("Portfolio check").boundingBox();
    const composerAfterReply = await page.locator(".ios-d3-chat-composer").boundingBox();
    const tabBar = await page.locator(".mobile-tab-bar").boundingBox();
    expect(reply).not.toBeNull();
    expect(composerAfterReply).not.toBeNull();
    expect(tabBar).not.toBeNull();
    expect(reply!.y + reply!.height).toBeLessThanOrEqual(composerAfterReply!.y);
    expect(composerAfterReply!.y + composerAfterReply!.height).toBeLessThanOrEqual(tabBar!.y);
    await expect(page.locator('.ios-d3-chat-bubble[data-streaming="true"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
    const quickActions = page.locator(".ios-d3-quick-actions");
    const quickBounds = (await quickActions.boundingBox())!;
    expect(quickBounds.x).toBe(0);
    expect(quickBounds.width).toBe(phone.width);
    const trailingAction = (await page.getByTestId("quick-action-operations").boundingBox())!;
    expect(trailingAction.x + trailingAction.width).toBeLessThanOrEqual(phone.width - 16);
    expect(await page.getByTestId("quick-action-analysis").evaluate((node) => getComputedStyle(node).backgroundColor))
      .toBe(insightFill);
    const chatHeaderAfterReply = await page.locator(".ios-d3-chat-header").boundingBox();
    expect(chatHeaderAfterReply!.height).toBeLessThanOrEqual(56);
    const topBar = await page.locator("#app-top-bar").boundingBox();
    expect(chatHeaderAfterReply!.y).toBeLessThan(topBar!.y + topBar!.height);
    await capture(page, phone.name, theme, "assistant-chat");
    await page.getByRole("textbox", { name: "Ask the assistant..." }).fill("Show my tool activity");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Tool activity")).toBeVisible();
    await expect(page.locator(".ios-d3-tool-activity summary")).toContainText(/2 tools · (running|done)/);
    await expect(page.locator(".ios-d3-tool-chevron")).toBeVisible();
    await capture(page, phone.name, theme, "assistant-tools");

    await page.goto("/#/overview");
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByRole("alertdialog", { name: "Source status" })).toBeVisible();
    await expect(page.locator("[data-source-status-row]").first()).toBeVisible();
    await expect(page.locator(".ios-d3-refresh-sheet [data-source-status-row]").first()).not.toContainText("Waiting…");
    await page.screenshot({ path: `test-results/mobile/d3-${phone.name}-${theme}-refresh.png` });
    await expect(page.locator(".ios-d3-refresh-sheet [role='progressbar']")).toHaveCount(0, { timeout: 90_000 });
    if (!await page.getByRole("alertdialog", { name: "Source status" }).isVisible()) {
      await page.getByRole("button", { name: "Source status" }).click();
    }
    await expect(page.locator("[data-source-status-row]").first()).toBeVisible();
    await expect(page.locator(".ios-d3-refresh-sheet p.sr-only")).toHaveCount(0);
    await expect(page.locator(".ios-d3-toast-viewport")).toHaveCount(1);
    await expect(page.locator(".ios-d3-toast-viewport")).toBeHidden();
    const sourceLayout = await page.locator(".ios-d3-refresh-sheet [data-source-status-row]").evaluateAll((rows) =>
      rows.map((row) => {
        const identity = row.querySelector(".ios-d3-refresh-row-title");
        const date = [...row.querySelectorAll("div")].find((node) => node.textContent?.startsWith("Last data "));
        return {
          rowWidth: row.getBoundingClientRect().width,
          columns: getComputedStyle(row).gridTemplateColumns,
          mainWidth: row.querySelector(".ios-d3-refresh-row-main")?.getBoundingClientRect().width ?? 0,
          contentWidth: row.querySelector(".ios-d3-refresh-row-content")?.getBoundingClientRect().width ?? 0,
          identityWidth: identity?.getBoundingClientRect().width ?? 0,
          identityText: identity?.textContent ?? "",
          dateRight: date?.getBoundingClientRect().right ?? 0,
          rowRight: row.getBoundingClientRect().right,
          identityHeight: identity?.getBoundingClientRect().height ?? 0,
          identityLine: identity ? Number.parseFloat(getComputedStyle(identity).lineHeight) : 0,
          date: date?.textContent ?? "",
        };
      }));
    expect(sourceLayout.every((row) => row.identityWidth >= 70 &&
      row.identityHeight <= row.identityLine + 1 &&
      row.dateRight <= row.rowRight + 1), JSON.stringify(sourceLayout)).toBe(true);
    expect(sourceLayout.map((row) => row.date).join(" ")).not.toContain("2026-");
    await page.screenshot({ path: `test-results/mobile/d3-${phone.name}-${theme}-refresh-results.png` });
    expect(errors).toEqual([]);
  });

  test(`D3 first launch and startup lock are captured on iPhone ${phone.name} in ${theme}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: phone.width, height: phone.height });
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
    await installTauriBridge(page, undefined, false, false, true);
    mkdirSync("test-results/mobile", { recursive: true });
    await page.goto("/#/overview");
    await expect(page.getByRole("button", { name: "Add your first source" })).toBeVisible();
    await page.screenshot({ path: `test-results/mobile/d3-${phone.name}-${theme}-first-launch.png` });
    await page.getByRole("button", { name: "Add your first source" }).click();
    await expect(page.getByRole("list", { name: "Getting started" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add symbol" })).toHaveCount(0);
    await capture(page, phone.name, theme, "onboarding");
    await page.getByRole("button", { name: "Add source" }).click();
    await expect(page.getByRole("button", { name: "Add exchange" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add custom asset" })).toBeVisible();
    await page.screenshot({ path: `test-results/mobile/d3-${phone.name}-${theme}-source-kind-picker.png` });
  });

  test(`D3 protected startup is captured on iPhone ${phone.name} in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height });
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
    await installTauriBridge(page, undefined, false, false, false, false, false, false, true);
    mkdirSync("test-results/mobile", { recursive: true });
    await page.goto("/#/overview");
    await expect(page.getByRole("alert")).toContainText("Track3 is locked");
    await page.screenshot({ path: `test-results/mobile/d3-${phone.name}-${theme}-startup-lock.png` });
  });
}

test("D3 pushed titles replace the large title after scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await installTauriBridge(page, undefined, false, true, false, false, true, false, false, true, true);
  await page.goto("/#/settings/data?section=backup");
  await expect(page.getByRole("heading", { name: "Backup", level: 1 })).toBeVisible();
  await expect(page.locator("#app-top-bar .ios-d3-pushed-title")).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect(page.locator("#app-top-bar .ios-d3-pushed-title")).toHaveText("Backup");
  await expect(page.locator("#app-top-bar .ios-d3-pushed-title")).toBeVisible();
  const compact = await page.locator("#app-top-bar .ios-d3-pushed-title").boundingBox();
  const topBar = await page.locator("#app-top-bar").boundingBox();
  expect(Math.abs(compact!.x + compact!.width / 2 - topBar!.width / 2)).toBeLessThan(2);
});
