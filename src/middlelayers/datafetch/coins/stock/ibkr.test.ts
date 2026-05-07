import { describe, expect, it } from "vitest";
import {
  getIbkrFlexStatementUrl,
  parseIbkrFlexOpenPositions,
} from "./ibkr";

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
      { symbol: "AAPL", amount: 3, price: 200.5 },
      { symbol: "MSFT", amount: 1.5, price: 410 },
    ]);
  });

  it("builds a GetStatement URL from the Flex reference code response", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FlexStatementResponse>
  <Status>Success</Status>
  <ReferenceCode>abc123</ReferenceCode>
</FlexStatementResponse>`;

    expect(getIbkrFlexStatementUrl(xml, "token-1")).toBe(
      "https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement?t=token-1&q=abc123&v=3",
    );
  });
});
