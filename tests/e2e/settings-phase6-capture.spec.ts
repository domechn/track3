import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";
import { captureSyncStates } from "./sync-status-captures";

const output = "/tmp/track3-phase6-screenshots";
const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const screens = {
  sources: "settings/configuration?section=sources",
  currency: "settings/configuration?section=currency",
  appearance: "settings/appearance?section=theme",
  language: "settings/appearance?section=language",
  blacklist: "settings/data?section=blacklist",
  pro: "settings/systemInfo?section=pro",
  ai: "settings/assistant",
  backup: "settings/data?section=backup",
  security: "settings/data?section=security",
  sync: "settings/sync",
  about: "settings/systemInfo?section=about",
} as const;

test("capture Phase 6 screens at the review sizes", async ({ browser }) => {
  test.skip(process.env.TRACK3_CAPTURE !== "1");
  test.setTimeout(500_000);
  mkdirSync(output, { recursive: true });
  for (const [size, width, height, mobile] of [
    ["desktop-1440", 1440, 900, false],
    ["desktop-1024", 1024, 768, false],
    ["phone-390", 390, 844, true],
    ["tablet-834", 834, 1194, true],
    ["tablet-1133", 1133, 834, true],
  ] as const) {
    if (process.env.TRACK3_CAPTURE_SIZE && process.env.TRACK3_CAPTURE_SIZE !== size) continue;
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: { width, height }, colorScheme: theme, reducedMotion: "reduce",
        ...(mobile ? { userAgent: iPhoneUserAgent, hasTouch: true, isMobile: true } : {}),
      });
      const page = await context.newPage();
      await page.addInitScript((next) => localStorage.setItem("track3-ui-theme", next), theme);
      await installTauriBridge(page, { richPortfolio: true, appVersion: "0.9.4" });
      for (const [screen, route] of Object.entries(screens)) {
        await page.goto(`/#/${route}`);
        await page.reload();
        await expect(page.locator("#app-main-content")).toBeVisible();
        await expect(page.locator(mobile ? ".ios-d3-settings" : ".t3-settings")).toBeVisible();
        await expect(page.getByText("Loading page", { exact: true })).toHaveCount(0);
        await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
        await page.waitForLoadState("networkidle");
        await page.screenshot({ path: `${output}/${size}-${theme}-${screen}.png`, animations: "disabled" });
        if (["ai", "backup", "security", "sync"].includes(screen)) {
          await page.screenshot({ path: `${output}/${size}-${theme}-${screen}-full.png`, fullPage: true, animations: "disabled" });
        }
        if (screen === "sources" && !mobile) {
          const desktopSource = (title: string) => page.locator(".t3-settings-source-tabs").getByRole("button", { name: new RegExp(`^${title} \\d+$`) });
          for (const tab of ["Wallets", "Brokers", "Custom assets"]) {
            await desktopSource(tab).click();
            await page.screenshot({ path: `${output}/${size}-${theme}-sources-${tab.toLowerCase().replace(" ", "-")}.png`, animations: "disabled" });
          }
          await desktopSource("Exchanges").click();
          await page.getByRole("button", { name: "Add Exchange Configuration" }).click();
          await expect(page.getByRole("dialog", { name: "Add Exchange Configuration" })).toBeVisible();
          await page.screenshot({ path: `${output}/${size}-${theme}-add-exchange.png`, animations: "disabled" });
          await page.keyboard.press("Escape");
          for (const [tab, action, file] of [
            ["Wallets", "Add Wallet Configuration", "add-wallet"],
            ["Brokers", "Add Stock Broker", "add-broker"],
            ["Custom assets", "Add Symbol", "add-custom"],
          ] as const) {
            await desktopSource(tab).click();
            await page.getByRole("button", { name: action }).click();
            await expect(page.getByRole("dialog", { name: tab === "Custom assets" ? "Add Other Configuration" : action })).toBeVisible();
            await page.screenshot({ path: `${output}/${size}-${theme}-${file}.png`, animations: "disabled" });
            await page.keyboard.press("Escape");
          }
          await page.locator(".t3-settings-content table tbody tr").first().locator("td").last().getByRole("button").first().click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page.screenshot({ path: `${output}/${size}-${theme}-attach.png`, animations: "disabled" });
          await page.keyboard.press("Escape");
          await desktopSource("Exchanges").click();
          await page.getByTitle("Delete").first().click();
          await expect(page.getByRole("alertdialog")).toBeVisible();
          await page.screenshot({ path: `${output}/${size}-${theme}-remove-confirm.png`, animations: "disabled" });
          await page.keyboard.press("Escape");
          await desktopSource("Wallets").click();
          await page.evaluate(() => {
            const tauri = (window as any).__TAURI_INTERNALS__;
            const originalInvoke = tauri.invoke;
            tauri.invoke = (command: string, args: unknown, options: unknown) =>
              command === "plugin:http|fetch_send" ? new Promise(() => {}) : originalInvoke(command, args, options);
          });
          await page.getByTitle("Quick look").first().click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page.screenshot({ path: `${output}/${size}-${theme}-quick-look.png`, animations: "disabled" });
        }
        if (screen === "sources" && mobile) {
          for (const tab of ["Wallets", "Brokers", "Custom assets"]) {
            await page.getByRole("tab", { name: tab }).click();
            await page.screenshot({ path: `${output}/${size}-${theme}-sources-${tab.toLowerCase().replace(" ", "-")}.png`, animations: "disabled" });
          }
          await page.getByRole("tab", { name: "Exchanges" }).click();
          await page.getByRole("button", { name: "Add exchange", exact: true }).first().click();
          await expect(page.getByRole("dialog", { name: "Edit data source" })).toBeVisible();
          await page.screenshot({ path: `${output}/${size}-${theme}-add-exchange.png`, animations: "disabled" });
          await page.keyboard.press("Escape");
          for (const [tab, action, dialog, file] of [
            ["Wallets", "Add wallet", "Edit data source", "add-wallet"],
            ["Brokers", "Add broker", "Edit data source", "add-broker"],
            ["Custom assets", "Add symbol", "Add custom asset", "add-custom"],
          ] as const) {
            await page.getByRole("tab", { name: tab }).click();
            await page.getByRole("button", { name: action }).click();
            await expect(page.getByRole("dialog", { name: dialog })).toBeVisible();
            await page.screenshot({ path: `${output}/${size}-${theme}-${file}.png`, animations: "disabled" });
            await page.keyboard.press("Escape");
          }
          await page.getByRole("tab", { name: "Exchanges" }).click();
          await page.getByRole("button", { name: "More actions for Main exchange" }).click();
          await page.getByRole("button", { name: "Delete", exact: true }).click();
          await expect(page.getByRole("alertdialog")).toBeVisible();
          await page.screenshot({ path: `${output}/${size}-${theme}-remove-confirm.png`, animations: "disabled" });
        }
      }
      if (mobile) {
        await page.goto("/#/settings");
        await page.screenshot({ path: `${output}/${size}-${theme}-menu.png`, animations: "disabled" });
        await page.screenshot({ path: `${output}/${size}-${theme}-menu-full.png`, fullPage: true, animations: "disabled" });
      }
      await page.goto("/#/settings/systemInfo?section=about");
      await page.getByTestId("onboarding-replay").click();
      await expect(page.getByTestId("onboarding-dialog")).toBeVisible();
      await page.screenshot({ path: `${output}/${size}-${theme}-guide-1.png`, animations: "disabled" });
      for (let step = 2; step <= 5; step++) {
        await page.getByTestId("onboarding-next").click();
        await page.screenshot({ path: `${output}/${size}-${theme}-guide-${step}.png`, animations: "disabled" });
      }
      await context.close();
      const statusContext = await browser.newContext({
        viewport: { width, height }, colorScheme: theme, reducedMotion: "reduce",
        ...(mobile ? { userAgent: iPhoneUserAgent, hasTouch: true, isMobile: true } : {}),
      });
      await captureSyncStates(await statusContext.newPage(), mobile ? "mobile" : "desktop", theme, "en",
        { size, width, height, output: `${output}/sync-popovers` });
      await statusContext.close();
    }
  }
  if (process.env.TRACK3_CAPTURE_SIZE && process.env.TRACK3_CAPTURE_SIZE !== "extras") return;
  for (const theme of ["light", "dark"] as const) {
    for (const [size, width, height] of [["desktop-1440", 1440, 900], ["desktop-1024", 1024, 768]] as const) {
    const desktop = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion: "reduce" });
    const desktopPage = await desktop.newPage();
    await desktopPage.addInitScript((next) => localStorage.setItem("track3-ui-theme", next), theme);
    await installTauriBridge(desktopPage, { richPortfolio: true, appVersion: "0.9.4" });
    await desktopPage.addInitScript(() => {
      const tauri = (window as any).__TAURI_INTERNALS__;
      const originalInvoke = tauri.invoke;
      tauri.invoke = (cmd: string, args: unknown, options: unknown) => {
        if (cmd === "plugin:updater|check") {
          return Promise.resolve({ rid: 84, currentVersion: "0.9.4", version: "0.9.5", date: "2026-11-01", body: "Update fixture" });
        }
        if (cmd === "plugin:updater|download_and_install") return Promise.resolve(null);
        return originalInvoke(cmd, args, options);
      };
    });
    await desktopPage.goto("/#/overview");
    await expect(desktopPage.getByRole("dialog", { name: "Update ready to install" })).toBeVisible();
    await expect(desktopPage.locator(".t3-overview-grid")).toBeVisible();
    await desktopPage.screenshot({ path: `${output}/${size}-${theme}-update-ready.png`, animations: "disabled" });
    await desktopPage.getByRole("button", { name: "Later" }).click();
    await desktopPage.screenshot({ path: `${output}/${size}-${theme}-update-later.png`, animations: "disabled" });
    await desktop.close();
    }

    for (const [size, width, height] of [["phone-390", 390, 844], ["tablet-834", 834, 1194], ["tablet-1133", 1133, 834]] as const) {
    const phone = await browser.newContext({
      viewport: { width, height }, colorScheme: theme, reducedMotion: "reduce",
      userAgent: iPhoneUserAgent, hasTouch: true, isMobile: true,
    });
    const phonePage = await phone.newPage();
    await phonePage.addInitScript((next) => localStorage.setItem("track3-ui-theme", next), theme);
    await installTauriBridge(phonePage, { lockedStartup: true });
    await phonePage.goto("/#/overview");
    await expect(phonePage.getByRole("alert")).toBeVisible();
    await phonePage.screenshot({ path: `${output}/${size}-${theme}-startup-lock.png`, animations: "disabled" });
    await phone.close();

    const firstRun = await browser.newContext({
      viewport: { width, height }, colorScheme: theme, reducedMotion: "reduce",
      userAgent: iPhoneUserAgent, hasTouch: true, isMobile: true,
    });
    const firstRunPage = await firstRun.newPage();
    await firstRunPage.addInitScript((next) => localStorage.setItem("track3-ui-theme", next), theme);
    await installTauriBridge(firstRunPage, { emptyPortfolio: true, onboarding: true });
    await firstRunPage.goto("/#/overview");
    await expect(firstRunPage.getByTestId("onboarding-dialog")).toBeVisible();
    await firstRunPage.screenshot({ path: `${output}/${size}-${theme}-firstrun-guide.png`, animations: "disabled" });
    await firstRunPage.getByTestId("onboarding-skip").click();
    await expect(firstRunPage.getByTestId("onboarding-dialog")).toHaveCount(0);
    await firstRunPage.screenshot({ path: `${output}/${size}-${theme}-firstrun-empty.png`, animations: "disabled" });
    await firstRun.close();
    }
  }
});
