import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { installTauriBridge } from "./fidelity-scenes";

const exchanges = ["binance", "okex", "bitget", "gate", "kraken", "coinbase", "bybit", "htx", "mexc", "backpack"];
const wallets = ["btc", "erc20", "sol", "doge", "trc20", "ton", "sui"];
const broker = ["ibkr"];
const sourceTypes = [...exchanges, ...wallets, ...broker];

async function seedSources(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem("track3-ui-theme")) localStorage.setItem("track3-ui-theme", "light");
    localStorage.setItem("track3-ui-locale", "en");
  });
  await installTauriBridge(page, { fidelitySample: "full" });
  const exchangeYaml = `exchanges:\n${exchanges.map((type) => `  - name: ${type}\n    alias: ${type}\n    initParams: {apiKey: ${type}-fixture-key, secret: fixture-secret${type === "okex" ? ", password: fixture-passphrase" : ""}}\n    active: true`).join("\n")}\n`;
  const walletYaml = `${wallets.map((type) => `${type}:\n  addresses:\n    - {address: ${type}-fixture-address, alias: ${type}, active: true}`).join("\n")}\n`;
  const brokerYaml = "brokers:\n  - name: ibkr\n    alias: ibkr\n    initParams: {queryId: '123456', token: fixture-token}\n    active: true\n";
  for (const [id, data] of [[10, exchangeYaml], [11, walletYaml], [20, brokerYaml]] as const) {
    await page.evaluate(({ id, data }) =>
      (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (?, ?)",
        values: [id, `!ent:e2e:${data}`],
      }), { id, data });
  }
}

async function inspectTheme(page: Page, project: "desktop" | "mobile", theme: "light" | "dark") {
  await page.goto("/#/settings/configuration?section=sources");
  await expect(page.locator("html")).toHaveClass(new RegExp(`(?:^|\\s)${theme}(?:\\s|$)`));
  await expect(page.locator(project === "mobile" ? ".fidelity-source-row" : ".t3-fidelity-source-row").first()).toBeVisible();
  for (const [tab, types] of [["exchanges", exchanges], ["wallets", wallets], ["brokers", broker]] as const) {
    if (project === "mobile") {
      await page.getByRole("tab", { name: tab === "brokers" ? "Brokers" : tab === "wallets" ? "Wallets" : "Exchanges" }).click();
    } else {
      await page.locator(".t3-fidelity-source-tabs button")
        .filter({ hasText: tab === "brokers" ? "Brokers" : tab === "wallets" ? "Wallets" : "Exchanges" }).click();
    }
    const logos = page.locator(project === "mobile"
      ? ".fidelity-source-row .ios-d3-source-avatar[data-logo-tile]"
      : ".t3-fidelity-source-row .t3-fidelity-source-logo[data-logo-tile]");
    await expect(logos).toHaveCount(types.length);
    const measurements = await logos.evaluateAll(async (tiles) => {
      await Promise.all(tiles.map((tile) => (tile.querySelector("img") as HTMLImageElement).decode()));
      return tiles.map((tile) => {
      const image = tile.querySelector("img")!;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const context = canvas.getContext("2d")!;
      context.filter = getComputedStyle(image).filter;
      context.drawImage(image, 0, 0, 128, 128);
      const pixels = context.getImageData(0, 0, 128, 128).data;
      const relativeLuminance = (red: number, green: number, blue: number) => {
        const linear = [red, green, blue].map((value) => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
      };
      let sum = 0;
      let count = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] < 128) continue;
        sum += relativeLuminance(pixels[index], pixels[index + 1], pixels[index + 2]);
        count++;
      }
      const match = getComputedStyle(tile).backgroundColor.match(/[\d.]+/g)!;
      const background = relativeLuminance(Number(match[0]), Number(match[1]), Number(match[2]));
      const foreground = sum / count;
      const contrast = (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
      const raisedTile = document.createElement("span");
      raisedTile.style.background = "hsl(var(--raised))";
      tile.append(raisedTile);
      const raisedBackground = getComputedStyle(raisedTile).backgroundColor;
      raisedTile.remove();
      return {
        type: tile.getAttribute("data-logo-type"),
        contrast,
        width: tile.getBoundingClientRect().width,
        background: getComputedStyle(tile).backgroundColor,
        raisedBackground,
      };
      });
    });
    expect(measurements.map((entry) => entry.type)).toEqual(types);
    for (const entry of measurements) {
      if (theme === "dark") {
        expect(entry.contrast, `${project} ${theme} ${entry.type}: ${JSON.stringify(entry)}`).toBeGreaterThanOrEqual(3);
      } else {
        expect(entry.background, `${project} ${theme} ${entry.type}: ${JSON.stringify(entry)}`).toBe(entry.raisedBackground);
      }
      expect(entry.width).toBe(28);
    }
    if (tab === "exchanges") {
      const okx = logos.filter({ has: page.locator('img[src*="okex-logo"]') });
      if (theme === "dark") {
        await expect(okx).toHaveCSS("background-color", "rgb(255, 255, 255)");
        await expect(okx).toHaveCSS("border-top-width", "1px");
      }
      await mkdir("/tmp/track3-logo-contrast", { recursive: true });
      await okx.screenshot({ path: `/tmp/track3-logo-contrast/${project}-${theme}-okx.png` });
    }
  }
}

test.describe("desktop source logos", () => {
  test.use({ viewport: { width: 1600, height: 900 }, reducedMotion: "reduce" });
  test("all 18 light tiles retain raised backgrounds and dark tiles contrast", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    expect(sourceTypes).toHaveLength(18);
    await seedSources(page);
    await inspectTheme(page, "desktop", "light");
    await page.evaluate(() => localStorage.setItem("track3-ui-theme", "dark"));
    await page.reload();
    await inspectTheme(page, "desktop", "dark");
  });
});

test.describe("mobile source logos", () => {
  test.use({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    reducedMotion: "reduce",
  });
  test("all 18 light tiles retain raised backgrounds and dark tiles contrast", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile");
    expect(sourceTypes).toHaveLength(18);
    await seedSources(page);
    await inspectTheme(page, "mobile", "light");
    await page.evaluate(() => localStorage.setItem("track3-ui-theme", "dark"));
    await page.reload();
    await inspectTheme(page, "mobile", "dark");
  });

  test("standard light-theme source avatars keep their original tint", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile");
    await seedSources(page);
    await page.goto("/#/settings/configuration");
    await expect(page.locator("html")).toHaveClass(/(?:^|\s)light(?:\s|$)/);
    const avatar = page.locator(".ios-d3-source-row .ios-d3-source-avatar[data-logo-tile]").first();
    await expect(avatar).toBeVisible();
    const colors = await avatar.evaluate((tile) => {
      const original = document.createElement("span");
      original.className = "ios-d3-source-avatar";
      tile.parentElement!.append(original);
      const expected = getComputedStyle(original).backgroundColor;
      original.remove();
      return { actual: getComputedStyle(tile).backgroundColor, expected };
    });
    expect(colors.actual).toBe(colors.expected);
  });
});
