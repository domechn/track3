import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  IbkrBroker,
  getIbkrFlexStatementUrl,
  parseIbkrFlexOpenPositions,
} from "./ibkr";
import { sendHttpTextRequest } from "../../utils/http";
import { listAllCurrencyRates } from "../../../configuration";
import { takeOptionalSourceFailures } from "../../utils/source-failure";
import { fetchStockPrices } from "../../utils/price";
import { getVersion } from "../../../../utils/app";
import { classifySourceError, serviceSourceDetail } from "../../utils/source-failure";

vi.mock("../../utils/http", () => ({
  sendHttpTextRequest: vi.fn(),
}));

vi.mock("../../../configuration", () => ({
  listAllCurrencyRates: vi.fn(),
}));
vi.mock("../../utils/price", () => ({ fetchStockPrices: vi.fn() }));
vi.mock("../../../../utils/app", () => ({ getVersion: vi.fn(async () => "0.9.14") }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVersion).mockResolvedValue("0.9.14");
});

describe("IBKR Flex parser", () => {
  it("extracts stock positions and USD cash from CashReport XML", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse>
  <FlexStatements>
    <FlexStatement>
      <AccountInformation currency="USD" />
      <CashReport>
        <CashReportCurrency currency="BASE_SUMMARY" endingCash="100" />
      </CashReport>
      <OpenPositions>
        <OpenPosition symbol="AAPL" assetCategory="STK" position="3" markPrice="200.50" />
        <OpenPosition symbol="MSFT" assetCategory="STK" position="1.5" markPrice="410" />
      </OpenPositions>
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>`;

    expect(parseIbkrFlexOpenPositions(xml)).toEqual([
      {
        symbol: "AAPL",
        amount: 3,
        price: 0,
        currency: "USD",
        market: "",
      },
      {
        symbol: "MSFT",
        amount: 1.5,
        price: 0,
        currency: "USD",
        market: "",
      },
      {
        symbol: "USD",
        amount: 100,
        price: 1,
        currency: "USD",
        market: "",
      },
    ]);
  });

  it("builds a GetStatement URL from the Flex reference code response", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FlexStatementResponse>
  <Status>Success</Status>
  <ReferenceCode>abc123</ReferenceCode>
  <url>https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement</url>
</FlexStatementResponse>`;

    expect(getIbkrFlexStatementUrl(xml, "token-1")).toBe(
      "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement?t=token-1&q=abc123&v=3",
    );
  });

  it("verifies required fields without fetching a Flex report", async () => {
    await expect(
      new IbkrBroker("token-1", "query-1").verifyConfig(),
    ).resolves.toBe(true);

    expect(sendHttpTextRequest).not.toHaveBeenCalled();
  });

  it("does not put the Flex token into a provider error", async () => {
    vi.mocked(sendHttpTextRequest).mockResolvedValue(`<FlexStatementResponse><Status>Fail</Status><ErrorMessage>bad token custom-private-key</ErrorMessage></FlexStatementResponse>`);
    await expect(new IbkrBroker("custom-private-key", "query-1").fetchPositions()).rejects.not.toThrow("custom-private-key");
  });

  it("logs the Flex error code without logging the token", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      vi.mocked(sendHttpTextRequest).mockResolvedValueOnce(`<FlexStatementResponse>
        <Status>Fail</Status><ErrorCode>1015</ErrorCode>
        <ErrorMessage>bad token private-token-value</ErrorMessage>
      </FlexStatementResponse>`);
      await new IbkrBroker("private-token-value", "q").fetchPositions().catch(() => {});
      expect(log).toHaveBeenCalledWith("IBKR Flex error code", "1015");
      expect(JSON.stringify(log.mock.calls)).not.toContain("private-token-value");
    } finally {
      log.mockRestore();
    }
  });

  it("polls GetStatement until the Flex report is ready", async () => {
    vi.mocked(sendHttpTextRequest)
      .mockResolvedValueOnce(`<?xml version="1.0" encoding="UTF-8"?>
<FlexStatementResponse>
  <Status>Success</Status>
  <ReferenceCode>abc123</ReferenceCode>
</FlexStatementResponse>`)
      .mockResolvedValueOnce(`<?xml version="1.0" encoding="UTF-8"?>
<FlexStatementResponse>
  <Status>Fail</Status>
  <ErrorCode>1019</ErrorCode>
  <ErrorMessage>Statement generation in progress</ErrorMessage>
</FlexStatementResponse>`)
      .mockResolvedValueOnce(`<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse>
  <FlexStatements>
    <FlexStatement>
      <OpenPositions>
        <OpenPosition symbol="AAPL" assetCategory="STK" position="3" markPrice="200.50" currency="USD" />
      </OpenPositions>
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>`);

    const broker = new (IbkrBroker as any)("token-1", "query-1", undefined, {
      statementPollDelayMs: 0,
      initialStatementDelayMs: 0,
      maxStatementPollAttempts: 3,
    });

    await expect(broker.fetchPositions()).resolves.toEqual({ AAPL: 3 });
    expect(sendHttpTextRequest).toHaveBeenCalledTimes(3);
  });

  it("returns CashReport cash and converts stock prices to USD", async () => {
    vi.mocked(sendHttpTextRequest)
      .mockResolvedValueOnce(`<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse>
  <FlexStatements>
    <FlexStatement>
      <AccountInformation currency="USD" />
      <CashReport>
        <CashReportCurrency currency="BASE_SUMMARY" endingCash="140" />
      </CashReport>
      <OpenPositions>
        <OpenPosition symbol="AAPL" assetCategory="STK" position="3" markPrice="200" currency="USD" />
        <OpenPosition symbol="SHOP" assetCategory="STK" position="4" markPrice="140" currency="CAD" />
      </OpenPositions>
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>`);
    vi.mocked(listAllCurrencyRates).mockResolvedValue([
      { currency: "USD", alias: "US dollar", symbol: "$", rate: 1 },
      { currency: "CAD", alias: "Canadian dollar", symbol: "$", rate: 2 },
    ] as never);

    const broker = new IbkrBroker("token-1", "query-1");

    await expect(broker.fetchPositions()).resolves.toEqual({
      AAPL: 3,
      USD: 140,
      "SHOP.TRT": 4,
    });

    await expect(broker.fetchPositionsPrice()).resolves.toEqual({
      AAPL: 0,
      USD: 1,
      "SHOP.TRT": 0,
    });
  });

  it("uses currency breakout rows without adding their base summary", () => {
    const xml = `<FlexQueryResponse><FlexStatements><FlexStatement accountId="U1">
      <AccountInformation currency="HKD"/>
      <CashReport><CashReportCurrency currency="BASE_SUMMARY" endingCash="1780"/>
        <CashReportCurrency currency="HKD" endingCash="1000"/>
        <CashReportCurrency currency="USD" endingCash="100"/></CashReport>
    </FlexStatement></FlexStatements></FlexQueryResponse>`;
    expect(parseIbkrFlexOpenPositions(xml).map(({ symbol, amount }) => [symbol, amount]))
      .toEqual([["HKD", 1000], ["USD", 100]]);
  });

  it("uses the account base currency when only a summary exists", async () => {
    const xml = `<FlexQueryResponse><FlexStatements><FlexStatement accountId="U1">
      <AccountInformation currency="HKD"/><CashReport>
        <CashReportCurrency currency="BASE_SUMMARY" endingCash="780"/>
      </CashReport></FlexStatement></FlexStatements></FlexQueryResponse>`;
    expect(parseIbkrFlexOpenPositions(xml).map(({ symbol, amount }) => [symbol, amount]))
      .toEqual([["HKD", 780]]);
    vi.mocked(sendHttpTextRequest).mockResolvedValueOnce(xml);
    vi.mocked(listAllCurrencyRates).mockResolvedValue([{ currency: "HKD", rate: 7.8 }] as never);
    await expect(new IbkrBroker("hkd-summary-token", "q").loadPortfolio()).resolves.toEqual([
      { symbol: "HKD", assetType: "stock", amount: 780, wallet: "ibkr:q",
        price: { base: "usd", value: 1 / 7.8 } },
    ]);
  });

  it("prices explicit USD and EUR cash while leaving currency-named STK positions for stock quoting", async () => {
    vi.mocked(sendHttpTextRequest).mockResolvedValueOnce(`<FlexQueryResponse><FlexStatements><FlexStatement>
      <AccountInformation currency="USD"/><CashReport>
        <CashReportCurrency currency="USD" endingCash="100"/>
        <CashReportCurrency currency="EUR" endingCash="50"/>
      </CashReport><OpenPositions>
        <OpenPosition symbol="AMD" assetCategory="STK" position="2" currency="USD"/>
        <OpenPosition symbol="COP" assetCategory="STK" position="3" currency="USD"/>
        <OpenPosition symbol="NIO" assetCategory="STK" position="4" currency="USD"/>
        <OpenPosition symbol="TTD" assetCategory="STK" position="5" currency="USD"/>
      </OpenPositions>
    </FlexStatement></FlexStatements></FlexQueryResponse>`);
    vi.mocked(listAllCurrencyRates).mockResolvedValue([{ currency: "EUR", rate: 0.8 }] as never);
    const coins = await new IbkrBroker("cash-and-stocks", "cash-and-stocks").loadPortfolio();
    expect(coins.filter((coin) => ["AMD", "COP", "NIO", "TTD"].includes(coin.symbol)))
      .toEqual(["AMD", "COP", "NIO", "TTD"].map((symbol, index) => ({
        symbol, assetType: "stock", amount: index + 2, wallet: "ibkr:cash-and-stocks",
      })));
    expect(coins.filter((coin) => ["USD", "EUR"].includes(coin.symbol)))
      .toEqual([
        { symbol: "USD", assetType: "stock", amount: 100, wallet: "ibkr:cash-and-stocks", price: { base: "usd", value: 1 } },
        { symbol: "EUR", assetType: "stock", amount: 50, wallet: "ibkr:cash-and-stocks", price: { base: "usd", value: 1.25 } },
      ]);
  });

  it("omits cash when its code collides with an STK ticker in the same broker wallet", async () => {
    vi.mocked(sendHttpTextRequest).mockResolvedValueOnce(`<FlexQueryResponse><FlexStatements><FlexStatement>
      <AccountInformation currency="USD"/><CashReport>
        <CashReportCurrency currency="EUR" endingCash="50"/>
      </CashReport><OpenPositions>
        <OpenPosition symbol="EUR" assetCategory="STK" position="2" currency="USD"/>
      </OpenPositions>
    </FlexStatement></FlexStatements></FlexQueryResponse>`);
    vi.mocked(listAllCurrencyRates).mockResolvedValue([{ currency: "EUR", rate: 0.8 }] as never);
    const broker = new IbkrBroker("collision", "collision");
    await expect(broker.loadPortfolio()).resolves.toEqual([
      { symbol: "EUR", assetType: "stock", amount: 2, wallet: "ibkr:collision" },
    ]);
    expect(takeOptionalSourceFailures(broker)).toEqual({ category: "other", endpoints: ["IBKR cash"] });
  });

  it("does not infer USD when the cash summary has no account currency", () => {
    const xml = `<FlexQueryResponse><FlexStatements><FlexStatement accountId="U1">
      <CashReport><CashReportCurrency currency="BASE_SUMMARY" endingCash="780"/></CashReport>
    </FlexStatement></FlexStatements></FlexQueryResponse>`;
    expect(parseIbkrFlexOpenPositions(xml)).toEqual([]);
  });

  it("sums cash per currency across accounts", () => {
    const xml = `<FlexQueryResponse><FlexStatements>
      <FlexStatement accountId="U1"><CashReport><CashReportCurrency currency="HKD" endingCash="120"/>
      <CashReportCurrency currency="USD" endingCash="4"/></CashReport></FlexStatement>
      <FlexStatement accountId="U2"><CashReport><CashReportCurrency currency="HKD" endingCash="30"/>
      <CashReportCurrency currency="USD" endingCash="8"/></CashReport></FlexStatement>
    </FlexStatements></FlexQueryResponse>`;
    expect(parseIbkrFlexOpenPositions(xml).map(({ symbol, amount }) => [symbol, amount]))
      .toEqual([["HKD", 150], ["USD", 12]]);
  });

  it("reports cash omitted when a summary has no base currency", async () => {
    vi.mocked(sendHttpTextRequest).mockResolvedValueOnce(`<FlexQueryResponse><FlexStatements>
      <FlexStatement><CashReport><CashReportCurrency currency="BASE_SUMMARY" endingCash="780"/></CashReport></FlexStatement>
    </FlexStatements></FlexQueryResponse>`);
    const broker = new IbkrBroker("cash-missing-token", "q");
    await expect(broker.loadPortfolio()).resolves.toEqual([]);
    expect(takeOptionalSourceFailures(broker)).toEqual({
      category: "other", endpoints: ["IBKR cash"],
    });
  });

  it("treats an invalid Account Information currency as missing cash", async () => {
    vi.mocked(sendHttpTextRequest).mockResolvedValueOnce(`<FlexQueryResponse><FlexStatements>
      <FlexStatement><AccountInformation currency="UNKNOWN"/><CashReport>
        <CashReportCurrency currency="BASE_SUMMARY" endingCash="780"/>
      </CashReport></FlexStatement>
    </FlexStatements></FlexQueryResponse>`);
    const broker = new IbkrBroker("bad-base-currency-token", "q");
    await expect(broker.loadPortfolio()).resolves.toEqual([]);
    expect(takeOptionalSourceFailures(broker)?.endpoints).toEqual(["IBKR cash"]);
  });

  it("values HKD and USD breakout cash with currency rates", async () => {
    vi.mocked(sendHttpTextRequest).mockResolvedValueOnce(`<FlexQueryResponse><FlexStatements>
      <FlexStatement><AccountInformation currency="HKD"/><CashReport>
        <CashReportCurrency currency="BASE_SUMMARY" endingCash="1780"/>
        <CashReportCurrency currency="HKD" endingCash="1000"/>
        <CashReportCurrency currency="USD" endingCash="100"/>
      </CashReport></FlexStatement>
    </FlexStatements></FlexQueryResponse>`);
    vi.mocked(listAllCurrencyRates).mockResolvedValue([
      { currency: "HKD", rate: 7.8 },
    ] as never);
    const broker = new IbkrBroker("breakout-rate-token", "q");
    await expect(broker.loadPortfolio()).resolves.toEqual([
      { symbol: "HKD", amount: 1000, assetType: "stock", wallet: "ibkr:q",
        price: { base: "usd", value: 1 / 7.8 } },
      { symbol: "USD", amount: 100, assetType: "stock", wallet: "ibkr:q",
        price: { base: "usd", value: 1 } },
    ]);
  });

  it("keeps cash currency symbols and USD prices in the broker position API", async () => {
    vi.mocked(sendHttpTextRequest).mockResolvedValueOnce(`<FlexQueryResponse><FlexStatements>
      <FlexStatement><CashReport>
        <CashReportCurrency currency="HKD" endingCash="780"/>
        <CashReportCurrency currency="USD" endingCash="12"/>
      </CashReport></FlexStatement>
    </FlexStatements></FlexQueryResponse>`);
    vi.mocked(listAllCurrencyRates).mockResolvedValue([
      { currency: "HKD", rate: 7.8 },
    ] as never);
    const broker = new IbkrBroker("cash-api-token", "q");
    await expect(broker.fetchPositions()).resolves.toEqual({ HKD: 780, USD: 12 });
    await expect(broker.fetchPositionsPrice()).resolves.toEqual({ HKD: 1 / 7.8, USD: 1 });
  });

  it("keeps stocks and marks partial when a cash currency rate is unavailable", async () => {
    vi.mocked(sendHttpTextRequest).mockResolvedValueOnce(`<FlexQueryResponse><FlexStatements>
      <FlexStatement><OpenPositions>
        <OpenPosition symbol="AAPL" assetCategory="STK" position="2"/>
      </OpenPositions><CashReport>
        <CashReportCurrency currency="HKD" endingCash="780"/>
      </CashReport></FlexStatement>
    </FlexStatements></FlexQueryResponse>`);
    vi.mocked(listAllCurrencyRates).mockRejectedValueOnce(new Error("rates offline"));
    const broker = new IbkrBroker("missing-rate-token", "q");
    await expect(broker.loadPortfolio()).resolves.toEqual([
      { symbol: "AAPL", assetType: "stock", amount: 2, wallet: "ibkr:q" },
    ]);
    expect(takeOptionalSourceFailures(broker)?.endpoints).toEqual(["IBKR cash rate"]);
  });

  it("includes only supported crypto and quoted funds, and reports other asset categories", async () => {
    vi.mocked(sendHttpTextRequest).mockResolvedValueOnce(`<FlexQueryResponse><FlexStatements><FlexStatement>
      <OpenPositions>
        <OpenPosition symbol="AAPL" assetCategory="STK" position="3" currency="USD"/>
        <OpenPosition symbol="BTC" assetCategory="CRYPTO" position="0.2" currency="USD"/>
        <OpenPosition symbol="UNKNOWN" assetCategory="CRYPTO" position="2" currency="USD"/>
        <OpenPosition symbol="VFIAX" assetCategory="FUND" position="4" currency="USD"/>
        <OpenPosition symbol="NOQUOTE" assetCategory="FUND" position="4" currency="USD"/>
        <OpenPosition symbol="OPT1" assetCategory="OPT" position="1"/>
        <OpenPosition symbol="OPT2" assetCategory="OPT" position="1"/>
        <OpenPosition symbol="BND" assetCategory="BOND" position="1"/>
        <OpenPosition symbol="FOP1" assetCategory="FOP" position="1"/>
        <OpenPosition symbol="FUT1" assetCategory="FUT" position="1"/>
        <OpenPosition symbol="WAR1" assetCategory="WAR" position="1"/>
        <OpenPosition symbol="FX1" assetCategory="CASH" position="1"/>
        <OpenPosition symbol="OTHER" assetCategory="MYSTERY" position="1"/>
      </OpenPositions>
    </FlexStatement></FlexStatements></FlexQueryResponse>`);
    vi.mocked(fetchStockPrices).mockResolvedValueOnce({ VFIAX: 300 });
    const broker = new IbkrBroker("mixed-assets-token", "q");
    await expect(broker.loadPortfolio()).resolves.toEqual([
      { symbol: "AAPL", assetType: "stock", amount: 3, wallet: "ibkr:q" },
      { symbol: "BTC", assetType: "crypto", amount: 0.2, wallet: "ibkr:q" },
      { symbol: "VFIAX", assetType: "stock", amount: 4, wallet: "ibkr:q",
        price: { base: "usd", value: 300 } },
    ]);
    expect(takeOptionalSourceFailures(broker)?.endpoints).toEqual([
      "IBKR positions: OPT x2, BOND x1, CASH x1, CRYPTO x1, FOP x1, FUND x1, FUT x1, MYSTERY x1, WAR x1",
    ]);
  });

  it.each([
    ["1012", "IBKR token expired", "auth"],
    ["1013", "IBKR IP restricted", "auth"],
    ["1014", "IBKR invalid query", "auth"],
    ["1015", "IBKR invalid token", "auth"],
    ["1016", "IBKR no permission", "auth"],
    ["1017", "IBKR not ready", "service"],
    ["1003", "IBKR not ready", "service"],
  ] as const)("classifies official Flex error %s as %s", async (code, detail, category) => {
    vi.mocked(sendHttpTextRequest).mockResolvedValueOnce(`<FlexStatementResponse>
      <Status>Fail</Status><ErrorCode>${code}</ErrorCode><ErrorMessage>IBKR failure</ErrorMessage>
    </FlexStatementResponse>`);
    try {
      await new IbkrBroker(`error-${code}-token`, "q").fetchPositions();
      throw new Error("Expected an IBKR error");
    } catch (error) {
      expect(classifySourceError(error)).toBe(category);
      expect(serviceSourceDetail(error)).toBe(detail);
    }
  });

  it("waits sixty seconds and retries 1018 only once", async () => {
    vi.useFakeTimers();
    try {
      const rateLimitXml = `<FlexStatementResponse><Status>Fail</Status>
        <ErrorCode>1018</ErrorCode><ErrorMessage>Too many requests</ErrorMessage></FlexStatementResponse>`;
      vi.mocked(sendHttpTextRequest).mockResolvedValue(rateLimitXml);
      const request = new IbkrBroker("rate-limit-token", "q").fetchPositions();
      const result = expect(request).rejects.toMatchObject({
        category: "rateLimit", detail: "IBKR rate limited",
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(sendHttpTextRequest).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(59_999);
      expect(sendHttpTextRequest).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await result;
      expect(sendHttpTextRequest).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("logs code 1018 even when its delayed retry succeeds", async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      vi.mocked(sendHttpTextRequest)
        .mockResolvedValueOnce(`<FlexStatementResponse><Status>Fail</Status>
          <ErrorCode>1018</ErrorCode><ErrorMessage>Too many requests</ErrorMessage></FlexStatementResponse>`)
        .mockResolvedValueOnce(`<FlexQueryResponse><FlexStatements/></FlexQueryResponse>`);
      const request = new IbkrBroker("eventual-success-token", "q").fetchPositions();
      await vi.advanceTimersByTimeAsync(60_000);
      await expect(request).resolves.toEqual({});
      expect(log).toHaveBeenCalledWith("IBKR Flex error code", "1018");
      expect(JSON.stringify(log.mock.calls)).not.toContain("eventual-success-token");
    } finally {
      log.mockRestore();
      vi.useRealTimers();
    }
  });

  it("limits all brokers sharing a token to one request per second and ten per minute", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(sendHttpTextRequest).mockResolvedValue("<FlexQueryResponse><FlexStatements/></FlexQueryResponse>");
      const requests = Array.from({ length: 11 }, (_, i) =>
        new IbkrBroker("shared-limiter-token", `q${i}`).fetchPositions());
      await vi.advanceTimersByTimeAsync(9_000);
      expect(sendHttpTextRequest).toHaveBeenCalledTimes(10);
      await vi.advanceTimersByTimeAsync(50_999);
      expect(sendHttpTextRequest).toHaveBeenCalledTimes(10);
      await vi.advanceTimersByTimeAsync(1);
      await Promise.all(requests);
      expect(sendHttpTextRequest).toHaveBeenCalledTimes(11);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends the required Track3 version User-Agent on both Flex endpoints", async () => {
    vi.mocked(sendHttpTextRequest)
      .mockResolvedValueOnce(`<FlexStatementResponse><Status>Success</Status><ReferenceCode>ref</ReferenceCode></FlexStatementResponse>`)
      .mockResolvedValueOnce(`<FlexQueryResponse><FlexStatements/></FlexQueryResponse>`);
    const broker = new IbkrBroker("ua-token", "q", undefined, {
      initialStatementDelayMs: 0,
    });
    await broker.fetchPositions();
    expect(sendHttpTextRequest).toHaveBeenNthCalledWith(1, "GET",
      expect.stringContaining("/SendRequest"), 20000, { "User-Agent": "Track3/0.9.14" });
    expect(sendHttpTextRequest).toHaveBeenNthCalledWith(2, "GET",
      expect.stringContaining("/GetStatement"), 30000, { "User-Agent": "Track3/0.9.14" });
  });
});
