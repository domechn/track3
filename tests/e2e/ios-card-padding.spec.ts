import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";
import { cardPaddingMeasurements, cardRoutes, expectAiSetupGeometry } from "./card-padding-captures";

test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

const ready: Record<(typeof cardRoutes)[number][0], string> = {
  Overview: ".fd-overview-holdings",
  Summary: ".fd-profit-loss",
  Wallets: ".fd-wallet-balances",
  Comparison: ".fd-comparison-assets",
  "Cost basis": ".fidelity-cost-holding",
  History: ".fidelity-history-card",
  Rebalance: ".pf-rebalance",
  Goals: ".pf-rules-list",
  Assistant: '[data-testid="chat-card"]',
  "Settings appearance": ".fidelity-appearance-card",
  "Settings currency": ".ios-d3-settings-page",
  "Settings data": ".ios-d3-settings-page",
  "Settings system": ".ios-d3-settings-page",
  "Settings AI": ".ios-d3-settings-page",
  "Settings sync": ".ios-d3-settings-page",
  "Coin detail": ".fd-coin-trend",
};

for (const theme of ["light", "dark"] as const) {
  test(`phone card padding across pages in ${theme}`, async ({ page }) => {
    test.setTimeout(600_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
    await installTauriBridge(page, { richPortfolio: true, seedRebalanceProfile: true });
    const problems: string[] = [];
    async function record(label: string, requireCard = true) {
      const measurements = await cardPaddingMeasurements(page);
      if (requireCard) expect(measurements.length, `${label} should measure at least one card`).toBeGreaterThan(0);
      if (process.env.CARD_PADDING_REPORT) console.log(`phone ${theme} ${label}: ${JSON.stringify(measurements)}`);
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
      if (process.env.CARD_PADDING_CAPTURE && theme === "dark" && name === "Assistant") {
        await page.locator('[data-testid="chat-card"]')
          .screenshot({ path: `/tmp/card-padding-${process.env.CARD_PADDING_CAPTURE}-phone-Assistant-chat.png` });
      }
      if (name === "Rebalance") {
        await page.getByRole("button", { name: "Plan actions" }).click();
        await page.getByRole("button", { name: "Advanced setup" }).click();
        if (process.env.CARD_PADDING_CAPTURE && theme === "dark") {
          await page.locator("[data-ai-setup-card]")
            .screenshot({ path: `/tmp/card-padding-${process.env.CARD_PADDING_CAPTURE}-phone-AI-setup.png` });
        }
      }
      if (process.env.CARD_PADDING_CAPTURE && theme === "dark" && ["Summary", "Goals", "Settings appearance"].includes(name)) {
        const other = page.locator("[data-ui-card], .fidelity-card, .t3-fidelity-card, .pf-kpi, .pf-rules-list").first();
        if (await other.count()) {
          await other.screenshot({ path: `/tmp/card-padding-${process.env.CARD_PADDING_CAPTURE}-phone-${name}.png` });
        }
      }
      await record(name);
      if (name === "Cost basis") await expectAiSetupGeometry(page);
      if (name === "Comparison") {
        await page.getByRole("button", { name: /Snapshot A:/ }).first().click();
        await expect(page.locator(".fd-comparison-picker")).toBeVisible();
        await record("Comparison picker");
        expect((await cardPaddingMeasurements(page)).some(({ card }) => card.includes("fd-comparison-picker"))).toBe(true);
      }
      if (name === "History") {
        await page.getByTestId("history-mobile-row").first().click();
        await expect(page.locator(".fidelity-history-detail")).toBeVisible();
        await record("History detail", false);
      }
      if (name === "Goals") {
        await page.getByRole("button", { name: "Rules options" }).click();
        await page.getByRole("button", { name: "Advanced setup" }).click();
        await expectAiSetupGeometry(page);
        await record("Goals advanced");
        await page.locator(".pf-advanced-back").click();
        await page.getByRole("button", { name: "Add rule" }).first().click();
        await expect(page.getByRole("dialog", { name: "Add rule" })).toBeVisible();
        await record("Goals editor");
      }
    }
    expect(problems).toEqual([]);
    await page.goto("/#/rebalance");
    await page.getByRole("button", { name: "Plan actions" }).click();
    await page.getByRole("button", { name: "Advanced setup" }).click();
    await expectAiSetupGeometry(page);
  });
}

test("wrapped phone AI suggestion keeps vertical padding", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { richPortfolio: true, seedRebalanceProfile: true });
  await page.goto("/#/rebalance");
  await page.getByRole("button", { name: "Plan actions" }).click();
  await page.getByRole("button", { name: "Advanced setup" }).click();
  const wrappedChip = await page.locator("[data-ai-setup-suggestion]").first().evaluate((chip) => {
    const label = chip.querySelector(".ai-setup-chip-label")!;
    label.textContent = "这个建议会换成多行文字来验证按钮上下两侧仍然保留足够的内边距";
    (chip as HTMLElement).style.width = "100px";
    (chip as HTMLElement).style.flex = "none";
    const style = getComputedStyle(label);
    return { top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom), height: label.getBoundingClientRect().height };
  });
  expect(wrappedChip.height).toBeGreaterThan(60);
  expect(wrappedChip.top).toBeGreaterThanOrEqual(4);
  expect(wrappedChip.bottom).toBeGreaterThanOrEqual(4);
});
