import { expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

export async function verifySourceRename(page: Page, theme: "light" | "dark", mobile: boolean) {
  const check = expect.configure({ timeout: 30_000 });
  await page.setViewportSize({ width: mobile ? 390 : 1280, height: mobile ? 844 : 900 });
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript(({ theme, hint }) => {
    localStorage.setItem("track3-ui-theme", theme);
    localStorage.setItem("track3-ui-locale", "en");
    localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([
      { sourceId: "btc:0", label: "Cold storage", kind: "wallet", provider: "BTC",
        hint, status: "ok" },
    ]));
  }, { theme, hint: "bc1q-d…rage" });
  const bridge = await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/settings/configuration?section=sources");
  await check(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
  if (mobile) {
    await check(page.locator(".fidelity-source-group")).toBeVisible();
    if (theme === "light") {
      await page.getByRole("tab", { name: /Custom/ }).click();
      await check(page.locator(".fidelity-custom-group")).toBeVisible();
      await page.getByRole("tab", { name: /Exchanges/ }).click();
    }
  }
  const snapshotTotals = () => page.evaluate(async () =>
    (window as any).__e2eInvoke("plugin:sql|select", {
      query: "SELECT wallet, COUNT(*) AS rows, COALESCE(SUM(value), 0) AS total FROM assets_v2 GROUP BY wallet ORDER BY wallet",
      values: [],
    }));
  const savedAlias = (id: number, alias: string) => page.evaluate(async ({ id, alias }) => {
    const rows = await (window as any).__e2eInvoke("plugin:sql|select", {
      query: "SELECT data FROM configuration WHERE id = ?", values: [id],
    });
    return rows.some((row: { data: string }) => row.data.includes(`alias: ${alias}`));
  }, { id, alias });
  const before = await snapshotTotals();
  const screenshotPrefix = `/tmp/track3-source-rename/${mobile ? "phone" : "desktop"}-${theme}`;
  mkdirSync("/tmp/track3-source-rename", { recursive: true });
  await check(page.getByRole("button", { name: "Rename Main exchange" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${screenshotPrefix}-before.png`, animations: "disabled" });
  let comparisonBefore = "";
  let csvBefore = "";
  if (!mobile) {
    await page.goto("/#/comparison");
    await check(page.getByRole("table", { name: "Per asset" })).toContainText("BTC");
    comparisonBefore = await page.getByRole("table", { name: "Per asset" }).innerText();
    await page.goto("/#/cost-basis");
    await page.getByRole("button", { name: /^Export$/ }).click();
    await page.getByRole("button", { name: /^Export CSV/ }).click();
    await check.poll(() => bridge.exportedFile() ?? "").toContain("Asset,Acquired Date,Disposed Date");
    csvBefore = bridge.exportedFile()!;
    expect(csvBefore).toContain("Asset,Acquired Date,Disposed Date");
    await page.goto("/#/settings/configuration?section=sources");
  }
  const tabs = page.getByRole("group", { name: "Data sources" });
  const selectWallets = async () => {
    if (mobile) await page.getByRole("tab", { name: /Wallets/ }).click();
    else await tabs.getByRole("button", { name: /Wallets \d+/ }).click();
  };
  const exchangeRename = page.getByRole("button", { name: "Rename Main exchange" });
  await check(exchangeRename).toBeVisible();
  expect((await exchangeRename.boundingBox())!.width).toBeGreaterThanOrEqual(mobile ? 44 : 24);
  await exchangeRename.click();
  await page.getByRole("textbox", { name: "Alias" }).fill("Trading account");
  await page.screenshot({ path: `${screenshotPrefix}-editor.png`, fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await check(page.getByText("Trading account", { exact: true }).first()).toBeVisible();
  await check(page.getByText("Renamed to Trading account", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${screenshotPrefix}-toast.png`, fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Undo" }).click();
  await check(page.getByRole("button", { name: "Rename Main exchange" })).toBeVisible();
  await check.poll(() => savedAlias(10, "Main exchange")).toBe(true);
  await page.getByRole("button", { name: "Rename Main exchange" }).click();
  await page.getByRole("textbox", { name: "Alias" }).fill("Trading account");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await check(page.getByRole("button", { name: "Rename Trading account" })).toBeVisible();
  await check.poll(() => savedAlias(10, "Trading account")).toBe(true);
  await selectWallets();
  await page.getByRole("button", { name: "Rename Cold storage" }).click();
  await page.getByRole("textbox", { name: "Alias" }).fill("Vault wallet");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await check(page.getByText("Vault wallet", { exact: true }).first()).toBeVisible();
  await check.poll(() => savedAlias(11, "Vault wallet")).toBe(true);
  await check.poll(snapshotTotals).toEqual(before);
  await page.reload();
  await check(page.getByRole("button", { name: "Rename Trading account" })).toBeVisible();
  await selectWallets();
  await check(page.getByRole("button", { name: "Rename Vault wallet" })).toBeVisible();
  await page.goto("/#/wallets");
  await check(page.getByText("Vault wallet").first()).toBeVisible();
  await page.goto("/#/coins/BTC");
  await check(page.getByText("Holdings by source", { exact: true })).toBeVisible();
  await check(page.getByText("Vault wallet").first()).toBeVisible();
  await page.goto("/#/overview");
  await check(page.getByText("Vault wallet", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Source status" }).click();
  await check(page.getByRole("alertdialog", { name: "Source status" })
    .getByRole("group", { name: /^Vault wallet(?: \(|$)/ })).toBeVisible();
  await page.getByRole("alertdialog", { name: "Source status" }).getByRole("button", { name: "Close" }).click();
  if (!mobile) {
    await page.goto("/#/history");
    await check(page.getByTestId("history-desktop-detail")).toContainText("Vault wallet");
    await page.goto("/#/summary");
    const attribution = page.locator(".fidelity-attribution");
    await attribution.locator("summary").click();
    await attribution.getByRole("button", { name: "Wallet", exact: true }).click();
    await check(page.getByText(/Vault wallet/).first()).toBeVisible();
    await page.goto("/#/comparison");
    await check.poll(() => page.getByRole("table", { name: "Per asset" }).innerText())
      .toBe(comparisonBefore);
    await page.goto("/#/cost-basis");
    await page.getByRole("button", { name: /^Export$/ }).click();
    await page.getByRole("button", { name: /^Export CSV/ }).click();
    await check.poll(() => bridge.exportedFile()).toBe(csvBefore);
  }
  await check.poll(snapshotTotals).toEqual(before);
  await page.goto("/#/settings/configuration?section=sources");
  await selectWallets();
  const longAlias = "Forty character wallet alias for display";
  expect(longAlias).toHaveLength(40);
  await page.getByRole("button", { name: "Rename Vault wallet" }).click();
  await page.getByRole("textbox", { name: "Alias" }).fill(longAlias);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const longLabel = mobile
    ? page.locator(".fidelity-source-name strong[title]", { hasText: longAlias }).first()
    : page.locator("table tbody tr td span[title]", { hasText: longAlias }).first();
  await check(longLabel).toBeVisible();
  await check(longLabel).toHaveAttribute("title", longAlias);
  expect(await longLabel.evaluate((node) => {
    const text = document.createRange();
    text.selectNodeContents(node);
    return getComputedStyle(node).textOverflow === "ellipsis" &&
      text.getBoundingClientRect().right > node.getBoundingClientRect().right;
  })).toBe(true);
  await check(page.getByRole("dialog")).toHaveCount(0);
  await check(page.getByText(`Renamed to ${longAlias}`, { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${screenshotPrefix}.png`, fullPage: true, animations: "disabled" });
}
