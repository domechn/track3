import { expect, test } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";
import { seedSettingsB, settingsBRoute } from "./fidelity-settings-b-scenes";

const notes = readFileSync("src/components/release-notes.fixture.md", "utf8");
const output = "/tmp/track3-release-notes";

for (const [size, width, height] of [["desktop", 1280, 800], ["phone", 390, 844], ["tablet", 834, 1112]] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`0.9.6 notes stay readable and scroll on ${size} in ${theme}`, async ({ browser }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop");
      test.setTimeout(120_000);
      mkdirSync(output, { recursive: true });
      const context = await browser.newContext({
        viewport: { width, height }, colorScheme: theme, reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage();
        await page.addInitScript(() => {
          const schedule = window.setTimeout;
          window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) =>
            schedule(handler, delay === 30_000 ? 300_000 : delay, ...args)) as typeof window.setTimeout;
        });
        await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
        await installTauriBridge(page, { appVersion: "0.9.5" });
        await page.addInitScript((body) => {
          const tauri = (window as any).__TAURI_INTERNALS__;
          const invoke = tauri.invoke;
          tauri.invoke = (cmd: string, args: any, options: unknown) => {
            if (cmd === "plugin:updater|check") {
              return Promise.resolve({ rid: 84, currentVersion: "0.9.5", version: "0.9.6", date: "2026-11-01", body });
            }
            if (cmd === "plugin:updater|download_and_install") {
              args.onEvent.onmessage({ event: "Started", data: { contentLength: 100 } });
              args.onEvent.onmessage({ event: "Progress", data: { chunkLength: 50 } });
              return new Promise((resolve, reject) => {
                (window as any).__finishDownload = (failed: boolean) =>
                  failed ? reject(new Error("local fixture connection reset")) : resolve(null);
              });
            }
            return invoke(cmd, args, options);
          };
        }, notes);
        await page.goto("/#/overview");
        await expect(page.getByRole("button", { name: "See what's new" })).toBeVisible();
        await page.getByRole("button", { name: "See what's new" }).click();
        const dialog = page.getByRole("dialog");
        const region = dialog.getByRole("region", { name: "Full release notes" });
        await expect(region.getByRole("heading", { name: "🎉 Features" })).toBeVisible();
        await expect(region.locator("ol > li").first()).toContainText("Every page now follows");
        const dimensions = await region.evaluate((element) => ({
          clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
        }));
        await page.screenshot({ path: `${output}/${size}-${theme}.png`, animations: "disabled" });
        expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
        const headerBefore = await dialog.getByRole("heading", { name: "Track3 0.9.6 is available" }).boundingBox();
        const buttonBefore = await dialog.getByRole("button", { name: "Download and install" }).boundingBox();
        await region.evaluate((element) => { element.scrollTop = element.scrollHeight; });
        await expect(region.getByRole("link", { name: /github\.com/ })).toBeVisible();
        const headerAfter = await dialog.getByRole("heading", { name: "Track3 0.9.6 is available" }).boundingBox();
        const buttonAfter = await dialog.getByRole("button", { name: "Download and install" }).boundingBox();
        expect(headerAfter?.y).toBe(headerBefore?.y);
        expect(buttonAfter?.y).toBe(buttonBefore?.y);
        await page.screenshot({ path: `${output}/${size}-${theme}-bottom.png`, animations: "disabled" });
        if (size === "desktop" && theme === "light") {
          await dialog.getByRole("button", { name: "Download and install" }).click();
          await expect(dialog.getByRole("progressbar")).toBeVisible();
          const percentColor = await dialog.locator(".t3-update-fidelity-progress-label span")
            .evaluate((element) => getComputedStyle(element).color);
          expect(Number(percentColor.match(/\d+/)?.[0])).toBeLessThan(110);
          const trackColor = await dialog.getByRole("progressbar").evaluate((element) => getComputedStyle(element).backgroundColor);
          expect(Number(trackColor.match(/\d+/)?.[0])).toBeGreaterThan(200);
          await page.screenshot({ path: `${output}/desktop-light-downloading.png`, animations: "disabled" });
          await page.evaluate(() => (window as any).__finishDownload(true));
          await expect(dialog.getByRole("heading", { name: "Update failed" })).toBeVisible();
          const errorStyle = await dialog.locator(".t3-update-fidelity-error").evaluate((element) => {
            const style = getComputedStyle(element);
            return { color: style.color, background: style.backgroundColor };
          });
          expect(Number(errorStyle.background.match(/\d+/)?.[0])).toBeGreaterThan(200);
          expect(Number(errorStyle.color.match(/\d+/)?.[0])).toBeLessThan(110);
          await page.screenshot({ path: `${output}/desktop-light-failed.png`, animations: "disabled" });
          await dialog.getByRole("button", { name: "Try again" }).click();
          await expect(dialog.getByRole("progressbar")).toBeVisible();
          await page.evaluate(() => (window as any).__finishDownload(false));
          await expect(dialog.getByRole("heading", { name: "Ready to restart" })).toBeVisible();
          const infoStyle = await dialog.locator(".t3-update-fidelity-info").evaluate((element) => {
            const style = getComputedStyle(element);
            return { color: style.color, background: style.backgroundColor };
          });
          expect(infoStyle.background).toMatch(/,\s*0\.1\)$/);
          expect(Number(infoStyle.color.match(/\d+/)?.[0])).toBeLessThan(110);
          await page.screenshot({ path: `${output}/desktop-light-ready.png`, animations: "disabled" });
        }
      } finally {
        await context.close();
      }
    });
  }
}

test("About keeps long release notes scrollable below its header and above its actions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  mkdirSync(output, { recursive: true });
  await page.setViewportSize({ width: 1600, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedSettingsB(page, "about", "update", "light");
  await page.goto(settingsBRoute.about);
  await page.evaluate((body) => {
    const invoke = (window as any).__e2eInvoke;
    (window as any).__e2eInvoke = (cmd: string, args: unknown, options: unknown) => cmd === "plugin:updater|check"
      ? Promise.resolve({ rid: 84, currentVersion: "0.9.4", version: "0.9.6", date: "2026-11-01", body })
      : invoke(cmd, args, options);
  }, notes);
  await page.getByTestId("about-check-updates").click();
  const dialog = page.getByRole("dialog");
  const region = dialog.getByRole("region", { name: "Full release notes" });
  await expect(region.getByRole("heading", { name: "🎉 Features" })).toBeVisible();
  expect(await region.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.screenshot({ path: `${output}/about-light.png`, animations: "disabled" });
  const headingBefore = await dialog.getByRole("heading", { name: "Track3 0.9.6 is available" }).boundingBox();
  const actionBefore = await dialog.getByRole("button", { name: "Download and install" }).boundingBox();
  await region.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(region.getByRole("link", { name: /github\.com/ })).toBeVisible();
  const headingAfter = await dialog.getByRole("heading", { name: "Track3 0.9.6 is available" }).boundingBox();
  const actionAfter = await dialog.getByRole("button", { name: "Download and install" }).boundingBox();
  expect(headingAfter?.y).toBe(headingBefore?.y);
  expect(actionAfter?.y).toBe(actionBefore?.y);
});
