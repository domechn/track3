import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { installPlanFidelityScene } from "./plan-fidelity-scenes";

const output = process.env.WUI18_CAPTURE_DIR ?? "/tmp/fidelity-desktop/goals";

for (const state of ["list", "delete", "edit", "edit-error", "empty", "kinds"] as const) {
  test(`Goals ${state} matches the desktop structure`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install({ time: new Date("2026-10-31T09:41:00.000Z") });
    await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "en"));
    await installPlanFidelityScene(page, state === "empty" || state === "kinds" ? "goals-empty" : "goals");
    await page.goto(state === "kinds" ? "/#/goals/kinds" : "/#/goals");
    await expect(page.locator('#app-main-content > div[aria-busy="false"]')).toBeVisible();
    if (state !== "kinds") {
      await expect(page.getByTestId("goals-summary")).toBeVisible();
      await expect(page.getByTestId("goals-summary")).toContainText("09:41");
      await expect(page.getByRole("link", { name: "Rule kinds" })).toBeVisible();
    }
    else await expect(page.getByRole("heading", { name: "Rule kinds" })).toBeVisible();
    if (state === "delete") {
      await page.getByRole("button", { name: "Delete rule" }).nth(3).click();
      await expect(page.getByRole("dialog", { name: /Delete/ })).toBeVisible();
      const dialogRect = await page.getByRole("dialog", { name: /Delete/ }).boundingBox();
      expect(dialogRect?.y).toBeCloseTo(415, 1);
      expect(dialogRect?.height).toBeCloseTo(170, 1);
    }
    if (state === "edit") {
      await page.getByRole("button", { name: "Edit rule" }).nth(3).click();
      await expect(page.getByRole("dialog", { name: "Edit rule" })).toBeVisible();
    }
    if (state === "edit-error") {
      await page.getByRole("button", { name: "Add rule" }).first().click();
      await page.getByRole("dialog").getByLabel("Kind").selectOption("asset_price_move");
      await expect(page.getByRole("dialog").getByLabel("Cooldown")).toHaveValue("1440");
      await page.getByRole("dialog").getByLabel("Threshold").fill("0");
      await page.getByRole("dialog").getByRole("button", { name: "Add rule" }).click();
    }
    await page.waitForTimeout(350);
    if (state === "list") {
      expect((await page.getByTestId("goals-summary").boundingBox())!.width).toBe(1488);
      const switchRect = await page.locator(".t3-fidelity-goal-switch input").first().boundingBox();
      expect(switchRect?.y).toBeCloseTo(321.5, 1);
      expect(await page.locator(".t3-fidelity-head p b").evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.fontWeight, style.color, style.fontSize, element.getBoundingClientRect().x];
      })).toEqual(["500", "rgb(255, 255, 255)", "13px", 84]);
    }
    if (state === "list" || state === "delete") {
      expect((await page.locator(".t3-fidelity-triggered h2").boundingBox())?.y).toBe(236);
      expect((await page.locator(".t3-fidelity-triggered .t3-fidelity-badge").boundingBox())?.y).toBe(238);
    }
    if (state === "edit") {
      const hintRect = await page.locator(".t3-fidelity-window-hint").boundingBox();
      expect(hintRect?.y).toBeCloseTo(551, 1);
      await expect(page.locator(".t3-fidelity-preview")).toContainText("once the 24 hour cooldown allows");
    }
    await expect(page.locator(".t3-fidelity-page").locator("xpath=..")).toHaveCSS("opacity", "1");
    await mkdir(output, { recursive: true });
    if (state === "list" || state === "empty") {
      await page.screenshot({ path: `${output}/${state}-viewport.png`, animations: "disabled" });
    }
    await page.screenshot({ path: `${output}/${state}.png`, fullPage: true, animations: "disabled" });
    if (state === "kinds") {
      await expect(page.getByRole("heading", { name: "Rule kinds" })).toBeVisible();
      await expect(page.getByText("How rules run")).toBeVisible();
    } else if (state === "empty") {
      await expect(page.getByText("Create your first rule")).toBeVisible();
    } else {
      await expect(page.getByText("SOL 7d move", { exact: true }).first()).toBeVisible();
      if (state === "edit-error") await expect(page.getByText("2 fields need attention")).toBeVisible();
    }
  });
}

test("Goals saves a stock rule with its asset type", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await installPlanFidelityScene(page, "goals");
  await page.goto("/#/goals");
  await expect(page.getByTestId("goals-summary")).toBeVisible();
  await page.getByRole("button", { name: "Add rule" }).first().click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("combobox", { name: "Kind" }).selectOption("asset_price_target");
  await editor.getByRole("combobox", { name: "Asset" }).selectOption("stock:AAPL");
  await editor.getByRole("spinbutton", { name: "Threshold" }).fill("250");
  await editor.getByRole("button", { name: "Add rule" }).click();
  await expect(page.getByText("AAPL price", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("AAPL price", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit rule" }).last().click();
  await expect(editor.getByRole("combobox", { name: "Asset" })).toHaveValue("stock:AAPL");
});

test("Goals deletes a rule only after confirmation and keeps it deleted after reload", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await installPlanFidelityScene(page, "goals");
  await page.goto("/#/goals");
  await expect(page.getByText("Portfolio drop", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete rule" }).last().click();
  const dialog = page.getByRole("dialog", { name: /Delete/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Portfolio drop", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete rule" }).last().click();
  await dialog.getByRole("button", { name: "Delete rule" }).click();
  await expect(page.getByText("Portfolio drop", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("goals-summary")).toBeVisible();
  await expect(page.getByText("Portfolio drop", { exact: true })).toHaveCount(0);
});

test("Goals announces a rejected save inside the open drawer", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await installPlanFidelityScene(page, "goals");
  await page.goto("/#/goals");
  await expect(page.getByTestId("goals-summary")).toBeVisible();
  await page.getByRole("button", { name: "Add rule" }).first().click();
  const editor = page.getByRole("dialog", { name: "Add rule" });
  await editor.getByRole("spinbutton", { name: "Threshold" }).fill("-5");
  await editor.getByRole("button", { name: "Add rule" }).click();
  await expect(editor).toBeVisible();
  await expect(editor.getByRole("alert")).toContainText("Enter a valid threshold, asset, window, and cooldown.");
});

test("Goals drawer controls match the source geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await installPlanFidelityScene(page, "goals");
  await page.goto("/#/goals");
  await expect(page.locator(".t3-fidelity-page")).toBeVisible();
  await page.getByRole("button", { name: "Edit rule" }).nth(3).click();
  const editor = page.getByRole("dialog", { name: "Edit rule" });
  await expect(editor).toBeVisible();
  expect(await editor.locator(".t3-fidelity-segmented button").first().evaluate((element) => element.getBoundingClientRect().height)).toBe(32);
  expect(await editor.getByRole("combobox", { name: "Kind" }).evaluate((element) => getComputedStyle(element).backgroundPosition)).toBe("calc(100% - 7px) 50%");
  expect(await editor.getByRole("combobox", { name: "Kind" }).evaluate((element) => getComputedStyle(element).fontVariantNumeric)).toBe("tabular-nums");
  expect(await editor.locator(".t3-fidelity-segmented button").first().evaluate((element) => getComputedStyle(element).fontVariantNumeric)).toBe("tabular-nums");
});

test("Rule kinds uses only the legacy navigation below 1500 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installPlanFidelityScene(page, "goals-empty");
  await page.goto("/#/goals/kinds");
  await expect(page.getByRole("heading", { name: "Rule kinds" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(1);
});
