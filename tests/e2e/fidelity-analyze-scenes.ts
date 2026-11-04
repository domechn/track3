import type { Browser } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

export async function analyzePage(browser: Browser, route: "wallets" | "comparison") {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, userAgent, isMobile: true, hasTouch: true,
    colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC",
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-31T10:10:00Z"));
  await page.addInitScript(() => {
    localStorage.setItem("track3-ui-theme", "dark");
    localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([
      { sourceId: "binance", label: "Binance", kind: "exchange", provider: "Binance", status: "ok", lastSuccessAt: "2026-10-31T09:41:00.000Z", detail: "API key, read-only" },
      { sourceId: "okx", label: "OKX", kind: "exchange", provider: "OKX", status: "failed", category: "rateLimit", detail: "Rate limit exceeded (HTTP 429)", lastSuccessAt: "2026-10-31T09:12:00.000Z", startedAt: "2026-10-31T09:40:00.000Z", finishedAt: "2026-10-31T09:41:00.000Z" },
      { sourceId: "ledger", label: "Ledger cold wallet", kind: "wallet", status: "ok", lastSuccessAt: "2026-10-31T09:40:00.000Z" },
      { sourceId: "onchain", label: "0x4f…a91c", kind: "wallet", status: "ok", lastSuccessAt: "2026-10-31T09:40:00.000Z" },
      { sourceId: "ibkr", label: "Interactive Brokers", kind: "broker", status: "ok", lastSuccessAt: "2026-10-31T09:41:00.000Z" },
    ]));
    localStorage.setItem("track3-assistant-comparison-dates", JSON.stringify({ base: "2026-10-01", head: "2026-10-31" }));
  });
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute",
    { query: "DELETE FROM assets_v2 WHERE createdAt < '2026-10-01'", values: [] }));
  await page.goto(`/#/${route}`);
  if (route === "wallets") await page.evaluate(async () => {
    const schedulerPath = "/src/middlelayers/refresh-retry-scheduler.ts";
    const statusesPath = "/src/middlelayers/ui-state/source-status-store.ts";
    const { refreshRetryScheduler } = await import(schedulerPath);
    const { readStoredStatuses } = await import(statusesPath);
    refreshRetryScheduler.complete(readStoredStatuses());
  });
  mkdirSync(`/tmp/fidelity/${route}`, { recursive: true });
  return { context, page };
}

export async function captureLong(page: import("@playwright/test").Page, path: string) {
  const previous = await page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>(".mobile-tab-bar");
    if (!nav) return null;
    const previous = nav.getAttribute("style");
    nav.style.setProperty("position", "absolute", "important");
    nav.style.setProperty("top", `${document.getElementById("app-main-content")!.scrollHeight - 60}px`, "important");
    nav.style.setProperty("bottom", "auto", "important");
    return previous;
  });
  try {
    await page.screenshot({ path, fullPage: true });
  } finally {
    await page.evaluate((style) => {
      const nav = document.querySelector<HTMLElement>(".mobile-tab-bar");
      if (!nav) return;
      if (style === null) nav.removeAttribute("style");
      else nav.setAttribute("style", style);
    }, previous);
  }
}
