import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";
import { expectReadablePublicIpButton } from "./public-ip-contrast";

test.use({
  isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 },
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

test("phone exchange form shows public IP states in both themes and languages", async ({ page }) => {
  test.setTimeout(300_000);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const bridge = await installTauriBridge(page, { richPortfolio: true });
  mkdirSync("test-results/public-ip", { recursive: true });
  await page.goto("/#/settings/configuration?section=sources");
  for (const width of [390, 320]) for (const locale of ["en", "zh"]) for (const theme of ["light", "dark"]) for (const mode of ["loading", "value", "error"] as const) {
    await page.setViewportSize({ width, height: width === 320 ? 932 : 844 });
    bridge.setPublicIpMode(mode);
    await page.evaluate(({ locale, theme }) => {
      localStorage.setItem("track3-ui-locale", locale);
      localStorage.setItem("track3-ui-theme", theme);
    }, { locale, theme });
    await page.reload();
    const before = bridge.publicIpRequests();
    await page.getByRole("button", { name: locale === "en" ? "Add exchange" : "添加交易所" }).click();
    expect(bridge.publicIpRequests()).toBe(before);
    if (mode === "loading") await page.clock.pauseAt(new Date());
    await page.getByRole("button", { name: "Binance" }).click();
    const nav = await page.locator(".ios-d3-editor-nav").boundingBox();
    const intro = await page.locator(".ios-d3-editor-intro").boundingBox();
    expect(intro!.y).toBeGreaterThanOrEqual(nav!.y + nav!.height);
    const info = page.getByRole("group", { name: locale === "en" ? "Your public IP:" : "你的公网 IP：" });
    await expect(info).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (mode === "loading") {
      await expect(info).toHaveAttribute("aria-busy", "true");
      await expect(info).toContainText(locale === "en" ? "Detecting IP" : "正在检测 IP");
    }
    if (mode === "value") await expect(info.getByText("8.8.8.8")).toHaveCSS("user-select", "text");
    if (mode === "error") {
      await expect(info.getByRole("alert")).toContainText(locale === "en" ? "Couldn't detect your IP" : "无法检测你的 IP");
      await expect(info.getByRole("button", { name: locale === "en" ? "Copy" : "复制" })).toHaveCount(0);
    }
    if (mode !== "value") await expect(info).not.toContainText(locale === "en" ? "Add this address" : "请将此地址");
    await expect.poll(() => bridge.publicIpRequests()).toBeGreaterThan(before);
    await info.scrollIntoViewIfNeeded();
    if (mode === "value" || mode === "error") {
      for (const label of mode === "error"
        ? [locale === "en" ? "Retry" : "重试"]
        : locale === "en" ? ["Copy", "Refresh"] : ["复制", "刷新"]) {
        await expectReadablePublicIpButton(info.getByRole("button", { name: label }));
      }
    }
    await page.getByRole("dialog").evaluate((node) => { node.scrollTop = 0; });
    await page.screenshot({ path: `test-results/public-ip/phone-${width}-${locale}-${theme}-${mode}.png`, fullPage: true });
    expect(await info.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    for (const label of mode === "error"
      ? [locale === "en" ? "Retry" : "重试"]
      : locale === "en" ? ["Copy", "Refresh"] : ["复制", "刷新"]) {
      const box = await info.getByRole("button", { name: label }).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      if (mode === "loading") await expect(info.getByRole("button", { name: label })).toBeDisabled();
    }
    if (mode === "value") {
      const copyButton = info.getByRole("button", { name: locale === "en" ? /^(Copy|Copied)$/ : /^(复制|已复制)$/ });
      const refreshButton = info.getByRole("button", { name: locale === "en" ? "Refresh" : "刷新" });
      const layout = async () => {
        const [copy, refresh, add, card] = await Promise.all([copyButton, refreshButton, page.locator(".ios-d3-editor-primary"), info]
          .map((element) => element.evaluate((node) => {
            const target = node as HTMLElement;
            return { x: target.offsetLeft, y: target.offsetTop, width: target.offsetWidth, height: target.offsetHeight };
          })));
        const relative = (button: typeof copy) => ({ x: button.x - card.x, y: button.y - card.y, width: button.width });
        return { copy: relative(copy), refresh: relative(refresh), add: relative(add), cardHeight: card.height };
      };
      const beforeCopy = await layout();
      await page.clock.pauseAt(new Date());
      await copyButton.click();
      await expect(copyButton).toHaveText(locale === "en" ? "Copied" : "已复制");
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("8.8.8.8");
      await page.getByRole("dialog").evaluate((node) => { node.scrollTop = 0; });
      await page.screenshot({ path: `test-results/public-ip/phone-${width}-${locale}-${theme}-copied.png`, fullPage: true });
      const afterCopy = await layout();
      for (const part of ["copy", "refresh", "add"] as const) {
        for (const field of ["x", "y", "width"] as const) {
          expect(Math.abs(afterCopy[part][field] - beforeCopy[part][field])).toBeLessThanOrEqual(1);
        }
      }
      expect(Math.abs(afterCopy.cardHeight - beforeCopy.cardHeight)).toBeLessThanOrEqual(1);
      await page.clock.resume();
    }
    await expect(info).toContainText(locale === "en" ? "On cellular and Wi-Fi" : "蜂窝网络和 Wi-Fi");
    if (mode === "loading") await page.clock.resume();
  }
});
