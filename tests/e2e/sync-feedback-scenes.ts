import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { FakeS3, S3Error } from "../../src/middlelayers/sync/object-store";
import { installTauriBridge } from "./tauri-bridge";

class ControlledS3 extends FakeS3 {
  private held?: Promise<void>;
  private releaseHold?: () => void;
  failList = false;
  ignoreConditions = false;

  hold() { this.held = new Promise((resolve) => { this.releaseHold = resolve; }); }
  release() { this.releaseHold?.(); this.held = undefined; }

  override async listObjectsV2(...args: Parameters<FakeS3["listObjectsV2"]>) {
    await this.held;
    if (this.failList) throw new S3Error("private failure", 404);
    return super.listObjectsV2(...args);
  }

  override async putObject(...args: Parameters<FakeS3["putObject"]>) {
    return super.putObject(args[0], args[1], this.ignoreConditions ? {} : args[2], args[3]);
  }
}

const artifactDir = resolve("artifacts/sync-feedback");
mkdirSync(artifactDir, { recursive: true });

async function shot(page: Page, name: string) {
  if (!name.startsWith("mobile") && (name.includes("-now-success") || name.includes("-now-error"))) {
    await page.getByRole("button", { name: /^(Sync now|立即同步)$/ })
      .evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
  }
  const toast = page.locator(`${name.startsWith("mobile") ? ".ios-d3-toast-viewport" : ".desktop-toast-viewport"} > li[data-state=open]`).last();
  await expect(toast).toBeVisible();
  await page.waitForTimeout(250);
  await expect(toast.locator("svg").first()).toBeVisible();
  expect(await toast.getAttribute("data-sync-status")).toMatch(/^(pending|success|error)$/);
  await expect.poll(async () => {
    const position = await toast.boundingBox();
    return position ? position.y + position.height : Infinity;
  }).toBeLessThanOrEqual(page.viewportSize()!.height);
  const box = await toast.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(box!.height).toBeLessThanOrEqual(name.startsWith("mobile") || page.viewportSize()!.width <= 900 ? 240 : 181);
  expect(box!.width).toBeGreaterThanOrEqual(page.viewportSize()!.width === 320 ? 280
    : page.viewportSize()!.width <= 900 ? 220 : page.viewportSize()!.width < 1000 ? 270 : 300);
  const overlap = await toast.evaluate((node, mobile) => {
    const rect = node.getBoundingClientRect();
    const main = document.querySelector("#app-main-content")!.getBoundingClientRect();
    const controls = document.querySelectorAll(mobile
      ? ".sync-settings-page button[aria-busy=true]"
      : ".sync-settings-page button, .sync-settings-page input, .sync-settings-page [role=switch], .sync-settings-page [role=note]");
    for (const control of controls) {
      const target = control.getBoundingClientRect();
      if (target.top < Math.min(innerHeight, main.bottom) && target.bottom > main.top &&
        rect.left < target.right && rect.right > target.left &&
        rect.top < target.bottom && rect.bottom > target.top) {
        return { toast: rect.toJSON(), control: target.toJSON(), name: control.id || control.textContent };
      }
    }
    return null;
  }, name.startsWith("mobile"));
  expect(overlap, `${name}: toast overlaps a control`).toBeNull();
  if (name.endsWith("-long-error")) {
    const description = toast.locator("div.grid > :last-child");
    const extent = await description.evaluate((node) => ({
      height: node.clientHeight,
      scrollHeight: node.scrollHeight,
      overflow: getComputedStyle(node).overflowY,
      lineClamp: getComputedStyle(node).webkitLineClamp,
    }));
    expect(extent.height).toBeLessThanOrEqual(61);
    expect(extent.overflow).toBe("hidden");
    expect(extent.lineClamp).toBe("3");
    if (name.includes("-en-") || name.endsWith("-en-long-error")) {
      expect(extent.scrollHeight).toBeGreaterThan(extent.height);
    }
  }
  const readability = await toast.evaluate((node) => {
    const text = node.querySelector("div.grid");
    const description = text?.lastElementChild;
    const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const luminance = (value: number[]) => value.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const foreground = luminance(rgb(getComputedStyle(text!).color));
    const background = luminance(rgb(getComputedStyle(node).backgroundColor));
    return {
      title: text?.firstElementChild?.textContent?.trim(),
      fontSize: parseFloat(getComputedStyle(description!).fontSize),
      contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
    };
  });
  expect(readability.title).toBeTruthy();
  expect(readability.fontSize).toBeGreaterThanOrEqual(14);
  expect(readability.contrast).toBeGreaterThanOrEqual(4.5);
  const close = toast.locator("[toast-close]");
  await expect(close).toBeVisible();
  const closeBox = await close.boundingBox();
  expect(closeBox!.height).toBeGreaterThanOrEqual(43.9);
  if (name.startsWith("mobile")) {
    const tab = await page.locator(".mobile-tab-bar").boundingBox();
    const bar = await page.locator("#app-top-bar").boundingBox();
    expect(tab).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(tab!.y + 1);
    expect(box!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height);
    const action = page.getByRole("button", { name: name.includes("-test-")
      ? /^(Test connection|测试连接|Testing…|正在测试…)$/ : /^(Sync now|立即同步|Syncing…|正在同步…)$/ });
    if (!name.endsWith("-long-error")) {
      const actionBox = await action.boundingBox();
      expect(actionBox).not.toBeNull();
      expect(actionBox!.y, `${name}: tapped button above viewport`).toBeGreaterThanOrEqual(bar!.y + bar!.height);
      expect(actionBox!.y + actionBox!.height, `${name}: tapped button behind tab bar`).toBeLessThanOrEqual(tab!.y);
      expect(actionBox!.y, `${name}: tapped button behind toast`).toBeGreaterThanOrEqual(box!.y + box!.height + 8);
    }
    expect(await page.locator("#app-main-content").evaluate((node) => getComputedStyle(node).translate)).toBe("none");
  } else {
    expect(box!.x).toBeGreaterThanOrEqual(page.viewportSize()!.width - 390);
    expect(box!.y).toBeGreaterThan(page.viewportSize()!.height / 2);
  }
  if (name.includes("-now-") && name.startsWith("mobile")) {
    const pill = await page.locator(".ios-d3-sync-indicator button[aria-label]").boundingBox();
    const disable = await page.getByRole("button", { name: /Disable sync|停用同步/ }).boundingBox();
    if (pill && disable) {
      expect(pill.x < disable.x + disable.width && pill.x + pill.width > disable.x &&
        pill.y < disable.y + disable.height && pill.y + pill.height > disable.y).toBe(false);
    }
  }
  if ((name.includes("-now-") || name.includes("-collapsed-")) && !name.startsWith("mobile")) {
    const pill = await page.locator(".desktop-sync-status-indicator button[aria-label]").boundingBox();
    const collapse = await page.getByRole("button", { name: /Collapse sidebar|Expand sidebar|收起侧边栏|展开侧边栏/ }).boundingBox();
    expect(pill).not.toBeNull();
    expect(collapse).not.toBeNull();
    expect(pill!.x < collapse!.x + collapse!.width && pill!.x + pill!.width > collapse!.x &&
      pill!.y < collapse!.y + collapse!.height && pill!.y + pill!.height > collapse!.y).toBe(false);
    const uploadLocator = page.locator(".sync-device-last-upload").first();
    const upload = await uploadLocator.count() ? await uploadLocator.boundingBox() : null;
    if (pill && upload) {
      expect(pill.x < upload.x + upload.width && pill.x + pill.width > upload.x &&
        pill.y < upload.y + upload.height && pill.y + pill.height > upload.y).toBe(false);
    }
  }
  if (!name.includes("-pending")) await expect.poll(async () => {
    const button = page.locator(".sync-settings-page button[aria-busy=true]");
    return button.count();
  }).toBe(0);
  if (name.includes("-now-success") || name.includes("-now-error")) {
    const now = page.getByRole("button", { name: /^(Sync now|立即同步)$/ });
    const action = await now.boundingBox();
    expect(action!.y).toBeGreaterThanOrEqual(48);
    expect(action!.y + action!.height).toBeLessThanOrEqual(page.viewportSize()!.height - 16);
  }
  await page.screenshot({ path: resolve(artifactDir, `${name}.png`) });
}

export function registerSyncFeedbackScenes(platform: "desktop" | "mobile") {
  for (const theme of ["light", "dark"] as const) {
    for (const locale of ["en", "zh"] as const) {
      for (const width of platform === "mobile" ? [390, 320] : locale === "en" ? [1280, 1024, 901, 768] : [1280, 768]) {
      test(`${platform} Sync feedback ${theme} ${locale} ${width}`, async ({ browser }) => {
        test.setTimeout(120_000);
        const mobile = platform === "mobile";
        const context = await browser.newContext({
          viewport: mobile ? { width, height: 844 } : { width, height: 800 },
          colorScheme: theme,
          ...(mobile ? {
            isMobile: true,
            hasTouch: true,
            userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          } : {}),
        });
        try {
          await context.addInitScript(({ theme, locale }) => {
            localStorage.setItem("track3-ui-theme", theme);
            localStorage.setItem("track3-ui-locale", locale);
          }, { theme, locale });
          const page = await context.newPage();
          const store = new ControlledS3();
          await installTauriBridge(page, store);
          await page.goto("/#/settings/sync");
          for (const [field, value] of Object.entries({
            endpoint: "https://s3.example.test", region: "us-east-1", bucket: "track3",
            accessKeyId: "key", secretAccessKey: "secret",
          })) await page.locator(`#sync-${field}`).fill(value);
          const testButton = page.getByRole("button", { name: locale === "en" ? "Test connection" : "测试连接" });
          const testWidth = (await testButton.boundingBox())!.width;
          const toast = page.locator(mobile ? ".ios-d3-toast-viewport" : ".desktop-toast-viewport");
          const prefix = `${platform}-${theme}-${locale}${width === 1280 || (mobile && width === 390) ? "" : `-${width}`}`;
          if (mobile) {
            expect((await testButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
            expect((await page.locator("#sync-path-style").boundingBox())!.height).toBeGreaterThanOrEqual(44);
            expect(await testButton.locator("> span").evaluate((node) => getComputedStyle(node).backgroundColor))
              .toBe("rgba(0, 0, 0, 0)");
          }

          store.hold();
          await testButton.click();
          expect(Math.abs((await page.locator(".sync-settings-page button[aria-busy=true]").boundingBox())!.width - testWidth))
            .toBeLessThan(1);
          if (platform === "desktop" && theme === "light" && locale === "en") {
            await page.waitForTimeout(4200);
            await expect(toast.locator("> li[data-state=open]")).toContainText("Testing…");
          }
          await shotPending(page, `${prefix}-test-pending`);
          store.release();
          await expect(toast.locator("> li[data-state=open]")).toContainText(locale === "en" ? "Connection OK" : "连接正常");
          await shot(page, `${prefix}-test-success`);

          store.ignoreConditions = true;
          await testButton.click();
          await expect(toast.locator("> li[data-state=open]")).toContainText(locale === "en" ? "conditional writes" : "条件写入");
          await shot(page, `${prefix}-test-error`);
          store.ignoreConditions = false;

          await page.locator("#sync-passphrase").fill("correct horse battery staple");
          await page.locator("#sync-confirm").fill("correct horse battery staple");
          await page.getByRole("button", { name: locale === "en" ? "Enable sync" : "启用同步" }).click();
          const now = page.getByRole("button", { name: locale === "en" ? "Sync now" : "立即同步" });
          await expect(now).toBeEnabled({ timeout: 15000 });
          await expect(page.getByRole("button", { name: locale === "en" ? "Sync idle" : "同步空闲" })).toBeVisible({ timeout: 15000 });

          const nowWidth = (await now.boundingBox())!.width;
          const nowBackground = await now.evaluate((node) => getComputedStyle(node).backgroundColor);
          store.hold();
          await now.click();
          const syncingButton = page.locator(".sync-settings-page button[aria-busy=true]");
          await expect(syncingButton).toHaveCount(1);
          await expect.poll(() => syncingButton.evaluate((node) => getComputedStyle(node).backgroundColor))
            .not.toBe(nowBackground);
          expect(Math.abs((await syncingButton.boundingBox())!.width - nowWidth))
            .toBeLessThan(1);
          await shotPending(page, `${prefix}-now-pending`);
          store.release();
          await expect(toast.locator("> li[data-state=open]")).toContainText(locale === "en" ? "Sync complete" : "同步完成");
          await expect(toast.locator("> li[data-state=open]")).toContainText(locale === "en" ? "Pushed 5" : "已推送 5 项");
          await shot(page, `${prefix}-now-success`);

          store.failList = true;
          await now.click();
          await expect(toast.locator("> li[data-state=open]")).toContainText(locale === "en" ? "Bucket not found." : "存储桶");
          await shot(page, `${prefix}-now-error`);

          await page.evaluate(async ({ mobile, locale }) => {
            const long = locale === "en"
              ? "The sync store did not finish the request. Check your bucket permissions, S3 endpoint, network connection, and the account that owns this bucket before trying again."
              : "同步存储未完成请求。请检查存储桶权限、S3 端点、网络连接以及拥有此存储桶的账户，然后重试。";
            const modulePath = mobile
              ? "/src/mobile/components/ui/use-toast.ts"
              : "/src/components/ui/use-toast.ts";
            const { toast } = await import(/* @vite-ignore */ modulePath);
            toast({ title: locale === "en" ? "Sync failed" : "同步失败", description: long,
              variant: "destructive", syncStatus: "error", duration: 8000 });
          }, { mobile, locale });
          await shot(page, `${prefix}-long-error`);
          if (!mobile) {
            await page.getByRole("button", { name: /Collapse sidebar|收起侧边栏/ }).click();
            await page.waitForTimeout(350);
            await shot(page, `${prefix}-collapsed-long-error`);
          }
          await toast.locator("> li[data-state=open] [toast-close]").click();
          await expect(toast.locator("> li[data-state=open]")).toHaveCount(0);
        } finally {
          await context.close();
        }
      });
      }
    }
  }
}

async function shotPending(page: Page, name: string) {
  const label = name.includes("-test-") ? /Testing|正在测试/ : /Syncing|正在同步/;
  const button = page.locator(".sync-settings-page button[aria-busy=true]");
  await expect(button).toHaveCount(1);
  await expect(button).toHaveText(label);
  await expect(button).toBeVisible();
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("aria-busy", "true");
  if (!name.startsWith("mobile") && page.viewportSize()!.width <= 900) {
    const buttonBox = await button.boundingBox();
    const mainBox = await page.locator("#app-main-content").boundingBox();
    expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(mainBox!.y + mainBox!.height);
  }
  const toast = page.locator(`${name.startsWith("mobile") ? ".ios-d3-toast-viewport" : ".desktop-toast-viewport"} > li[data-state=open]`);
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveAttribute("data-sync-status", "pending");
  if (name.includes("-now-")) {
    await expect(page.getByRole("button", { name: /Disable sync|停用同步/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Forget remote data|删除远程数据/ }).first()).toBeDisabled();
    await expect(page.locator(".sync-settings-page > [role=status]")).toHaveCount(0);
  }
  await shot(page, name);
}
