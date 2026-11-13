import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { KrakenExchange } from "./kraken";
import { takeOptionalSourceFailures } from "../../utils/source-failure";

vi.mock("../../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2023-11-14T22:13:20.000Z"));
  (KrakenExchange as unknown as { nonceSeq: number }).nonceSeq = 0;
  (KrakenExchange as unknown as { lastNonce: bigint }).lastNonce = 0n;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("KrakenExchange", () => {
  it("counts held trades once and restores documented staked and bonded suffixes without merging ETH2.S", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      error: [],
      result: {
        XXBT: { balance: "3", hold_trade: "2" },
        "SOL.S": { balance: "4", hold_trade: "1" },
        "DOT.P": { balance: "5", hold_trade: "0" },
        "ETH2.S": { balance: "6", hold_trade: "0" },
      },
    });
    const exchange = new KrakenExchange("key", "c2VjcmV0");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({
      BTC: 3,
      SOL: 4,
      DOT: 5,
      "ETH2.S": 6,
    });
  });

  it("signs the nonce and normalizes Kraken asset and earn suffixes", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      error: [],
      result: {
        "XXBT.F": { balance: "1", hold_trade: "0.5" },
        XETH: { balance: "0", hold_trade: "0" },
        "SOL.M": { balance: "2", hold_trade: "0" },
      },
    });
    const exchange = new KrakenExchange(
      "test-key",
      "dGVzdC1zZWNyZXQ=",
    );

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({
      BTC: 1,
      SOL: 2,
    });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "POST",
      "https://api.kraken.com/0/private/BalanceEx",
      5000,
      {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        "API-Key": "test-key",
        "API-Sign":
          "P8hMtwVeeWXVRcGP9ekmzH70F3TMmUn+yzChY/rgcZISweFeJ9F5jkYv6On5Srk5AbvktYnJfmpHk63TEAYHUw==",
      },
      undefined,
      { nonce: "17000000000000001" },
    );
  });

  it("maps XBT ticker symbols and filters zero mid-prices", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      error: [],
      result: {
        XBTUSDT: { a: ["65001", "1", "1"], b: ["64999", "1", "1"] },
        ETHUSDT: { a: ["0", "1", "1"], b: ["0", "1", "1"] },
        SOLBTC: { a: ["0.002", "1", "1"], b: ["0.001", "1", "1"] },
      },
    });
    const exchange = new KrakenExchange("key", "c2VjcmV0");

    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({ BTC: 65000 });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.kraken.com/0/public/Ticker",
    );
  });

  it("returns false when private credential validation fails", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      error: ["EAPI:Invalid key"],
      result: {},
    });
    const exchange = new KrakenExchange("bad-key", "c2VjcmV0");

    await expect(exchange.verifyConfig()).resolves.toBe(false);
  });

  it("normalizes legacy balance and pair names while flagging an unknown legacy code", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValueOnce({ error: [], result: {
      XXBT: { balance: "1", hold_trade: "0" },
      XETH: { balance: "1", hold_trade: "0" },
      XXRP: { balance: "1", hold_trade: "0" },
      XLTC: { balance: "1", hold_trade: "0" },
      XXDG: { balance: "1", hold_trade: "0" },
      ZUSD: { balance: "2", hold_trade: "0" },
      ZEUR: { balance: "3", hold_trade: "0" },
      ZARS: { balance: "1", hold_trade: "0" },
      ZCOP: { balance: "1", hold_trade: "0" },
      ZXOF: { balance: "1", hold_trade: "0" },
      "XFOO.F": { balance: "4", hold_trade: "0" },
    } }).mockResolvedValueOnce({ error: [], result: {
      XDGUSDT: { a: ["0.2", "1", "1"], b: ["0.2", "1", "1"] },
    } });
    const exchange = new KrakenExchange("key", "c2VjcmV0");
    await expect(exchange.fetchTotalBalance()).resolves.toEqual({
      BTC: 1, ETH: 1, XRP: 1, LTC: 1, DOGE: 1, USD: 2, EUR: 3,
      ARS: 1, COP: 1, XOF: 1, XFOO: 4,
    });
    expect(takeOptionalSourceFailures(exchange)).toEqual({
      category: "other", endpoints: ["Some assets"],
    });
    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({ DOGE: 0.2 });
  });

  it("keeps Kraken nonces monotonic across a long session and a restart", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ error: [], result: {} });
    (KrakenExchange as unknown as { nonceSeq: number }).nonceSeq = 9998;
    await new KrakenExchange("key", "c2VjcmV0").fetchTotalBalance();
    const first = BigInt((vi.mocked(sendHttpRequest).mock.calls[0][5] as { nonce: string }).nonce);
    await new KrakenExchange("key", "c2VjcmV0").fetchTotalBalance();
    const wrapped = BigInt((vi.mocked(sendHttpRequest).mock.calls[1][5] as { nonce: string }).nonce);
    expect(wrapped).toBeGreaterThan(first);
    (KrakenExchange as unknown as { nonceSeq: number }).nonceSeq = 0;
    (KrakenExchange as unknown as { lastNonce: bigint }).lastNonce = 0n;
    vi.setSystemTime(new Date("2023-11-14T22:13:20.001Z"));
    await new KrakenExchange("key", "c2VjcmV0").fetchTotalBalance();
    const restarted = BigInt((vi.mocked(sendHttpRequest).mock.calls[2][5] as { nonce: string }).nonce);
    expect(restarted).toBeGreaterThan(wrapped);
  });

  it("does not flag an unknown legacy code with zero holdings", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ error: [], result: {
      XFOO: { balance: "0", hold_trade: "0" },
    } });
    const exchange = new KrakenExchange("key", "c2VjcmV0");
    await expect(exchange.fetchTotalBalance()).resolves.toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("keeps held ZEUS, ZETA and ZORA without calling them unknown legacy codes", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ error: [], result: {
      ZEUS: { balance: "1", hold_trade: "0" },
      ZETA: { balance: "2", hold_trade: "0" },
      ZORA: { balance: "3", hold_trade: "0" },
    } });
    const exchange = new KrakenExchange("key", "c2VjcmV0");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({
      ZEUS: 1, ZETA: 2, ZORA: 3,
    });
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });
});
