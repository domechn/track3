// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeJwt,
  decodeProtectedHeader,
  importSPKI,
  jwtVerify,
} from "jose";
import CryptoJS from "crypto-js";
import { sendHttpRequest } from "../../utils/http";
import { CoinbaseExchange } from "./coinbase";

vi.mock("../../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

const PRIVATE_KEY = [
  "-----BEGIN " + "PRIVATE KEY-----",
  "MIIBeQIBADCCAQMGByqGSM49AgEwgfcCAQEwLAYHKoZIzj0BAQIhAP////8AAAAB",
  "AAAAAAAAAAAAAAAA////////////////MFsEIP////8AAAABAAAAAAAAAAAAAAAA",
  "///////////////8BCBaxjXYqjqT57PrvVV2mIa8ZR0GsMxTsPY7zjw+J9JgSwMV",
  "AMSdNgiG5wSTamZ44ROdJreBn36QBEEEaxfR8uEsQkf4vOblY6RA8ncDfYEt6zOg",
  "9KE5RdiYwpZP40Li/hp/m47n60p8D54WK84zV2sxXs7LtkBoN79R9QIhAP////8A",
  "AAAA//////////+85vqtpxeehPO5ysL8YyVRAgEBBG0wawIBAQQg3/UAUfP+88rt",
  "pe6T7UqM0zhd2WqqSkt0KlMhoDpGhMihRANCAAT9NobbyVx2CdMW0t+Wj5CubV5z",
  "FyCBN5mgSXzY/1k03BzBicLsSiRhrV5yUZHYgUz4poPbjFAjxHlrrp/hLXOZ",
  "-----END " + "PRIVATE KEY-----",
].join("\n");

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBSzCCAQMGByqGSM49AgEwgfcCAQEwLAYHKoZIzj0BAQIhAP////8AAAABAAAA
AAAAAAAAAAAA////////////////MFsEIP////8AAAABAAAAAAAAAAAAAAAA////
///////////8BCBaxjXYqjqT57PrvVV2mIa8ZR0GsMxTsPY7zjw+J9JgSwMVAMSd
NgiG5wSTamZ44ROdJreBn36QBEEEaxfR8uEsQkf4vOblY6RA8ncDfYEt6zOg9KE5
RdiYwpZP40Li/hp/m47n60p8D54WK84zV2sxXs7LtkBoN79R9QIhAP////8AAAAA
//////////+85vqtpxeehPO5ysL8YyVRAgEBA0IABP02htvJXHYJ0xbS35aPkK5t
XnMXIIE3maBJfNj/WTTcHMGJwuxKJGGtXnJRkdiBTPimg9uMUCPEeWuun+Etc5k=
-----END PUBLIC KEY-----`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2023-11-14T22:13:20.000Z"));
  vi.spyOn(CryptoJS.lib.WordArray, "random").mockReturnValue(
    CryptoJS.enc.Hex.parse("00112233445566778899aabbccddeeff"),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("CoinbaseExchange", () => {
  it("creates a verifiable JWT for the exact credential-validation URL", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ portfolios: [] });
    const exchange = new CoinbaseExchange("test-key", PRIVATE_KEY);

    await expect(exchange.verifyConfig()).resolves.toBe(true);
    const [, url, timeout, headers] = vi.mocked(sendHttpRequest).mock.calls[0];
    expect(url).toBe(
      "https://api.coinbase.com/api/v3/brokerage/portfolios",
    );
    expect(timeout).toBe(10000);

    const token = (headers as Record<string, string>).Authorization.replace(
      "Bearer ",
      "",
    );
    expect(decodeProtectedHeader(token)).toEqual({
      alg: "ES256",
      kid: "test-key",
      nonce: "00112233445566778899aabbccddeeff",
    });
    expect(decodeJwt(token)).toEqual({
      iss: "cdp",
      nbf: 1700000000,
      exp: 1700000120,
      sub: "test-key",
      uri: "GET api.coinbase.com/api/v3/brokerage/portfolios",
    });
    await expect(
      jwtVerify(token, await importSPKI(PUBLIC_KEY, "ES256")),
    ).resolves.toMatchObject({
      protectedHeader: { alg: "ES256", kid: "test-key" },
    });
  });

  it("maps active default and perpetual portfolios while filtering zero balances", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.endsWith("/portfolios")) {
        return {
        portfolios: [
          { name: "Spot", uuid: "spot-id", type: "DEFAULT", deleted: false },
          { name: "Perp", uuid: "perp-id", type: "INTX", deleted: false },
          { name: "Old", uuid: "old-id", type: "DEFAULT", deleted: true },
        ],
        };
      }
      if (url.endsWith("/portfolios/spot-id")) {
        return {
          breakdown: {
            spot_positions: [
              { asset: "btc", total_balance_crypto: 1 },
              { asset: "eth", total_balance_crypto: 0 },
            ],
          },
        };
      }
      if (url.endsWith("/intx/balances/perp-id")) {
        return {
          portfolio_balances: [
            {
              balances: [
                { asset: { asset_name: "BTC" }, quantity: "2" },
                { asset: { asset_name: "sol" }, quantity: "0" },
              ],
            },
          ],
        };
      }
      throw new Error(`Unexpected Coinbase request: ${url}`);
    });
    const exchange = new CoinbaseExchange("test-key", PRIVATE_KEY);

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({ BTC: 3 });
    expect(sendHttpRequest).toHaveBeenCalledTimes(3);
    expect(exchange.fetchCoinsPrice()).resolves.toEqual({});
  });

  it("reports invalid credentials without leaking the private key", async () => {
    vi.mocked(sendHttpRequest).mockRejectedValue(new Error("unauthorized"));
    const exchange = new CoinbaseExchange("bad-key", PRIVATE_KEY);

    await expect(exchange.verifyConfig()).resolves.toBe(false);
    expect(exchange.getIdentity()).toBe("coinbase-bad-key");
    expect(exchange.getIdentity()).not.toContain("PRIVATE KEY");
  });
});
