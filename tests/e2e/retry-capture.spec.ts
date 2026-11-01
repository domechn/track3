import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

const output = "/tmp/track3-p3-screenshots";
const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("capture retry settings, wallet status and source sheet in both themes", async ({ browser }) => {
  test.skip(process.env.TRACK3_CAPTURE !== "1");
  test.setTimeout(180_000);
  mkdirSync(output, { recursive: true });
  for (const [name, width, height, mobile] of [
    ["desktop-1440", 1440, 900, false], ["desktop-1024", 1024, 768, false],
    ["phone-390", 390, 844, true], ["tablet-834", 834, 1194, true],
  ] as const) for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme,
      reducedMotion: "reduce", ...(mobile ? { userAgent: iPhoneUserAgent, hasTouch: true, isMobile: true } : {}) });
    const page = await context.newPage();
    await page.addInitScript(({ theme }) => {
      localStorage.setItem("track3-ui-theme", theme);
      localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([
        { sourceId: "btc:0", label: "BTC wallet 1", status: "failed", category: "network",
          finishedAt: new Date().toISOString(), lastSuccessAt: new Date(Date.now() - 3_600_000).toISOString() },
      ]));
    }, { theme });
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/settings/configuration?section=sources");
    await expect(page.getByRole("switch", { name: "Retry failed sources automatically" })).toBeVisible();
    await page.screenshot({ path: `${output}/${name}-${theme}-settings.png`, animations: "disabled" });

    await page.goto("/#/wallets");
    await page.evaluate(async () => {
      const modulePath = "/src/middlelayers/refresh-retry-scheduler.ts";
      const { refreshRetryScheduler } = await import(modulePath) as { refreshRetryScheduler: { complete: (statuses: { sourceId: string; label: string; status: "failed"; category: "network"; finishedAt: string }[]) => void } };
      refreshRetryScheduler.complete([{ sourceId: "btc:0", label: "BTC wallet 1", status: "failed", category: "network",
        finishedAt: new Date().toISOString() }]);
    });
    await expect(page.getByText(/Next automatic try at/)).toBeVisible();
    await expect(page.locator(".analyze-wallets")).toHaveAttribute("aria-busy", "false");
    await page.screenshot({ path: `${output}/${name}-${theme}-wallets.png`, animations: "disabled" });

    await page.goto("/#/overview");
    await expect(page.getByRole("heading", { name: "Overview" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Source status" }).click();
    await expect(page.getByRole("alertdialog", { name: "Source status" })).toBeVisible();
    await page.screenshot({ path: `${output}/${name}-${theme}-status.png`, animations: "disabled" });
    await page.evaluate(async () => {
      const modulePath = "/src/middlelayers/refresh-retry-scheduler.ts";
      const { refreshRetryScheduler } = await import(modulePath) as { refreshRetryScheduler: { stop: () => void } };
      refreshRetryScheduler.stop();
    });
    await expect(page.getByRole("button", { name: "Run full refresh" })).toBeVisible();
    await page.screenshot({ path: `${output}/${name}-${theme}-status-stopped.png`, animations: "disabled" });
    await context.close();
  }
});
