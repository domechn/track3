import { afterEach, expect, it, vi } from "vitest";
import { fetch } from "@tauri-apps/plugin-http";
import { takeOptionalSourceFailures } from "../../utils/source-failure";
import { BinanceExchange } from "./binance";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it("retries a real HTTP -1021 response after syncing spot server time", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1700000000000);
  let spotCalls = 0;
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v3/time") return new Response('{"serverTime":1700000010000}');
    if (url.pathname === "/api/v3/account") {
      if (++spotCalls === 1) {
        return new Response('{"code":-1021,"msg":"Timestamp for this request is outside of the recvWindow."}', { status: 400 });
      }
      return new Response('{"balances":[]}');
    }
    if (url.pathname === "/sapi/v1/margin/account") return new Response('{"userAssets":[]}');
    if (url.pathname.includes("/simple-earn/")) return new Response('{"rows":[],"total":0}');
    return new Response("[]");
  });

  await expect(new BinanceExchange("key", "secret").fetchTotalBalance()).resolves.toEqual({});
  const urls = vi.mocked(fetch).mock.calls.map(([input]) => new URL(String(input)));
  expect(urls.filter((url) => url.pathname === "/api/v3/time").map((url) => url.origin)).toEqual(["https://api.binance.com"]);
  expect(urls.filter((url) => url.pathname === "/api/v3/account").map((url) => url.searchParams.get("timestamp")))
    .toEqual(["1700000000000", "1700000010000"]);
});

it("ignores disabled margin and futures accounts through the HTTP wrapper", async () => {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/v3/account") return new Response('{"balances":[{"asset":"BTC","free":"2","locked":"0"}]}');
    if (path === "/sapi/v1/margin/account") {
      return new Response('{"code":-3003,"msg":"Margin account does not exist."}', { status: 400 });
    }
    if (path === "/fapi/v2/balance") {
      return new Response('{"code":-2015,"msg":"Invalid API-key, IP, or permissions for action."}', { status: 401 });
    }
    if (path.includes("/simple-earn/")) return new Response('{"rows":[],"total":0}');
    return new Response("[]");
  });

  const exchange = new BinanceExchange("key", "secret");
  await expect(exchange.fetchTotalBalance()).resolves.toEqual({ BTC: 2 });
  expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
});
