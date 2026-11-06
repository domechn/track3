import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { installTauriBridge } from "./tauri-bridge";
import { installPlanFidelityScene } from "./plan-fidelity-scenes";

test.beforeEach(({}, info) => test.skip(info.project.name !== "mobile", "Phone empty states"));
test.use({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  isMobile: false, hasTouch: true, reducedMotion: "reduce",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

async function seedGoals(page: Page, rules: number, alerts: number) {
  const execute = (query: string) => page.evaluate((sql) =>
    (window as typeof window & { __e2eInvoke: (cmd: string, args: unknown) => Promise<unknown> })
      .__e2eInvoke("plugin:sql|execute", { query: sql, values: [] }), query);
  if (rules) await execute(`WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<${rules})
    INSERT INTO alert_rules (kind, asset_type, symbol, comparator, threshold, window, enabled, cooldown_seconds, armed)
    SELECT 'total_value_target', NULL, NULL, 'gte', 1000*i, NULL, 1, 3600, 1 FROM n`);
  if (alerts) await execute(`WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<${alerts})
    INSERT INTO alert_history (rule_id, kind, title, message, value, triggered_at, acknowledged_at)
    SELECT ((i-1)%${rules})+1, 'total_value_target', 'Target', 'Reached', 1000,
      '2026-11-01T00:00:00.000Z', NULL FROM n`);
}

async function assertNoBareEmptyCards(page: Page) {
  const failures = await page.locator("[data-ui-card], .fidelity-card, .t3-fidelity-card, .coin-fidelity-card, .fd-card, .pf-card, .fidelity-cost-card, .fidelity-source-empty, .ios-d3-source-group > p, .ios-d3-others > p")
    .evaluateAll((cards) => cards.flatMap((card) => {
      const box = card.getBoundingClientRect();
      if (!box.width || !box.height) return [];
      if (card.matches(".fidelity-source-empty") && !card.querySelector("[data-empty-state]"))
        return [`${card.className}: missing shared empty state`];
      if (card.querySelector("[data-empty-state], tbody tr, li, [class$='-row'], [class$='-balance'], [class$='-mover']") || card.matches("[data-empty-state]")) return [];
      const contents = [...card.querySelectorAll("h1, h2, h3, h4, p, td, th, button, input, select, strong, small, b, span")]
        .filter((element) => element.getBoundingClientRect().height > 0 && element.textContent?.trim());
      const headingOnly = !!card.textContent?.trim() && !card.querySelector("button, input, table") &&
        contents.length > 0 && contents.every((element) => element.closest("h1, h2, h3, h4"));
      const lastContent = Math.max(...contents.map((element) => element.getBoundingClientRect().bottom), box.top);
      const mostlyBlank = box.height >= 120 && (lastContent - box.top) / box.height < 0.4;
      return box.height < 120 && headingOnly || mostlyBlank
        ? [`${card.className}: ${Math.round(box.height)}px, content ${Math.round(lastContent - box.top)}px`] : [];
    }));
  expect(failures).toEqual([]);
}

for (const theme of ["dark", "light"]) {
  test(`phone empty Goals panels are substantial in ${theme} mode`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await installPlanFidelityScene(page, "goals-empty");
    await page.goto("/#/goals");
    await expect(page.getByText("Create your first rule")).toBeVisible({ timeout: 20_000 });
    if (theme === "light") {
      const titleColor = await page.getByRole("heading", { name: "Create your first rule" })
        .evaluate((element) => getComputedStyle(element).color);
      expect(titleColor).not.toBe("rgb(255, 255, 255)");
    }
    for (const selector of [".pf-rules-list", ".pf-history"]) {
      const card = page.locator(selector);
      await expect(card.locator("[data-empty-state]")).toBeVisible();
      expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(120);
    }
    const chipHeights = await page.locator(".pf-rules-list .t3-empty-state-chips button")
      .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
    expect(chipHeights).toHaveLength(4);
    for (const height of chipHeights) expect(height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("button", { name: "Acknowledge all" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Clear" })).toBeDisabled();
    await mkdir("/tmp/wui18-evidence", { recursive: true });
    await page.screenshot({ path: `/tmp/wui18-evidence/goals-phone-${theme}-empty.png`, fullPage: true, animations: "disabled" });
    await page.locator(".pf-history").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/wui18-evidence/goals-phone-${theme}-history.png`, animations: "disabled" });
  });
}

test("iPad legacy Goals empty rules keep a 220px minimum", async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1112 });
  await installTauriBridge(page, { emptyPortfolio: true });
  await page.goto("/#/goals");
  const empty = page.locator(".t3-goals-rules [data-empty-state]");
  await expect(empty).toBeVisible({ timeout: 20_000 });
  expect(await empty.evaluate((element) => getComputedStyle(element).minHeight)).toBe("220px");
});

for (const [rules, alerts] of [[1, 0], [20, 0], [25, 40]]) {
  test(`phone Goals with ${rules} rules and ${alerts} alerts stays usable`, async ({ page }) => {
    await installPlanFidelityScene(page, "goals-empty");
    await seedGoals(page, rules, alerts);
    await page.goto("/#/goals");
    await expect(page.getByTestId("goals-summary")).toContainText(`${rules} of ${rules}`, { timeout: 20_000 });
    await expect(page.locator(".pf-goal-row")).toHaveCount(Math.min(20, rules));
    if (rules >= 20) {
      const rulesCard = page.locator(".pf-rules-list");
      const alertsCard = page.locator(".pf-history");
      expect((await rulesCard.boundingBox())!.height).toBeLessThanOrEqual(844 * 0.7 + 1);
      if (alerts) expect((await alertsCard.boundingBox())!.height).toBeLessThanOrEqual(844 * 0.7 + 1);
    }
    if (rules > 20) {
      const rulesCard = page.locator(".pf-rules-list");
      await mkdir("/tmp/wui18-evidence", { recursive: true });
      await page.screenshot({ path: "/tmp/wui18-evidence/goals-phone-25-rules-40-alerts.png", animations: "disabled" });
      const historyScroll = await page.locator(".pf-history").evaluate((element) => {
        element.scrollTop = 100;
        return { top: element.scrollTop, max: element.scrollHeight - element.clientHeight };
      });
      expect(historyScroll.max).toBeGreaterThan(0);
      expect(historyScroll.top).toBeGreaterThan(0);
      expect(await rulesCard.evaluate((element) => element.scrollTop)).toBe(0);
      await rulesCard.getByRole("navigation", { name: "Rules" }).getByRole("button", { name: "Next" }).click();
      await expect(page.locator(".pf-goal-row")).toHaveCount(5);
    }
  });
}

test("empty phone pages have no bare or mostly blank cards", async ({ page }) => {
  await installTauriBridge(page, { emptyPortfolio: true });
  for (const [route, ready] of [
    ["/#/wallets", "main [data-empty-state]"],
    ["/#/history", ".fidelity-history-empty[data-empty-state]"],
    ["/#/cost-basis", ".fidelity-cost-lots [data-empty-state]"],
    ["/#/rebalance", ".pf-trades .pf-empty"],
    ["/#/goals", ".pf-rules-list [data-empty-state]"],
    ["/#/settings/configuration?section=sources", ".fidelity-source-empty [data-empty-state]"],
  ]) {
    await page.goto(route);
    await expect(page.locator(ready)).toBeVisible({ timeout: 20_000 });
    await assertNoBareEmptyCards(page);
  }
  const tabs = page.getByRole("tablist", { name: "Data sources" });
  for (const name of ["Wallets", "Brokers", "Custom assets"]) {
    await tabs.getByRole("tab", { name }).click();
    await assertNoBareEmptyCards(page);
  }
});

test("a phone coin with no transactions shows lots and transaction empty states", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/coins/BTC");
  for (const selector of [".fd-open-lots", ".fd-coin-transactions"]) {
    const card = page.locator(selector);
    await expect(card.locator("[data-empty-state]")).toBeVisible();
    expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(120);
  }
});

test("light phone Data sources hints stay readable in every empty tab", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await installTauriBridge(page, { emptyPortfolio: true });
  await page.goto("/#/settings/configuration?section=sources");
  const tabs = page.getByRole("tablist", { name: "Data sources" });
  for (const name of ["Exchanges", "Wallets", "Brokers", "Custom assets"]) {
    await tabs.getByRole("tab", { name }).click();
    const hint = page.locator("main [data-empty-state] p");
    await expect(hint).toBeVisible();
    await expect(hint).toHaveCSS("color", "rgb(180, 182, 188)");
  }
});
