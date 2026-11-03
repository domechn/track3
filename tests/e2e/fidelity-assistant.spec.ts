import { mkdir, writeFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { installTauriBridge } from "./fidelity-scenes";

const output = "/tmp/fidelity/assistant";
const at = "2026-10-31T09:42:00.000Z";
const reply = `Your portfolio is up **+$26,010.84 (+3.53%)** over the last 7 days, from $737,798.43 on 24 Oct to $763,809.27 today.

Change in value by asset, 24 Oct to 31 Oct. Stables = USDT + USDC.

| Asset | Value now | Price, 7D | Value change |
| --- | ---: | ---: | ---: |
| BTC | $205,737.58 | +6.4% | +$12,286.29 |
| SOL | $69,044.00 | +14.3% | +$8,663.30 |
| ETH | $151,251.35 | +3.1% | +$4,507.36 |
| BNB | $49,774.10 | +2.7% | +$1,324.26 |
| NVDA | $31,075.00 | +1.7% | +$532.40 |
| Stables | $222,446.74 | – | +$54.73 |
| AAPL | $34,480.50 | −3.8% | −$1,357.50 |
| **Total** | **$763,809.27** | | **+$26,010.84** |

- **SOL** moved most, +14.3% in price, and added $8,663.30 on a 9.0% weight.
- **BTC** added the most in dollars (+$12,286.29, +6.4%). It is 3.1 pts below your 30.0% goal.
- **AAPL** is the only position down: −3.8%, −$1,357.50.

BTC is at $63,842.11, so it needs 9.6% more to reach $70,000. I can set an alert for that.`;

const action = {
  kind: "pending_action", id: "e2e-btc-alert", toolCallId: "e2e-alert-call",
  name: "create_alert",
  args: { kind: "asset_price_target", symbol: "BTC", assetType: "crypto", comparator: "gte", threshold: 70000, cooldownSeconds: 86400, enabled: true },
  preview: { before: "{}", after: JSON.stringify({ kind: "asset_price_target", symbol: "BTC", assetType: "crypto", comparator: "gte", threshold: 70000, cooldownSeconds: 86400, enabled: true }) },
  risk: "low", status: "pending", createdAt: at, expiresAt: "2026-11-10T00:00:00.000Z",
};
const mainMessages = [
  { role: "user", content: "What drove my gain this week? And should I set an alert on BTC?", at },
  { role: "assistant", blocks: [{ kind: "text", text: reply }, action],
    usage: { promptTokens: 3412, completionTokens: 486, source: "reported" }, at: "2026-10-31T09:42:30.000Z" },
];
const sessions = [
  ["assistant-main", "What drove my gain this week?", "BTC added most in dollars, SOL in percent", "2026-10-31T09:42:00.000Z", mainMessages],
  ["assistant-rebalance", "Rebalance plan, 30% BTC", "Sell USDT, buy BTC to reach 30%…", "2026-10-30T11:00:00.000Z", []],
  ["assistant-pnl", "Explain my 30D P&L", "+$34,641.48 in 30 days, led by BTC", "2026-10-29T11:00:00.000Z", []],
  ["assistant-stables", "Is my stablecoin share too high?", "USDT and USDC are 29.1% of the total", "2026-10-27T11:00:00.000Z", []],
  ["assistant-compare", "Compare 24 Oct with 31 Oct", "Total rose by $26,010.84", "2026-10-24T11:00:00.000Z", []],
  ["assistant-sol", "Alert ideas for SOL", "A 7d move above 10% fits its recent range", "2026-10-22T11:00:00.000Z", []],
  ["assistant-oct", "What changed since 1 Oct?", "Total went from $729,167.79 to $763,809.27", "2026-10-20T11:00:00.000Z", []],
] as const;

async function seed(page: Page, state: string) {
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/");
  await page.evaluate(async ({ sessions, mainMessages, action, state, reply }) => {
    const invoke = (window as any).__e2eInvoke;
    await invoke("plugin:sql|execute", { query: "UPDATE configuration SET data = ? WHERE id = 994",
      values: [`!ent:e2e:${JSON.stringify({ endpoint: "https://assistant.test/v1", apiKey: "sk-e2e", model: "gpt-4.1", contextSize: 8192,
        inputPricePerMillionTokens: 2.5, outputPricePerMillionTokens: 10, allowActions: true })}`] });
    // The exact TARGET map from the design's ds/pages/plan-common.js.
    const targets = [["BTC", 30], ["ETH", 20], ["SOL", 8], ["BNB", 7], ["USDT", 20], ["USDC", 5], ["NVDA", 5], ["AAPL", 5]]
      .map(([symbol, percent]) => ({ kind: "asset", assetType: symbol === "NVDA" || symbol === "AAPL" ? "stock" : "crypto", symbol, percent }));
    await invoke("plugin:sql|execute", { query: "INSERT OR REPLACE INTO rebalance_profiles (id, targets, tolerance_percent) VALUES (1, ?, 0)",
      values: [JSON.stringify(targets)] });
    await invoke("plugin:sql|execute", { query: "INSERT INTO alert_rules (kind, comparator, threshold, enabled, cooldown_seconds) VALUES ('total_value_target', 'gte', 800000, 1, 86400)", values: [] });
    const insightCard = { snapshotUuid: "fidelity-day-30", dismissedIds: [], insights: [
      { id: "mover:percent:7d", severity: "info", messageKey: "insights.mover",
        data: { symbol: "SOL", window: "7d", changeValue: 8663.3, changePercent: 14.3 } },
      { id: "drift:BTC", severity: "warning", messageKey: "insights.drift", data: { symbol: "BTC", deviationPercent: -3.1 } },
      { id: "goal:1", severity: "warning", messageKey: "insights.goalNear",
        data: { value: 763809.27, threshold: 800000, reached: false } },
    ] };
    await invoke("plugin:sql|execute", { query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (992, ?)",
      values: [`!ent:e2e:${JSON.stringify(insightCard)}`] });
    if (state === "nokey") {
      await invoke("plugin:sql|execute", { query: "DELETE FROM configuration WHERE id = 994", values: [] });
    }
    for (const [id, title, preview, updatedAt, messages] of sessions) {
      const persisted = state === "approved" && id === "assistant-main" ? [
        mainMessages[0], { ...mainMessages[1], blocks: [{ kind: "text", text: reply },
          { ...action, status: "approved", result: "Created alert: BTC above $70,000" }] },
        { role: "user", content: "Yes, approve it.", at: "2026-10-31T09:43:00.000Z" },
        { role: "assistant", blocks: [{ kind: "text", text: "Done. The rule **BTC price above $70,000** is on, with a 24 hour cooldown. It starts at 91.2% progress and is checked at each refresh." }],
          usage: { promptTokens: 4024, completionTokens: 58, source: "reported" }, at: "2026-10-31T09:43:30.000Z" },
      ] : messages;
      await invoke("plugin:sql|execute", { query: `INSERT INTO chat_sessions (id, title, createdAt, updatedAt, pinned, messageCount, preview) VALUES (?, ?, ?, ?, 0, ?, ?)`,
        values: [id, title, updatedAt, updatedAt, persisted.length, preview] });
      if (persisted.length) {
        const text = `!ent:e2e:${JSON.stringify({ version: 1, messages: persisted })}`;
        const bytes = [...new TextEncoder().encode(text)];
        await invoke("plugin:fs|write_text_file", bytes, { headers: { path: `/e2e/app/ai/sessions/${id}.json.ent` } });
      }
    }
    if (state === "error") {
      const failedMessages = [
        { role: "user", content: "Which of my positions is the riskiest right now?", at: "2026-10-31T09:51:00.000Z" },
        { role: "assistant", blocks: [{ kind: "text", text: "[error] HTTP 429, retry after 20 s" }], at: "2026-10-31T09:51:10.000Z" },
      ];
      await invoke("plugin:sql|execute", { query: "INSERT INTO chat_sessions (id, title, createdAt, updatedAt, pinned, messageCount, preview) VALUES (?, ?, ?, ?, 0, ?, ?)",
        values: ["assistant-error", "Which positions are riskiest?", "2026-10-31T09:51:00.000Z", "2026-10-31T09:51:00.000Z", 2, "Request failed, message saved"] });
      const text = `!ent:e2e:${JSON.stringify({ version: 1, messages: failedMessages })}`;
      await invoke("plugin:fs|write_text_file", [...new TextEncoder().encode(text)], { headers: { path: "/e2e/app/ai/sessions/assistant-error.json.ent" } });
    }
  }, { sessions, mainMessages, action, state, reply });
}

test.use({
  viewport: { width: 390, height: 844 },
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  deviceScaleFactor: 2,
});

for (const state of ["new", "phone", "approved", "error", "nokey", "sessions", "kbd"]) {
  test(`assistant ${state} capture`, async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "Phone fidelity capture");
    await page.clock.setFixedTime(new Date("2026-10-31T09:45:00.000Z"));
    await seed(page, state);
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.goto(state === "phone" || state === "approved" || state === "kbd"
      ? "/#/assistant/assistant-main" : state === "error" ? "/#/assistant/assistant-error" : "/#/assistant");
    if (state === "nokey") await page.getByTestId("assistant-not-configured").waitFor();
    else await page.getByTestId("chat-session-layout").waitFor();
    if (state === "new") {
      await expect(page.getByText(/Buying .+ of BTC would bring it back to 30\.0%, funded by selling USDT/)).toBeVisible();
    }
    if (state === "approved") {
      await expect(page.locator(".fidelity-action-label")).toHaveCSS("font-size", "12px");
      await expect(page.locator(".fidelity-chat-header-title h3")).toHaveText("What drove my gain this week?");
      await expect(page.locator(".mobile-tab-bar")).toBeHidden();
    }
    if (state === "phone" || state === "approved" || state === "kbd" || state === "error") {
      await page.getByTestId("assistant-bubble").first().waitFor();
    }
    if (state === "sessions") {
      await page.getByTestId("sidebar-toggle").click();
      await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
      await expect(page.locator(".fidelity-session-section-head h2")).toHaveCSS("font-size", "15px");
    }
    if (state === "kbd") {
      await page.getByTestId("chat-input").fill("What would it take to hit $800,000?");
      await page.evaluate(() => {
        Object.defineProperty(window.visualViewport, "height", { configurable: true, value: 553 });
        window.dispatchEvent(new Event("resize"));
        const style = document.createElement("style");
        style.textContent = `.fidelity-keyboard-mock{position:fixed;left:0;right:0;top:553px;height:291px;background:#1a1a1e;border-top:1px solid #222224;padding:10px 4px;z-index:50}
          .fidelity-keyboard-mock .row{display:flex;gap:6px;justify-content:center;margin-bottom:10px}
          .fidelity-keyboard-mock i{height:44px;flex:1;max-width:34px;border-radius:5px;background:#2e2e34}
          .fidelity-keyboard-mock i.wide{max-width:none;flex:0 0 52px;background:#24242a}
          .fidelity-keyboard-mock i.space{max-width:none;flex:1}`;
        document.head.append(style);
        const keyboard = document.createElement("div");
        keyboard.className = "fidelity-keyboard-mock";
        keyboard.setAttribute("aria-label", "Test keyboard placeholder");
        keyboard.innerHTML = [10, 9, 7].map((n) => `<div class="row">${"<i></i>".repeat(n)}</div>`).join("")
          + '<div class="row"><i class="wide"></i><i class="space"></i><i class="wide"></i></div>';
        document.body.append(keyboard);
      });
      await expect(page.locator(".fidelity-chat-actions")).toBeHidden();
    }
    await page.waitForFunction(() => {
      const target = document.querySelector('[data-testid="chat-session-layout"], [data-testid="assistant-not-configured"]');
      return target && getComputedStyle(target.parentElement!).opacity === "1";
    });
    await page.evaluate(() => document.fonts.ready);
    await mkdir(output, { recursive: true });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: `${output}/${state}.png` });
    if (state === "kbd") {
      const bottom = await page.locator("[data-testid=chat-session-layout]").evaluate(
        (element) => element.getBoundingClientRect().bottom);
      expect(bottom).toBeGreaterThanOrEqual(552);
    }
    if (state === "phone") {
      const bottom = await page.locator("[data-testid=chat-session-layout]").evaluate(
        (element) => element.getBoundingClientRect().bottom);
      expect(bottom).toBeGreaterThanOrEqual(843);
    }
    if (state === "new") {
      const metrics = await page.evaluate(() => Object.fromEntries([
        ".fidelity-chat-welcome", ".fidelity-chat-welcome-intro", ".fidelity-assistant-insights",
        ".fidelity-assistant-insights > header", ".fidelity-assistant-insights > header h3",
        ".fidelity-assistant-insights-meta", ".fidelity-assistant-insight",
        ".fidelity-assistant-insight strong", ".fidelity-assistant-insight p", ".fidelity-assistant-insight button",
      ].map((selector) => {
        const el = document.querySelector(selector);
        if (!el) return [selector, null];
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return [selector, { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          fontSize: style.fontSize, lineHeight: style.lineHeight, padding: style.padding, margin: style.margin }];
      })));
      await writeFile(`${output}/new-metrics.json`, JSON.stringify(metrics, null, 2));
    }
    if (state === "new") {
      await expect(page.getByText("Ask about your portfolio")).toBeVisible();
      await expect(page.getByText("Insights for today")).toBeVisible();
      await expect(page.getByText("SOL is +14.3% in 7 days")).toBeVisible();
      await expect(page.locator(".fidelity-assistant-insights-meta")).toContainText("Data refreshed");
    }
    if (state === "phone") {
      await expect(page.getByText("Create alert: BTC above $70,000")).toBeVisible();
      expect((await page.locator(".fidelity-action-card").boundingBox())!.height).toBeLessThanOrEqual(359);
      await expect(page.getByText("Cooldown", { exact: true })).toBeVisible();
      await expect(page.locator(".fidelity-action-card")).toContainText("24 hours");
      await expect(page.locator(".fidelity-action-card")).toContainText("Asset type");
      await expect(page.locator(".fidelity-action-card")).toContainText("Enabled");
      const table = page.getByTestId("assistant-bubble").first().locator("table");
      await expect(table.locator("thead th")).toHaveCount(4);
      await expect(table.locator("thead")).toBeVisible();
      await expect(table.locator("tbody tr").filter({ hasText: "AAPL" }).locator("td").nth(2)).toHaveCSS("color", "rgb(238, 106, 130)");
      await expect(table.locator("tbody tr").filter({ hasText: "Total" }).locator("td").last()).toHaveCSS("color", "rgb(95, 195, 156)");
      await page.evaluate(() => {
        const style = document.createElement("style");
        style.textContent = `
          html, body, #root, .app-layout, #app-main-content { height: auto !important; min-height: 0 !important; overflow: visible !important; }
          [data-testid="chat-session-layout"], .ios-chat-split, [data-testid="chat-card"],
          .ios-d3-chat [data-radix-scroll-area-root], .ios-d3-chat [data-radix-scroll-area-viewport] {
            height: auto !important; min-height: 0 !important; overflow: visible !important;
          }
          .ios-d3-chat [data-radix-scroll-area-root] { flex: none !important; }
        `;
        document.head.append(style);
      });
      await page.screenshot({ path: `${output}/phone-long.png`, fullPage: true });
    }
    if (state === "approved") {
      expect((await page.locator(".fidelity-action-card").boundingBox())!.height).toBeLessThanOrEqual(334);
    }
    if (state === "sessions") {
      await expect(page.getByText("Rebalance plan, 30% BTC")).toBeVisible();
      await expect(page.getByText("Chats are stored on this device and in encrypted sync.")).toBeVisible();
    }
    if (state === "nokey") await expect(page.getByText("Add an API key to use the assistant")).toBeVisible();
    if (state === "error") await expect(page.getByText("Request failed", { exact: true }).first()).toBeVisible();
  });
}

test("assistant chat follows the saved light appearance", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Phone appearance");
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await seed(page, "new");
  await page.goto("/#/assistant");
  await page.getByTestId("chat-session-layout").waitFor();
  await expect(page.locator(".fidelity-chat-header")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".fidelity-assistant-insights")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".fidelity-chat-header-title h3")).toHaveCSS("color", "rgb(23, 23, 28)");
});
