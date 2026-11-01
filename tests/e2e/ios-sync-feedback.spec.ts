import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { ControlledS3, registerSyncFeedbackScenes } from "./sync-feedback-scenes";
import { installTauriBridge } from "./tauri-bridge";

registerSyncFeedbackScenes("mobile");

test("wide tablet Sync uses its detail width when no toast is open", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1133, height: 834 }, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  try {
    const page = await context.newPage();
    await installTauriBridge(page);
    await page.goto("/#/settings/sync");
    await expect(page.locator(".sync-settings-page")).toBeVisible();
    const detail = (await page.locator(".ios-d3-settings .mobile-split-detail:has(.sync-settings-page)").boundingBox())!;
    const sync = (await page.locator(".sync-settings-page").boundingBox())!;
    expect(sync.width).toBeGreaterThanOrEqual(detail.width * 0.8);
  } finally {
    await context.close();
  }
});

// These dimensions match the device presets in ios-wide.spec.ts.
const tabletViewports = [
  ["tablet-no-gutter-boundary", 1099, 800],
  ["tablet-gutter-boundary", 1100, 800],
  ["ipad-mini-landscape", 1133, 744],
  ["ipad-13-portrait", 1032, 1376],
  ["ipad-11-landscape", 1194, 834],
  ["ipad-13-landscape", 1376, 1032],
  ["ipad-mini-portrait", 744, 1133],
  ["ipad-11-portrait", 834, 1194],
  ["fold-spanned", 1114, 705],
  ["ipad-landscape-1180", 1180, 820],
  ["ipad-landscape-1366", 1366, 1024],
] as const;

async function captureToastWithoutCoveredControls(page: Page, name: string, phase: string) {
  const toast = page.locator(".ios-d3-toast-viewport > li[data-state=open]").last();
  await expect(toast).toBeVisible();
  await expect.poll(async () => {
    const rect = await toast.boundingBox();
    return !!rect && rect.x >= 0 && rect.x + rect.width <= page.viewportSize()!.width &&
      rect.y >= 0 && rect.y + rect.height <= page.viewportSize()!.height;
  }).toBe(true);
  const box = await toast.boundingBox();
  expect(box, `${name} ${phase}: toast is missing`).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  mkdirSync("test-results/mobile", { recursive: true });
  await page.screenshot({
    path: `test-results/mobile/sync-overlap-${name}-${phase}.png`,
    fullPage: true,
  });
  const overlaps = await toast.evaluate((node) => {
    const toastRect = node.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>(
      ".sync-settings-page button, .sync-settings-page input, .sync-settings-page [role=switch]",
    )].filter((control) => {
      const rect = control.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0 &&
        toastRect.left < rect.right && toastRect.right > rect.left &&
        toastRect.top < rect.bottom && toastRect.bottom > rect.top;
    }).map((control) => control.id || control.getAttribute("aria-label") || control.textContent?.trim());
  });
  expect(overlaps, `${name} ${phase}: toast covers controls`).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth),
    `${name} ${phase}: page clips horizontally`).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  const pageBox = (await page.locator(".sync-settings-page").boundingBox())!;
  expect(pageBox.x, `${name} ${phase}: page starts offscreen`).toBeGreaterThanOrEqual(0);
  expect(pageBox.x + pageBox.width, `${name} ${phase}: page ends offscreen`)
    .toBeLessThanOrEqual(page.viewportSize()!.width + 1);
}

for (const [name, width, height] of tabletViewports) {
  for (const locale of (["ipad-mini-portrait", "ipad-11-portrait", "ipad-13-portrait", "fold-spanned",
    "ipad-mini-landscape", "ipad-landscape-1366"].includes(name) ? ["en", "zh"] : ["en"])) {
  test(`${name} ${locale} Sync toast leaves controls usable after an error and completion`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: "reduce",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    try {
      await context.addInitScript((selectedLocale) => {
        localStorage.setItem("track3-ui-locale", selectedLocale);
      }, locale);
      const page = await context.newPage();
      const store = new ControlledS3();
      await installTauriBridge(page, store);
      await page.goto("/#/settings/sync");
      await expect(page.locator(".sync-settings-page")).toBeVisible();
      for (const [field, value] of Object.entries({
        endpoint: "https://s3.example.test", region: "us-east-1", bucket: "track3",
        accessKeyId: "key", secretAccessKey: "secret",
      })) await page.locator(`#sync-${field}`).fill(value);
      store.ignoreConditions = true;
      await page.getByRole("button", { name: locale === "en" ? "Test connection" : "测试连接" }).click();
      const toast = page.locator(".ios-d3-toast-viewport > li[data-state=open]").last();
      await expect(toast).toContainText(locale === "en" ? "conditional writes" : "条件写入");
      const finalSentence = locale === "en" ? "Multi-device sync needs this S3 feature." : "多设备同步需要此 S3 功能。";
      const visibleEnd = await toast.locator(".mobile-toast-copy > :last-child")
        .evaluate((node, sentence) => {
          const text = node.firstChild;
          if (!text || !text.textContent?.endsWith(sentence)) return false;
          const range = document.createRange();
          range.setStart(text, text.textContent.length - sentence.length);
          range.setEnd(text, text.textContent.length);
          return range.getBoundingClientRect().bottom <= node.getBoundingClientRect().bottom + 1;
        }, finalSentence);
      const shotName = `${name}-${locale}`;
      await captureToastWithoutCoveredControls(page, shotName, "connection-error");
      expect(visibleEnd, `${name} ${locale}: actionable error sentence is clipped`).toBe(true);
      const gutter = await page.locator(".ios-d3-settings .mobile-split-detail:has(.sync-settings-page)")
        .evaluate((node) => parseFloat(getComputedStyle(node).paddingRight));
      const toastWidth = (await toast.boundingBox())!.width;
      if (width >= 1100) {
        expect(toastWidth, `${name}: toast width`).toBeGreaterThanOrEqual(329);
        expect(gutter, `${name}: right gutter`).toBeGreaterThanOrEqual(toastWidth + 16);
        expect((await page.locator(".sync-settings-page").boundingBox())!.width,
          `${name}: Sync content width`).toBeGreaterThanOrEqual(500);
      } else {
        expect(gutter, `${name}: unexpected right gutter`).toBeLessThan(1);
      }

      store.ignoreConditions = false;
      await page.locator("#sync-passphrase").fill("correct horse battery staple");
      await page.locator("#sync-confirm").fill("correct horse battery staple");
      await page.getByRole("button", { name: locale === "en" ? "Enable sync" : "启用同步" }).click();
      const now = page.getByRole("button", { name: locale === "en" ? "Sync now" : "立即同步" });
      await expect(now).toBeEnabled({ timeout: 15000 });
      await now.click();
      await expect(toast).toContainText(locale === "en" ? "Sync complete" : "同步完成");
      const nameInput = page.getByRole("textbox", { name: locale === "en" ? /^Name for device / : /^设备 .* 的名称$/ });
      await expect(nameInput).toBeVisible();
      expect((await nameInput.boundingBox())!.width,
        `${name} ${locale}: device name input is too narrow`).toBeGreaterThanOrEqual(200);
      await captureToastWithoutCoveredControls(page, shotName, "sync-complete");
    } finally {
      await context.close();
    }
  });
  }
}
