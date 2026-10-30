import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";
import { expectReadablePublicIpButton } from "./public-ip-contrast";

test("desktop exchange form shows public IP states in both themes and languages", async ({ page }) => {
  test.setTimeout(180_000);
  await page.context().grantPermissions(["clipboard-write"]);
  await page.setViewportSize({ width: 1280, height: 900 });
  const bridge = await installTauriBridge(page);
  mkdirSync("test-results/public-ip", { recursive: true });
  await page.goto("/#/settings/configuration");
  for (const locale of ["en", "zh"]) for (const theme of ["light", "dark"]) for (const mode of ["loading", "value", "error"] as const) {
    bridge.setPublicIpMode(mode);
    await page.evaluate(({ locale, theme }) => {
      localStorage.setItem("track3-ui-locale", locale);
      localStorage.setItem("track3-ui-theme", theme);
    }, { locale, theme });
    await page.reload();
    const before = bridge.publicIpRequests();
    const add = page.getByRole("button", { name: locale === "en" ? "Add Exchange Configuration" : "新增交易所配置" });
    await add.click();
    expect(bridge.publicIpRequests()).toBe(before);
    await page.getByRole("combobox", { name: locale === "en" ? "Type" : "类型" }).click();
    await page.getByRole("option", { name: "Binance" }).click();
    const info = page.getByRole("group", { name: locale === "en" ? "Your public IP:" : "你的公网 IP：" });
    await expect(info).toBeVisible();
    if (mode === "loading") {
      await expect(info).toHaveAttribute("aria-busy", "true");
      await expect(info).toContainText(locale === "en" ? "Detecting IP" : "正在检测 IP");
      await expect(info.getByRole("button", { name: locale === "en" ? "Copy" : "复制" })).toBeDisabled();
      await expect(info.getByRole("button", { name: locale === "en" ? "Refresh" : "刷新" })).toBeDisabled();
    }
    if (mode === "value") {
      await expect(info.getByText("8.8.8.8")).toBeVisible();
      await expect(info.getByText("8.8.8.8")).toHaveCSS("user-select", "text");
      await expectReadablePublicIpButton(info.getByRole("button", { name: locale === "en" ? "Copy" : "复制" }));
      await expectReadablePublicIpButton(info.getByRole("button", { name: locale === "en" ? "Refresh" : "刷新" }));
    }
    if (mode === "error") {
      await expect(info.getByRole("alert")).toContainText(locale === "en" ? "Couldn't detect your IP" : "无法检测你的 IP");
      await expectReadablePublicIpButton(info.getByRole("button", { name: locale === "en" ? "Retry" : "重试" }));
      await expect(info.getByRole("button", { name: locale === "en" ? "Copy" : "复制" })).toHaveCount(0);
    }
    if (mode !== "value") await expect(info).not.toContainText(locale === "en" ? "Add this address" : "请将此地址");
    expect(bridge.publicIpRequests()).toBeGreaterThan(before);
    await page.screenshot({ path: `test-results/public-ip/desktop-${locale}-${theme}-${mode}.png` });
    if (mode === "value") {
      await info.getByRole("button", { name: locale === "en" ? "Copy" : "复制" }).click();
      await expect(info.getByRole("button", { name: locale === "en" ? "Copied" : "已复制" })).toBeVisible();
      await page.screenshot({ path: `test-results/public-ip/desktop-${locale}-${theme}-copied.png` });
    }
    expect(await info.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
});
