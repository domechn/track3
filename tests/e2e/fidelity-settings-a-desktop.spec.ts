import { copyFileSync, mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { seedSettingsA, settingsACaptures, settingsASql } from "./fidelity-settings-a-scenes";

test.use({ viewport: { width: 1600, height: 777 }, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });

async function designViewport(page: Page, area: string, state: string) {
  const height = area === "add" ? 1111
    : area === "currency" ? 787
      : area === "sources" && state === "quicklook" ? 938
        : area === "sources" && state === "attach" ? 1000
          : (area === "language" && state === "zh-toast") || (area === "blacklist" && state === "undo") ? 1222
            : 777;
  await page.setViewportSize({ width: 1600, height });
}

async function shot(page: Page, state: string) {
  await expect(page.getByRole("status", { name: "Backing up data" })).toBeHidden({ timeout: 10000 });
  mkdirSync(settingsACaptures, { recursive: true });
  const path = `${settingsACaptures}/${state}-desktop.png`;
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  const pageName = state.startsWith("add-") ? "add-source" : state.split("-")[0];
  const pageDirectory = `/tmp/fidelity-desktop/${pageName}`;
  mkdirSync(pageDirectory, { recursive: true });
  copyFileSync(path, `${pageDirectory}/${state}-desktop.png`);
}

const sourceStates = [
  "default", "wallets", "brokers", "custom", "empty", "loading", "error", "quicklook", "attach", "remove",
] as const;

for (const state of sourceStates) {
  test(`sources ${state} desktop fidelity`, async ({ page }) => {
    await designViewport(page, "sources", state);
    page.on("pageerror", (error) => console.error("Settings A page error:", error.message));
    page.on("console", (message) => { if (message.type() === "error") console.error("Settings A console:", message.text()); });
    await seedSettingsA(page, { page: "sources", name: state });
    if (state === "empty") {
      await settingsASql(page, "UPDATE configuration SET data = '!ent:e2e:exchanges: []' WHERE id = 10");
    }
    if (state === "loading") {
      await page.goto("/#/settings/appearance?section=theme");
      await expect(page.getByText("Loading portfolio data")).toBeHidden({ timeout: 20000 });
      await page.evaluate(() => {
        const original = (window as any).__e2eInvoke;
        (window as any).__e2eInvoke = async (cmd: string, args: any, ...rest: any[]) => {
          if (cmd === "plugin:sql|select" && /FROM assets_v2/i.test(args.query) &&
              /DESC LIMIT \?/.test(args.query) && args.values?.includes(1)) return new Promise(() => {});
          return original(cmd, args, ...rest);
        };
      });
    }
    if (state === "loading") await page.evaluate(() => { window.location.hash = "#/settings/configuration?section=sources"; });
    else await page.goto("/#/settings/configuration?section=sources");
    if (state === "default") {
      await page.waitForTimeout(1000);
      await shot(page, "sources-default-baseline");
    }
    await expect(page.getByRole("heading", { name: "Data sources" }).last()).toBeVisible();
    await expect(page.getByTestId("source-table")).toBeVisible();
    if (state === "loading") {
      await expect(page.locator(".t3-fidelity-source-skeleton").first()).toBeVisible();
      await expect(page.getByText("Loading portfolio data")).toBeHidden();
    }
    if (["wallets", "brokers", "custom", "attach"].includes(state)) {
      const tab = state === "attach" ? "Custom assets" : state === "wallets" ? "Wallets" : state === "brokers" ? "Brokers" : "Custom assets";
      await page.getByRole("button", { name: new RegExp(tab) }).first().click();
    }
    if (state === "quicklook") await page.getByTestId("source-quicklook-Binance").click();
    if (state === "attach") await page.getByTestId("source-attach-GOLD").click();
    if (state === "remove") await page.getByTestId("source-remove-OKX").click();
    if (state === "empty") {
      const card = await page.getByTestId("source-table").boundingBox();
      expect(card?.y).toBe(160);
      expect(card?.height).toBe(188);
    }
    await shot(page, `sources-${state}`);
    if (state === "default") {
      await expect(page.getByTestId("source-table")).toContainText("$500,893.94");
      await expect(page.locator(".t3-fidelity-source-banner svg path")).toHaveAttribute("d", /^M12 22/);
      await expect(page.getByTestId("source-quicklook-Binance")).toHaveCSS("height", "32px");
    }
  });
}

type AddState =
  | "pick" | "form" | "form-errors" | "form-okx" | "form-saving" | "ip-error" | "ip-loading"
  | "wallet-empty" | "wallet-eth" | "wallet-invalid" | "wallet-saving"
  | "broker" | "broker-error" | "broker-rejected" | "custom";
const addStates: AddState[] = [
  "pick", "form", "form-errors", "form-okx", "form-saving", "ip-error", "ip-loading",
  "wallet-empty", "wallet-eth", "wallet-invalid", "wallet-saving",
  "broker", "broker-error", "broker-rejected", "custom",
];
for (const state of addStates) {
  test(`add ${state} desktop fidelity`, async ({ page }) => {
    await designViewport(page, "add", state);
    const bridge = await seedSettingsA(page, { page: "add", name: state });
    if (state === "form-saving") {
      await page.addInitScript(() => {
        const original = (window as any).__e2eInvoke;
        (window as any).__e2eInvoke = async (cmd: string, args: any, ...rest: any[]) => {
          if (cmd === "plugin:http|fetch" && String(args.clientConfig?.url).includes("api.binance.com")) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
          return original(cmd, args, ...rest);
        };
      });
    }
    if (state === "ip-error") bridge.setPublicIpMode("error");
    if (state === "ip-loading") bridge.setPublicIpMode("loading");
    await page.goto("/#/settings/configuration?section=sources");
    const wallet = state.startsWith("wallet");
    const broker = state.startsWith("broker");
    const custom = state === "custom";
    if (wallet || broker || custom) {
      await page.getByRole("button", { name: new RegExp(wallet ? "Wallets" : broker ? "Brokers" : "Custom assets") }).first().click();
    }
    await page.getByRole("button", { name: wallet ? "Add wallet" : broker ? "Add broker" : custom ? "Add custom asset" : "Add exchange" }).first().click();
    if (!wallet && !broker && !custom && state !== "pick") {
      await page.getByRole("button", { name: state === "form-okx" || state === "form-errors" ? "OKX" : "Binance", exact: true }).click();
      await page.getByRole("button", { name: /Continue with/ }).click();
      if (state !== "form-errors") {
        await page.getByLabel("API key", { exact: true }).fill("vK3p9Qx2nT8mLw4Zr7YbH1c5uE6dFaG0jS7Qf2");
        await page.getByLabel("API secret", { exact: true }).fill("sample-secret-32-characters-long-for-e2e-testing-only");
        if (state === "form-okx") await page.getByLabel("Passphrase", { exact: true }).fill("sample-passphrase");
      } else {
        await page.getByLabel("API secret", { exact: true }).fill("short-sample-secret");
      }
      if (state === "form-errors") await page.getByRole("button", { name: "Save and test" }).click();
      if (state === "form-saving") await page.getByRole("button", { name: "Save and test" }).click();
    }
    if (wallet) {
      if (state === "wallet-eth" || state === "wallet-invalid") await page.getByRole("button", { name: /ETH.*Ethereum/ }).click();
      if (state === "wallet-eth") await page.getByLabel("Address").fill("0x4f2a8c1e9b07d3a5c6e41f8b2d90a7c3e5b1a91c");
      if (state === "wallet-invalid") await page.getByLabel("Address").fill("0x4f2a8c1e9b07d3a5c6e41f8b2d90zz");
      if (state === "wallet-saving") {
        await page.getByLabel("Address").fill("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq");
        await page.getByLabel("Label").fill("Cold storage 2");
        await page.getByRole("button", { name: "Add wallet" }).last().click();
      }
    }
    if (broker) {
      await page.getByLabel("Flex Query ID").fill(state === "broker-error" ? "912x04" : "912406");
      await page.getByLabel("Flex token").fill("sample-flex-web-service-token");
    }
    if (broker && state === "broker-rejected") await page.getByRole("button", { name: "Save and test" }).click();
    if (custom) {
      await page.getByLabel("Symbol", { exact: true }).fill("GOLD");
      await page.getByLabel("Name", { exact: true }).fill("Gold bars");
      await page.getByLabel("Amount", { exact: true }).fill("4");
      await page.getByLabel("Price in USD").fill("2,650.00");
    }
    if (state !== "wallet-empty") await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await shot(page, `add-${state}`);
    if (state !== "wallet-saving" && state !== "broker-rejected") await expect(page.getByRole("dialog")).toBeVisible();
  });
}

for (const state of ["default", "select", "updating", "rates-error"] as const) {
  test(`currency ${state} desktop fidelity`, async ({ page }) => {
    await designViewport(page, "currency", state);
    await seedSettingsA(page, { page: "currency", name: state });
    if (state === "updating" || state === "rates-error") {
      await page.addInitScript(({ failing }) => {
        const original = (window as any).__e2eInvoke;
        let rateRequest: number | undefined;
        (window as any).__e2eInvoke = async (cmd: string, args: any, ...rest: any[]) => {
          if (cmd === "plugin:http|fetch" && String(args.clientConfig?.url).includes("currency-rate-api.track3.dev")) {
            rateRequest = await original(cmd, args, ...rest);
            return rateRequest;
          }
          if (cmd === "plugin:http|fetch_send" && args.rid === rateRequest) {
            if (failing) throw new Error("Currency service unavailable");
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
          return original(cmd, args, ...rest);
        };
      }, { failing: state === "rates-error" });
    }
    await page.goto("/#/settings/configuration?section=currency");
    await expect(page.getByRole("heading", { name: "Currency & display" }).last()).toBeVisible();
    await expect(page.getByTestId("currency-settings")).toBeVisible();
    if (state === "select") await page.getByRole("button", { name: "Base currency" }).click();
    if (state === "rates-error") await settingsASql(page,
      "UPDATE currency_rates SET updatedAt = '2026-10-30T09:30:00.000Z' WHERE currency <> 'USD'");
    if (state === "updating" || state === "rates-error") await page.getByRole("button", { name: "Update rates" }).click();
    if (state === "rates-error") {
      await expect(page.getByText("Couldn’t reach the rates service.")).toBeVisible();
      await expect(page.getByText("from 30 Oct", { exact: true })).toBeVisible();
    }
    await shot(page, `currency-${state}`);
    await expect(page.getByTestId("currency-settings")).toBeVisible();
    if (state === "default") {
      await expect(page.locator(".t3-fidelity-currency .setting-row").first()).toHaveCSS("border-top-width", "1px");
      await expect(page.locator(".t3-fidelity-currency-rates tbody td").first()).toHaveCSS("border-top-width", "1px");
      await expect(page.locator(".t3-fidelity-currency-stable .stable-row").first()).toHaveCSS("border-top-width", "1px");
    }
    if (state === "select") {
      const menu = await page.locator(".t3-fidelity-currency .options").boundingBox();
      expect(menu?.height).toBe(214);
      expect(menu?.y).toBeCloseTo(229.6, 0);
    }
  });
}

for (const state of ["default", "redup", "system"] as const) {
  test(`appearance ${state} desktop fidelity`, async ({ page }) => {
    await designViewport(page, "appearance", state);
    await seedSettingsA(page, { page: "appearance", name: state });
    await page.goto("/#/settings/appearance?section=theme");
    await expect(page.getByRole("heading", { name: "Appearance" }).last()).toBeVisible();
    await expect(page.getByTestId("theme-preview-grid")).toBeVisible();
    if (state === "default") {
      const tile = await page.locator(".t3-fidelity-appearance .theme-choice").first().boundingBox();
      expect(tile?.x).toBeCloseTo(341, 0);
      expect(tile?.y).toBeCloseTo(163, 0);
    }
    if (state === "redup") {
      const choice = await page.locator(".t3-fidelity-appearance .colour-choice").last().boundingBox();
      expect(choice?.y).toBeCloseTo(347, 0);
      expect(choice?.height).toBeCloseTo(142, 0);
    }
    await shot(page, `appearance-${state}`);
    await expect(page.getByTestId("theme-preview-grid")).toBeVisible();
  });
}

for (const state of ["default", "zh", "zh-toast"] as const) {
  test(`language ${state} desktop fidelity`, async ({ page }) => {
    await designViewport(page, "language", state);
    await seedSettingsA(page, { page: "language", name: state });
    await page.goto("/#/settings/appearance?section=language");
    await expect(page.getByTestId("language-preview")).toBeVisible();
    if (state === "zh-toast") await page.getByRole("radio", { name: "简体中文" }).click();
    if (state === "zh-toast") {
      const toast = page.locator(".desktop-toast-viewport > li");
      await expect(toast).toContainText("已切换到简体中文");
      await expect.poll(async () => {
        const box = await toast.boundingBox();
        return box ? box.y + box.height : Infinity;
      }).toBeLessThan(1222);
    }
    await shot(page, `language-${state}`);
    await expect(page.getByTestId("language-preview")).toBeVisible();
  });
}

for (const state of ["default", "empty", "add-error", "undo"] as const) {
  test(`blacklist ${state} desktop fidelity`, async ({ page }) => {
    await designViewport(page, "blacklist", state);
    page.on("pageerror", (error) => console.error("Blacklist page error:", error.message));
    page.on("console", (message) => { if (message.type() === "error") console.error("Blacklist console:", message.text()); });
    await seedSettingsA(page, { page: "blacklist", name: state });
    await page.goto("/#/settings/data?section=blacklist");
    await expect(page.getByTestId("blacklist-table")).toBeVisible();
    if (state === "add-error") {
      await page.getByPlaceholder("Token symbol, for example SHIBAI").fill("ETHG");
      await page.getByRole("button", { name: "Hide token" }).click();
    }
    if (state === "undo") {
      await page.getByRole("button", { name: "Remove SHIBAI from blacklist" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Remove from blacklist" }).click();
      await expect(page.locator(".desktop-toast-viewport")).toContainText("Removed SHIBAI from the blacklist");
      await expect(page.locator(".desktop-toast-viewport")).toContainText("It will show up again after the next refresh.");
      const close = page.locator(".desktop-toast-viewport [toast-close]");
      await expect(close).toBeVisible();
      expect((await close.boundingBox())?.width).toBeGreaterThanOrEqual(44);
    }
    await shot(page, `blacklist-${state}`);
    await expect(page.getByTestId("blacklist-table")).toBeVisible();
  });
}
