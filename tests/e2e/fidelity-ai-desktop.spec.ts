import { expect, test } from "@playwright/test";
import { seedSettingsB, settingsBRoute, settingsBShot } from "./fidelity-settings-b-scenes";

test.use({ viewport: { width: 1600, height: 777 }, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });

for (const state of ["default", "testing", "fail", "reveal", "saved", "json-error"] as const) {
  test(`AI ${state} desktop fidelity`, async ({ page }) => {
    await seedSettingsB(page, "ai", state);
    await page.goto(settingsBRoute.ai);
    await expect(page.getByTestId("assistant-endpoint")).toHaveValue("https://openrouter.ai/api/v1");
    await expect(page.getByText("Context and cost", { exact: true })).toBeVisible();
    await expect(page.getByText("1,284,300 · $3.85", { exact: true })).toBeVisible();
    if (state === "default") {
      await expect(page.getByTestId("assistant-endpoint")).toHaveCSS("font-size", "22px");
      await expect(page.getByTestId("assistant-context-size")).toHaveValue("128,000 tokens");
      await expect(page.locator("#assistant-input-price")).toHaveValue("3.00");
      await expect(page.locator("#assistant-output-price")).toHaveValue("15.00");
      const usageRows = page.locator(".t3-b-cost-foot > div:not(.t3-b-rule)");
      expect(await usageRows.evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height)))
        .toEqual([37, 37, 37]);
    }
    await page.evaluate((scenario) => {
      const original = (window as any).__e2eInvoke;
      let read = false;
      (window as any).__e2eInvoke = (command: string, args: unknown, options: unknown) => {
        if (command === "plugin:http|fetch_send") {
          if (scenario === "testing") return new Promise(() => {});
          return Promise.resolve({
            status: scenario === "fail" ? 401 : 200,
            statusText: scenario === "fail" ? "Unauthorized" : "OK",
            url: "https://openrouter.ai/api/v1/chat/completions",
            headers: { "content-type": "application/json" },
            rid: 999999,
          });
        }
        if (command === "plugin:http|fetch_read_body") {
          if (read) return Promise.resolve([1]);
          read = true;
          const body = scenario === "fail" ? '{"error":{"message":"Unauthorized"}}'
            : '{"choices":[{"message":{"content":"pong"}}]}';
          return Promise.resolve([...new TextEncoder().encode(body), 0]);
        }
        return original(command, args, options);
      };
    }, state);
    if (state !== "testing" && state !== "fail") {
      await page.getByTestId("assistant-test-connection").click();
      await expect(page.getByText("Connected", { exact: true })).toBeVisible();
    }
    if (state === "reveal") await page.getByTestId("assistant-show-key").click();
    if (state === "json-error") {
      await page.getByTestId("assistant-advanced").fill([
        "{",
        '  "temperature": 0.2,',
        '  "top_p": 0.9,',
        '  "headers": {',
        '    "HTTP-Referer": "https://track3.dev",',
        '    "X-Title": "Track3"',
        "  },",
        '  "extra_body": { "reasoning": { "effort": "low" } },',
        '  "provider": { "order": ["anthropic"], "allow_fallbacks": true },',
        "}",
      ].join("\n"));
      await page.getByTestId("assistant-save").click();
      await expect(page.getByTestId("assistant-advanced-error")).toContainText("Invalid JSON on line 9");
      await expect(page.locator(".t3-b-option-list")).toContainText("last valid");
    }
    if (state === "saved") {
      await page.getByTestId("assistant-save").click();
      await expect(page.locator(".desktop-toast-viewport .t3-fidelity-toast-success")).toHaveCount(2);
    }
    if (state === "testing" || state === "fail") {
      await page.getByTestId("assistant-test-connection").click();
      await expect(page.getByText(state === "testing" ? "Testing" : "Failed", { exact: true })).toBeVisible();
    }
    if (state !== "saved" && await page.locator("[toast-close]").count()) {
      await page.locator("[toast-close]").evaluate((button: HTMLElement) => button.click());
    }
    await settingsBShot(page, "ai", state);
    if (state === "default") {
      const context = page.getByTestId("assistant-context-size");
      await context.focus();
      await expect(context).toHaveValue("128000");
      await context.fill("64000");
      await context.blur();
      await expect(context).toHaveValue("64,000 tokens");
      const price = page.locator("#assistant-input-price");
      await price.fill("4");
      await price.blur();
      await expect(price).toHaveValue("4.00");
    }
  });
}
