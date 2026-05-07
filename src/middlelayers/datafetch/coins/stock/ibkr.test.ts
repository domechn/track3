import { describe, expect, it } from "vitest";
import { parseIbkrFlexOpenPositions } from "./ibkr";

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
});
