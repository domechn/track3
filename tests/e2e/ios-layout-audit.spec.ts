import { expect, test } from "@playwright/test";
import { seedLayoutFixture } from "./layout-audit-scenes";
import { iPhone, registerLayoutAudit } from "./layout-audit-captures";
import { assertNoOverflow } from "./layout-audit";

test("phone wallet sections page independently and use allocation colors on later pages", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: iPhone });
  const page = await context.newPage();
  try {
    await seedLayoutFixture(page, "real");
    await page.goto("/#/wallets", { waitUntil: "commit" });
    await expect(page.locator(".fd-wallets")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
    const chips = page.locator(".fd-wallet-chips button");
    const legend = page.locator(".fd-wallet-legend span");
    const balances = page.locator(".fd-wallet-balances .fd-wallet-balance");
    const statuses = page.locator(".fd-wallet-status .fd-wallet-status-row");
    await expect(balances).toHaveCount(8);
    const first = await Promise.all([chips.nth(1), legend.first(), balances.first(), statuses.first()]
      .map((node) => node.textContent()));
    await page.locator(".fd-wallet-balances [data-layout-pager]").getByRole("button", { name: "Next" }).click();
    await expect(balances).toHaveCount(8);
    expect(await balances.first().textContent()).not.toBe(first[2]);
    expect(await Promise.all([chips.nth(1), legend.first(), statuses.first()]
      .map((node) => node.textContent()))).toEqual([first[0], first[1], first[3]]);
    await page.locator(".fd-wallet-allocation [data-layout-pager]").getByRole("button", { name: "Next" }).click();
    const othersColor = await page.locator(".fd-wallet-split i").last().evaluate((node) => getComputedStyle(node).backgroundColor);
    const nextLegendColor = await legend.first().locator("i").evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(nextLegendColor).toBe(othersColor);
  } finally {
    await context.close();
  }
});

test("phone source count uses a singular custom asset label", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: iPhone });
  const page = await context.newPage();
  try {
    await seedLayoutFixture(page, "real");
    await page.goto("/#/settings/configuration?section=sources", { waitUntil: "commit" });
    await expect(page.locator(".fidelity-settings-source-summary")).toContainText("1 custom asset.");
  } finally {
    await context.close();
  }
});

test("320px Summary keeps a seven digit CNY unrecorded amount inside its month card", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 844 }, userAgent: iPhone });
  const page = await context.newPage();
  try {
    await seedLayoutFixture(page, "small");
    await page.evaluate(async () => {
      const execute = (query: string) =>
        (window as typeof window & { __e2eInvoke: (command: string, arguments_: unknown) => Promise<unknown> })
          .__e2eInvoke("plugin:sql|execute", { query, values: [] });
      await execute("INSERT OR REPLACE INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('CNY', 'Chinese yuan', '¥', 7.124, 1, '2026-10-31T09:41:00.000Z')");
      await execute("INSERT OR REPLACE INTO configuration (id, data) VALUES (7, 'CNY')");
    });
    await page.goto("/#/summary", { waitUntil: "commit" });
    await expect(page.locator(".fd-summary")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
    const amount = page.locator(".fd-month-unrecorded").first();
    await expect(amount).toBeVisible();
    await expect(amount).toContainText("¥");
    expect((await assertNoOverflow(page)).filter((issue) =>
      issue.rule === "R7" && issue.message.includes("Unrecorded changes"))).toEqual([]);
    const [text, card] = await Promise.all([amount.boundingBox(), amount.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' fd-month ')][1]").boundingBox()]);
    expect(text!.x).toBeGreaterThanOrEqual(card!.x + 8);
    expect(text!.x + text!.width).toBeLessThanOrEqual(card!.x + card!.width - 8);
  } finally {
    await context.close();
  }
});


registerLayoutAudit("mobile");
