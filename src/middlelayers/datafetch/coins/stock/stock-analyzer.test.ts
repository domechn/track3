import { beforeEach, describe, expect, it, vi } from "vitest";
import { StockAnalyzer } from "./stock-analyzer";

const mockBroker = {
  getBrokerName: vi.fn(() => "IBKR"),
  getIdentity: vi.fn(() => "ibkr:query-1"),
  getAlias: vi.fn(() => "Main"),
  fetchPositions: vi.fn(),
  fetchPositionsPrice: vi.fn(),
  verifyConfig: vi.fn(async () => true),
};

vi.mock("./ibkr", () => ({
  IbkrBroker: vi.fn(function MockIbkrBroker() {
    return mockBroker;
  }),
}));

describe("StockAnalyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBroker.fetchPositions.mockResolvedValue({
      AAPL: 3,
      USD: 140,
    });
    mockBroker.fetchPositionsPrice.mockResolvedValue({
      AAPL: 200,
      USD: 1,
    });
  });

  it("omits broker statement prices so realtime stock quotes can refresh them", async () => {
    const analyzer = new StockAnalyzer({
      stockConfig: {
        brokers: [
          {
            name: "ibkr",
            initParams: {
              token: "token-1",
              queryId: "query-1",
            },
            active: true,
          },
        ],
      },
    });

    await expect(analyzer.loadPortfolio()).resolves.toEqual([
      {
        symbol: "AAPL",
        assetType: "stock",
        amount: 3,
        wallet: "ibkr:query-1",
      },
      {
        symbol: "USD",
        assetType: "stock",
        amount: 140,
        wallet: "ibkr:query-1",
      },
    ]);
    expect(mockBroker.fetchPositionsPrice).not.toHaveBeenCalled();
  });

  it("lists broker identities for data source fallback handling", () => {
    const analyzer = new StockAnalyzer({
      stockConfig: {
        brokers: [
          {
            name: "ibkr",
            initParams: {
              token: "token-1",
              queryId: "query-1",
            },
            active: true,
          },
        ],
      },
    });

    expect(analyzer.getWalletIdentities()).toEqual(["ibkr:query-1"]);
  });
});
