import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";
import { cardPaddingMeasurements, cardRoutes, expectAiSetupGeometry } from "./card-padding-captures";

const ready: Record<(typeof cardRoutes)[number][0], string> = {
  Overview: ".t3-grid-hero .t3-hero-card",
  Summary: ".fidelity-summary-pnl",
  Wallets: ".wallet-source-change-card",
  Comparison: ".comparison-assets-card",
  "Cost basis": ".fidelity-cost-holding",
  History: ".fidelity-history-list",
  Rebalance: '[data-testid="rebalance-summary"]',
  Goals: ".t3-goals-rules",
  Assistant: '[data-testid="chat-card"]',
  "Settings appearance": ".t3-settings-content [data-ui-card]",
  "Settings currency": ".t3-settings-content",
  "Settings data": ".t3-settings-content",
  "Settings system": ".t3-settings-content",
  "Settings AI": ".t3-settings-content",
  "Settings sync": ".t3-settings-content",
  "Coin detail": ".coin-fidelity-chart",
};

for (const theme of ["light", "dark"] as const) {
  test(`desktop card padding across pages in ${theme}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
    await installTauriBridge(page, { richPortfolio: true, seedRebalanceProfile: true });
    const problems: string[] = [];
    async function record(label: string) {
      const measurements = await cardPaddingMeasurements(page);
      expect(measurements.length, `${label} should measure at least one card`).toBeGreaterThan(0);
      if (process.env.CARD_PADDING_REPORT) console.log(`desktop ${theme} ${label}: ${JSON.stringify(measurements)}`);
      for (const problem of measurements.filter(({ edges, flush }) =>
        !flush && (Object.values(edges).some((value) => value < 12) || Math.abs(edges.top - edges.left) > 6))) {
        problems.push(`${label}: ${JSON.stringify(problem)}`);
      }
    }
    for (const [name, route] of cardRoutes) {
      await page.goto(`/#${route}`);
      await page.reload();
      await expect(page.locator("#app-main-content"), name).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("#app-main-content h1,#app-main-content h2,#app-main-content h3").first(), name).toBeAttached({ timeout: 30_000 });
      await expect(page.locator("#app-main-content [aria-busy='true']"), name).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator(ready[name]).first(), name).toBeVisible({ timeout: 30_000 });
      if (name === "Overview") {
        const titleInset = await page.locator(".t3-total-overview .t3-hero-header h3").evaluate((title) => {
          const card = title.closest(".t3-hero-card")!.getBoundingClientRect();
          const heading = title.getBoundingClientRect();
          return { top: heading.top - card.top, left: heading.left - card.left };
        });
        expect(titleInset.top).toBeGreaterThanOrEqual(12);
        expect(Math.abs(titleInset.top - titleInset.left)).toBeLessThanOrEqual(6);
      }
      if (process.env.CARD_PADDING_CAPTURE && theme === "dark" && name === "Overview") {
        await page.locator(".t3-hero-card").first()
          .screenshot({ path: `/tmp/card-padding-${process.env.CARD_PADDING_CAPTURE}-desktop-Overview-hero.png` });
        await page.locator(".t3-insights-card").first()
          .screenshot({ path: `/tmp/card-padding-${process.env.CARD_PADDING_CAPTURE}-desktop-Overview-insights.png` });
      }
      if (process.env.CARD_PADDING_CAPTURE && theme === "dark" && name === "Assistant") {
        await page.locator('[data-testid="chat-card"]')
          .screenshot({ path: `/tmp/card-padding-${process.env.CARD_PADDING_CAPTURE}-desktop-Assistant-chat.png` });
      }
      if (process.env.CARD_PADDING_CAPTURE && theme === "dark" && ["Summary", "Goals", "Settings appearance"].includes(name)) {
        await page.locator("[data-ui-card], .fidelity-card, .t3-fidelity-card").first()
          .screenshot({ path: `/tmp/card-padding-${process.env.CARD_PADDING_CAPTURE}-desktop-${name}.png` });
      }
      if (process.env.CARD_PADDING_CAPTURE && theme === "dark" && name === "Rebalance") {
        await page.locator("[data-ai-setup-card]")
          .screenshot({ path: `/tmp/card-padding-${process.env.CARD_PADDING_CAPTURE}-desktop-AI-setup.png` });
      }
      await record(name);
      if (name === "Cost basis") {
        await page.getByRole("button", { name: "Records controls" }).click();
        await expectAiSetupGeometry(page);
        await record("Cost basis controls");
      }
      if (name === "Comparison") {
        await page.getByRole("button", { name: /Base Date|Snapshot A/ }).first().click();
        await expect(page.getByRole("dialog").last()).toBeVisible();
        await record("Comparison picker");
        expect((await cardPaddingMeasurements(page)).some(({ card }) => card === "date picker popover")).toBe(true);
      }
      if (name === "History") {
        await page.getByTestId("history-snapshot-row").first().click();
        await expect(page.getByTestId("history-desktop-detail")).toBeVisible();
        await record("History detail");
      }
      if (name === "Goals") {
        await expectAiSetupGeometry(page);
        await page.getByRole("button", { name: "New rule" }).first().click();
        await expect(page.getByRole("button", { name: "Save rule" })).toBeVisible();
        await record("Goals editor");
      }
    }
    expect(problems).toEqual([]);
    await page.goto("/#/rebalance");
    await expectAiSetupGeometry(page);
  });
}

test("AI setup layout applies outside the main content", async ({ page }) => {
  await page.goto("/");
  const layout = await page.evaluate(() => {
    const card = document.createElement("div");
    card.setAttribute("data-ai-setup-card", "");
    card.innerHTML = '<div class="ai-setup-content"><div class="ai-setup-header"></div><form class="ai-setup-form"></form></div>';
    document.body.append(card);
    const content = card.firstElementChild!;
    const result = {
      padding: getComputedStyle(content).paddingLeft,
      layout: getComputedStyle(content).display,
      gap: getComputedStyle(content).gap,
    };
    card.remove();
    return result;
  });
  expect(layout).toEqual({ padding: "20px", layout: "flex", gap: "12px" });
});

test("assistant chat title clears its divider", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/assistant");
  const header = page.locator('[data-testid="chat-card"] > div:first-child');
  await expect(header).toBeVisible();
  const bottomInset = await header.evaluate((element) =>
    element.getBoundingClientRect().bottom - element.firstElementChild!.lastElementChild!.getBoundingClientRect().bottom);
  expect(bottomInset).toBeGreaterThanOrEqual(12);
});

test("wide dark Goals drawer padding", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/goals");
  await expect(page.locator(".t3-fidelity-goals")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Add rule" }).first().click();
  await expect(page.locator(".t3-goals-drawer")).toBeVisible();
  const drawer = (await cardPaddingMeasurements(page)).find(({ card }) => card === "Goals drawer");
  expect(drawer).toBeDefined();
  expect(Object.values(drawer!.edges).every((value) => value >= 12)).toBe(true);
  expect(Math.abs(drawer!.edges.top - drawer!.edges.left)).toBeLessThanOrEqual(6);
});
