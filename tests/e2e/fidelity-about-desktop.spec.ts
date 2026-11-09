import { expect, test } from "@playwright/test";
import { seedSettingsB, settingsBRoute, settingsBShot } from "./fidelity-settings-b-scenes";

test.use({ viewport: { width: 1600, height: 777 }, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });

for (const state of ["default", "checking", "check-error", "downloading", "guide", "later", "ready", "toast-ok", "update"] as const) {
  test(`About ${state} desktop fidelity`, async ({ page }) => {
    await seedSettingsB(page, "about", state);
    await page.goto(settingsBRoute.about);
    await expect(page.getByText("Help and links", { exact: true })).toBeVisible();
    if (state === "guide") {
      await page.getByTestId("onboarding-replay").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("dialog")).toContainText("You will see the 5 setup steps again: sources, refresh, Pro, sync and the assistant.");
      await expect(page.getByRole("dialog")).toHaveCSS("width", "576px");
      await expect(page.getByRole("dialog").getByRole("button", { name: "Close" })).toBeHidden();
    } else if (state !== "default") {
      await page.evaluate((scenario) => {
        const original = (window as any).__e2eInvoke;
        (window as any).__e2eInvoke = async (command: string, args: unknown, options: unknown) => {
          if (command === "plugin:updater|check") {
            if (scenario === "checking") return new Promise(() => {});
            if (scenario === "check-error") throw new Error("Update server unavailable");
            if (scenario === "toast-ok") return null;
            return {
              rid: 44, currentVersion: "0.9.4", version: "0.9.5",
              date: "2026-10-30T00:00:00Z",
              body: "New\n- Sync status shows phase timings, request counters and a Copy diagnostics button.\n- Import lists every conflict so you pick per item what to keep.\nImproved\n- ERC20 wallet refreshes finish faster for wallets with many tokens.\n- Assistant replies stream while tools run.\nFixed\n- Goals and alerts cooldown now follows the selected window.\n- History keeps your page after you delete a snapshot.",
              rawJson: {},
            };
          }
          if (command === "plugin:updater|download") {
            if (scenario === "downloading") return new Promise(() => {});
            return 45;
          }
          if (command === "plugin:updater|install") return null;
          return original(command, args, options);
        };
      }, state);
      await page.getByTestId("about-check-updates").click();
      if (["update", "downloading", "ready", "later"].includes(state)) {
        await expect(page.getByRole("dialog")).toBeVisible();
        if (state === "update") {
          await expect(page.locator(".t3-b-about-update-dialog > button.absolute")).toBeHidden();
          await expect(page.getByRole("dialog").getByRole("button", { name: "Download and install" })).toBeVisible();
        }
        await expect(page.getByRole("dialog").getByText("Sync status shows phase timings, request counters and a Copy diagnostics button.")).toBeVisible();
        await expect(page.getByRole("dialog").getByText("Released 30 Oct 2026", { exact: false })).toBeVisible();
        if (state === "later") {
          await page.getByRole("dialog").getByRole("button", { name: "Remind me later" }).click();
          await expect(page.getByRole("dialog")).toBeHidden();
        }
        if (state === "downloading" || state === "ready") {
          await page.getByRole("dialog").getByRole("button", { name: "Download and install" }).click();
          if (state === "ready") {
            await expect(page.getByRole("dialog", { name: "Ready to restart" })).toBeVisible();
          } else {
            await expect(page.getByRole("dialog", { name: "Downloading Track3 0.9.5" }).getByRole("progressbar")).toBeVisible();
          }
        }
      }
      if (state === "checking") await expect(page.getByRole("button", { name: /Checking/ })).toBeVisible();
      if (state === "check-error") await expect(page.getByText("Could not reach the update server.", { exact: true })).toBeVisible();
      if (state === "toast-ok") {
        await expect(page.locator(".desktop-toast-viewport")).toContainText("You are on the latest version, 0.9.4.");
        const toast = await page.locator(".desktop-toast-viewport > li").boundingBox();
        expect(toast?.width).toBe(368);
      }
    }
    await settingsBShot(page, "about", state);
  });
}
