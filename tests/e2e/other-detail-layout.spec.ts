import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./fidelity-bridge-captures";
import { installTauriBridge as installWalletBridge } from "./fidelity-scenes";
import { installPlanFidelityScene } from "./plan-fidelity-scenes";

test("a short History detail card ends after its content", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await installTauriBridge(page, { fidelityRecords: "history-single" });
  await page.goto("/#/history");
  const detail = page.getByTestId("history-desktop-detail");
  await expect(detail).toBeVisible();
  await expect.poll(() => detail.evaluate((card) => {
    const last = card.lastElementChild;
    return last ? card.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom : 0;
  })).toBeLessThan(120);
});

test("Cost basis side cards end after their content", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await installTauriBridge(page, { fidelityRecords: "cost" });
  await page.goto("/#/cost-basis");
  await expect(page.locator(".fidelity-cost-grid")).toBeVisible();
  for (const selector of [".fidelity-cost-chart", ".fidelity-cost-averages"]) {
    const card = page.locator(selector).first();
    await expect(card).toBeVisible();
    const gap = await card.evaluate((element) => element.getBoundingClientRect().bottom -
      (element.lastElementChild?.getBoundingClientRect().bottom ?? element.getBoundingClientRect().bottom));
    expect(gap, selector).toBeLessThan(120);
  }
});

test("Cost basis cards keep their height with one holding", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await installTauriBridge(page, { fidelityRecords: "cost" });
  await page.evaluate(() => (window as any).__e2eInvoke("plugin:sql|execute", {
    query: "DELETE FROM assets_v2 WHERE symbol <> 'BTC'", values: [],
  }));
  await page.goto("/#/cost-basis");
  for (const selector of [".fidelity-cost-chart", ".fidelity-cost-averages"]) {
    const card = page.locator(selector).first();
    await expect(card).toBeVisible();
    const gap = await card.evaluate((element) => element.getBoundingClientRect().bottom -
      (element.lastElementChild?.getBoundingClientRect().bottom ?? element.getBoundingClientRect().bottom));
    expect(gap, selector).toBeLessThan(120);
  }
});

test("Wallet detail cards end after their content", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await installWalletBridge(page, { fidelitySample: "BTC" });
  await page.goto("/#/wallets");
  const grid = page.locator(".t3-wallet-grid");
  await expect(grid).toBeVisible();
  for (const selector of [".t3-wallet-balances", ".t3-wallet-side", ".t3-wallet-moved"]) {
    const card = grid.locator(selector).first();
    if (!await card.isVisible()) continue;
    const gap = await card.evaluate((element) => element.getBoundingClientRect().bottom -
      (element.lastElementChild?.getBoundingClientRect().bottom ?? element.getBoundingClientRect().bottom));
    expect(gap, selector).toBeLessThan(120);
  }
});

test("a source with one asset keeps a content-height balance table", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await installWalletBridge(page, { fidelitySample: "BTC" });
  await page.goto("/#/wallets");
  await page.locator(".t3-wallet-chips").getByRole("button", { name: /Ledger cold wallet/ }).click();
  const card = page.locator(".t3-wallet-balances");
  await expect(card.locator("tbody tr")).toHaveCount(1);
  const geometry = await card.evaluate((element) => {
    const row = element.querySelector("tbody tr")!.getBoundingClientRect();
    const footer = element.querySelector("tfoot")!.getBoundingClientRect();
    return { rowHeight: row.height, bottomGap: element.getBoundingClientRect().bottom - footer.bottom };
  });
  expect(geometry.rowHeight).toBeLessThan(80);
  expect(geometry.bottomGap).toBeLessThan(120);
  const mover = page.locator(".t3-wallet-side .t3-wallet-movers > div").first();
  await expect(mover).toBeVisible();
  expect((await mover.boundingBox())!.height).toBeLessThan(80);
  expect((await mover.locator(".t3-wallet-mover-track").boundingBox())!.width).toBeGreaterThanOrEqual(60);
});

test("Goals side card ends after its last alert", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await installPlanFidelityScene(page, "goals");
  await page.goto("/#/goals");
  const card = page.locator(".t3-fidelity-triggered");
  await expect(card.locator(".t3-fidelity-history-row").first()).toBeVisible();
  const gap = await card.evaluate((element) => element.getBoundingClientRect().bottom -
    (element.lastElementChild?.getBoundingClientRect().bottom ?? element.getBoundingClientRect().bottom));
  expect(gap).toBeLessThan(120);
  const innerGap = await card.evaluate((element) =>
    (element.querySelector(".t3-fidelity-foot")?.getBoundingClientRect().top ?? 0) -
    (element.querySelector(".t3-fidelity-history-row:last-child")?.getBoundingClientRect().bottom ?? 0));
  expect(innerGap).toBeLessThan(120);
});
