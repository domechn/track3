import { beforeEach, expect, it, vi } from "vitest";
import { orchestrateQuery } from "./index";
import { fetch } from "@tauri-apps/plugin-http";
import { runSkill } from "../tools";

vi.mock("../tools", () => ({ runSkill: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));

beforeEach(() => {
  vi.mocked(fetch).mockReset();
  vi.mocked(runSkill).mockReset();
});

it("tells synthesis when one planned skill failed", async () => {
  vi.mocked(runSkill).mockImplementation(async (name) =>
    name === "asset_snapshot"
      ? { ok: true, result: { data: { total: 10 }, text: "Total is 10" } }
      : { ok: false, error: "Price source unavailable" },
  );
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
    choices: [{ message: { content: "The total is 10; price data is unavailable." } }],
  }), { headers: { "content-type": "application/json" } }) as any);
  const events = [];
  for await (const event of orchestrateQuery({
    endpoint: "https://example.com/v1", apiKey: "", model: "test",
    baseCurrency: { currency: "USD", rate: 1, alias: "USD", symbol: "$" },
    skipAnalyzer: true,
    planOverride: {
      query: "value and prices", requiresRefinement: false, maxOptimizerRounds: 0,
      tasks: [
        { id: "t1", skillName: "asset_snapshot", args: {}, description: "Holdings", dependsOn: [] },
        { id: "t2", skillName: "market_price", args: {}, description: "Prices", dependsOn: [] },
      ],
    },
  }, "value and prices", "")) events.push(event);
  expect(events.some((event) => event.kind === "agent_error")).toBe(true);
  const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
  expect(JSON.stringify(body.messages)).toContain("Price source unavailable");
});

it("passes advanced headers to synthesis", async () => {
  vi.mocked(runSkill).mockResolvedValue({ ok: true, result: { data: { total: 10 }, text: "Total is 10" } });
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
    choices: [{ message: { content: "Total is 10." } }],
  }), { headers: { "content-type": "application/json" } }) as any);
  for await (const _event of orchestrateQuery({
    endpoint: "https://example.com/v1", apiKey: "", model: "test",
    advanced: { headers: { "x-model-access": "access-value" } },
    baseCurrency: { currency: "USD", rate: 1, alias: "USD", symbol: "$" },
    skipAnalyzer: true,
    planOverride: {
      query: "value", requiresRefinement: false, maxOptimizerRounds: 0,
      tasks: [{ id: "t1", skillName: "asset_snapshot", args: {}, description: "Holdings", dependsOn: [] }],
    },
  }, "value", "")) { /* drain */ }
  expect(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).toMatchObject({ "x-model-access": "access-value" });
});
