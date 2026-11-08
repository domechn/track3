import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";
import { expectFocusRing, expectOverlayTheme } from "./overlay-theme-scenes";

const output = "/tmp/track3-overlay-theme";
const themes = [
  { stored: "light", scheme: "light" },
  { stored: "dark", scheme: "dark" },
  { stored: "system", scheme: "light" },
] as const;

for (const [device, width, height] of [["phone", 390, 844], ["ipad", 820, 1112]] as const) {
  for (const { stored, scheme } of themes) {
    test(`${device} overlays follow ${stored} with ${scheme} preference`, async ({ browser }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile");
      test.setTimeout(90_000);
      mkdirSync(output, { recursive: true });
      const context = await browser.newContext({
        viewport: { width, height }, colorScheme: scheme, reducedMotion: "reduce",
        userAgent: device === "phone"
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
          : "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        isMobile: true, hasTouch: true,
      });
      try {
        const page = await context.newPage();
        await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), stored);
        const bridge = await installTauriBridge(page, { seedLockedSync: true });
        bridge.setImportFile("{}");
        await page.goto("/#/overview");
        const locked = page.getByRole("dialog", { name: "Sync is locked" });
        await expect(locked).toBeVisible({ timeout: 20_000 });
        const lockedContrast = await expectOverlayTheme(locked, locked.getByRole("button", { name: /^Unlock( sync)?$/ }), "16px");
        await expect(locked.getByRole("button", { name: "Continue without sync" }))
          .toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
        await expectFocusRing(locked.getByLabel("Sync passphrase"));
        if (device === "phone") {
          if (stored === "light") {
            const selected = page.locator(".fd-overview-range-row .fd-range button[aria-checked='true']");
            await expect(selected).toBeVisible();
            const { selectedColor, token } = await selected.evaluate((node) => {
              const probe = document.createElement("span");
              probe.style.background = "hsl(var(--secondary))";
              node.append(probe);
              const token = getComputedStyle(probe).backgroundColor;
              probe.remove();
              return { selectedColor: getComputedStyle(node, "::before").backgroundColor, token };
            });
            expect(selectedColor).toBe(token);
          }
          expect(await page.evaluate(() => {
            const style = getComputedStyle(document.body, "::before");
            return { position: style.position, inset: [style.top, style.right, style.bottom, style.left],
              background: style.backgroundColor, zIndex: style.zIndex };
          })).toEqual({
            position: "fixed", inset: ["0px", "0px", "0px", "0px"],
            background: "rgba(0, 0, 0, 0.55)", zIndex: "90",
          });
        }
        if (device === "ipad") {
          const panel = await locked.boundingBox();
          const forgot = await locked.getByRole("button", { name: "Forgot the passphrase?" }).boundingBox();
          const unlock = await locked.getByRole("button", { name: /^Unlock( sync)?$/ }).boundingBox();
          expect(Math.abs(panel!.x + panel!.width / 2 - width / 2)).toBeLessThanOrEqual(2);
          expect(Math.abs(panel!.y + panel!.height / 2 - height / 2)).toBeLessThanOrEqual(2);
          expect(forgot!.y + forgot!.height).toBeLessThanOrEqual(unlock!.y);
          const scrim = await page.evaluate(() => getComputedStyle(document.body, "::before").backgroundColor);
          expect(scrim).not.toBe("rgba(0, 0, 0, 0)");
        }
        await page.screenshot({ path: `${output}/${device}-${stored}-locked.png`, animations: "disabled" });
        await locked.getByRole("button", { name: "Use recovery file" }).click();
        await locked.getByRole("button", { name: "Choose .t3key file" }).click();
        await expect(locked.getByLabel("Recovery file passphrase")).toBeVisible();
        await expectOverlayTheme(locked, locked.getByRole("button", { name: /^Unlock( sync)?$/ }), "16px");
        await page.screenshot({ path: `${output}/${device}-${stored}-recovery.png`, animations: "disabled" });
        if (stored === "system") {
          await page.emulateMedia({ colorScheme: "dark" });
          await expect(page.locator("html")).toHaveClass(/dark/);
          await expectOverlayTheme(locked, locked.getByRole("button", { name: /^Unlock( sync)?$/ }), "16px");
          await page.screenshot({ path: `${output}/${device}-system-dark-recovery.png`, animations: "disabled" });
          await page.emulateMedia({ colorScheme: "light" });
        }
        await page.keyboard.press("Escape");
        await expect(locked).toHaveCount(0);
        if (device === "phone") {
          await expect(page.locator(".fd-overview, .fd-partial-overview").first()).toBeVisible();
        }
        await page.evaluate(async () => {
          const moduleUrl: string = "/src/mobile/components/ui/use-toast.ts";
          const { toast } = await import(moduleUrl);
          toast({ title: "Theme toast" });
        });
        const toast = page.locator(".ios-d3-toast-viewport .mobile-toast").first();
        await expect(toast).toBeVisible();
        await expectOverlayTheme(toast, undefined, "--radius", device === "phone" ? "--popover" : "--raised");
        await page.screenshot({ path: `${output}/${device}-${stored}-toast.png`, animations: "disabled" });
        if (device === "phone" && stored === "light") {
          await page.goto("/#/settings/sync");
          const status = page.locator(".fidelity-b-sync .t3-sync-status");
          await expect(status).toBeVisible();
          await expect(status).toHaveCSS("background-color", "rgb(255, 255, 255)");
          await expect(status.locator(".t3-sync-status-rows > div").first())
            .toHaveCSS("border-top-color", "rgb(212, 212, 216)");
          await expect(status.locator("button")).toHaveCSS("color", "rgb(83, 83, 90)");
          await expect(page.locator('label[for="sync-passphrase"]'))
            .toHaveCSS("color", "rgb(23, 23, 28)");
          await expect(page.locator(".fidelity-b-sync .t3-sync-connection input").first())
            .toHaveCSS("background-color", "rgb(244, 244, 246)");
        }
        console.log(`${device} ${stored}: locked ${lockedContrast.textContrast.toFixed(2)}:1, action ${lockedContrast.actionContrast?.toFixed(2)}:1`);
      } finally {
        await context.close();
      }
    });
  }
}
