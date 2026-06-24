import React from "react";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TopCoinsPercentageChange from "@/components/top-coins-percentage-change";
import { ChartResizeContext } from "@/App";
import { queryTopCoinsPercentageChangeData } from "@/middlelayers/charts";
import { downloadCoinLogos } from "@/middlelayers/data";
import { getImageApiPath } from "@/utils/app";

vi.mock("@/middlelayers/charts", () => ({
  queryTopCoinsPercentageChangeData: vi.fn(),
}));

vi.mock("@/middlelayers/data", () => ({
  downloadCoinLogos: vi.fn(),
}));

vi.mock("@/utils/app", () => ({
  getImageApiPath: vi.fn(),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appCacheDir: vi.fn().mockResolvedValue("/tmp/track3-cache"),
}));

// Each call to getImageApiPath returns a deterministic fake file URL per symbol.
vi.mocked(getImageApiPath).mockImplementation(async (_cacheDir, symbol) =>
  `asset://localhost/cache/assets/coins/${symbol.toLowerCase()}.png`,
);

function renderChart() {
  return render(
    <ChartResizeContext.Provider
      value={{
        needResize: 0,
        setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>>,
      }}
    >
      <TopCoinsPercentageChange
        dateRange={{
          start: new Date("2024-04-15"),
          end: new Date("2024-04-17"),
        }}
      />
    </ChartResizeContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Re-apply the default getImageApiPath mock after clearAllMocks.
  vi.mocked(getImageApiPath).mockImplementation(async (_cacheDir, symbol) =>
    `asset://localhost/cache/assets/coins/${symbol.toLowerCase()}.png`,
  );
});

describe("TopCoinsPercentageChange", () => {
  it("renders one row per coin sorted by current value % descending", async () => {
    vi.mocked(queryTopCoinsPercentageChangeData).mockResolvedValue({
      timestamps: [1713158400000, 1713244800000, 1713331200000],
      coins: [
        {
          coin: "DOGE",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: -3.2, price: -5.1 },
            { timestamp: 1713331200000, value: -3.2, price: -5.1 },
          ],
        },
        {
          coin: "PEPE",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 80, price: 90 },
            { timestamp: 1713331200000, value: 156.8, price: 180.2 },
          ],
        },
        {
          coin: "BTC",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 6, price: 5 },
            { timestamp: 1713331200000, value: 12.4, price: 10.2 },
          ],
        },
      ],
    });

    const { getAllByTestId } = renderChart();

    await waitFor(() => {
      expect(getAllByTestId("tcpc-row")).toHaveLength(3);
    });

    const rows = getAllByTestId("tcpc-row");
    const labels = rows.map((r) => within(r).getByTestId("tcpc-symbol").textContent);
    expect(labels).toEqual(["PEPE", "BTC", "DOGE"]);
  });

  it("marks the first and last row as Top Gainer and Top Loser", async () => {
    vi.mocked(queryTopCoinsPercentageChangeData).mockResolvedValue({
      timestamps: [1713158400000, 1713244800000],
      coins: [
        {
          coin: "PEPE",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 156.8, price: 180.2 },
          ],
        },
        {
          coin: "SOL",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 24.3, price: 28.0 },
          ],
        },
        {
          coin: "ARB",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: -8.9, price: -12.3 },
          ],
        },
      ],
    });

    const { getAllByTestId } = renderChart();

    await waitFor(() => {
      expect(getAllByTestId("tcpc-row")).toHaveLength(3);
    });

    const rows = getAllByTestId("tcpc-row");
    expect(within(rows[0]).getByTestId("tcpc-badge").textContent).toBe("Top Gainer");
    expect(within(rows[2]).getByTestId("tcpc-badge").textContent).toBe("Top Loser");
    // middle row has no badge
    expect(within(rows[1]).queryByTestId("tcpc-badge")).toBeNull();
  });

  it("renders both value and price percentages with sign formatting", async () => {
    vi.mocked(queryTopCoinsPercentageChangeData).mockResolvedValue({
      timestamps: [1713158400000, 1713244800000],
      coins: [
        {
          coin: "PEPE",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 156.8, price: 180.2 },
          ],
        },
      ],
    });

    const { getByTestId } = renderChart();

    await waitFor(() => {
      expect(getByTestId("tcpc-row")).toBeInTheDocument();
    });

    expect(getByTestId("tcpc-value").textContent).toContain("156.8%");
    expect(getByTestId("tcpc-price").textContent).toContain("180.2%");
  });

  it("renders a sparkline svg per row", async () => {
    vi.mocked(queryTopCoinsPercentageChangeData).mockResolvedValue({
      timestamps: [1713158400000, 1713244800000, 1713331200000],
      coins: [
        {
          coin: "PEPE",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 80, price: 90 },
            { timestamp: 1713331200000, value: 156.8, price: 180.2 },
          ],
        },
        {
          coin: "ARB",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: -4, price: -6 },
            { timestamp: 1713331200000, value: -8.9, price: -12.3 },
          ],
        },
      ],
    });

    const { getAllByTestId } = renderChart();

    await waitFor(() => {
      expect(getAllByTestId("tcpc-row")).toHaveLength(2);
    });

    const sparklines = getAllByTestId("tcpc-sparkline");
    expect(sparklines).toHaveLength(2);
    sparklines.forEach((s) => {
      expect(s.tagName.toLowerCase()).toBe("svg");
      // a sparkline always has exactly one stroke path
      expect(s.querySelectorAll("path")).toHaveLength(1);
    });
  });

  it("uses emerald color class for positive value and rose for negative", async () => {
    vi.mocked(queryTopCoinsPercentageChangeData).mockResolvedValue({
      timestamps: [1713158400000, 1713244800000],
      coins: [
        {
          coin: "PEPE",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 12.4, price: 10.2 },
          ],
        },
        {
          coin: "DOGE",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: -3.2, price: -5.1 },
          ],
        },
      ],
    });

    const { getAllByTestId } = renderChart();

    await waitFor(() => {
      expect(getAllByTestId("tcpc-row")).toHaveLength(2);
    });

    const rows = getAllByTestId("tcpc-row");
    const gainerClasses = within(rows[0]).getByTestId("tcpc-value").className;
    const loserClasses = within(rows[1]).getByTestId("tcpc-value").className;
    expect(gainerClasses).toMatch(/emerald/);
    expect(loserClasses).toMatch(/rose/);
  });

  it("renders a real logo image per row sourced from the local cache", async () => {
    vi.mocked(queryTopCoinsPercentageChangeData).mockResolvedValue({
      timestamps: [1713158400000, 1713244800000],
      coins: [
        {
          coin: "PEPE",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 156.8, price: 180.2 },
          ],
        },
        {
          coin: "BTC",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 12.4, price: 10.2 },
          ],
        },
      ],
    });

    const { getAllByTestId } = renderChart();

    await waitFor(() => {
      expect(getAllByTestId("tcpc-row")).toHaveLength(2);
    });

    // Wait for the logo fetch effect to resolve and re-render.
    await waitFor(() => {
      const logos = getAllByTestId("tcpc-logo");
      expect(logos.every((l) => l.getAttribute("src"))).toBe(true);
    });

    const logos = getAllByTestId("tcpc-logo");
    logos.forEach((logo) => {
      const src = logo.getAttribute("src") ?? "";
      // Either the cached asset path, or the default fallback bundled SVG
      // (asset URL starts with `asset://localhost` or the inline SVGs shipped
      // by Vite resolve to `/src/assets/icons/...`).
      expect(
        src.startsWith("asset://localhost/cache/assets/coins/") ||
          src.includes("/assets/icons/"),
      ).toBe(true);
    });

    // The downloader should be called with crypto-eligible coins.
    expect(vi.mocked(downloadCoinLogos)).toHaveBeenCalled();
    const callArg = vi.mocked(downloadCoinLogos).mock.calls[0]?.[0] ?? [];
    const symbols = callArg.map((c) => c.symbol);
    expect(symbols).toEqual(expect.arrayContaining(["PEPE", "BTC"]));
  });

  it("renders max and min in a two-column subgrid so labels and values line up across rows", async () => {
    // Two rows where the max/min widths differ (3 digits vs 1 digit) so the
    // subgrid is what keeps the "max" / "min" labels at the same x-position.
    vi.mocked(queryTopCoinsPercentageChangeData).mockResolvedValue({
      timestamps: [1713158400000, 1713244800000, 1713331200000],
      coins: [
        {
          coin: "PEPE",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 5, price: 4 },
            { timestamp: 1713331200000, value: 10.1, price: 30 },
          ],
        },
        {
          coin: "ARB",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: -2, price: -3 },
            { timestamp: 1713331200000, value: -12.3, price: -18.5 },
          ],
        },
      ],
    });

    const { getAllByTestId } = renderChart();

    await waitFor(() => {
      expect(getAllByTestId("tcpc-row")).toHaveLength(2);
    });

    const maxRows = getAllByTestId("tcpc-max");
    const minRows = getAllByTestId("tcpc-min");
    expect(maxRows).toHaveLength(2);
    expect(minRows).toHaveLength(2);

    // Each max/min row is a 2-column grid so the label sits in a fixed-width
    // left column and the value right-aligns in the remaining column.
    maxRows.forEach((row) => {
      const children = Array.from(row.children);
      expect(children).toHaveLength(2);
      expect(children[0].textContent?.trim()).toBe("max");
      expect(children[1].textContent?.trim()).toMatch(/%$/);
    });
    minRows.forEach((row) => {
      const children = Array.from(row.children);
      expect(children).toHaveLength(2);
      expect(children[0].textContent?.trim()).toBe("min");
      expect(children[1].textContent?.trim()).toMatch(/%$/);
    });

    // Actual values are still present and signed.
    expect(maxRows[0].textContent).toContain("+10.1%");
    expect(minRows[0].textContent).toContain("0%");
    expect(maxRows[1].textContent).toContain("0%");
    expect(minRows[1].textContent).toContain("-12.3%");
  });

  it("renders Value and Price column labels with the active one highlighted", async () => {
    vi.mocked(queryTopCoinsPercentageChangeData).mockResolvedValue({
      timestamps: [1713158400000, 1713244800000],
      coins: [
        {
          coin: "BTC",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 12.4, price: 10.2 },
          ],
        },
      ],
    });

    const { getByTestId } = renderChart();

    await waitFor(() => {
      expect(getByTestId("tcpc-row")).toBeInTheDocument();
    });

    // Column labels exist in the header.
    expect(getByTestId("tcpc-header-value")).toBeInTheDocument();
    expect(getByTestId("tcpc-header-price")).toBeInTheDocument();
    expect(getByTestId("tcpc-header-value").textContent).toBe("Value");
    expect(getByTestId("tcpc-header-price").textContent).toBe("Price");

    // Default sort: value column is active, price column is inactive.
    expect(getByTestId("tcpc-header-value").getAttribute("data-active")).toBe("true");
    expect(getByTestId("tcpc-header-price").getAttribute("data-active")).toBe("false");
    expect(getByTestId("tcpc-value").getAttribute("data-active")).toBe("true");
    expect(getByTestId("tcpc-price").getAttribute("data-active")).toBe("false");

    // Active value uses the larger font class, inactive uses the smaller one.
    expect(getByTestId("tcpc-value").className).toMatch(/text-base/);
    expect(getByTestId("tcpc-price").className).toMatch(/text-\[10px\]/);

    // Switch to price sort.
    fireEvent.click(getByTestId("tcpc-sort-price"));

    await waitFor(() => {
      expect(getByTestId("tcpc-value").getAttribute("data-active")).toBe("false");
    });

    expect(getByTestId("tcpc-header-value").getAttribute("data-active")).toBe("false");
    expect(getByTestId("tcpc-header-price").getAttribute("data-active")).toBe("true");
    expect(getByTestId("tcpc-value").className).toMatch(/text-\[10px\]/);
    expect(getByTestId("tcpc-price").className).toMatch(/text-base/);
  });

  it("switches the sparkline path, color, and min/max to the active metric", async () => {
    // ALPHA: value up-then-down, price steadily up.
    // BETA:  value down-then-up, price steadily down.
    // Value sort desc: BETA (3) > ALPHA (-5).  Price sort desc: ALPHA (20) > BETA (-12).
    vi.mocked(queryTopCoinsPercentageChangeData).mockResolvedValue({
      timestamps: [0, 1, 2, 3, 4, 5, 6].map((t) => 1713158400000 + t * 86400000),
      coins: [
        {
          coin: "ALPHA",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          // value ends -1 (rose), price ends +20 (emerald).
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 5, price: 3 },
            { timestamp: 1713331200000, value: 10, price: 6 },
            { timestamp: 1713417600000, value: 8, price: 9 },
            { timestamp: 1713504000000, value: 3, price: 12 },
            { timestamp: 1713590400000, value: -2, price: 15 },
            { timestamp: 1713676800000, value: -1, price: 20 },
          ],
        },
        {
          coin: "BETA",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          // value ends -5 (rose), price ends +10 (emerald).
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: -3, price: 2 },
            { timestamp: 1713331200000, value: -6, price: 4 },
            { timestamp: 1713417600000, value: -2, price: 6 },
            { timestamp: 1713504000000, value: -2, price: 8 },
            { timestamp: 1713590400000, value: -4, price: 9 },
            { timestamp: 1713676800000, value: -5, price: 10 },
          ],
        },
      ],
    });

    const { getAllByTestId, getByTestId } = renderChart();

    await waitFor(() => {
      expect(getAllByTestId("tcpc-row")).toHaveLength(2);
    });

    // Both sorts put ALPHA first (highest in its metric).
    // Value sort desc: ALPHA (-1) > BETA (-5).  Price sort desc: ALPHA (+20) > BETA (+10).

    // Default (value) sort: ALPHA's value path max = 10, min = -2.
    expect(getAllByTestId("tcpc-max")[0].textContent).toContain("+10.0%");
    expect(getAllByTestId("tcpc-min")[0].textContent).toContain("-2%");

    // Sparkline is ALPHA's value path, ending at -1 (rose).
    const pathBefore = getAllByTestId("tcpc-sparkline")[0].querySelector("path");
    const dBefore = pathBefore?.getAttribute("d");
    const strokeBefore = pathBefore?.getAttribute("stroke");
    expect(strokeBefore).toBe("#f43f5e");

    // Switch to price sort. ALPHA stays first, but now its price path is shown
    // (ending at +20, emerald). The path d, color, and min/max all change.
    fireEvent.click(getByTestId("tcpc-sort-price"));

    await waitFor(() => {
      // ALPHA's price path max = 20.0, min = 0.
      const maxText = getAllByTestId("tcpc-max")[0].textContent;
      expect(maxText).toContain("+20.0%");
    });
    expect(getAllByTestId("tcpc-min")[0].textContent).toContain("0%");

    const pathAfter = getAllByTestId("tcpc-sparkline")[0].querySelector("path");
    const dAfter = pathAfter?.getAttribute("d");
    const strokeAfter = pathAfter?.getAttribute("stroke");
    expect(dAfter).not.toBe(dBefore);
    expect(strokeAfter).toBe("#10b981");
  });

  it("renders the empty state when no coins are returned", async () => {
    vi.mocked(queryTopCoinsPercentageChangeData).mockResolvedValue({
      timestamps: [],
      coins: [],
    });

    const { getByTestId, queryAllByTestId } = renderChart();

    await waitFor(() => {
      expect(getByTestId("tcpc-empty")).toBeInTheDocument();
    });

    expect(queryAllByTestId("tcpc-row")).toHaveLength(0);
  });

  it("renders a Value / Price sort toggle in the card header", async () => {
    vi.mocked(queryTopCoinsPercentageChangeData).mockResolvedValue({
      timestamps: [1713158400000, 1713244800000],
      coins: [
        {
          coin: "BTC",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 12.4, price: 10.2 },
          ],
        },
      ],
    });

    const { getAllByTestId } = renderChart();

    await waitFor(() => {
      expect(getAllByTestId("tcpc-row")).toHaveLength(1);
    });

    // Two sort options in the header.
    const sortValue = getAllByTestId("tcpc-sort-value");
    const sortPrice = getAllByTestId("tcpc-sort-price");
    expect(sortValue).toHaveLength(1);
    expect(sortPrice).toHaveLength(1);
    // Default sort is value, so its button is in the checked state.
    expect(sortValue[0].getAttribute("data-state")).toBe("checked");
    expect(sortPrice[0].getAttribute("data-state")).toBe("unchecked");
  });

  it("reorders rows when the user switches to Price sort", async () => {
    // ALPHA: high value, low price.  BETA: low value, high price.
    // Value-sorted: ALPHA, BETA.  Price-sorted: BETA, ALPHA.
    vi.mocked(queryTopCoinsPercentageChangeData).mockResolvedValue({
      timestamps: [1713158400000, 1713244800000],
      coins: [
        {
          coin: "ALPHA",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 50.0, price: 1.0 },
          ],
        },
        {
          coin: "BETA",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 5.0, price: 80.0 },
          ],
        },
      ],
    });

    const { getAllByTestId, getByTestId } = renderChart();

    await waitFor(() => {
      expect(getAllByTestId("tcpc-row")).toHaveLength(2);
    });

    // Default sort: by value desc -> ALPHA, BETA.
    let symbols = getAllByTestId("tcpc-row").map((r) =>
      within(r).getByTestId("tcpc-symbol").textContent,
    );
    expect(symbols).toEqual(["ALPHA", "BETA"]);

    // Click the Price sort option.
    fireEvent.click(getByTestId("tcpc-sort-price"));

    // After price sort: BETA (+80.0), ALPHA (+1.0).
    await waitFor(() => {
      const next = getAllByTestId("tcpc-row").map((r) =>
        within(r).getByTestId("tcpc-symbol").textContent,
      );
      expect(next).toEqual(["BETA", "ALPHA"]);
    });

    // The Price button is now the checked one.
    expect(getByTestId("tcpc-sort-price").getAttribute("data-state")).toBe("checked");
    expect(getByTestId("tcpc-sort-value").getAttribute("data-state")).toBe("unchecked");

    // Switch back to Value.
    fireEvent.click(getByTestId("tcpc-sort-value"));
    await waitFor(() => {
      const next = getAllByTestId("tcpc-row").map((r) =>
        within(r).getByTestId("tcpc-symbol").textContent,
      );
      expect(next).toEqual(["ALPHA", "BETA"]);
    });
  });
});
