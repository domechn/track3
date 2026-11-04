import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installPlanFidelityScene } from "./phone-plan-fidelity-scenes";

test.beforeEach(({}, info) => { test.skip(info.project.name !== "mobile", "Mobile fidelity capture"); });

test.use({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  isMobile: false, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

async function capture(page: Page, name: string) {
  mkdirSync("/tmp/fidelity/rebalance", { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `/tmp/fidelity/rebalance/${name}.png`, fullPage: true });
  await page.screenshot({ path: `/tmp/fidelity/rebalance/${name}-phone.png` });
}

for (const state of ["rebalance", "rebalance-empty"] as const) {
  test(`${state} uses the approved allocation hierarchy`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
    await page.addInitScript(() => sessionStorage.setItem("track3-rebalance-options", JSON.stringify({
      mode: "full", injectedCash: 0, minimumTradeValue: 1000, ignoreBelowValue: 0, stablecoinsAsCash: false,
    })));
    await installPlanFidelityScene(page, state);
    await page.goto("/#/rebalance");
    await expect(page.getByTestId("rebalance-summary")).toContainText("$763,809.27", { timeout: 15_000 });
    if (state === "rebalance-empty") {
      await expect(page.getByRole("button", { name: "0.0 pts" })).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "2.0 pts" }).click();
      await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
    }
    await capture(page, state);
    const cardBounds = await page.locator(".pf-rebalance > .pf-card").evaluateAll((cards) =>
      cards.slice(0, 3).map((card) => {
        const bounds = card.getBoundingClientRect();
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
          background: getComputedStyle(card).backgroundColor };
      }));
    const [summaryHeight, allocationY, rulesY] = state === "rebalance" ? [260, 378, 1240] : [242, 360, 1222];
    expect(cardBounds[0]).toEqual({ x: 16, y: 106, width: 358, height: summaryHeight, background: "rgb(19, 18, 23)" });
    expect(cardBounds[1]).toMatchObject({ x: 16, y: allocationY, width: 358, height: 850 });
    expect(cardBounds[2]).toMatchObject({ x: 16, y: rulesY, width: 358, height: 711 });
    await expect(page.locator("#app-top-bar .mobile-header-back")).toBeHidden();
    await expect(page.getByRole("heading", { name: "Target allocation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rules" })).toBeVisible();
    const rulesHeading = (await page.locator(".pf-rules h2").boundingBox())!;
    const rulesAction = (await page.getByRole("button", { name: "Plan actions" }).boundingBox())!;
    expect(rulesAction.x).toBe(rulesHeading.x);
    await expect(page.getByRole("heading", { name: "Result" })).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: "Target percentage for BTC" }))
      .toHaveCSS("font-variant-numeric", "tabular-nums");
    await expect(page.locator(".pf-head p")).toHaveCSS("font-variant-numeric", "tabular-nums");
    await expect(page.locator(".pf-rules .pf-card-head small")).toHaveCSS("font-variant-numeric", "tabular-nums");
    await expect(page.locator(".pf-segment button").nth(1)).toHaveCSS("font-variant-numeric", "tabular-nums");
    await expect(page.locator(".pf-export-note")).toHaveCSS("font-size", "13px");
    expect(Math.round((await page.locator(".pf-alloc-total em").boundingBox())!.x))
      .toBe(state === "rebalance" ? 133 : 161);
    if (state === "rebalance") {
      const tradeSizes = await page.locator(".pf-trades").evaluate((card) => {
        const first = card.querySelector(".pf-trade")!;
        const detail = first.querySelector("small")!;
        const subtotal = card.querySelector(".pf-trade-sub")!;
        const subtotalLabel = subtotal.querySelector("span")!;
        const net = card.querySelector(".pf-trade-net")!;
        const netLabel = net.querySelector("b")!;
        return {
          row: first.getBoundingClientRect().height,
          detailTop: detail.getBoundingClientRect().top - first.getBoundingClientRect().top,
          subtotal: subtotal.getBoundingClientRect().height,
          subtotalLabelTop: subtotalLabel.getBoundingClientRect().top - subtotal.getBoundingClientRect().top,
          net: net.getBoundingClientRect().height,
          netLabelTop: netLabel.getBoundingClientRect().top - net.getBoundingClientRect().top,
        };
      });
      expect(tradeSizes).toEqual({
        row: 61, detailTop: 33, subtotal: 57, subtotalLabelTop: 11,
        net: 67, netLabelTop: 11,
      });
      await expect(page.locator(".pf-trade-net b")).toHaveCSS("font-weight", "700");
      await expect(page.locator(".pf-trade-net strong")).toHaveCSS("font-weight", "700");
      await expect(page.locator(".pf-trade-net b")).toHaveCSS("font-size", "13px");
      await expect(page.locator(".pf-trade-net b")).toHaveCSS("color", "rgb(255, 255, 255)");
      await expect(page.locator(".pf-result")).toContainText("Stablecoins are traded as assets");
      await expect(page.locator(".pf-result")).toContainText("Down from 2 of 8 (BTC, USDT)");
      await expect(page.locator(".pf-result")).toContainText("9 rows: action, asset, amount, units, price");
    } else {
      const widths = await page.locator(".pf-empty-actions button").evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().width));
      expect(widths).toEqual([202, 116]);
      await expect(page.locator(".pf-set-face svg").first()).toBeVisible();
    }
  });
}

test("More tab returns from Rebalance after its Back control is removed", async ({ page }) => {
  await installPlanFidelityScene(page, "rebalance");
  await page.goto("/#/rebalance");
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: /More/ }).click();
  await expect(page).toHaveURL(/#\/more$/);
});

test("light theme keeps allocation text and inputs readable", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await page.addInitScript(() => sessionStorage.setItem("track3-rebalance-options", JSON.stringify({
    mode: "full", injectedCash: 0, minimumTradeValue: 1000, ignoreBelowValue: 0, stablecoinsAsCash: false,
  })));
  await installPlanFidelityScene(page, "rebalance");
  await page.goto("/#/rebalance");
  await expect(page.getByTestId("rebalance-summary")).toContainText("$763,809.27", { timeout: 15_000 });
  await expect(page.locator(".pf-money-input input")).toHaveValue("1,000");
  await page.getByRole("button", { name: "Plan actions" }).click();
  const textColor = (selector: string) => page.locator(selector).first().evaluate((element) =>
    Number(getComputedStyle(element).color.match(/\d+/)?.[0] ?? 255));
  expect(await textColor(".pf-rebalance h1")).toBeLessThan(80);
  expect(await textColor(".pf-asset b")).toBeLessThan(80);
  expect(await textColor(".pf-target input")).toBeLessThan(80);
  const moreTab = page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: /More/ });
  expect(await textColor(".mobile-tab[aria-current='page']")).toBeLessThan(80);
  await expect(moreTab).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".pf-profile-actions .pf-primary")).toHaveCSS("background-color", "rgb(23, 23, 28)");
  await expect(page.locator(".pf-profile-actions .pf-primary")).toHaveCSS("color", "rgb(255, 255, 255)");
  await capture(page, "rebalance-light");
});

test("invalid edit pauses trades and offers normalization", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await page.addInitScript(() => sessionStorage.setItem("track3-rebalance-options", JSON.stringify({
    mode: "full", injectedCash: 0, minimumTradeValue: 1000, ignoreBelowValue: 0, stablecoinsAsCash: false,
  })));
  await installPlanFidelityScene(page, "rebalance");
  await page.goto("/#/rebalance");
  await expect(page.getByTestId("rebalance-summary")).toContainText("$763,809.27");
  const btc = page.getByRole("spinbutton", { name: "Target percentage for BTC" });
  await btc.fill("33");
  await expect(page.getByText("Targets must total 100%")).toBeVisible();
  await btc.blur();
  await btc.focus();
  await capture(page, "rebalance-invalid");
  expect(Math.round((await page.locator(".pf-alloc-total em").boundingBox())!.x)).toBe(148);
  const normalize = page.locator(".pf-trades .pf-empty > button");
  await expect(normalize).toHaveCSS("font-size", "13px");
  expect(await normalize.evaluate((node) => node.getBoundingClientRect().width)).toBe(147);
});

test("typing and presets keep the saved profile until Save or confirmed Delete", async ({ page }) => {
  await installPlanFidelityScene(page, "rebalance");
  await page.goto("/#/rebalance");
  const btc = page.getByRole("spinbutton", { name: "Target percentage for BTC" });
  await expect(btc).toHaveValue("30.0");
  await expect(page.locator(".pf-rules .pf-card-head")).toContainText("Saved on this device");
  await btc.clear();
  await btc.pressSequentially("12.5");
  await expect(btc).toHaveValue("12.5");
  await expect(page.locator(".pf-rules .pf-card-head")).toContainText("Unsaved changes");
  await page.waitForTimeout(750);
  await page.reload();
  await expect(btc).toHaveValue("30.0");
  await expect(page.locator(".pf-rules .pf-card-head")).toContainText("Saved on this device");
  await page.getByRole("button", { name: "Equal weights" }).click();
  await page.reload();
  await expect(btc).toHaveValue("30.0");
  await page.getByRole("button", { name: "Equal weights" }).click();
  await page.getByRole("button", { name: "Plan actions" }).click();
  await page.getByRole("button", { name: "Save targets" }).click();
  await expect(page.getByRole("status")).toContainText("Targets saved.");
  await expect(page.locator(".pf-rules .pf-card-head")).toContainText("Saved on this device");
  await page.reload();
  await expect(btc).toHaveValue("12.5");
  await page.getByRole("button", { name: "Plan actions" }).click();
  await page.getByRole("button", { name: "Delete targets" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  await page.reload();
  await expect(btc).toHaveValue("12.5");
  await page.getByRole("button", { name: "Plan actions" }).click();
  await page.getByRole("button", { name: "Delete targets" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("status")).toContainText("Targets deleted.");
  await expect(page.locator(".pf-rules .pf-card-head")).toContainText("Not saved yet");
  await page.reload();
  await expect(btc).toHaveValue("");
});

test("empty and invalid results use the design's disabled export and preset colours", async ({ page }) => {
  await installPlanFidelityScene(page, "rebalance-empty");
  await page.goto("/#/rebalance");
  await expect(page.locator(".pf-rules .pf-card-head")).toContainText("Not saved yet");
  await expect(page.locator(".pf-export")).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator(".pf-export")).toHaveCSS("opacity", "0.45");
  await expect(page.locator(".pf-preset-row button").last()).toHaveCSS("opacity", "0.5");
  await page.getByRole("button", { name: "Equal weights" }).first().click();
  await expect(page.locator(".pf-rules .pf-card-head")).toContainText("Unsaved changes");
  await page.getByRole("spinbutton", { name: "Target percentage for BTC" }).fill("33");
  await expect(page.locator(".pf-export")).toHaveCSS("color", "rgb(255, 255, 255)");
});
