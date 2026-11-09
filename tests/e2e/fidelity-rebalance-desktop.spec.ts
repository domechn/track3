import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { installPlanFidelityScene } from "./plan-fidelity-scenes";

const output = "/tmp/fidelity-desktop/rebalance";

for (const state of ["plan", "empty", "invalid"] as const) {
  test(`Rebalance ${state} matches the desktop structure`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install({ time: new Date("2026-10-31T09:41:00.000Z") });
    await page.addInitScript(() => {
      localStorage.setItem("track3-ui-locale", "en");
      sessionStorage.setItem("track3-rebalance-options", JSON.stringify({
        mode: "full", injectedCash: 0, minimumTradeValue: 1000,
        ignoreBelowValue: 0, stablecoinsAsCash: false,
      }));
    });
    await installPlanFidelityScene(page, state === "empty" ? "rebalance-empty" : "rebalance");
    await page.goto("/#/rebalance");
    await expect(page.locator('#app-main-content > div[aria-busy="false"]')).toBeVisible();
    await expect(page.getByTestId("rebalance-summary")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose date range" })).toHaveCount(0);
    if (state === "empty") await page.getByRole("button", { name: "2.0 pts" }).click();
    if (state === "invalid") {
      const btcTarget = page.getByLabel("Target percentage for BTC").first();
      await btcTarget.fill("33");
      await btcTarget.blur();
      await btcTarget.focus();
      await expect(btcTarget).toHaveValue("33.0");
    }
    await page.waitForTimeout(350);
    await expect(page.locator(".t3-fidelity-page").locator("xpath=..")).toHaveCSS("opacity", "1");
    // Full-page Chromium captures offset fixed rails by the overflow height.
    // Pin it to the page origin for the capture; the live rail stays fixed.
    await page.addStyleTag({ content: ".t3-fidelity-rail { position: absolute !important; top: -20px !important; left: -84px !important; height: 1000px !important; bottom: auto !important; }" });
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/${state}.png`, fullPage: true, animations: "disabled" });
    await expect(page.getByText("Target allocation", { exact: true })).toBeVisible();
    await expect(page.getByText("Rules", { exact: true })).toBeVisible();
    await expect(page.getByText("Result", { exact: true })).toBeVisible();
    if (state === "plan") {
      await expect(page.locator(".t3-fidelity-rail-badge")).toBeVisible();
      await expect(page.getByTestId("rebalance-summary")).toContainText("$763,809.27");
      await expect(page.getByRole("table", { name: "Suggested trades" })).toBeVisible();
    } else if (state === "empty") {
      await expect(page.locator(".t3-fidelity-rail-badge")).toBeVisible();
      await expect(page.getByText("No targets set yet")).toBeVisible();
      await page.getByRole("button", { name: "Set" }).first().click();
      await expect(page.getByRole("dialog").getByLabel("Target percentage for BTC")).toBeVisible();
      await expect(page.getByRole("dialog").getByLabel("Symbol")).toHaveValue("BTC");
    } else {
      await expect(page.getByText("Targets add up to 103.0%, not 100%")).toBeVisible();
    }
  });
}

for (const [name, targets] of [
  ["type", [
    { kind: "type", assetType: "crypto", percent: 60 },
    { kind: "type", assetType: "stock", percent: 40 },
  ]],
  ["cash", [
    { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 70 },
    { kind: "cash", percent: 30 },
  ]],
] as const) {
  test(`saved ${name} targets keep their target and drift information`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await installPlanFidelityScene(page, "rebalance");
    await page.evaluate(async (storedTargets) => {
      await (window as typeof window & { __e2eInvoke: (cmd: string, args: unknown) => Promise<unknown> })
        .__e2eInvoke("plugin:sql|execute", {
          query: "UPDATE rebalance_profiles SET targets = ? WHERE id = 1",
          values: [JSON.stringify(storedTargets)],
        });
    }, targets);
    await page.goto("/#/rebalance");
    await page.getByText("Manual setup").click();
    await expect(page.getByRole("spinbutton", { name: name === "type" ? "Target percentage for Crypto" : "Target percentage for BTC" })).toBeVisible();
    await expect(page.locator(".t3-manage-rebalance.t3-fidelity-page")).toBeVisible();
    await expect(page.locator(".t3-fidelity-rail")).toBeVisible();
    await expect(page.locator("aside.fixed.inset-y-0")).toBeHidden();
    await expect(page.getByRole("heading", { name: "Allocation deviations" })).toBeVisible();
    await expect(page.getByText(name === "type" ? "AAPL -16.5 pp" : "BTC -43.1 pp")).toBeVisible();
    await expect(page.getByText("Type targets follow the current mix of untargeted holdings. Cash includes stablecoins.")).toBeVisible();
  });
}

test("target and minimum trade keep decimal digits during sequential typing", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => {
    localStorage.setItem("track3-ui-locale", "en");
    sessionStorage.setItem("track3-rebalance-options", JSON.stringify({
      mode: "full", injectedCash: 0, minimumTradeValue: 1000,
      ignoreBelowValue: 0, stablecoinsAsCash: false,
    }));
  });
  await installPlanFidelityScene(page, "rebalance");
  await page.goto("/#/rebalance");
  await expect(page.getByTestId("rebalance-summary")).toBeVisible();
  const target = page.getByLabel("Target percentage for BTC").first();
  await target.fill("");
  await target.pressSequentially("30.5");
  await expect(target).toHaveValue("30.5");
  await target.blur();
  await expect(target).toHaveValue("30.5");
  const minimum = page.getByRole("textbox", { name: "Minimum trade" });
  await minimum.fill("");
  await minimum.pressSequentially("1500.5");
  await expect(minimum).toHaveValue("1500.5");
  await minimum.blur();
  await expect(minimum).toHaveValue("$1,500.5");
});

test("target and tolerance edits remain saved after a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await installPlanFidelityScene(page, "rebalance");
  await page.goto("/#/rebalance");
  await expect(page.getByTestId("rebalance-summary")).toBeVisible();
  await page.getByLabel("Target percentage for BTC").fill("31");
  await page.getByLabel("Target percentage for ETH").fill("19");
  await page.getByRole("button", { name: "1.0 pts" }).click();
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save targets" }).first().click();
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("rebalance-summary")).toBeVisible();
  await expect(page.getByLabel("Target percentage for BTC")).toHaveValue("31.0");
  await expect(page.getByLabel("Target percentage for ETH")).toHaveValue("19.0");
  await expect(page.getByRole("button", { name: "1.0 pts" })).toHaveClass(/selected/);
});

test("Rebalance controls use the source typography and row dimensions", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => {
    sessionStorage.setItem("track3-rebalance-options", JSON.stringify({
      mode: "full", injectedCash: 0, minimumTradeValue: 1000,
      ignoreBelowValue: 0, stablecoinsAsCash: false,
    }));
  });
  await installPlanFidelityScene(page, "rebalance");
  await page.goto("/#/rebalance");
  await expect(page.locator('#app-main-content > div[aria-busy="false"]')).toBeVisible();
  await expect(page.getByTestId("rebalance-summary")).toContainText("$763,809.27");
  await expect(page.getByRole("table", { name: "Suggested trades" })).toBeVisible();
  const exportButton = page.getByRole("button", { name: "Export CSV" });
  expect(await exportButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.fontWeight, style.fontVariantNumeric];
  })).toEqual(["500", "tabular-nums"]);
  expect(await page.locator(".t3-fidelity-result-export small").evaluate((element) => getComputedStyle(element).fontSize)).toBe("13px");
  expect(await page.locator(".t3-fidelity-switch-field").first().evaluate((element) => element.getBoundingClientRect().height)).toBe(36);
  expect(await page.locator(".t3-fidelity-trades th").first().evaluate((element) => {
    return [getComputedStyle(element).lineHeight, element.getBoundingClientRect().height];
  })).toEqual(["16px", 24.5]);
  expect(await page.locator(".t3-fidelity-trades table").evaluate((element) => {
    const header = element.querySelector("th")!.getBoundingClientRect();
    const row = element.querySelector("tbody tr")!.getBoundingClientRect();
    return row.y - header.y;
  })).toBe(24.5);
  expect(await page.locator(".t3-fidelity-trades th").evaluateAll((columns) =>
    columns.map((column) => Math.round(column.getBoundingClientRect().x * 10) / 10),
  )).toEqual([105, 149, 244.8, 337.1, 504.4, 655.9, 823.2]);
  expect(await page.getByRole("button", { name: "Equal weights" }).first().evaluate((element) => getComputedStyle(element).lineHeight)).toBe("16px");
  expect(await page.getByRole("button", { name: "Normalize to 100%" }).first().evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(135);
  expect(await page.getByLabel("Target percentage for BNB").first().evaluate((element) => getComputedStyle(element).fontVariantNumeric)).toBe("tabular-nums");
  const shareArrow = page.locator(".t3-fidelity-trades tbody tr").first().locator("td:nth-child(7) span");
  expect(await shareArrow.evaluate((element) => {
    const style = getComputedStyle(element);
    return [element.textContent, style.color, style.fontSize, element.getBoundingClientRect().width];
  })).toEqual(["→", "rgb(155, 157, 163)", "13px", 10.90625]);
});
