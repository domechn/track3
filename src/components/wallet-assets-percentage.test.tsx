import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import WalletAssetsPercentage from "@/components/wallet-assets-percentage";
import { ChartResizeContext } from "@/App";
import { DataChangedContext } from "@/contexts/data-changed";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import type { WalletAssetsPercentageData } from "@/middlelayers/types";
import type { CurrencyRateDetail, TDateRange } from "@/middlelayers/types";

const mocks = vi.hoisted(() => ({
  queryWalletAssetsPercentage: vi.fn(),
  reportLoaded: vi.fn(),
  openUrl: vi.fn(),
  useWindowSize: vi.fn(() => ({ width: 1280, height: 800 })),
}));

vi.mock("@/middlelayers/charts", () => ({
  WALLET_ANALYZER: {
    queryWalletAssetsPercentage: mocks.queryWalletAssetsPercentage,
  },
}));

vi.mock("@/utils/hook", () => ({
  useWindowSize: mocks.useWindowSize,
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: mocks.openUrl,
}));

vi.mock("@/components/motion", () => ({
  FadeUp: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerContainer: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/common/asset-label", () => ({
  default: ({ asset }: { asset: { symbol: string } }) => (
    <span data-testid="asset-label">{asset.symbol}</span>
  ),
}));

function makeWallet(
  wallet: string,
  percentage: number,
  walletType: string | undefined,
) {
  return {
    wallet,
    walletType,
    walletAlias: undefined,
    percentage,
    value: percentage * 1000,
    amount: percentage,
    chartColor: "rgba(0,0,0,1)",
  };
}

// CEX total: 32.4 + 12.6 + 6.7 + 3.2 = 54.9
// Broker total: 12.88
// Onchain total: 8.3 + 4.8 + 2.1 + 1.7 + 1.4 + 1.2 + 1.0 + 0.9 + 0.7 + 0.4 = 22.5
// Others total: 5.54
// Grand total: 95.82
const MIXED_15: WalletAssetsPercentageData = [
  makeWallet("binance", 32.4, "Binance"),
  makeWallet("ibkr", 12.88, "IBKR"),
  makeWallet("okx", 12.6, "Okex"),
  makeWallet("phantom", 8.3, "SOL"),
  makeWallet("bybit", 6.7, "Bybit"),
  makeWallet("manual", 5.54, "Others"),
  makeWallet("metamask", 4.8, "ERC20"),
  makeWallet("coinbase", 3.2, "Coinbase"),
  makeWallet("rabby", 2.1, "ERC20"),
  makeWallet("keplr", 1.7, "ERC20"),
  makeWallet("trust", 1.4, "TON"),
  makeWallet("sui", 1.2, "SUI"),
  makeWallet("tron", 1.0, "TRC20"),
  makeWallet("backpack", 0.9, "SOL"),
  makeWallet("unisat", 0.7, "BTC"),
  makeWallet("phantom-m", 0.4, "SOL"),
];

const currency: CurrencyRateDetail = {
  name: "USD",
  symbol: "$",
  rate: 1,
} as unknown as CurrencyRateDetail;

const dateRange: TDateRange = {
  start: new Date("2024-01-01"),
  end: new Date("2024-12-31"),
} as TDateRange;

function findTile(container: HTMLElement, key: string): HTMLElement {
  const el = container.querySelector(`[data-tile-key="${key}"]`);
  if (!el) {
    throw new Error(`tile with key "${key}" not found`);
  }
  return el as HTMLElement;
}

function renderComponent(
  props: Partial<React.ComponentProps<typeof WalletAssetsPercentage>> = {},
) {
  return render(
    <DataChangedContext.Provider value={0}>
      <ChartResizeContext.Provider
        value={{
          needResize: 0,
          setNeedResize: vi.fn() as React.Dispatch<
            React.SetStateAction<number>
          >,
        }}
      >
        <OverviewLoadingContext.Provider
          value={{ reportLoaded: mocks.reportLoaded }}
        >
          <WalletAssetsPercentage
            currency={currency}
            dateRange={dateRange}
            {...props}
          />
        </OverviewLoadingContext.Provider>
      </ChartResizeContext.Provider>
    </DataChangedContext.Provider>,
  );
}

// jsdom returns 0,0,0,0 from getBoundingClientRect by default, which would
// keep the treemap isReady gate closed forever. Mock it to return a realistic
// size so the treemap can lay out and tests can assert on it.
const originalGetBoundingClientRect =
  HTMLElement.prototype.getBoundingClientRect;
beforeAll(() => {
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.getAttribute("data-testid") === "wallet-treemap-container") {
      return {
        width: 1000,
        height: 480,
        top: 0,
        left: 0,
        right: 1000,
        bottom: 480,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    }
    return originalGetBoundingClientRect.call(this);
  };
});
afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

beforeEach(() => {
  mocks.queryWalletAssetsPercentage.mockReset();
  mocks.reportLoaded.mockReset();
  mocks.openUrl.mockReset();
  mocks.useWindowSize.mockReturnValue({ width: 1280, height: 800 });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("WalletAssetsPercentage treemap", () => {
  it("renders 14 tiles: 13 wallets ≥1% + 1 Others tile for the 3 wallets <1%", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByTestId("wallet-treemap-tile")).toHaveLength(14);
    });
  });

  it("shows a scrollable list of all aggregated wallets in the More tile's popover", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    const { container } = renderComponent();

    await waitFor(() => {
      expect(screen.getAllByTestId("wallet-treemap-tile").length).toBe(14);
    });

    // find the aggregated (More) tile
    const aggregatedTile = container.querySelector(
      '[data-tile-key="__others_aggregated__"]',
    );
    expect(aggregatedTile).not.toBeNull();
    expect(aggregatedTile?.textContent).toMatch(/\+\d+/);

    // click the wrapper div to open the popover
    fireEvent.click(aggregatedTile!.parentElement!);
    const popoverContent = await waitFor(() => {
      const el = document.querySelector('[data-testid="treemap-popover"]');
      if (!el) throw new Error("popover not yet mounted");
      return el as HTMLElement;
    });

    // the popover should contain a list of aggregated wallets
    const list = popoverContent.querySelector(
      '[data-testid="aggregated-wallet-list"]',
    );
    expect(list).not.toBeNull();
    // 16 wallets total; 13 are ≥1% + 1 Others aggregating the 3 <1% wallets
    const items =
      list?.querySelectorAll('[data-testid="aggregated-wallet-item"]') ?? [];
    expect(items.length).toBe(3);

    // the list should be scrollable
    expect(list?.className).toMatch(/overflow-y-auto/);
    expect(list?.className).toMatch(/max-h-/);

    // each item shows the wallet name and percentage
    const firstItemText = items[0]?.textContent ?? "";
    expect(firstItemText).toMatch(/%/);

    // close by clicking outside
    fireEvent.click(document.body);
  });

  it("groups the smallest wallets into a single synthetic 'Others' tile", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByTestId("wallet-treemap-tile").length).toBe(14);
    });
    // the synthetic tile is keyed by the OTHERS_AGGREGATED_KEY constant
    const othersTile = screen
      .getAllByTestId("wallet-treemap-tile")
      .find((t) => t.getAttribute("data-tile-key") === "__others_aggregated__");
    expect(othersTile).toBeDefined();
    expect(othersTile?.textContent).toMatch(/\+\d+/);
  });

  it("shows the no-data state when there are no wallets", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue([]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("wallet-treemap-empty")).toBeInTheDocument();
    });
    expect(screen.queryAllByTestId("wallet-treemap-tile")).toHaveLength(0);
  });

  it("renders a single tile when only one wallet has a positive value", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue([
      makeWallet("binance", 100, "Binance"),
    ]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByTestId("wallet-treemap-tile")).toHaveLength(1);
    });
  });

  it("does not render the More tile when every wallet is ≥1%", async () => {
    // Every wallet is ≥1%, so the <1% tail is empty and the aggregated
    // "More" tile (count = 0) should be omitted.
    mocks.queryWalletAssetsPercentage.mockResolvedValue([
      makeWallet("binance", 45, "Binance"),
      makeWallet("okx", 25, "Okex"),
      makeWallet("ibkr", 20, "IBKR"),
      makeWallet("phantom", 10, "SOL"),
    ]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByTestId("wallet-treemap-tile")).toHaveLength(4);
    });

    const aggregatedTile = screen
      .getAllByTestId("wallet-treemap-tile")
      .find((t) => t.getAttribute("data-tile-key") === "__others_aggregated__");
    expect(aggregatedTile).toBeUndefined();
  });

  it("does not render the More tile when its aggregated percentage rounds to 0.00%", async () => {
    // 2 wallets cover 100% of value; the remaining 7 wallets each hold 0%,
    // so the aggregated "More" tile would show "+7" at 0.00% and should be
    // dropped from the treemap.
    mocks.queryWalletAssetsPercentage.mockResolvedValue([
      makeWallet("binance", 95, "Binance"),
      makeWallet("okx", 5, "Okex"),
      makeWallet("w1", 0, "ERC20"),
      makeWallet("w2", 0, "ERC20"),
      makeWallet("w3", 0, "ERC20"),
      makeWallet("w4", 0, "ERC20"),
      makeWallet("w5", 0, "ERC20"),
      makeWallet("w6", 0, "ERC20"),
      makeWallet("w7", 0, "ERC20"),
    ]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByTestId("wallet-treemap-tile")).toHaveLength(2);
    });

    const aggregatedTile = screen
      .getAllByTestId("wallet-treemap-tile")
      .find((t) => t.getAttribute("data-tile-key") === "__others_aggregated__");
    expect(aggregatedTile).toBeUndefined();
  });

  it("reports the stat row with total value, top share, and top-3 share", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("stat-total-value").textContent).toContain("$");
    });

    const top = screen.getByTestId("stat-top").textContent ?? "";
    const top3 = screen.getByTestId("stat-top3").textContent ?? "";
    const total = screen.getByTestId("stat-total-value").textContent ?? "";

    expect(top).toContain("32.40%");
    expect(top3).toContain("57.88%");
    expect(total).toMatch(/\$[\d,]+/);
  });

  it("renders the type summary pills with correct category percentages", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("type-pill-cex")).toBeInTheDocument();
    });

    expect(screen.getByTestId("type-pill-cex").textContent).toContain("57.29%");
    expect(screen.getByTestId("type-pill-broker").textContent).toContain(
      "13.44%",
    );
    expect(screen.getByTestId("type-pill-onchain").textContent).toContain(
      "23.48%",
    );
    expect(screen.getByTestId("type-pill-others").textContent).toContain(
      "5.78%",
    );
  });

  it("calls reportLoaded once the query resolves", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    renderComponent();

    await waitFor(() => {
      expect(mocks.reportLoaded).toHaveBeenCalledTimes(1);
    });
  });

  it("opens the wallet detail URL when a clickable tile is clicked", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    const { container } = renderComponent();

    await waitFor(() => {
      expect(
        screen.getAllByTestId("wallet-treemap-tile").length,
      ).toBeGreaterThan(0);
    });

    // phantom (SOL) is in the top 4 with MAX_TILES=5 and has a detail URL
    const phantomTile = findTile(container, "phantom");
    fireEvent.click(phantomTile);

    expect(mocks.openUrl).toHaveBeenCalledTimes(1);
    expect(mocks.openUrl.mock.calls[0][0]).toMatch(/jup\.ag\/portfolio\//);
  });

  it("does not call openUrl for tiles without a detail URL mapping", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    const { container } = renderComponent();

    await waitFor(() => {
      expect(
        screen.getAllByTestId("wallet-treemap-tile").length,
      ).toBeGreaterThan(0);
    });

    fireEvent.click(findTile(container, "binance"));

    expect(mocks.openUrl).not.toHaveBeenCalled();
  });

  it("renders the loading placeholder when the container has zero size", async () => {
    // Force the container to return 0,0,0,0 for this test only
    const realGet = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.getAttribute("data-testid") === "wallet-treemap-container") {
        return {
          width: 0,
          height: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return realGet.call(this);
    };
    try {
      mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
      renderComponent();

      await waitFor(() => {
        expect(mocks.queryWalletAssetsPercentage).toHaveBeenCalled();
      });
      // the placeholder is shown while isReady is false
      expect(
        screen.getByTestId("wallet-treemap-placeholder"),
      ).toBeInTheDocument();
      // no tiles yet
      expect(screen.queryAllByTestId("wallet-treemap-tile")).toHaveLength(0);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = realGet;
    }
  });

  it("gives the treemap container enough vertical room so squarify can lay out readable tiles", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByTestId("wallet-treemap-container"),
      ).toBeInTheDocument();
    });
    const container = screen.getByTestId("wallet-treemap-container");
    // the inline style height must be at least 540px so each tile is ~100+ tall
    const inlineHeight = container.style.height;
    const px = parseInt(inlineHeight, 10);
    expect(px).toBeGreaterThanOrEqual(540);
  });

  it("guarantees every visible tile is wide and tall enough to show at least the wallet name", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getAllByTestId("wallet-treemap-tile").length,
      ).toBeGreaterThan(0);
    });
    const tiles = screen.getAllByTestId("wallet-treemap-tile");
    // DEBUG: log all sizes
    const sizes = tiles.map((t) => {
      const wrapper = t.parentElement;
      const w = parseFloat(wrapper?.style.width ?? "0");
      const h = parseFloat(wrapper?.style.height ?? "0");
      return `${t.getAttribute("data-tile-key")}: ${w}x${h}`;
    });
    for (const t of tiles) {
      const wrapper = t.parentElement;
      if (!wrapper) continue;
      const w = parseFloat(wrapper.style.width);
      const h = parseFloat(wrapper.style.height);
      expect(
        w,
        `tile ${t.getAttribute("data-tile-key")} width`,
      ).toBeGreaterThanOrEqual(40);
      expect(
        h,
        `tile ${t.getAttribute("data-tile-key")} height`,
      ).toBeGreaterThanOrEqual(24);
    }
  });

  it("applies overflow-hidden on the treemap container to clip residual overflow", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByTestId("wallet-treemap-container"),
      ).toBeInTheDocument();
    });
    const container = screen.getByTestId("wallet-treemap-container");
    expect(container.className).toContain("overflow-hidden");
  });

  it("renders the Card with a boundary marker for layout reference", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByTestId("wallet-treemap-container"),
      ).toBeInTheDocument();
    });
    // the Card element with data-card-boundary must exist in the DOM
    const card = document.querySelector("[data-card-boundary]");
    expect(card).not.toBeNull();
    expect(card?.getAttribute("data-card-boundary")).toBe("true");
  });

  it("renders the treemap container inside the Card element", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByTestId("wallet-treemap-container"),
      ).toBeInTheDocument();
    });
    const card = document.querySelector('[data-card-boundary="true"]');
    expect(card).not.toBeNull();
    // the treemap container must be a descendant of the Card
    expect(card?.contains(screen.getByTestId("wallet-treemap-container"))).toBe(
      true,
    );
  });

  it("shows the popover on click and hides on click-outside", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getAllByTestId("wallet-treemap-tile").length,
      ).toBeGreaterThan(0);
    });

    const firstTile = screen.getAllByTestId("wallet-treemap-tile")[0];
    const wrapper = firstTile.parentElement!;

    // popover should not exist before click
    expect(
      document.querySelector('[data-testid="treemap-popover"]'),
    ).toBeNull();

    // click shows popover
    fireEvent.click(wrapper);
    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="treemap-popover"]'),
      ).not.toBeNull();
    });

    // click outside hides popover
    fireEvent.click(document.body);
    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="treemap-popover"]'),
      ).toBeNull();
    });
  });

  it("shows wallet details (name, type, percentage, value) in the popover", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getAllByTestId("wallet-treemap-tile").length,
      ).toBeGreaterThan(0);
    });

    // Click the binance tile (a CEX wallet)
    const binanceTile = screen
      .getAllByTestId("wallet-treemap-tile")
      .find((t) => t.getAttribute("data-tile-key") === "binance")!;
    fireEvent.click(binanceTile.parentElement!);

    const popover = await waitFor(() => {
      const el = document.querySelector('[data-testid="treemap-popover"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });

    // should show the wallet name
    expect(popover.textContent).toMatch(/binance/i);
    // should show the percentage
    expect(popover.textContent).toMatch(/32\.40%/);
    // should show the value with currency symbol
    expect(popover.textContent).toMatch(/\$/);

    // close by clicking outside
    fireEvent.click(document.body);
  });

  it("exposes an aria-label on each tile for screen readers", async () => {
    mocks.queryWalletAssetsPercentage.mockResolvedValue(MIXED_15);
    const { container } = renderComponent();

    await waitFor(() => {
      expect(
        screen.getAllByTestId("wallet-treemap-tile").length,
      ).toBeGreaterThan(0);
    });

    const binanceTile = findTile(container, "binance");
    expect(binanceTile).toHaveAttribute("aria-label");
    expect(binanceTile.getAttribute("aria-label")).toMatch(/binance/i);
    expect(binanceTile.getAttribute("aria-label")).toMatch(/%/);
  });
});
