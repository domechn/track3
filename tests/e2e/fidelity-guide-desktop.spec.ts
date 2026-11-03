import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

const output = "/tmp/fidelity-desktop/guide";
const steps = ["welcome", "sources", "history", "deeper", "backup"] as const;

test("Guide desktop captures all five real onboarding steps", async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "desktop");
  mkdirSync(output, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    colorScheme: "dark",
    reducedMotion: "reduce",
    timezoneId: "UTC",
  });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
    await installTauriBridge(page, { emptyPortfolio: true, onboarding: true });
    await page.goto("/#/overview");
    const dialog = page.getByTestId("onboarding-dialog");
    for (const [index, step] of steps.entries()) {
      await expect(dialog).toHaveAttribute("data-step", step);
      await expect(dialog).toHaveCSS("opacity", "1");
      await expect(dialog.locator(".ob-fidelity-eyebrow")).toHaveText(["Welcome to Track3", "Sources", "History", "Planning", "Backups"][index]);
      await expect(dialog.locator(".ob-fidelity-title")).toHaveText(["Your data stays on this device", "Add a source", "Every refresh is a snapshot", "Planning tools", "Back up your data"][index]);
      await page.screenshot({ path: `${output}/guide-${index + 1}-desktop.png`, fullPage: true, animations: "disabled" });
      if (index < steps.length - 1) await dialog.press("ArrowRight");
    }
  } finally {
    await context.close();
  }
});
