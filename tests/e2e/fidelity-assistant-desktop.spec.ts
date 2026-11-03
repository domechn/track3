import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

const captureDir = "/tmp/fidelity-desktop/assistant";
const at = "2026-10-31T09:42:00.000Z";
const sessions = [
  ["gain", "What drove my gain this week?", "BTC added most in dollars, SOL in percent", at],
  ["rebalance", "Rebalance plan, 30% BTC", "Sell USDT, buy BTC to reach 30%…", "2026-10-30T09:42:00.000Z"],
  ["profit", "Explain my 30D P&L", "+$34,641.48 in 30 days, led by BTC", "2026-10-29T09:42:00.000Z"],
  ["stable", "Is my stablecoin share too high?", "USDT and USDC are 29.1% of the total", "2026-10-27T09:42:00.000Z"],
  ["compare", "Compare 24 Oct with 31 Oct", "Total rose by $26,010.84", "2026-10-24T09:42:00.000Z"],
  ["ideas", "Alert ideas for SOL", "A 7d move above 10% fits its recent range", "2026-10-22T09:42:00.000Z"],
  ["change", "What changed since 1 Oct?", "Total went from $729,167.79 to $763,809.27", "2026-10-20T09:42:00.000Z"],
] as const;

const answer = `Your portfolio is up **+$26,010.84 (+3.53%)** over the last 7 days, from $737,798.43 on 24 Oct to $763,809.27 today.

Change in value by asset, 24 Oct to 31 Oct. Stables = USDT + USDC.

| Asset | Value now | Price, 7D | Value change |
| :--- | ---: | ---: | ---: |
| BTC | $205,737.58 | +6.4% | +$12,286.29 |
| SOL | $69,044.00 | +14.3% | +$8,663.30 |
| ETH | $151,251.35 | +3.1% | +$4,507.36 |
| BNB | $49,774.10 | +2.7% | +$1,324.26 |
| NVDA | $31,075.00 | +1.7% | +$532.40 |
| Stables | $222,446.74 | – | +$54.73 |
| AAPL | $34,480.50 | −3.8% | −$1,357.50 |
| Total | $763,809.27 | | +$26,010.84 |

- **SOL** moved most, +14.3% in price, and added $8,663.30 on a 9.0% weight.
- **BTC** added the most in dollars (+$12,286.29, +6.4%). It is 3.1 pts below your 30.0% goal.
- **AAPL** is the only position down: −3.8%, −$1,357.50.

BTC is at $63,842.11, so it needs 9.6% more to reach $70,000. I can set an alert for that.`;

const alertAction = {
  kind: "pending_action", id: "alert-btc-70000", toolCallId: "tool-alert-btc-70000",
  name: "create_alert",
  args: { kind: "asset_price_target", assetType: "crypto", symbol: "BTC", comparator: "gte", threshold: 70000, window: null, cooldownSeconds: 86400, enabled: true },
  preview: {
    before: "null",
    after: JSON.stringify({ kind: "asset_price_target", assetType: "crypto", symbol: "BTC", comparator: "gte", threshold: 70000, window: null, cooldownSeconds: 86400, enabled: true }),
  },
  risk: "low", status: "pending", createdAt: at, expiresAt: "2026-11-01T09:42:00.000Z",
};

async function invoke(page: Page, command: string, args: unknown, options?: unknown) {
  return page.evaluate(({ command, args, options }) =>
    (window as any).__e2eInvoke(command, args, options), { command, args, options });
}

async function seedSession(page: Page, id: string, messages: unknown[], title = "What drove my gain this week?",
  preview = "BTC added most in dollars, SOL in percent", updatedAt = at) {
  await invoke(page, "plugin:sql|execute", {
    query: "INSERT INTO chat_sessions (id, title, createdAt, updatedAt, pinned, messageCount, preview) VALUES (?, ?, ?, ?, 0, ?, ?)",
    values: [id, title, updatedAt, updatedAt, messages.length, preview],
  });
  const text = `!ent:e2e:${JSON.stringify({ version: 1, messages })}`;
  await invoke(page, "plugin:fs|write_text_file", [...new TextEncoder().encode(text)],
    { headers: { path: encodeURIComponent(`/e2e/app/ai/sessions/${id}.json.ent`) } });
}

async function seed(page: Page, state: string) {
  if (state === "nokey") {
    await invoke(page, "plugin:sql|execute", { query: "DELETE FROM configuration WHERE id = 994", values: [] });
    return;
  }
  await invoke(page, "plugin:sql|execute", {
    query: "UPDATE configuration SET data = ? WHERE id = 994",
    values: [`!ent:e2e:${JSON.stringify({
      endpoint: "https://assistant.test/v1", apiKey: "sk-e2e", model: "gpt-4.1", contextSize: 8192,
      inputPricePerMillionTokens: 2.5, outputPricePerMillionTokens: 10, allowActions: true, proactiveInsightsSummary: true,
    })}`],
  });
  await invoke(page, "plugin:sql|execute", {
    query: "INSERT INTO rebalance_profiles (id, targets, tolerance_percent) VALUES (1, ?, 0)",
    values: [JSON.stringify([
      { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 30 },
      { kind: "asset", assetType: "crypto", symbol: "SOL", percent: 8 },
      { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 20 },
      { kind: "asset", assetType: "crypto", symbol: "BNB", percent: 7 },
      { kind: "asset", assetType: "stock", symbol: "NVDA", percent: 5 },
      { kind: "asset", assetType: "stock", symbol: "AAPL", percent: 5 },
      { kind: "asset", assetType: "crypto", symbol: "USDT", percent: 20 },
      { kind: "asset", assetType: "crypto", symbol: "USDC", percent: 5 },
    ])],
  });
  for (let index = 0; index < 7; index++) {
    const approvedRule = state === "approved" && index === 6;
    await invoke(page, "plugin:sql|execute", {
      query: approvedRule
        ? "INSERT INTO alert_rules (kind, asset_type, symbol, comparator, threshold, enabled, cooldown_seconds) VALUES ('asset_price_target', 'crypto', 'BTC', 'gte', 70000, 1, 86400)"
        : "INSERT INTO alert_rules (kind, asset_type, symbol, comparator, threshold, enabled) VALUES (?, NULL, NULL, 'gte', ?, 1)",
      values: approvedRule ? [] : ["total_value_target", index === 0 ? 800000 : 900000 + index * 10000],
    });
  }
  await invoke(page, "plugin:sql|execute", {
    query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (992, ?)",
    values: [`!ent:e2e:${JSON.stringify({
      snapshotUuid: "fidelity-day-30", dismissedIds: [], insights: [
        { id: "mover:percent:7d", severity: "info", messageKey: "insights.mover",
          data: { symbol: "SOL", window: "7d", changeValue: 8663.30, changePercent: 14.3 } },
        { id: "drift", severity: "info", messageKey: "insights.drift",
          data: { symbol: "BTC", deviationPercent: -10.3 } },
        { id: "goal:1", severity: "warning", messageKey: "insights.goalNear",
          data: { value: 763809.27, threshold: 800000, reached: false } },
      ],
    })}`],
  });
  const usedMainIn = state === "approved" ? 7436 : 3412;
  const usedMainOut = state === "approved" ? 544 : 486;
  const backgroundCount = state === "approved" ? 39 : 40;
  const backgroundUsage = Array.from({ length: backgroundCount }, (_, index) => ({
    role: "assistant", blocks: [{ kind: "text", text: `Saved reply ${index + 1}` }],
    usage: {
      promptTokens: Math.floor((118420 - usedMainIn) / backgroundCount)
        + (index < (118420 - usedMainIn) % backgroundCount ? 1 : 0),
      completionTokens: Math.floor((16905 - usedMainOut) / backgroundCount)
        + (index < (16905 - usedMainOut) % backgroundCount ? 1 : 0),
      source: "reported",
    },
    at: "2026-10-25T09:42:00.000Z",
  }));
  let backgroundOffset = 0;
  for (const [sessionIndex, [id, title, preview, updatedAt]] of sessions.entries()) {
    if (id === "gain") continue;
    const count = Math.floor(backgroundCount / 6) + (sessionIndex - 1 < backgroundCount % 6 ? 1 : 0);
    await seedSession(page, id, backgroundUsage.slice(backgroundOffset, backgroundOffset + count), title, preview, updatedAt);
    backgroundOffset += count;
  }
  if (state === "error") {
    await seedSession(page, "risky", [
      { role: "user", content: "Which of my positions is the riskiest right now?", at: "2026-10-31T09:51:00.000Z" },
      { role: "assistant", blocks: [{ kind: "text", text: "[error] HTTP 429, retry after 20 s" }], at: "2026-10-31T09:51:10.000Z" },
    ], "Which positions are riskiest?", "Request failed, message saved", "2026-10-31T09:51:00.000Z");
  }
  const messages = [
    { role: "user", content: "What drove my gain this week? And should I set an alert on BTC?", at },
    { role: "assistant", blocks: [{ kind: "text", text: answer }, { ...alertAction,
      status: state === "approved" ? "approved" : "pending",
      ...(state === "approved" ? { result: "Alert created", createdAt: "2026-10-31T09:43:00.000Z" } : {}) }],
      usage: { promptTokens: 3412, completionTokens: 486, source: "reported" }, at: "2026-10-31T09:42:30.000Z" },
    ...(state === "approved" ? [
      { role: "user", content: "Yes, approve it.", at: "2026-10-31T09:43:00.000Z" },
      { role: "assistant", blocks: [{ kind: "text", text: "Done. The rule **BTC price above $70,000** is on, with a 24 hour cooldown. It starts at 91.2% progress and is checked at each refresh." }],
        usage: { promptTokens: 4024, completionTokens: 58, source: "reported" }, at: "2026-10-31T09:43:20.000Z" },
    ] : []),
  ];
  await seedSession(page, "gain", messages);
}

for (const state of ["new", "thread", "chat", "approved", "error", "nokey"] as const) {
  test(`assistant ${state} follows the desktop design`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 }, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC",
    });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T09:52:00.000Z"));
      await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
      await installTauriBridge(page, { fidelitySample: "full" });
      await seed(page, state);
      await page.goto(`/#/assistant${state === "new" || state === "nokey" ? "" : state === "error" ? "/risky" : "/gain"}`);
      await expect(page.locator(state === "nokey" ? '[data-testid="assistant-not-configured"]' : '[data-testid="chat-session-layout"]')).toBeVisible({ timeout: 30_000 });
      if (state !== "nokey") {
        await expect(page.locator('[data-testid="chat-card"]')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator(".t3-assistant-context-source").first()).toContainText("$763,809.27", { timeout: 30_000 });
        await expect(page.locator(".t3-assistant-context-section").getByText("Ask first", { exact: true }).first()).toHaveCSS("color", "rgb(255, 255, 255)");
        await expect(page.locator(".t3-assistant-context-source").nth(1)).toHaveCSS("border-top-style", "solid");
      }
      if (state === "thread") {
        await page.addStyleTag({ content: `
          .t3-assistant-page [data-testid="chat-session-layout"] { height: auto; min-height: calc(100vh - 128px); overflow: visible; align-items: start; }
          .t3-assistant-page [data-testid="chat-session-layout"] > div:has([data-testid="session-sidebar"]),
          .t3-assistant-page [data-testid="chat-session-layout"] > div:has([data-testid="session-sidebar"]) > div { height: auto; }
          .t3-assistant-page [data-testid="chat-card"] { height: auto; overflow: visible; }
          .t3-assistant-page [data-radix-scroll-area-root],
          .t3-assistant-page [data-radix-scroll-area-viewport] { height: auto !important; overflow: visible !important; }
          .t3-assistant-page [data-testid="session-sidebar"] { position: sticky; top: 20px; height: auto; }
          .t3-assistant-page .t3-assistant-context { position: sticky; top: 20px; height: 817px; }
        ` });
      }
      if (state === "chat" || state === "approved") {
        await page.locator('[data-testid="chat-card"] [data-radix-scroll-area-viewport]').first()
          .evaluate((element) => { element.scrollTop = element.scrollHeight; });
      }
      await expect(page.locator(".t3-assistant-page h1")).toHaveText("Assistant");
      await expect(page.locator('nav[aria-label="Main navigation"] a[aria-current="page"] svg path'))
        .toHaveAttribute("d", "M3 4h12v8H8l-3.5 3v-3H3z");
      if (state !== "nokey") {
        await expect(page.locator('[data-testid="session-sidebar"]')).toBeVisible();
        await expect(page.locator(".t3-assistant-context")).toBeVisible();
        await expect(page.locator(".t3-assistant-session-time").first()).toHaveText(state === "error" ? "09:51" : "09:42");
        await expect(page.locator(".t3-assistant-context")).toContainText("7 rules, 2 unread");
        await expect(page.locator(".t3-assistant-context")).toContainText("118,420");
        await expect(page.locator(".t3-assistant-context")).toContainText("16,905");
      }
      if (state === "new") {
        await expect(page.locator(".t3-insights-card")).toBeVisible();
        await expect(page.locator('[data-testid="chat-send"]')).toHaveCSS("background-color", "rgb(38, 38, 44)");
        await expect(page.locator(".t3-insights-card")).toContainText("SOL is +14.3% in 7 days");
        await expect(page.locator(".t3-insights-card")).toContainText("BTC is 3.1 pts under target");
        await expect(page.locator(".t3-insights-card")).toContainText("95.5% of the way to $800,000");
      }
      if (state === "chat" || state === "thread") {
        await expect(page.locator('[aria-label="Confirm assistant action"]')).toBeVisible();
        await expect(page.locator(".t3-assistant-thread-meta")).toHaveAttribute("aria-label", "1 reply · $0.013 · gpt-4.1");
        const caption = page.getByText("Change in value by asset, 24 Oct to 31 Oct. Stables = USDT + USDC.");
        await expect(caption).toHaveCSS("font-size", "12px");
        await expect(page.getByRole("cell", { name: "−$1,357.50" })).toHaveClass(/t3-assistant-loss/);
        await expect(page.locator('[data-testid="assistant-bubble"] .markdown-content tbody tr').last().locator("td").first()).toHaveCSS("font-weight", "600");
      }
      if (state === "approved") {
        await expect(page.locator('[aria-label="Confirm assistant action"]')).toContainText("Approved");
        await expect(page.locator(".t3-assistant-thread-meta")).toHaveAttribute("aria-label", "2 replies · $0.024 · gpt-4.1");
      }
      if (state === "error") await expect(page.getByRole("alert")).toContainText("Request failed");
      if (state === "chat" || state === "thread" || state === "approved") {
        await expect(page.locator('[aria-label="Confirm assistant action"]')).toContainText("$63,842.11");
      }
      if (state !== "nokey") await page.getByTestId("chat-input").blur();
      mkdirSync(captureDir, { recursive: true });
      await page.screenshot({ path: `${captureDir}/${state}.png`, fullPage: true });
    } finally {
      await context.close();
    }
  });
}
