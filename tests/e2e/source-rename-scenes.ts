import { expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { installTauriBridge } from "./tauri-bridge";
import { seedSettingsA } from "./fidelity-settings-a-scenes";

const measure = (target: Page, row: string) => target.evaluate((selector) => {
  const details = (element: Element | null) => {
    if (!element) return null;
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
      color: style.color, background: style.backgroundColor, fontFamily: style.fontFamily,
      fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight,
      padding: style.padding };
  };
  return { heading: details(document.querySelector("h1")), row: details(document.querySelector(selector)) };
}, row);

const difference = (page: Page, designPath: string, appPath: string, threshold: number) =>
  page.evaluate(async ({ design, app, threshold }) => {
    const image = (data: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const item = new Image();
      item.onload = () => resolve(item);
      item.onerror = reject;
      item.src = `data:image/png;base64,${data}`;
    });
    const [left, right] = await Promise.all([image(design), image(app)]);
    const pixels = (item: HTMLImageElement) => {
      const canvas = document.createElement("canvas");
      canvas.width = item.width;
      canvas.height = item.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(item, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const a = pixels(left);
    const b = pixels(right);
    let different = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i += 4) {
      if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]),
        Math.abs(a[i + 2] - b[i + 2])) > threshold) different++;
    }
    return { ratio: different / (Math.min(a.length, b.length) / 4),
      designSize: [left.width, left.height], appSize: [right.width, right.height], threshold };
  }, {
    design: readFileSync(designPath).toString("base64"),
    app: readFileSync(appPath).toString("base64"),
    threshold,
  });

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
    const colors = await page.evaluate(() => ({
      page: getComputedStyle(document.body).backgroundColor,
      row: getComputedStyle(document.querySelector(".fidelity-source-group")!).backgroundColor,
      bounds: document.querySelector(".fidelity-source-group")!.getBoundingClientRect().toJSON(),
    }));
    const channel = (color: string) => Number(color.match(/\d+/)?.[0] ?? 0);
    expect(channel(colors.page)).toBeGreaterThan(theme === "light" ? 200 : 0);
    expect(channel(colors.page)).toBeLessThan(theme === "light" ? 256 : 50);
    expect(channel(colors.row)).toBeGreaterThan(theme === "light" ? 200 : 0);
    expect(channel(colors.row)).toBeLessThan(theme === "light" ? 256 : 50);
    expect(colors.bounds.width).toBeGreaterThan(300);
    if (theme === "light") {
      await page.getByRole("tab", { name: /Custom/ }).click();
      await check(page.locator(".fidelity-custom-group")).toBeVisible();
      const customColor = await page.locator(".fidelity-custom-group").evaluate(
        (element) => getComputedStyle(element).backgroundColor);
      expect(channel(customColor)).toBeGreaterThan(200);
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
  expect((await exchangeRename.boundingBox())!.width).toBeGreaterThanOrEqual(mobile ? 44 : 36);
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
  await check(page.getByRole("alertdialog", { name: "Source status" })).toContainText("Vault wallet");
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
  expect(await longLabel.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  await check(page.getByRole("dialog")).toHaveCount(0);
  await check(page.getByText(`Renamed to ${longAlias}`, { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${screenshotPrefix}.png`, fullPage: true, animations: "disabled" });
  const designFile = process.env.TRACK3_DESIGN_SOURCE_PAGE;
  if (designFile) {
    const samplePage = await page.context().newPage();
    await samplePage.setViewportSize({ width: mobile ? 390 : 1600, height: mobile ? 844 : 900 });
    await samplePage.emulateMedia({ reducedMotion: "reduce" });
    await seedSettingsA(samplePage, { page: "sources", name: "default", theme });
    await samplePage.goto("/#/settings/configuration?section=sources");
    const measurements: Record<string, { app: unknown; design?: unknown; pixelDiff?: unknown }> = {};
    for (const state of ["default", "wallets", "brokers", "custom"] as const) {
      if (state !== "default") {
        const tabName = state === "wallets" ? /Wallets/ : state === "brokers" ? /Brokers/ : /Custom/;
        if (mobile) await samplePage.getByRole("tab", { name: tabName }).click();
        else await samplePage.getByRole("group", { name: "Data sources" })
          .getByRole("button", { name: tabName }).click();
      }
      const marker = state === "default" ? "Binance" : state === "wallets" ? "Ledger cold wallet"
        : state === "brokers" ? "Interactive Brokers" : "GOLD";
      const rowSelector = mobile
        ? state === "custom" ? ".fidelity-custom-row" : ".fidelity-source-row"
        : state === "custom" ? ".t3-fidelity-source-row.custom" : ".t3-fidelity-source-row";
      const row = samplePage.locator(rowSelector).first();
      await check(row).toBeVisible();
      await check(row).toContainText(marker);
      await samplePage.evaluate(() => document.fonts.ready);
      await samplePage.bringToFront();
      await samplePage.evaluate(() => new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await check(row).toBeVisible();
      const app = await measure(samplePage, rowSelector);
      expect(app.heading).not.toBeNull();
      expect(app.row).not.toBeNull();
      const appPath = `${screenshotPrefix}-sample-${state}.png`;
      let captureSize = 0;
      for (let attempt = 0; attempt < 3 && captureSize < 15_000; attempt++) {
        if (attempt) await samplePage.evaluate(() => new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        captureSize = (await samplePage.screenshot({ path: appPath, animations: "disabled" })).byteLength;
      }
      expect(captureSize, appPath).toBeGreaterThan(15_000);
      measurements[state] = { app };
    }
    await samplePage.close();
    const sourcePage = await page.context().newPage();
    await sourcePage.setViewportSize({ width: mobile ? 390 : 1600, height: mobile ? 844 : 900 });
    const designUrl = pathToFileURL(resolve(designFile)).href;
    for (const state of ["default", "wallets", "brokers", "custom"] as const) {
      await sourcePage.goto(state === "default" ? designUrl : `${designUrl}#${state}`);
      if (state !== "default") await sourcePage.reload();
      await sourcePage.evaluate(() => document.fonts.ready);
      const marker = state === "default" ? "Binance" : state === "wallets" ? "Ledger cold wallet"
        : state === "brokers" ? "Interactive Brokers" : "GOLD";
      await check(sourcePage.locator(".srow").first()).toContainText(marker);
      const design = await measure(sourcePage, ".srow");
      expect(design.heading).not.toBeNull();
      expect(design.row).not.toBeNull();
      const designPath = `${screenshotPrefix}-design-${state}.png`;
      await sourcePage.screenshot({ path: designPath, animations: "disabled" });
      measurements[state].design = design;
      measurements[state].pixelDiff = await difference(page,
        designPath, `${screenshotPrefix}-sample-${state}.png`, mobile ? 16 : 24);
    }
    writeFileSync(`${screenshotPrefix}-measure.json`, JSON.stringify(measurements, null, 2));
    await sourcePage.close();
  }
}
