import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { installTauriBridge as installSampleBridge, seedDesktopAiSummary, seedDesktopSourceStatuses } from "./fidelity-scenes";
import { installPlanFidelityScene as installDesktopPlan } from "./plan-fidelity-scenes";
import { installPlanFidelityScene as installPhonePlan } from "./phone-plan-fidelity-scenes";
import { installTauriBridge as installSummaryBridge } from "./fidelity-desktop-scenes";
import { installTauriBridge as installRecordsBridge } from "./fidelity-bridge-captures";

const root = "/tmp/marketing/raw";
const phoneAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const tabletAgent = phoneAgent.replace("iPhone; CPU iPhone", "iPad; CPU");
const at = new Date("2026-10-31T09:45:00.000Z");
type Size = { width: number; height: number; scale: number; mobile?: boolean };

type Fixture = "sample" | "summary" | "plan-goals" | "plan-rebalance" | "records-cost" | "records-history";

async function scene(browser: Browser, size: Size, theme: "dark" | "light", fixture: Fixture) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.scale,
    userAgent: size.mobile ? size.width < 700 ? phoneAgent : tabletAgent : undefined,
    isMobile: !!size.mobile, hasTouch: !!size.mobile, colorScheme: theme,
    reducedMotion: "reduce", timezoneId: "UTC", locale: "en-US",
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(at);
  await page.addInitScript((selected) => {
    localStorage.setItem("track3-ui-theme", selected);
    localStorage.setItem("track3-ui-locale", "en");
    localStorage.setItem("track3-assistant-comparison-dates", JSON.stringify({ base: "2026-10-01", head: "2026-10-31" }));
    sessionStorage.setItem("track3-rebalance-options", JSON.stringify({
      mode: "full", injectedCash: 0, minimumTradeValue: 1000, ignoreBelowValue: 0, stablecoinsAsCash: false,
    }));
  }, theme);
  if (fixture === "summary") await installSummaryBridge(page, { fidelityDesktop: "summary" });
  else if (fixture.startsWith("records-")) await installRecordsBridge(page, {
    fidelityRecords: fixture === "records-cost" ? "cost" : "history",
  });
  else if (fixture.startsWith("plan-")) {
    if (size.mobile && size.width < 700) await installPhonePlan(page, fixture === "plan-goals" ? "goals" : "rebalance");
    else await installDesktopPlan(page, fixture === "plan-goals" ? "goals" : "rebalance");
  } else {
    await seedDesktopSourceStatuses(page);
    await installSampleBridge(page, { fidelitySample: "full", appVersion: "0.9.13" });
    await seedDesktopAiSummary(page);
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
      query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '31')", values: [],
    }));
  }
  return { context, page };
}

async function seedAssistant(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    const invoke = (window as any).__e2eInvoke;
    await invoke("plugin:sql|execute", {
      query: "UPDATE configuration SET data = ? WHERE id = 994",
      values: ['!ent:e2e:{"endpoint":"https://assistant.test/v1","apiKey":"sk-e2e","model":"gpt-4.1","contextSize":8192,"allowActions":true}'],
    });
    const messages = [
      { role: "user", content: "What drove my gain this week?", at: "2026-10-31T09:42:00.000Z" },
      { role: "assistant", blocks: [{ kind: "text", text: "Your portfolio is up **+$26,010.84 (+3.53%)** over the last 7 days, from $737,798.43 on 24 Oct to $763,809.27 today.\n\n**BTC** added the most in dollars (+$12,286.29, +6.4%). **SOL** moved most in price (+14.3%) and added $8,663.30. **AAPL** is the only position down (−3.8%, −$1,357.50)." }], at: "2026-10-31T09:42:30.000Z" },
    ];
    await invoke("plugin:sql|execute", {
      query: "INSERT INTO chat_sessions (id, title, createdAt, updatedAt, pinned, messageCount, preview) VALUES (?, ?, ?, ?, 0, ?, ?)",
      values: ["marketing-gain", "What drove my gain this week?", "2026-10-31T09:42:00.000Z", "2026-10-31T09:42:30.000Z", 2, "BTC added most in dollars, SOL in percent"],
    });
    const text = `!ent:e2e:${JSON.stringify({ version: 1, messages })}`;
    await invoke("plugin:fs|write_text_file", [...new TextEncoder().encode(text)], {
      headers: { path: "/e2e/app/ai/sessions/marketing-gain.json.ent" },
    });
  });
}

const markers: Record<string, string> = {
  overview: ".t3-hero-value, .fd-overview-value",
  summary: ".fidelity-summary-pnl, .fd-summary",
  wallets: ".fd-wallet-allocation, .analyze-wallets",
  comparison: ".analyze-comparison",
  "cost-basis": ".fidelity-cost-kpis",
  history: ".fidelity-history, .d2-history",
  rebalance: '[data-testid="rebalance-summary"]',
  goals: '[data-testid="goals-summary"]',
  assistant: '[data-testid="chat-session-layout"]',
  sources: ".fidelity-source-row, .t3-fidelity-source-page",
  settings: ".sync-settings-page, .ios-d3-settings",
};

async function capture(page: Page, route: string, path: string, options: { amount?: boolean; detail?: boolean } = {}) {
  const assistantWelcome = path === "ios/assistant-light.png";
  await page.goto(route === "assistant" ? assistantWelcome ? "/#/assistant" : "/#/assistant/marketing-gain"
    : route === "settings" ? "/#/settings/sync"
      : route === "sources" ? "/#/settings/configuration?section=sources"
      : `/#/${route}`);
  await expect(page.locator(markers[route]).first()).toBeVisible({ timeout: 40_000 });
  if (route === "history" && options.detail) {
    const row = page.locator(".history-mobile-snapshot-button").first();
    await expect(row).toContainText("$763,809.27");
    await row.click();
    await expect(page.getByRole("region", { name: "Snapshot details" })).toContainText("$763,809.27");
  }
  if (route === "history" && !options.detail) {
    await expect(page.locator(".history-mobile-snapshot, [data-testid='history-snapshot-row']").first())
      .toContainText("$763,809.27", { timeout: 40_000 });
  }
  if (route === "summary") await expect(page.locator(".fidelity-summary, .fd-summary").first()).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  if (route === "cost-basis") await expect(page.getByTestId("cost-desktop-table")).toContainText("BTC");
  if (route === "rebalance") await expect(page.getByTestId("rebalance-summary")).toContainText("$763,809.27");
  if (route === "goals") await expect(page.getByTestId("goals-summary")).toContainText("6 of 7", { timeout: 40_000 });
  if (route === "assistant") {
    if (assistantWelcome) await expect(page.getByTestId("chat-welcome")).toBeVisible();
    else await expect(page.getByText("What drove my gain this week?").last()).toBeVisible();
  }
  if (path === "desktop/settings.png") await expect(page.getByText("What to sync")).toBeVisible();
  if (options.amount) await expect(page.getByText("$763,809.27").first()).toBeVisible({ timeout: 40_000 });
  await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 40_000 });
  const fontsLoaded = await page.evaluate(async () => {
    const faces = await Promise.all([
      document.fonts.load('13px "Public Sans Variable"'),
      document.fonts.load('13px "Fidelity Public Sans"'),
    ]);
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.getElementById("app-main-content")!.scrollTo(0, 0);
    for (const node of document.querySelectorAll<HTMLElement>("[data-radix-scroll-area-viewport]")) node.scrollTop = 0;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return faces.every((loaded) => loaded.length > 0);
  });
  expect(fontsLoaded).toBe(true);
  if (route === "overview" && (path.startsWith("desktop/") || path.startsWith("readme/"))) {
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: viewport.width + 1, height: viewport.height });
    await page.setViewportSize(viewport);
    await page.evaluate(async () => {
      const canvas = document.querySelector<HTMLCanvasElement>(".t3-hero-chart canvas");
      if (!canvas) throw new Error("Overview chart canvas missing");
      let previous = "";
      let stableFrames = 0;
      for (let attempt = 0; attempt < 20 && stableFrames < 2; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const next = canvas.toDataURL();
        stableFrames = next === previous ? stableFrames + 1 : 0;
        previous = next;
      }
      if (stableFrames < 2) throw new Error("Overview chart did not settle");
    });
  }
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|0x[0-9a-fA-F]{8,}|sk-[\w-]+|fidelity-key|fixture|demo-key|\bLoading\b|Refresh in progress/i);
  mkdirSync(join(root, path, ".."), { recursive: true });
  await page.screenshot({ path: join(root, path), animations: "disabled", caret: "hide" });
}

test("captures the sample portfolio for marketing", async ({ browser }, testInfo) => {
  test.skip(process.env.TRACK3_MARKETING !== "1" || testInfo.project.name !== "desktop");
  test.setTimeout(600_000);
  rmSync(root, { recursive: true, force: true });
  const desktop = { width: 1600, height: 1000, scale: 1 };
  const readme = { width: 1512, height: 1012, scale: 2 };
  const phone = { width: 390, height: 844, scale: 2, mobile: true };
  const tablet = { width: 1376, height: 1032, scale: 1, mobile: true };
  const work: { size: Size; theme: "dark" | "light"; fixture: Fixture; shots: [string, string, { amount?: boolean; detail?: boolean }?][] }[] = [
    { size: desktop, theme: "dark", fixture: "sample", shots: [
      ["overview", "desktop/overview-dark.png", { amount: true }], ["wallets", "desktop/wallets.png", { amount: true }],
      ["comparison", "desktop/comparison.png"], ["settings", "desktop/settings.png"], ["assistant", "desktop/assistant.png"],
    ] },
    { size: desktop, theme: "dark", fixture: "records-cost", shots: [["cost-basis", "desktop/cost-basis.png"]] },
    { size: desktop, theme: "dark", fixture: "records-history", shots: [["history", "desktop/history.png"]] },
    { size: desktop, theme: "light", fixture: "sample", shots: [["overview", "desktop/overview.png", { amount: true }]] },
    { size: desktop, theme: "dark", fixture: "summary", shots: [["summary", "desktop/profit.png"]] },
    { size: desktop, theme: "dark", fixture: "plan-rebalance", shots: [["rebalance", "desktop/rebalance.png"]] },
    { size: desktop, theme: "dark", fixture: "plan-goals", shots: [["goals", "desktop/goals.png"]] },
    { size: readme, theme: "dark", fixture: "sample", shots: [
      ["overview", "readme/sc1.png", { amount: true }], ["wallets", "readme/sc3.png", { amount: true }],
    ] },
    { size: readme, theme: "dark", fixture: "records-cost", shots: [["cost-basis", "readme/sc4.png"]] },
    { size: readme, theme: "dark", fixture: "records-history", shots: [["history", "readme/sc5.png"]] },
    { size: readme, theme: "dark", fixture: "summary", shots: [["summary", "readme/sc2.png"]] },
    { size: readme, theme: "dark", fixture: "plan-rebalance", shots: [["rebalance", "readme/sc6.png"]] },
    { size: readme, theme: "dark", fixture: "plan-goals", shots: [["goals", "readme/sc7.png"]] },
  ];
  for (const theme of ["dark", "light"] as const) {
    work.push({ size: phone, theme, fixture: "sample", shots: [
      ["overview", `ios/overview-${theme}.png`, { amount: true }],
      ["summary", `ios/analytics-${theme}.png`],
      ["wallets", `ios/wallets-${theme}.png`, { amount: true }],
      ["sources", `ios/sources-${theme}.png`], ["assistant", `ios/assistant-${theme}.png`],
    ] });
    work.push({ size: phone, theme, fixture: "records-history", shots: [["history", `ios/history-${theme}.png`]] });
    work.push({ size: phone, theme, fixture: "plan-goals", shots: [["goals", `ios/goals-${theme}.png`]] });
    work.push({ size: tablet, theme, fixture: "sample", shots: [
      ["overview", `ipad/pro-landscape-overview-${theme}.png`, { amount: true }],
      ["assistant", `ipad/pro-landscape-assistant-${theme}.png`],
      ["settings", `ipad/pro-landscape-settings-${theme}.png`],
    ] });
    work.push({ size: tablet, theme, fixture: "records-history", shots: [
      ["history", `ipad/pro-landscape-history-detail-${theme}.png`, { detail: true }],
    ] });
  }
  for (const group of work) {
    const { context, page } = await scene(browser, group.size, group.theme, group.fixture);
    try {
      if (group.shots.some(([route]) => route === "assistant")) await seedAssistant(page);
      for (const [route, path, options] of group.shots) await capture(page, route, path, options);
    } finally {
      await context.close();
    }
  }
});
