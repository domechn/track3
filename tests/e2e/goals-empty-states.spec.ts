import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { installTauriBridge } from "./tauri-bridge";

test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "Desktop empty states"));

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

async function assertEmptyCard(page: Page, selector: string, minFilled = 0.4) {
  const card = page.locator(selector);
  const state = page.locator(`${selector}[data-empty-state], ${selector} [data-empty-state]`).first();
  await expect(state).toBeVisible();
  const sizes = await card.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const empty = (element.matches("[data-empty-state]") ? element : element.querySelector("[data-empty-state]"))!.getBoundingClientRect();
    return { card: box.height, empty: empty.height, filled: empty.height / box.height };
  });
  expect(sizes.card).toBeGreaterThanOrEqual(120);
  expect(sizes.empty, selector).toBeGreaterThanOrEqual(200);
  expect(sizes.filled).toBeGreaterThanOrEqual(minFilled);
}

async function assertNoBareEmptyCards(page: Page) {
  const failures = await page.locator("[data-ui-card], .fidelity-card, .t3-fidelity-card, .coin-fidelity-card, .fd-card, .pf-card, .t3-wallet-card, .t3-fidelity-source-card, .t3-fidelity-source-empty, .rounded-lg.border-dashed")
    .evaluateAll((cards) => cards.flatMap((card) => {
      const box = card.getBoundingClientRect();
      if (!box.width || !box.height) return [];
      if (card.matches(".t3-fidelity-source-card") && !card.querySelector(".t3-fidelity-source-row, [data-empty-state]"))
        return [`${card.className}: missing shared empty state`];
      if (card.matches(".t3-fidelity-source-empty") && !card.matches("[data-empty-state]") && !card.querySelector("[data-empty-state]"))
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

for (const width of [1280, 1100]) {
  for (const theme of ["dark", "light"]) {
    test(`empty Goals panels stack at ${width}px in ${theme} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installTauriBridge(page, { emptyPortfolio: true });
      await page.goto("/#/goals");
      await expect(page.getByText("Create your first rule")).toBeVisible({ timeout: 20_000 });
      await assertEmptyCard(page, ".t3-goals-rules");
      await assertEmptyCard(page, ".t3-goals-history");
      await assertEmptyCard(page, ".t3-goals-chart");
      const panels = await page.locator(".t3-goals-rules, .t3-goals-history").evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().toJSON()));
      expect(panels[1].top).toBeGreaterThanOrEqual(panels[0].bottom);
      await expect(page.getByRole("button", { name: "Acknowledge all" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Clear history" })).toBeDisabled();
      const notificationY = (await page.locator(".t3-goals-notifications").boundingBox())!.y;
      const chartY = (await page.locator(".t3-goals-chart").boundingBox())!.y;
      expect(chartY).toBeGreaterThan(notificationY);
      await mkdir("/tmp/wui18-evidence", { recursive: true });
      await page.screenshot({ path: `/tmp/wui18-evidence/goals-${width}-${theme}-empty.png`, animations: "disabled" });
    });
  }

  for (const [rules, alerts] of [[1, 0], [1, 40], [25, 40]]) {
    test(`Goals panels stay bounded with ${rules} rules and ${alerts} alerts at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await installTauriBridge(page);
      await seedGoals(page, rules, alerts);
      await page.goto("/#/goals");
      await expect(page.locator(".t3-goals-summary")).toContainText(`${rules} / ${rules}`, { timeout: 20_000 });
      await expect(page.locator(".t3-goals-rules .t3-goals-rule-row")).toHaveCount(Math.min(rules, 20));
      const panels = await page.locator(".t3-goals-rules, .t3-goals-history").evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().toJSON()));
      expect(panels[1].top).toBeGreaterThanOrEqual(panels[0].bottom);
      expect(panels[0].height).toBeLessThanOrEqual(700);
      if (rules === 1 && alerts === 40) expect(panels[0].height).toBeLessThanOrEqual(400);
      if (rules > 20) {
        await expect(page.getByRole("navigation", { name: "Rules" })).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Alert history" })).toBeVisible();
        await mkdir("/tmp/wui18-evidence", { recursive: true });
        await page.screenshot({ path: `/tmp/wui18-evidence/goals-${width}-25-rules-40-alerts.png`, animations: "disabled" });
        const scroll = await page.locator(".t3-goals-history > div:last-child").evaluate((element) => {
          element.scrollTop = 100;
          return { top: element.scrollTop, max: element.scrollHeight - element.clientHeight };
        });
        expect(scroll.max).toBeGreaterThan(0);
        expect(scroll.top).toBeGreaterThan(0);
        expect(await page.locator(".t3-goals-rules > div:last-child").evaluate((element) => element.scrollTop)).toBe(0);
        await page.getByRole("navigation", { name: "Rules" }).getByRole("button", { name: "Next" }).click();
        await expect(page.locator(".t3-goals-rules .t3-goals-rule-row")).toHaveCount(5);
      }
    });
  }
}

test("1920px Goals stacks a short alert history below its rules", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await installTauriBridge(page);
  await seedGoals(page, 5, 2);
  await page.goto("/#/goals");
  await expect(page.locator(".t3-fidelity-goal-rules .t3-fidelity-goal-row:not(.t3-fidelity-table-head)")).toHaveCount(5);
  await expect(page.locator(".t3-fidelity-triggered .t3-fidelity-history-row")).toHaveCount(2);
  const rules = (await page.locator(".t3-fidelity-goal-rules").boundingBox())!;
  const history = (await page.locator(".t3-fidelity-triggered").boundingBox())!;
  const lastAlert = (await page.locator(".t3-fidelity-history-row").last().boundingBox())!;
  const footnote = (await page.locator(".t3-fidelity-triggered .t3-fidelity-foot").boundingBox())!;
  expect(history.y).toBeGreaterThanOrEqual(rules.y + rules.height);
  expect(footnote.y - lastAlert.y - lastAlert.height).toBeLessThan(40);
  expect(history.y + history.height - footnote.y - footnote.height).toBeLessThan(24);
});

test.describe("coarse pointer empty Goals panels", () => {
  test.use({ isMobile: true, hasTouch: true });

  test("fits without an inner scroll at 360px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 390 });
    await installTauriBridge(page, { emptyPortfolio: true });
    await page.goto("/#/goals");
    for (const selector of [".t3-goals-rules", ".t3-goals-history"]) {
      const panel = page.locator(selector);
      await expect(panel.locator("[data-empty-state]")).toBeVisible();
      const overflow = await panel.locator(":scope > div:last-child").evaluate((content) => ({
        horizontal: content.scrollWidth - content.clientWidth,
        vertical: content.scrollHeight - content.clientHeight,
      }));
      expect(overflow, selector).toEqual({ horizontal: 0, vertical: 0 });
    }
  });
});

test("empty desktop pages have no bare or mostly blank cards", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriBridge(page, { emptyPortfolio: true });
  for (const [route, ready] of [
    ["/#/wallets", "main [data-empty-state]"],
    ["/#/history", ".fidelity-history-empty [data-empty-state]"],
    ["/#/cost-basis", ".fidelity-cost-averages [data-empty-state]"],
    ["/#/rebalance", ".t3-manage-rebalance [data-empty-state]"],
    ["/#/goals", ".t3-goals-rules [data-empty-state]"],
    ["/#/settings/configuration?section=sources", ".t3-settings-source-tabs ~ [data-ui-card] [data-empty-state]"],
  ]) {
    await page.goto(route);
    await expect(page.locator(ready)).toBeVisible({ timeout: 20_000 });
    await assertNoBareEmptyCards(page);
  }
  const tabs = page.getByRole("group", { name: "Data sources" });
  for (const name of ["Wallets 0", "Brokers 0", "Custom assets 0"]) {
    await tabs.getByRole("button", { name }).click();
    await assertNoBareEmptyCards(page);
  }
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(page.locator(".t3-fidelity-source-card")).toBeVisible();
  for (const tab of await page.locator(".t3-fidelity-source-tabs button").all()) {
    await tab.click();
    await assertNoBareEmptyCards(page);
  }
});

test("an empty standard Rebalance plan has a full empty state", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriBridge(page, { emptyPortfolio: true });
  await page.goto("/#/rebalance");
  await expect(page.getByRole("heading", { name: "Set targets to see suggestions." })).toBeVisible();
  await assertEmptyCard(page, ".t3-manage-rebalance > [data-empty-state]", 0);
});

test("wide Goals keeps one rule compact beside long alert history", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installTauriBridge(page);
  await seedGoals(page, 1, 40);
  await page.goto("/#/goals");
  await expect(page.locator(".t3-fidelity-goal-row:not(.t3-fidelity-table-head)")).toHaveCount(1);
  const panels = await page.locator(".t3-fidelity-goal-rules, .t3-fidelity-triggered")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(Math.abs(panels[0] - panels[1])).toBeLessThanOrEqual(1);
  expect(panels[0]).toBeLessThanOrEqual(400);
  const history = await page.locator(".t3-fidelity-history-list").evaluate((element) =>
    element.scrollHeight - element.clientHeight);
  expect(history).toBeGreaterThan(0);
});

test("the desktop rule column header stays visible while rules scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await installTauriBridge(page);
  await seedGoals(page, 25, 0);
  await page.goto("/#/goals");
  const list = page.locator(".t3-fidelity-rule-list");
  await expect(list.locator(".t3-fidelity-goal-row:not(.t3-fidelity-table-head)")).toHaveCount(20);
  const scroll = await list.evaluate((element) => {
    element.scrollTop = 120;
    return element.scrollTop;
  });
  expect(scroll).toBeGreaterThan(0);
  const headerOffset = await list.evaluate((element) =>
    element.querySelector(".t3-fidelity-table-head")!.getBoundingClientRect().top
      - element.getBoundingClientRect().top);
  expect(Math.abs(headerOffset)).toBeLessThanOrEqual(0.5);
});

test("a coin with no transactions has substantial lots and transaction states", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await installTauriBridge(page);
  await page.goto("/#/coins/BTC");
  await expect(page.getByRole("heading", { name: "No open lots yet" })).toBeVisible();
  await expect(page.locator(".coin-fidelity-sources table")).toContainText("$42,000.00");
  const heights = await page.locator(".coin-fidelity-lots [data-empty-state]")
    .evaluateAll((states) => states.map((state) => state.getBoundingClientRect().height).filter(Boolean));
  expect(heights).toHaveLength(1);
  for (const height of heights) expect(height, "coin lots").toBeGreaterThanOrEqual(200);
  await assertEmptyCard(page, ".coin-fidelity-transactions");
});

test("cost basis empty panels stack at 1100px", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await installTauriBridge(page, { emptyPortfolio: true });
  await page.goto("/#/cost-basis");
  await expect(page.getByTestId("cost-desktop-table")).toBeVisible();
  await expect(page.locator(".fidelity-cost-averages [data-empty-state]")).toBeVisible();
  const panels = await page.locator(".fidelity-cost-chart, .fidelity-cost-averages")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
  expect(panels[1].top).toBeGreaterThanOrEqual(panels[0].bottom);
});
