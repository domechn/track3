import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  IbkrBroker,
  getIbkrFlexStatementUrl,
  parseIbkrFlexOpenPositions,
} from "./ibkr";
import { sendHttpTextRequest } from "../../utils/http";
import { listAllCurrencyRates } from "../../../configuration";

vi.mock("../../utils/http", () => ({
  sendHttpTextRequest: vi.fn(),
}));

vi.mock("../../../configuration", () => ({
  listAllCurrencyRates: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("IBKR Flex parser", () => {
  it("extracts stock positions and mark prices from OpenPositions XML", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse>
  <FlexStatements>
    <FlexStatement>
      <OpenPositions>
        <OpenPosition symbol="AAPL" assetCategory="STK" position="3" markPrice="200.50" />
        <OpenPosition symbol="MSFT" assetCategory="STK" position="1.5" markPrice="410" />
        <OpenPosition symbol="USD" assetCategory="CASH" position="100" markPrice="1" />
      </OpenPositions>
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>`;

    expect(parseIbkrFlexOpenPositions(xml)).toEqual([
      { symbol: "AAPL", amount: 3, price: 200.5, currency: "USD" },
      { symbol: "MSFT", amount: 1.5, price: 410, currency: "USD" },
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

  it("converts non-USD IBKR mark prices to USD", async () => {
    vi.mocked(sendHttpTextRequest)
      .mockResolvedValueOnce(`<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse>
  <FlexStatements>
    <FlexStatement>
      <OpenPositions>
        <OpenPosition symbol="AAPL" assetCategory="STK" position="3" markPrice="200" currency="USD" />
        <OpenPosition symbol="SHOP" assetCategory="STK" position="4" markPrice="140" currency="CAD" />
      </OpenPositions>
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>`);
    vi.mocked(listAllCurrencyRates).mockResolvedValue([
      { currency: "USD", alias: "US dollar", symbol: "$", rate: 1 },
      { currency: "CAD", alias: "Canadian dollar", symbol: "$", rate: 1.4 },
    ] as never);

    const broker = new IbkrBroker("token-1", "query-1");

    await expect(broker.fetchPositionsPrice()).resolves.toEqual({
      AAPL: 200,
      SHOP: 100,
    });
  });
});
