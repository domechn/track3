import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";
import { installTauriBridge as installSampleBridge } from "./fidelity-scenes";
import { captureLong } from "./fidelity-analyze-scenes";
import { createSyncHeader } from "../../src/middlelayers/sync/crypto";
import { FakeS3, writeSyncHeader } from "../../src/middlelayers/sync/object-store";

const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
test.use({ viewport: { width: 390, height: 844 }, userAgent, isMobile: true, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce" });
test.beforeEach(({}, info) => test.skip(info.project.name !== "mobile"));

test("first-run guide renders all five approved phone steps", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true });
  await page.goto("/#/overview");
  const dialog = page.getByTestId("onboarding-dialog");
  const titles = ["Your data stays on this device", "Add a source", "Every refresh is a snapshot", "Planning tools", "Back up your data"];
  mkdirSync("/tmp/fidelity/flows", { recursive: true });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(300);
  expect((await dialog.locator(".fd-guide-art").boundingBox())?.y).toBeCloseTo(194.703, 2);
  await expect(dialog.locator(".fd-guide-copy .ob-title")).toHaveCSS("letter-spacing", "-0.24px");
  await page.screenshot({ path: "/tmp/fidelity/flows/guide-before.png" });
  for (const [index, title] of titles.entries()) {
    await expect(dialog.getByRole("heading", { name: title })).toBeVisible();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `/tmp/fidelity/flows/guide-${index + 1}-phone.png` });
    writeFileSync(`/tmp/fidelity/flows/guide-${index + 1}-geometry.json`, JSON.stringify(await page.evaluate(() =>
      [".fd-guide-top", ".fd-guide-art", ".fd-guide-copy", ".fd-guide-eyebrow", ".fd-guide-copy .ob-title", ".fd-guide-copy .ob-desc", ".fd-guide-foot"]
        .map((selector) => {
          const element = document.querySelector(selector)!;
          const r = element.getBoundingClientRect();
          const s = getComputedStyle(element);
          return { selector, y: r.y, h: r.height, font: s.font, color: s.color, opacity: s.opacity,
            letter: s.letterSpacing, variant: s.fontVariantNumeric, kerning: s.fontKerning, optical: s.fontOpticalSizing,
            rendering: s.textRendering, fontSmoothing: s.getPropertyValue("-webkit-font-smoothing"), margin: s.margin, padding: s.padding };
        })), null, 2));
    if (index < 4) await page.getByTestId("onboarding-next").click();
  }
  await expect(dialog).toContainText("every 24 hours or after a refresh");
  await expect(dialog).not.toContainText("monthly");
});

test("phone guide illustration captions follow the selected language", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("track3-ui-theme", "dark");
    localStorage.setItem("track3-ui-locale", "zh");
  });
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true });
  await page.goto("/#/overview");
  const dialog = page.getByTestId("onboarding-dialog");
  const art = dialog.locator(".fd-guide-art > svg").first();
  for (const caption of ["本地 SQLite 数据库", "交易所", "每次刷新一份快照", "再平衡", "端到端加密"]) {
    await expect(art).toContainText(caption);
    if (caption !== "端到端加密") await dialog.getByTestId("onboarding-next").click();
  }
});

test("empty first run offers real source setup and backup restore", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installTauriBridge(page, { emptyPortfolio: true });
  await page.goto("/#/overview");
  await expect(page.getByRole("heading", { name: "Add your first source" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add an exchange" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import a backup" })).toBeVisible();
  expect((await page.getByRole("heading", { name: "Overview" }).boundingBox())!.y).toBeLessThan(50);
  expect((await page.locator(".fd-first-run-bottom").first().boundingBox())?.height).toBe(164);
  expect((await page.locator(".fd-first-run-bottom .fd-empty").first().boundingBox())?.y).toBe(830);
  expect((await page.locator(".fd-first-run-bottom .fd-empty").first().boundingBox())?.height).toBe(98);
  await page.screenshot({ path: "/tmp/fidelity/flows/firstrun-empty-phone.png" });
  await captureLong(page, "/tmp/fidelity/flows/firstrun-empty-phone-long.png");
  writeFileSync("/tmp/fidelity/flows/firstrun-empty-geometry.json", JSON.stringify(await page.evaluate(() => {
    const selectors = [".fd-first-run-head", ".fd-first-run-choose", ".fd-first-run-options", ".fd-first-run-primary", ".fd-first-run-backup", ".fd-first-run-bottom"];
    return selectors.map((selector) => [selector, ...Array.from(document.querySelectorAll(selector), (element) => {
      const r = element.getBoundingClientRect();
      return { y: r.y, height: r.height, padding: getComputedStyle(element).padding, boxSizing: getComputedStyle(element).boxSizing };
    })]);
  }), null, 2));
});

test("one configured source with no refresh shows the first snapshot state", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installSampleBridge(page, { emptyPortfolio: true, firstRunBinance: true });
  await page.evaluate(async () => {
    for (const title of ["BTC price alert", "Portfolio target alert"]) {
      await (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "INSERT INTO alert_history (kind, title, message, value, triggered_at) VALUES ('price', ?, 'Design fixture alert', 1, '2026-10-31T09:41:00.000Z')",
        values: [title],
      });
    }
  });
  await page.goto("/#/overview");
  await expect(page.getByText("Binance has not been refreshed yet.")).toBeVisible({ timeout: 30_000 });
  expect((await page.locator(".fd-first-run-banner > div").boundingBox())?.x).toBe(61);
  await expect(page.locator(".fd-first-run-banner")).toHaveCSS("border-color", "rgb(31, 58, 92)");
  await expect(page.getByRole("button", { name: "Refresh now" })).toBeVisible();
  await expect(page.locator(".fd-first-run-source small svg")).toHaveCount(1);
  await expect(page.locator(".mobile-tab-bar")).toContainText("2");
  expect((await page.getByRole("heading", { name: "Overview" }).boundingBox())!.y).toBeLessThan(50);
  writeFileSync("/tmp/fidelity/flows/firstrun-one-geometry.json", JSON.stringify(await page.evaluate(() =>
    [".fd-first-run-hero", ".fd-first-run-sources", ".fd-first-run-bottom"]
      .flatMap((selector) => Array.from(document.querySelectorAll(selector), (element) => {
        const r = element.getBoundingClientRect();
        return { selector, y: r.y, h: r.height };
      }))), null, 2));
  expect((await page.locator(".fd-first-run-hero").boundingBox())?.y).toBe(280);
  expect((await page.locator(".fd-first-run-sources").boundingBox())?.y).toBe(637);
  expect((await page.locator(".fd-first-run-bottom").first().boundingBox())?.y).toBe(809);
  expect((await page.locator(".fd-first-run-bottom").last().boundingBox())?.y).toBe(985);
  expect(await page.locator(".fd-first-run-hero,.fd-first-run-bottom").evaluateAll((cards) =>
    cards.every((card) => {
      const cardBottom = card.getBoundingClientRect().bottom;
      return [...card.querySelectorAll(".fd-empty")].every((box) => box.getBoundingClientRect().bottom <= cardBottom);
    }))).toBe(true);
  await page.screenshot({ path: "/tmp/fidelity/flows/firstrun-one-phone.png" });
  await captureLong(page, "/tmp/fidelity/flows/firstrun-one-phone-long.png");
});

test("multiple configured sources without a snapshot can be refreshed", async ({ page }) => {
  await installSampleBridge(page, { emptyPortfolio: true, firstRunBinance: true });
  await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
    query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (11, ?)",
    values: ["btc:\n  addresses:\n    - address: bc1qtestwallet\n      alias: Cold wallet\n"],
  }));
  await page.goto("/#/overview");
  await expect(page.getByText("2 sources have not been refreshed yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh now" })).toBeVisible();
});

test("slow local read keeps the approved loading card frames", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installTauriBridge(page, { slowOverview: true, richPortfolio: true });
  await page.goto("/#/overview");
  await expect(page.locator(".fd-overview-loading-grid")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator(".ios-d3-auto-backup")).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(() => window.dispatchEvent(new Event("track3:soft-refresh")));
  await expect(page.locator(".fd-overview-loading-grid")).toHaveAttribute("aria-busy", "true", { timeout: 15_000 });
  await page.screenshot({ path: "/tmp/fidelity/flows/loading-phone.png" });
  writeFileSync("/tmp/fidelity/flows/loading-geometry.json", JSON.stringify(await page.evaluate(() =>
    Array.from(document.querySelectorAll(".fd-loading-head,.fd-overview-loading-grid>.fd-card"), (element) => {
      const r = element.getBoundingClientRect();
      return { className: element.className, y: r.y, height: r.height };
    })), null, 2));
});

test("partial snapshot excludes the failed source and keeps changes unknown", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:42:00Z"));
  await page.addInitScript(() => {
    localStorage.setItem("track3-ui-theme", "dark");
    localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([
      { sourceId: "cex:0", label: "Binance", kind: "exchange", provider: "Binance", status: "ok", lastSuccessAt: "2026-10-31T09:41:00.000Z", startedAt: "2026-10-31T09:40:56.900Z", finishedAt: "2026-10-31T09:41:00.000Z" },
      { sourceId: "cex:1", label: "OKX", kind: "exchange", provider: "OKX", status: "failed", category: "network", detail: "Source timed out", lastSuccessAt: "2026-10-30T21:14:00.000Z", startedAt: "2026-10-31T09:41:40.000Z", finishedAt: "2026-10-31T09:42:00.000Z" },
      { sourceId: "btc:0", label: "Ledger cold wallet", kind: "wallet", status: "ok", lastSuccessAt: "2026-10-31T09:40:00.000Z", startedAt: "2026-10-31T09:39:53.200Z", finishedAt: "2026-10-31T09:40:00.000Z" },
      { sourceId: "erc20:0", label: "0x4f…a91c", kind: "wallet", status: "ok", lastSuccessAt: "2026-10-31T09:40:00.000Z", startedAt: "2026-10-31T09:39:52.800Z", finishedAt: "2026-10-31T09:40:00.000Z" },
      { sourceId: "stock:0", label: "Interactive Brokers", kind: "broker", status: "ok", lastSuccessAt: "2026-10-31T09:41:00.000Z", startedAt: "2026-10-31T09:40:54.600Z", finishedAt: "2026-10-31T09:41:00.000Z" },
    ]));
  });
  await installSampleBridge(page, { fidelitySample: "full" });
  const wallet = await page.evaluate(async () => {
    const rows = await (window as any).__e2eInvoke("plugin:sql|select", {
      query: "SELECT wallet FROM assets_v2 WHERE uuid = 'fidelity-day-30' AND symbol = 'USDC'", values: [],
    });
    return rows[0].wallet as string;
  });
  await page.evaluate(async (id) => {
    const invoke = (window as any).__e2eInvoke;
    for (const [symbol, value] of [["ETH", 32097.44], ["USDT", 69993], ["USDC", 40000]] as const) {
      await invoke("plugin:sql|execute", { query: "UPDATE assets_v2 SET value = ?, price = ? / amount WHERE uuid = 'fidelity-day-30' AND wallet = ? AND symbol = ?", values: [value, value, id, symbol] });
    }
    await invoke("plugin:sql|execute", {
      query: "INSERT INTO snapshot_partial (uuid, sources_total, missing, fill, created_at) VALUES (?, 5, ?, 'last_known', ?)",
      values: ["fidelity-day-30", JSON.stringify([{ wallet: id, kind: "exchange", provider: "OKX", category: "network", lastSuccessAt: "2026-10-30T21:14:00.000Z" }]), "2026-10-31T09:41:00.000Z"],
    });
    await invoke("plugin:sql|execute", { query: "DELETE FROM assets_v2 WHERE createdAt < '2026-10-01'", values: [] });
  }, wallet);
  await page.goto("/#/overview");
  await expect(page.getByText("Total value, excluding OKX").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#app-top-bar .mobile-header-total")).toBeHidden();
  await expect(page.getByText("$621,333.50").first()).toBeVisible();
  await expect(page.locator(".fd-partial-table-head")).toHaveText("AssetValue7D");
  await expect(page.locator(".fd-partial-left-row").first()).toContainText("ETH");
  await expect(page.locator(".fd-partial-left-summary").first()).toContainText("Total excluding OKX");
  await expect(page.locator(".fd-partial-source [aria-label='Ledger cold wallet wallet']")).toHaveText("Lg");
  expect((await page.locator(".fd-partial-banner > div").boundingBox())?.x).toBe(61);
  await expect(page.locator(".fd-partial-banner")).toHaveCSS("border-color", "rgb(74, 60, 24)");
  expect((await page.locator(".fd-partial-head .fd-range").boundingBox())?.width).toBe(260);
  expect((await page.locator(".fd-partial-head .fd-range").boundingBox())?.height).toBe(40);
  expect((await page.locator(".fd-partial-head .fd-range button").nth(2).boundingBox())?.x).toBe(98);
  expect((await page.locator(".fd-partial-head .fd-range button").nth(2).boundingBox())?.width).toBe(48);
  expect((await page.locator(".fd-partial-refresh").boundingBox())?.y).toBe(122);
  expect((await page.locator(".fd-partial-total").boundingBox())?.y).toBe(441);
  await page.screenshot({ path: "/tmp/fidelity/flows/refresh-partial-phone.png" });
  await page.getByRole("button", { name: "Refreshed 09:42 · 4 of 5 sources" }).click();
  await expect(page.getByRole("alertdialog", { name: "Source status" })).toBeVisible();
  await expect(page.getByRole("alertdialog", { name: "Source status" }).getByText("Refresh finished")).toBeVisible();
  writeFileSync("/tmp/fidelity/flows/refresh-partial-pop-geometry.json", JSON.stringify(await page.evaluate(() =>
    [".fd-partial-status", ".fd-partial-status-handle", ".fd-partial-status-head", ".fd-partial-progress", ".fd-partial-status-row", ".fd-partial-status-buttons"]
      .flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => {
        const r = element.getBoundingClientRect();
        return { selector, y: r.y, h: r.height };
      }))), null, 2));
  expect((await page.locator(".fd-partial-status-row").nth(1).boundingBox())?.height).toBe(65);
  await page.screenshot({ path: "/tmp/fidelity/flows/refresh-partial-pop-phone.png" });
  await page.getByRole("alertdialog", { name: "Source status" }).getByRole("button", { name: "Close" }).click();
  await captureLong(page, "/tmp/fidelity/flows/refresh-partial-phone-long.png");
  writeFileSync("/tmp/fidelity/flows/refresh-partial-geometry.json", JSON.stringify(await page.evaluate(() =>
    Array.from(document.querySelectorAll(".fd-partial-head,.fd-partial-head .fd-range,.fd-partial-banner,.fd-partial-grid>.fd-card,.fd-partial-kpis,.fd-partial-chart"), (element) => {
      const r = element.getBoundingClientRect();
      return { className: element.className, x: r.x, y: r.y + document.getElementById("app-main-content")!.scrollTop, width: r.width, height: r.height };
    })), null, 2));
});

test("quota partial snapshot offers real usage and preserves unknown changes", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:42:00Z"));
  await page.addInitScript(() => {
    localStorage.setItem("track3-ui-theme", "dark");
    localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([
      { sourceId: "cex:0", label: "Binance", kind: "exchange", provider: "Binance", status: "ok", lastSuccessAt: "2026-10-31T09:41:00.000Z", startedAt: "2026-10-31T09:40:56.900Z", finishedAt: "2026-10-31T09:41:00.000Z" },
      { sourceId: "cex:1", label: "OKX", kind: "exchange", provider: "OKX", status: "ok", lastSuccessAt: "2026-10-31T09:41:00.000Z", startedAt: "2026-10-31T09:40:57.000Z", finishedAt: "2026-10-31T09:41:00.000Z" },
      { sourceId: "btc:0", label: "Ledger cold wallet", kind: "wallet", status: "ok", lastSuccessAt: "2026-10-31T09:40:00.000Z", startedAt: "2026-10-31T09:39:53.200Z", finishedAt: "2026-10-31T09:40:00.000Z" },
      { sourceId: "erc20:0", label: "0x4f…a91c", kind: "wallet", status: "failed", category: "quota", detail: "Pro limit reached", lastSuccessAt: "2026-10-30T21:14:00.000Z", startedAt: "2026-10-31T09:41:40.000Z", finishedAt: "2026-10-31T09:42:00.000Z" },
      { sourceId: "stock:0", label: "Interactive Brokers", kind: "broker", status: "ok", lastSuccessAt: "2026-10-31T09:41:00.000Z", startedAt: "2026-10-31T09:40:54.600Z", finishedAt: "2026-10-31T09:41:00.000Z" },
    ]));
  });
  await installSampleBridge(page, { fidelitySample: "full", quotaExhaustedFixture: true });
  const wallet = await page.evaluate(async () => {
    const rows = await (window as any).__e2eInvoke("plugin:sql|select", {
      query: "SELECT wallet FROM assets_v2 WHERE uuid = 'fidelity-day-30' AND symbol = 'ETH' AND amount = 27", values: [],
    });
    return rows[0].wallet as string;
  });
  await page.evaluate(async (id) => {
    const invoke = (window as any).__e2eInvoke;
    await invoke("plugin:sql|execute", { query: "UPDATE assets_v2 SET value = 67437.90, price = 67437.90 / amount WHERE uuid = 'fidelity-day-30' AND wallet = ? AND symbol = 'ETH'", values: [id] });
    await invoke("plugin:sql|execute", {
      query: "INSERT INTO snapshot_partial (uuid, sources_total, missing, fill, created_at) VALUES (?, 5, ?, 'last_known', ?)",
      values: ["fidelity-day-30", JSON.stringify([{ wallet: id, kind: "wallet", provider: "0x4f…a91c", category: "quota", lastSuccessAt: "2026-10-30T21:14:00.000Z" }]), "2026-10-31T09:41:00.000Z"],
    });
    await invoke("plugin:sql|execute", { query: "DELETE FROM assets_v2 WHERE createdAt < '2026-10-01'", values: [] });
  }, wallet);
  await page.goto("/#/overview");
  await expect(page.getByText("$695,576.49").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "See usage" })).toBeVisible();
  expect((await page.locator(".fd-partial-left-out").boundingBox())!.height).toBeLessThanOrEqual(300);
  await expect(page.locator(".fd-partial-left-row").first()).toHaveText("ETH 27$67,437.90");
  expect((await page.locator(".fd-partial-head .fd-range").boundingBox())?.width).toBe(260);
  expect((await page.locator(".fd-partial-banner").boundingBox())?.height).toBe(156);
  expect((await page.locator(".fd-partial-hero").boundingBox())?.y).toBe(354);
  await page.screenshot({ path: "/tmp/fidelity/flows/refresh-quota-phone.png" });
  await page.getByRole("button", { name: "Refreshed 09:42 · 4 of 5 sources" }).click();
  await expect(page.getByRole("alertdialog", { name: "Source status" })).toBeVisible();
  writeFileSync("/tmp/fidelity/flows/refresh-quota-pop-geometry.json", JSON.stringify(await page.evaluate(() =>
    [".fd-partial-status", ".fd-partial-status-handle", ".fd-partial-status-head", ".fd-partial-progress", ".fd-partial-status-row", ".fd-partial-status-buttons"]
      .flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => {
        const r = element.getBoundingClientRect();
        return { selector, y: r.y, h: r.height };
      }))), null, 2));
  expect((await page.locator(".fd-partial-status").boundingBox())?.height).toBe(466);
  expect((await page.locator(".fd-partial-status-row").nth(3).boundingBox())?.height).toBe(71);
  await page.screenshot({ path: "/tmp/fidelity/flows/refresh-quota-pop-phone.png" });
  await page.getByRole("alertdialog", { name: "Source status" }).getByRole("button", { name: "Close" }).click();
  await captureLong(page, "/tmp/fidelity/flows/refresh-quota-phone-long.png");
});

test("phone toast stack shows the stored snapshot and refresh outcomes", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installSampleBridge(page, { fidelitySample: "full" });
  await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute",
    { query: "DELETE FROM assets_v2 WHERE createdAt < '2026-10-01'", values: [] }));
  await page.goto("/#/overview");
  await expect(page.getByText("$763,809.27").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".fd-overview")).toBeVisible();
  await page.evaluate(async () => {
    const toastPath = "/src/mobile/components/ui/use-toast.ts";
    const { toast } = await import(toastPath);
    toast({ title: "Refresh complete", description: "5 of 5 sources refreshed at 09:41." });
  });
  await expect(page.getByText("Refresh complete", { exact: true })).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({ path: "/tmp/fidelity/flows/toasts-ok-phone.png" });
  const okBox = await page.locator(".mobile-toast").boundingBox();
  expect(okBox && [okBox.x, okBox.y, okBox.width, okBox.height].map(Math.round)).toEqual([16, 710, 358, 62]);
  await expect(page.locator(".mobile-toast")).toHaveCSS("border-left-color", "rgb(95, 196, 155)"); // Shared --positive token RGB.
  await captureLong(page, "/tmp/fidelity/flows/toasts-ok-phone-long.png");
  await page.evaluate(async () => {
    const reactPath = "/node_modules/.vite/deps/react.js";
    const toastPath = "/src/mobile/components/ui/use-toast.ts";
    const actionPath = "/src/mobile/components/ui/toast.tsx";
    const [React, { toast }, { ToastAction }] = await Promise.all([
      import(reactPath), import(toastPath), import(actionPath),
    ]);
    toast({ title: "Snapshot deleted", description: "30 Oct 21:14 removed from History.",
      action: React.default.createElement(ToastAction, { altText: "Undo" }, "Undo") });
    toast({ title: "OKX refresh failed", description: "Request timed out after 20 s.", variant: "destructive",
      action: [
        React.default.createElement(ToastAction, { key: "retry", altText: "Retry", onClick: () => window.dispatchEvent(new CustomEvent("fidelity:mobile-refresh-source", { detail: "cex:1" })) }, "Retry"),
        React.default.createElement(ToastAction, { key: "details", altText: "Details", onClick: () => { location.hash = "/wallets"; } }, "Details"),
      ] });
  });
  await expect(page.getByText("Snapshot deleted", { exact: true })).toBeVisible();
  await expect(page.getByText("OKX refresh failed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Details" })).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({ path: "/tmp/fidelity/flows/toasts-stack-phone.png" });
  const toastBoxes = await page.locator(".mobile-toast").evaluateAll((nodes) =>
    nodes.map((node) => { const box = node.getBoundingClientRect(); return [box.x, box.y, box.width, box.height].map(Math.round); })
      .sort((a, b) => a[1] - b[1]));
  expect(toastBoxes).toEqual([[16, 550, 358, 106], [16, 666, 358, 106]]);
  const actionY = await page.locator(".mobile-toast-action").evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().y)).sort((a, b) => a - b));
  expect(actionY).toEqual([599, 599, 715]);
  for (const action of await page.locator(".mobile-toast-action").all()) {
    expect((await action.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  for (const close of await page.locator(".mobile-toast [toast-close]").all()) {
    const box = await close.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  for (const [label, width] of [["Retry", 42], ["Details", 50], ["Undo", 40]] as const) {
    expect((await page.getByRole("button", { name: label }).boundingBox())?.width).toBeGreaterThanOrEqual(width);
  }
  await expect(page.getByRole("button", { name: "Details" })).toHaveCSS("color", "rgb(180, 182, 187)"); // Shared --muted-foreground token RGB.
  await captureLong(page, "/tmp/fidelity/flows/toasts-stack-phone-long.png");
  writeFileSync("/tmp/fidelity/flows/toasts-stack-geometry.json", JSON.stringify(await page.evaluate(() =>
    Array.from(document.querySelectorAll(".ios-d3-toast-viewport, .mobile-toast"), (element) => ({
      box: element.getBoundingClientRect().toJSON(), bottom: getComputedStyle(element).bottom,
      top: getComputedStyle(element).top, transform: getComputedStyle(element).transform,
    }))), null, 2));
  await page.evaluate(async () => {
    const toastPath = "/src/mobile/components/ui/use-toast.ts";
    const actionPath = "/src/mobile/components/ui/toast.tsx";
    const reactPath = "/node_modules/.vite/deps/react.js";
    const [{ toast }, { ToastAction }, React] = await Promise.all([
      import(toastPath), import(actionPath), import(reactPath),
    ]);
    toast({
      title: "Refresh warning",
      description: "Totals may be incomplete. Partial sources returned fewer balances than usual. Some wallets did not respond, so the displayed total could be lower than usual. Check source details.",
      action: React.default.createElement(ToastAction, { altText: "Details" }, "Details"),
    });
  });
  const warning = page.locator(".mobile-toast").filter({ hasText: "Refresh warning" });
  await expect(warning).toBeVisible();
  const descriptionBox = await warning.locator(".mobile-toast-copy > div:last-child").boundingBox();
  expect(descriptionBox!.height).toBeGreaterThanOrEqual(68);
  const warningAction = await warning.locator(".mobile-toast-action").boundingBox();
  expect(warningAction!.y).toBeGreaterThanOrEqual(descriptionBox!.y + descriptionBox!.height);
  expect(warningAction!.height).toBeGreaterThanOrEqual(44);
});

test("configured sync asks for its real passphrase at startup and reports an incorrect one", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  const s3 = new FakeS3();
  const { header } = await createSyncHeader("correct demo passphrase");
  await writeSyncHeader(s3, header);
  await installSampleBridge(page, { fidelitySample: "full", seedLockedSync: true, s3 });
  await page.goto("/#/overview");
  const unlock = page.locator(".ios-d3-sync-popover");
  await expect(unlock).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".fd-overview-value")).toBeVisible();
  await expect(page.locator(".fd-header-alerts")).toHaveCSS("opacity", "0");
  await expect(unlock.getByText("The passphrase never leaves your devices. Without it, remote data cannot be read.")).toBeVisible();
  writeFileSync("/tmp/fidelity/flows/startup-syncunlock-geometry.json", JSON.stringify(await unlock.evaluate((root) =>
    [".fd-sync-lock-icon", "h2", "p", "label", ".fd-sync-passphrase input", ".fd-sync-passphrase-hint", ".fd-sync-forgot", ".fd-sync-unlock", ".fd-sync-skip"]
      .map((selector) => {
        const element = root.querySelector(selector)!;
        const box = element.getBoundingClientRect();
        return { selector, y: box.y, height: box.height, margin: getComputedStyle(element).margin };
      })), null, 2));
  const unlockY = (await unlock.getByRole("button", { name: "Unlock" }).boundingBox())!.y;
  expect(unlockY).toBeGreaterThanOrEqual(718);
  expect(unlockY).toBeLessThanOrEqual(722);
  await unlock.getByLabel("Sync passphrase").fill("sampledemopass");
  await expect(unlock.getByLabel("Sync passphrase")).toHaveAttribute("type", "password");
  await unlock.getByRole("button", { name: "Show passphrase" }).click();
  await expect(unlock.getByLabel("Sync passphrase")).toHaveAttribute("type", "text");
  await unlock.getByRole("button", { name: "Hide passphrase" }).click();
  await expect(unlock.getByLabel("Sync passphrase")).toHaveAttribute("type", "password");
  await unlock.getByLabel("Sync passphrase").focus();
  await page.screenshot({ path: "/tmp/fidelity/flows/startup-syncunlock-phone.png" });
  await unlock.getByLabel("Sync passphrase").fill("wrongdemopass!");
  await unlock.getByRole("button", { name: "Unlock" }).click();
  await expect(unlock.getByRole("alert")).toContainText("That passphrase does not unlock this bucket. Check for typos and try again.");
  await expect(unlock.getByRole("alert").locator("svg")).toBeVisible();
  await expect(unlock.getByText("The passphrase never leaves your devices. Without it, remote data cannot be read.")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/fidelity/flows/startup-syncunlock-error-phone.png" });
  await unlock.getByRole("button", { name: "Continue without sync" }).click();
  await expect(unlock).toHaveCount(0);
});

test("native keychain startup failure stays locked and offers its real retry", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installTauriBridge(page, { lockedStartup: true });
  await page.goto("/#/overview");
  await expect(page.locator(".ios-d3-startup-lock")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".ios-d3-startup-lock").getByRole("button", { name: /retry/i })).toBeVisible();
  await page.screenshot({ path: "/tmp/fidelity/flows/startup-keychain-error-phone.png" });
});

test("database read failure offers a safe retry without hiding the error", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installTauriBridge(page, { failDataQueries: true });
  await page.goto("/#/overview");
  await expect(page.getByText(/data.*load|could not load|try again/i).first()).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: "/tmp/fidelity/flows/startup-data-error-phone.png" });
});

test("frontend render failure shows a recoverable phone error with copyable details", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await page.evaluate(async () => {
    const reactPath = "/node_modules/.vite/deps/react.js";
    const domPath = "/node_modules/.vite/deps/react-dom_client.js";
    const boundaryPath = "/src/mobile/components/app-error-boundary.tsx";
    const [React, ReactDOM, { default: AppErrorBoundary }] = await Promise.all([
      import(reactPath), import(domPath), import(boundaryPath),
    ]);
    const host = document.createElement("div");
    host.id = "fidelity-error-host";
    document.body.append(host);
    document.getElementById("root")!.style.display = "none";
    const Throws = () => { throw new TypeError("Cannot read properties of undefined (reading 'value')"); };
    ReactDOM.default.createRoot(host).render(React.default.createElement(AppErrorBoundary, null, React.default.createElement(Throws)));
  });
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy details" })).toBeVisible();
  await page.screenshot({ path: "/tmp/fidelity/flows/startup-error-phone.png" });
});

test("iOS key recovery notice points to existing settings recovery", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installSampleBridge(page, { fidelitySample: "full", keyRecoveryNeeded: true });
  await page.goto("/#/overview");
  await expect(page.getByText("$763,809.27").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/encryption key is missing/i)).toBeVisible();
  await page.screenshot({ path: "/tmp/fidelity/flows/startup-key-recovery-notice-phone.png" });
});

test("real Overview exposes idle, pull, and source progress on phone", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:42:00Z"));
  await page.addInitScript(() => {
    localStorage.setItem("track3-ui-theme", "dark");
    localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([
      { sourceId: "cex:0", label: "Binance", kind: "exchange", provider: "Binance", status: "ok", lastSuccessAt: "2026-10-31T09:41:00.000Z" },
      { sourceId: "cex:1", label: "OKX", kind: "exchange", provider: "OKX", status: "ok", lastSuccessAt: "2026-10-31T09:41:00.000Z" },
      { sourceId: "btc:0", label: "Ledger cold wallet", kind: "wallet", status: "ok", lastSuccessAt: "2026-10-31T09:40:00.000Z" },
      { sourceId: "erc20:0", label: "0x4f…a91c", kind: "wallet", status: "ok", lastSuccessAt: "2026-10-31T09:40:00.000Z" },
      { sourceId: "stock:0", label: "Interactive Brokers", kind: "broker", status: "ok", lastSuccessAt: "2026-10-31T09:41:00.000Z" },
    ]));
  });
  await installSampleBridge(page, { fidelitySample: "full", slowRefreshPersist: true });
  await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
    query: "UPDATE configuration SET data = ? WHERE id = 12",
    values: ["configs:\n  groupUSD: false\nothers: []\n"],
  }));
  await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute",
    { query: "DELETE FROM assets_v2 WHERE createdAt < '2026-10-01'", values: [] }));
  await page.goto("/#/overview");
  await expect(page.getByText("$763,809.27").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".fd-overview-ath strong")).toHaveText("$763,809.27");
  await page.screenshot({ path: "/tmp/fidelity/flows/refresh-idle-phone.png" });
  await captureLong(page, "/tmp/fidelity/flows/refresh-idle-phone-long.png");
  await page.evaluate(() => {
    const target = document.querySelector('[data-testid="pull-to-refresh"]');
    if (!target) throw new Error("pull target missing");
    const start = new Touch({ identifier: 1, target, clientX: 185, clientY: 80 });
    const moved = new Touch({ identifier: 1, target, clientX: 185, clientY: 160 });
    target.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start], targetTouches: [start], changedTouches: [start] }));
    target.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, touches: [moved], targetTouches: [moved], changedTouches: [moved] }));
  });
  await expect(page.locator(".mobile-pull-indicator")).toBeVisible();
  await expect(page.getByText(/Release to refresh · last 09:41/)).toBeVisible();
  await page.screenshot({ path: "/tmp/fidelity/flows/refresh-ptr-phone.png" });
  await captureLong(page, "/tmp/fidelity/flows/refresh-ptr-phone-long.png");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("fidelity:mobile-refresh-progress", {
    detail: { active: true, total: 5, completed: ["Binance", "OKX", "Interactive Brokers"] },
  })));
  await expect(page.getByText("Refreshing sources")).toBeVisible();
  await page.screenshot({ path: "/tmp/fidelity/flows/refresh-ptrrun-phone.png" });
  await captureLong(page, "/tmp/fidelity/flows/refresh-ptrrun-phone-long.png");
  await page.reload();
  await expect(page.getByText("$763,809.27").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".fd-overview-refresh, .fd-partial-refresh")).toBeVisible();
  await page.evaluate(() => {
    const original = (window as any).__e2eInvoke;
    (window as any).__e2eInvoke = (cmd: string, args: unknown, ...rest: unknown[]) =>
      cmd === "plugin:http|fetch_send" ? new Promise(() => {}) : original(cmd, args, ...rest);
  });
  await page.locator(".fd-overview-refresh, .fd-partial-refresh").click();
  const sourceSheet = page.getByRole("alertdialog", { name: "Source status" });
  await expect(sourceSheet).toHaveCount(0);
  await page.getByRole("button", { name: "Source status" }).click();
  await expect(sourceSheet).toBeVisible();
  await expect(sourceSheet).toContainText("Refreshing sources");
  await expect(sourceSheet.getByRole("progressbar")).toHaveCount(0);
  await expect.poll(() => sourceSheet.locator("[data-source-status-row]").count()).toBeGreaterThanOrEqual(5);
  await expect(sourceSheet.locator("[data-source-status-row]")).toHaveCount(5);
  await expect.poll(() => sourceSheet.locator("[data-source-status-row]").evaluateAll((rows) =>
    rows.slice(0, 5).map((row) => row.getAttribute("aria-label"))))
    .toEqual(["Binance", "OKX", "Ledger cold wallet", "0x4f…a91c", "Interactive Brokers"]);
  await expect(sourceSheet.getByRole("group", { name: "Binance" })).toContainText("Refreshing");
  await expect(sourceSheet.getByRole("group", { name: "OKX" })).toContainText("Refreshing");
  await expect(sourceSheet.locator('[data-source-status-row][aria-label="Ledger cold wallet"] > span')).toHaveText("Lg");
  await expect(sourceSheet.locator('[data-source-status-row][aria-label="0x4f…a91c"] > span')).toHaveText("0x");
  await expect(sourceSheet).toContainText("0 of 5 finished · 0 failed");
  await expect(sourceSheet.locator(".fd-refresh-progress-row small")).toHaveText([
    /Refreshing|Waiting/, /Refreshing|Waiting/, /Refreshing|Waiting/, /Refreshing|Waiting/, /Refreshing|Waiting/,
  ]);
  await page.screenshot({ path: "/tmp/fidelity/flows/refresh-progress-phone.png" });
  await captureLong(page, "/tmp/fidelity/flows/refresh-progress-phone-long.png");
});
