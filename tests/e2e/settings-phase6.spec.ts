import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test("desktop Settings menu opens focused source and currency sections", async ({ page }) => {
  await installTauriBridge(page, { appVersion: "0.9.15" });
  await page.goto("/#/settings/configuration");
  await expect(page).toHaveURL(/#\/settings\/configuration\?section=sources$/);
  await expect(page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "About 0.9.15" })).toBeVisible();
  await expect(page.locator(".t3-settings-source-tabs")).toBeVisible();
  await expect(page.getByRole("heading", { name: "General", exact: true })).toHaveCount(0);
  await expect(page.evaluate(() =>
    (window as any).__e2eInvoke(["download", "coins", "logos"].join("_"), { coins: [] })))
    .rejects.toThrow("Unhandled Tauri command");

  await page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Currency & display" }).click();
  await expect(page.getByRole("heading", { name: "General", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Exchanges", exact: true })).toHaveCount(0);

  await page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Data sources" }).click();
  await expect(page.locator(".t3-settings-source-tabs").getByRole("button", { name: /^Exchanges \d+$/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "General", exact: true })).toHaveCount(0);
});

test("desktop Settings keeps backup, blacklist, security, appearance, and About distinct", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/settings/data?section=backup");
  await expect(page.getByRole("heading", { name: "Import Data", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Token Blacklist", exact: true })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Blacklist" }).click();
  await expect(page.getByRole("heading", { name: "Token Blacklist", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import Data", exact: true })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Security" }).click();
  await expect(page.getByRole("heading", { name: "Encryption Key", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Token Blacklist", exact: true })).toHaveCount(0);

  await page.goto("/#/settings/appearance?section=language");
  await expect(page.getByRole("heading", { name: "Language", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Theme", exact: true })).toHaveCount(0);
  await page.goto("/#/settings/appearance?section=theme");
  await expect(page.getByRole("heading", { name: "Theme", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "System" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "English" })).toHaveCount(0);

  await page.goto("/#/settings/systemInfo?section=about");
  await expect(page.getByRole("button", { name: "Replay guide" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Track3 Free" })).toHaveCount(0);
  const versionCard = page.locator(".t3-about-version");
  const guideCard = page.locator(".t3-about-guide");
  await expect(versionCard).toBeVisible();
  await expect(guideCard).toBeVisible();
  expect(Math.abs((await versionCard.boundingBox())!.y - (await guideCard.boundingBox())!.y)).toBeLessThan(4);
});

test("About offers an in-app update beside the release link in light and dark", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    if (!localStorage.getItem("track3-ui-theme")) localStorage.setItem("track3-ui-theme", "light");
  });
  await installTauriBridge(page, { appVersion: "0.9.14" });
  for (const theme of ["light", "dark"] as const) {
    if (theme === "dark") {
      await page.evaluate(() => localStorage.setItem("track3-ui-theme", "dark"));
      await page.reload();
    } else {
      await page.goto("/#/settings/systemInfo?section=about");
    }
    await expect(page.locator(".t3-about-version")).toBeVisible();
    await page.evaluate(() => {
      const original = (window as any).__e2eInvoke;
      (window as any).__updateDownloads = 0;
      (window as any).__e2eInvoke = (command: string, args: unknown, options: unknown) => {
        if (command === "plugin:updater|check") return Promise.resolve({
          rid: 44, currentVersion: "0.9.14", version: "0.9.15", date: "", body: "", rawJson: {},
        });
        if (command === "plugin:updater|download") {
          (window as any).__updateDownloads++;
          return new Promise(() => {});
        }
        return original(command, args, options);
      };
    });
    const card = page.locator(".t3-about-version");
    await card.getByRole("button", { name: "Check for updates" }).click();
    const update = card.getByRole("button", { name: "Update now" });
    await expect(update).toBeVisible();
    const row = update.locator("..");
    await expect(row.getByRole("button")).toHaveText(["Update now", "Check for updates", "Release notes"]);
    const bounds = await row.getByRole("button").evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right };
      }));
    expect(bounds.every((button) => Math.abs(button.top - bounds[0].top) < 2)).toBe(true);
    expect(bounds[2].right).toBeLessThanOrEqual((await card.boundingBox())!.x + (await card.boundingBox())!.width);
    await page.screenshot({ path: `/tmp/track3-about-update-now-${theme}.png`, animations: "disabled" });
    await update.click();
    await expect(page.getByRole("dialog", { name: "Downloading Track3 0.9.15" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Downloading...", includeHidden: true })).toBeDisabled();
    expect(await page.evaluate(() => (window as any).__updateDownloads)).toBe(1);
  }
});

test("desktop Sync and AI use the approved two column card layout", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriBridge(page);
  await page.goto("/#/settings/sync");
  await expect(page.getByRole("heading", { name: "Backup & sync" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connection" })).toBeVisible();
  const connection = page.locator(".t3-sync-connection");
  const passphrase = page.locator(".t3-sync-passphrase");
  await expect(connection).toBeVisible();
  await expect(passphrase).toBeVisible();
  await expect.poll(async () =>
    Math.abs((await connection.boundingBox())!.y - (await passphrase.boundingBox())!.y)).toBeLessThan(4);

  await page.goto("/#/settings/assistant");
  const endpoint = page.locator("[data-ui-card]").filter({ has: page.locator("#assistant-endpoint") });
  const key = page.locator("[data-ui-card]").filter({ has: page.locator("#assistant-api-key") });
  await expect(endpoint).toBeVisible();
  await expect.poll(async () =>
    Math.abs((await endpoint.boundingBox())!.y - (await key.boundingBox())!.y)).toBeLessThan(4);
});

test("desktop Sync uses the available width when no toast is open", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await installTauriBridge(page);
  await page.goto("/#/settings/sync");
  await expect(page.locator(".t3-sync-connection")).toBeVisible();
  const content = (await page.locator(".t3-settings-content").boundingBox())!;
  const sync = (await page.locator(".sync-settings-page").boundingBox())!;
  expect(sync.width).toBeGreaterThanOrEqual(content.width * 0.85);
});

test("dark mode still shows a light surface in the Light theme preview", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installTauriBridge(page);
  await page.goto("/#/settings/appearance?section=theme");
  const color = await page.locator('label[for="light"] > div').evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(color).toBe("rgb(245, 246, 248)");
});

test("desktop language settings show the current appearance summary", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/settings/appearance?section=language");
  await expect(page.getByRole("heading", { name: "Current Theme" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Language", exact: true }).last()).toBeVisible();
  await expect(page.getByText("Affects all visible text in the app.")).toBeVisible();
});

test("system preview surfaces follow theme background tokens", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/settings/appearance?section=theme");
  const halves = page.locator('label[for="system"] .flex > div');
  await halves.first().evaluate((node) => (node as HTMLElement).style.setProperty("--background", "0 100% 50%"));
  await halves.last().evaluate((node) => (node as HTMLElement).style.setProperty("--background", "120 100% 50%"));
  expect(await halves.first().evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgb(255, 0, 0)");
  expect(await halves.last().evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgb(0, 255, 0)");
});

test("dark preview surfaces follow theme background tokens", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/settings/appearance?section=theme");
  const surface = page.locator('label[for="dark"] > div > div');
  await surface.evaluate((node) => (node as HTMLElement).style.setProperty("--background", "0 100% 50%"));
  expect(await surface.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgb(255, 0, 0)");
});

test("desktop source editor uses a readable vertical form", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/settings/configuration?section=sources");
  await page.getByRole("button", { name: "Add Exchange Configuration" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Exchange Configuration" });
  await expect(dialog).toBeVisible();
  expect((await dialog.boundingBox())!.width).toBeGreaterThanOrEqual(500);
  const label = (await dialog.locator('label[for="apiKey"]').boundingBox())!;
  const input = (await dialog.locator("#apiKey").boundingBox())!;
  expect(input.y).toBeGreaterThanOrEqual(label.y + label.height);
});

test("desktop source selector shows counts and its selected section", async ({ page }) => {
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/settings/configuration?section=sources");
  await expect(page.getByText(/^Everything Track3 reads: \d+ sources\.$/)).toBeVisible();
  const selector = page.getByRole("group", { name: "Data sources" });
  const wallets = selector.getByRole("button", { name: /^Wallets \d+$/ });
  await expect(wallets).toHaveAttribute("aria-pressed", "false");
  await wallets.click();
  await expect(wallets).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Wallet", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Exchanges", exact: true })).toHaveCount(0);
});

test("narrow desktop Settings keeps its menu above the content in one row", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await installTauriBridge(page);
  await page.goto("/#/settings/sync");
  const menu = page.getByRole("navigation", { name: "Settings sections" });
  await expect(menu).toBeVisible();
  const menuBounds = (await menu.boundingBox())!;
  const contentBounds = (await page.locator(".t3-settings-content").boundingBox())!;
  expect(menuBounds.height).toBeLessThanOrEqual(60);
  expect(contentBounds.y).toBeLessThanOrEqual(menuBounds.y + 80);
});

test("source actions remain inside their card at 1024px", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/settings/configuration?section=sources");
  const card = (await page.locator(".t3-settings-content [data-ui-card]").last().boundingBox())!;
  const action = (await page.locator(".t3-settings-content table.table-fixed tbody tr").first().locator("td").last().boundingBox())!;
  expect(action.x + action.width).toBeLessThanOrEqual(card.x + card.width - 8);
});

test("desktop guide leaves a backdrop while retaining its five stored steps", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("track3-onboarding-v1", "completed"));
  await installTauriBridge(page);
  await page.goto("/#/settings/systemInfo?section=about");
  await page.getByRole("button", { name: "Replay guide" }).click();
  const guide = page.getByTestId("onboarding-dialog");
  await expect(guide).toBeVisible();
  const bounds = (await guide.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(16);
  expect(bounds.y).toBeGreaterThanOrEqual(16);
  expect(bounds.width).toBeGreaterThanOrEqual(1400);
  expect(bounds.height).toBeGreaterThanOrEqual(860);
  await expect(page.getByTestId("onboarding-progress").locator("span")).toHaveCount(5);
});

test("desktop sync details use the approved wide card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriBridge(page, { seedLockedSync: true });
  await page.goto("/#/overview");
  const card = page.getByRole("dialog");
  await expect(card).toBeVisible();
  expect((await card.boundingBox())!.width).toBeGreaterThanOrEqual(440);
});
