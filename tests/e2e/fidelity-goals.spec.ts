import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installPlanFidelityScene } from "./phone-plan-fidelity-scenes";

test.beforeEach(({}, info) => { test.skip(info.project.name !== "mobile", "Mobile fidelity capture"); });

test.use({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  isMobile: false, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

async function capture(page: Page, name: string, fullPage = true) {
  const output = process.env.WUI18_CAPTURE_DIR ?? "/tmp/fidelity/goals";
  mkdirSync(output, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${output}/${name}.png`, fullPage });
  if (fullPage) await page.screenshot({ path: `${output}/${name}-phone.png` });
}

test("rules and triggered alerts follow the approved order", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-31T09:41:00.000Z") });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installPlanFidelityScene(page, "goals");
  await expect(page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: /More/ })).toContainText("2", { timeout: 30_000 });
  await page.goto("/#/goals");
  await expect(page.getByTestId("goals-summary")).toContainText("6 of 7", { timeout: 15_000 });
  const main = page.locator("#app-main-content");
  await expect(main).toBeFocused();
  expect(await main.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("none");
  expect((await page.locator(".pf-rules-list").boundingBox())!.height).toBe(1234);
  expect((await page.locator(".pf-history").boundingBox())!.height).toBe(749);
  await expect(page.locator(".pf-head p")).toHaveCSS("font-variant-numeric", "tabular-nums");
  await expect(page.locator(".pf-rules-list .pf-card-head small")).toHaveCSS("font-variant-numeric", "tabular-nums");
  await expect(page.getByRole("button", { name: "Rules options" })).toBeVisible();
  const rulesHeading = (await page.locator(".pf-rules-list h2").boundingBox())!;
  const rulesAction = (await page.getByRole("button", { name: "Rules options" }).boundingBox())!;
  expect(rulesAction.x).toBe(rulesHeading.x);
  await expect(page.getByRole("button", { name: "Rule kinds" })).toBeHidden();
  await capture(page, "goals");
  const pillWidths = await page.locator(".pf-goals").evaluate((root) => {
    const width = (selector: string) => root.querySelector(selector)!.getBoundingClientRect().width;
    return [width(".pf-head .pf-add"), width(".pf-history-actions button"),
      width(".pf-history-actions button:last-child"), width(".pf-alert-action button")];
  });
  expect(pillWidths).toEqual([105, 120, 55, 102]);
  const cards = await page.locator(".pf-goals > .pf-card").evaluateAll((nodes) =>
    nodes.map((node) => {
      const bounds = node.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
        background: getComputedStyle(node).backgroundColor };
    }));
  expect(cards[0]).toEqual({ x: 16, y: 140, width: 358, height: 204, background: "rgb(19, 18, 23)" });
  expect(cards[1]).toMatchObject({ x: 16, y: 356, width: 358, height: 1234 });
  expect(cards[2]).toMatchObject({ x: 16, y: 1602, width: 358, height: 749 });
  await expect(page.locator("#app-top-bar .mobile-header-back")).toBeHidden();
  await expect(page.locator(".pf-history-actions button").first()).toHaveCSS("font-weight", "500");
  await expect(page.locator(".pf-history-actions button").last()).toHaveCSS("font-weight", "500");
  await expect(page.locator(".pf-alert-action button").first()).toHaveCSS("font-weight", "500");
  await expect(page.locator(".pf-history-actions button").first()).toHaveCSS("color", "rgb(155, 157, 163)");
  await expect(page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "Overview" }))
    .toHaveCSS("font-weight", "500");
  const tabCenters = await page.locator(".mobile-tab-bar .mobile-tab").evaluateAll((tabs) =>
    tabs.map((tab) => {
      const box = tab.getBoundingClientRect();
      return Math.round(box.x + box.width / 2);
    }));
  expect(tabCenters).toEqual([49, 146, 244, 341]);
  await expect(page.locator(".mobile-tab-bar")).toHaveCSS("padding-top", "2px");
  const moreBadge = await page.locator(".mobile-tab-bar .mobile-tab-badge").evaluate((node) => {
    const bounds = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return { x: Math.round(bounds.x), y: Math.round(bounds.y), width: bounds.width, height: bounds.height,
      color: style.color, background: style.backgroundColor, fontSize: style.fontSize, padding: style.padding };
  });
  expect(moreBadge).toEqual({ x: 347, y: 791, width: 17, height: 16, color: "rgb(26, 5, 9)",
    background: "rgb(238, 106, 130)", fontSize: "10px", padding: "0px 5px" });
  await expect(page.getByRole("heading", { name: "Triggered" })).toBeVisible();
  await expect(page.getByText("SOL 7d move", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".pf-alert-row").nth(0)).toContainText("+14.3% over 7 days: $147.27 to $168.40");
  await expect(page.locator(".pf-alert-row").nth(1)).toContainText("BTC 26.9% vs target 30.0%: −3.1 pts (limit 2.0)");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await skip.focus();
  await skip.press("Enter");
  await expect(main).toBeFocused();
  expect(await main.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
});

test("empty rules show both designed empty panels", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-31T09:41:00.000Z") });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installPlanFidelityScene(page, "goals-empty");
  await page.goto("/#/goals");
  await expect(page.getByRole("heading", { name: "Create your first rule" })).toBeVisible({ timeout: 15_000 });
  await capture(page, "goals-empty");
  expect(await page.locator(".pf-empty .pf-add").evaluate((node) => node.getBoundingClientRect().width)).toBe(107);
  const summaryValues = page.getByTestId("goals-summary").locator(".pf-kpi strong");
  await expect(summaryValues.nth(0)).toHaveCSS("color", "rgb(155, 157, 163)");
  await expect(summaryValues.nth(3)).toHaveCSS("color", "rgb(155, 157, 163)");
  await expect(page.getByText("Alerts appear here after a refresh triggers a rule.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Acknowledge all" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Clear" })).toBeDisabled();
});

test("More tab returns from Goals after its Back control is removed", async ({ page }) => {
  await installPlanFidelityScene(page, "goals-empty");
  await page.goto("/#/goals");
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: /More/ }).click();
  await expect(page).toHaveURL(/#\/more$/);
});

test("older alert dates follow the selected phone language", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-31T09:41:00.000Z") });
  await page.addInitScript(() => {
    localStorage.setItem("track3-ui-theme", "dark");
    localStorage.setItem("track3-ui-locale", "zh");
  });
  await installPlanFidelityScene(page, "goals");
  await page.goto("/#/goals");
  await expect(page.getByTestId("goals-phone")).toContainText("10月27日", { timeout: 15_000 });
  await expect(page.getByTestId("goals-phone")).toContainText("在 7 天内上涨超过 10%");
  await expect(page.getByTestId("goals-summary")).toContainText("7 条中开启 6 条");
  await expect(page.locator(".pf-goals .pf-head p")).toHaveText("2 条未读 · 7 条规则中开启 6 条。进度按最近一次刷新计算。");
  await expect(page.locator(".pf-history-list")).not.toContainText("price moved");
  await expect(page.locator(".pf-history-list")).not.toContainText("pts");
  await expect(page.locator(".pf-history-list")).toContainText("+14.3%");
  const tabCenters = await page.locator(".mobile-tab-bar .mobile-tab").evaluateAll((tabs) =>
    tabs.map((tab) => {
      const box = tab.getBoundingClientRect();
      return Math.round(box.x + box.width / 2);
    }));
  expect(tabCenters).toEqual([49, 146, 244, 341]);
  await capture(page, "goals-zh");
});

test("phone owners can reach notification permission, AI setup, and the goal chart", async ({ page }) => {
  await installPlanFidelityScene(page, "goals");
  await page.goto("/#/goals");
  await page.getByRole("button", { name: "Rules options" }).click();
  await page.getByRole("button", { name: "Advanced setup" }).click();
  const advanced = page.getByRole("dialog", { name: "Advanced setup" });
  await expect(advanced.getByText("Let the assistant set this up")).toBeVisible();
  await expect(advanced.getByText("Allow system notifications", { exact: false })).toBeVisible();
  await expect(advanced.locator("canvas").first()).toBeVisible();
  await advanced.getByRole("button", { name: "Enable notifications" }).click();
  await expect(advanced.getByRole("status")).toContainText(/notifications|Alerts/i);
});

test("light theme keeps rules and the editor readable", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-31T09:41:00.000Z") });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await installPlanFidelityScene(page, "goals");
  await page.goto("/#/goals");
  await expect(page.getByTestId("goals-summary")).toContainText("6 of 7", { timeout: 15_000 });
  const textColor = (selector: string) => page.locator(selector).first().evaluate((element) =>
    Number(getComputedStyle(element).color.match(/\d+/)?.[0] ?? 255));
  expect(await textColor(".pf-goals h1")).toBeLessThan(80);
  expect(await textColor(".pf-goal-name b")).toBeLessThan(80);
  expect(await textColor(".mobile-tab[aria-current='page']")).toBeLessThan(80);
  const tabContrast = await page.locator(".mobile-tab").first().evaluate((tab) => {
    const rgb = (color: string) => (color.match(/\d+/g) ?? []).slice(0, 3).map(Number);
    const lum = (values: number[]) => values.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const ink = lum(rgb(getComputedStyle(tab).color));
    const bar = lum(rgb(getComputedStyle(tab.closest(".mobile-tab-bar")!).backgroundColor));
    return (Math.max(ink, bar) + 0.05) / (Math.min(ink, bar) + 0.05);
  });
  expect(tabContrast).toBeGreaterThanOrEqual(4.5);
  await capture(page, "goals-light");
  await page.getByRole("button", { name: "Edit SOL 7d move" }).click();
  expect(await textColor(".pf-editor-field")).toBeLessThan(80);
  await capture(page, "goals-edit-light", false);
});

test("rule kinds explain all seven stored rule types", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-31T09:41:00.000Z") });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installPlanFidelityScene(page, "goals-empty");
  await page.goto("/#/goals");
  await page.getByRole("button", { name: "Rules options" }).click();
  await page.getByRole("button", { name: "Rule kinds" }).click();
  await expect(page.getByRole("heading", { name: "Rule kinds" })).toBeVisible();
  await capture(page, "goals-kinds");
});

test("falling move thresholds round trip through the phone editor as negative values", async ({ page }) => {
  await installPlanFidelityScene(page, "goals-empty");
  await page.goto("/#/goals");
  await page.getByRole("button", { name: "Add rule" }).first().click();
  const editor = page.getByRole("dialog", { name: "Add rule" });
  await editor.getByRole("combobox", { name: "Kind" }).selectOption("asset_price_move");
  await editor.getByRole("combobox", { name: "Asset" }).selectOption("crypto:BTC");
  await editor.getByRole("combobox", { name: "Comparator" }).selectOption("lte");
  await editor.getByRole("spinbutton", { name: "Threshold" }).fill("10");
  await editor.getByRole("button", { name: "Add rule" }).click();
  await expect(page.getByText("Falls more than 10% in 7 days")).toBeVisible();
  const stored = () => page.evaluate(() => (window as any).__e2eInvoke("plugin:sql|select", {
    query: "SELECT comparator, threshold FROM alert_rules WHERE kind='asset_price_move' ORDER BY id DESC LIMIT 1",
    values: [],
  }));
  expect(await stored()).toMatchObject([{ comparator: "lte", threshold: -10 }]);
  await page.getByRole("button", { name: "Edit BTC 7d move" }).click();
  await expect(page.getByRole("dialog", { name: "Edit rule" }).getByRole("spinbutton", { name: "Threshold" })).toHaveValue("10");
  await page.getByRole("dialog", { name: "Edit rule" }).getByRole("button", { name: "Save changes" }).click();
  expect(await stored()).toMatchObject([{ comparator: "lte", threshold: -10 }]);
});

test("confirmed deletion from a rule row removes only that stored rule", async ({ page }) => {
  await installPlanFidelityScene(page, "goals");
  await page.goto("/#/goals");
  await expect(page.getByTestId("goals-summary")).toContainText("6 of 7");
  await page.getByRole("button", { name: "Delete SOL 7d move" }).click();
  const sheet = page.getByRole("alertdialog", { name: /Delete “SOL 7d move”/ });
  await sheet.getByRole("button", { name: "Cancel" }).click();
  const stored = () => page.evaluate(() => (window as any).__e2eInvoke("plugin:sql|select", {
    query: "SELECT kind, symbol FROM alert_rules WHERE kind='asset_price_move' AND symbol='SOL'",
    values: [],
  }));
  expect(await stored()).toEqual([{ kind: "asset_price_move", symbol: "SOL" }]);
  await page.getByRole("button", { name: "Delete SOL 7d move" }).click();
  await page.getByRole("alertdialog", { name: /Delete “SOL 7d move”/ })
    .getByRole("button", { name: "Delete rule" }).click();
  await expect.poll(stored).toEqual([]);
  await expect(page.getByTestId("goals-summary")).toContainText("5 of 6");
});

test("rule edit, invalid add, and delete use approved overlays", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-31T09:41:00.000Z") });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installPlanFidelityScene(page, "goals");
  await page.goto("/#/goals");
  await expect(page.getByText("SOL 7d move", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Edit SOL 7d move" }).click();
  await capture(page, "goals-edit", false);
  await expect(page.getByRole("dialog", { name: "Edit rule" })).toBeVisible();
  expect(await page.locator(".pf-editor-delete").evaluate((node) => node.getBoundingClientRect().width)).toBe(91);
  await expect(page.locator(".pf-editor")).toHaveCSS("font-variant-numeric", "tabular-nums");
  const backLink = await page.locator(".pf-editor-head button").boundingBox();
  expect(backLink).toMatchObject({ x: 6, y: 10, height: 34 });
  expect(backLink!.width).toBeGreaterThan(150);
  expect(await page.locator(".pf-editor .pf-segment .active").evaluate((element) => {
    const button = element.getBoundingClientRect();
    const selected = getComputedStyle(element, "::before");
    return { y: button.y + Number.parseFloat(selected.top), height: Number.parseFloat(selected.height) };
  })).toEqual({ y: 425, height: 32 });
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Add rule" }).first().click();
  await page.getByRole("combobox", { name: "Kind" }).selectOption("asset_price_move");
  await page.getByRole("button", { name: "Add rule" }).last().click();
  await capture(page, "goals-edit-error", false);
  await expect(page.getByText("2 fields need attention")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Delete SOL 7d move" }).click();
  await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
  await capture(page, "goals-delete", false);
  await expect(page.locator(".pf-delete h2")).toHaveCSS("font-variant-numeric", "normal");
  await expect(page.getByRole("alertdialog", { name: /Delete “SOL 7d move”/ })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Edit SOL 7d move" }).click();
  await page.getByRole("dialog", { name: "Edit rule" }).getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete rule" }).click();
  await expect(page.locator('[role="dialog"][aria-label="Edit rule"]')).toHaveCount(0);
  await expect(page.getByText("SOL 7d move", { exact: true })).toBeHidden();
});
