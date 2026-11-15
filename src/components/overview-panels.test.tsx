import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DailyChangeCard, WhatMovedCard, SourceStatusCard, TopCoinsCard } from "./overview-panels";
import { bucketDailyChanges, maxDailyBars } from "./overview-daily-buckets";

const usd = { currency: "USD", rate: 1, alias: "US Dollar", symbol: "$" };
const eur = { currency: "EUR", rate: 2, alias: "Euro", symbol: "€" };
const cny = { currency: "CNY", rate: 1, alias: "Yuan", symbol: "¥" };
const days = (count: number, start = new Date(2026, 0, 1)) => Array.from({ length: count }, (_, index) => ({
  timestamp: new Date(start.getFullYear(), start.getMonth(), start.getDate() + index).getTime(),
  value: index % 3 === 0 ? -2 : 3,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("daily change buckets", () => {
  it.each([1, 10, 30, 31, 90, 264, 1000])("preserves the total and caps %i changes", (count) => {
    const daily = days(count);
    const { buckets } = bucketDailyChanges(daily, 40);
    expect(buckets.reduce((sum, bucket) => sum + bucket.value, 0))
      .toBe(daily.reduce((sum, item) => sum + item.value, 0));
    expect(buckets.length).toBeLessThanOrEqual(40);
    expect(buckets.map((bucket) => bucket.start)).toEqual([...buckets.map((bucket) => bucket.start)].sort((a, b) => a - b));
    if (count <= 30) expect(buckets).toHaveLength(count);
  });

  it("groups consecutive changes by Monday-start weeks across gaps", () => {
    const daily = [
      { timestamp: new Date(2026, 10, 1, 12).getTime(), value: 9 },
      { timestamp: new Date(2026, 10, 2, 10).getTime(), value: -5 },
      { timestamp: new Date(2026, 10, 2, 18).getTime(), value: 8 },
      { timestamp: new Date(2026, 10, 9, 12).getTime(), value: -2 },
      ...days(40, new Date(2026, 10, 10)),
    ];
    const result = bucketDailyChanges(daily, 20);
    expect(result.period).toBe("week");
    expect(result.buckets.slice(0, 3).map(({ start, value, count }) => [start, value, count]))
      .toEqual([
        [new Date(2026, 9, 26).getTime(), 9, 1],
        [new Date(2026, 10, 2).getTime(), 3, 2],
        [new Date(2026, 10, 9).getTime(), 6, 7],
      ]);
  });

  it("uses monthly sums for long spans and daily sums for dense short spans", () => {
    const monthly = bucketDailyChanges(days(264), 40);
    expect(monthly.period).toBe("month");
    expect(monthly.buckets[0]).toMatchObject({ start: new Date(2026, 0, 1).getTime(), count: 31 });
    const dense = bucketDailyChanges(Array.from({ length: 31 }, (_, index) => ({
      timestamp: new Date(2026, 10, 1 + Math.floor(index / 4), 12 + index % 4).getTime(),
      value: 1,
    })), 20);
    expect(dense.period).toBe("day");
    expect(dense.buckets).toHaveLength(8);
    expect(dense.buckets[0]).toMatchObject({ value: 4, count: 4 });
  });

  it("derives desktop and phone limits from available pixels", () => {
    expect(maxDailyBars(180, false)).toBe(30);
    expect(maxDailyBars(600, false)).toBe(60);
    expect(maxDailyBars(180, true)).toBe(36);
    expect(maxDailyBars(600, true)).toBe(40);
  });
});

describe("overview panels", () => {
  it.each([
    { desktopFidelity: true, count: 59 },
    { desktopFidelity: false, count: 39 },
  ])("measures the $desktopFidelity chart when data arrives and again on resize", ({ desktopFidelity, count }) => {
    let width = 600;
    let onResize: ResizeObserverCallback = () => {};
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("t3-daily-chart") ? width : 0;
    });
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { onResize = callback; }
      observe() {}
      disconnect() {}
    });
    const { rerender } = render(<DailyChangeCard currency={usd} daily={[]} desktopFidelity={desktopFidelity} />);
    rerender(<DailyChangeCard currency={usd} daily={days(count)} desktopFidelity={desktopFidelity} />);
    expect(document.querySelectorAll(".t3-daily-column")).toHaveLength(count);
    width = 180;
    act(() => onResize([], {} as ResizeObserver));
    expect(document.querySelectorAll(".t3-daily-column").length).toBeLessThan(count);
  });

  it("positions interior month ticks over their bar centers", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("t3-daily-chart") ? 600 : 0;
    });
    render(<DailyChangeCard currency={usd} daily={days(264)} desktopFidelity />);
    const tick = [...document.querySelectorAll<HTMLElement>(".t3-daily-x-axis span")]
      .find((element) => [1, 2, 3, 5, 6, 7].includes(new Date(Number(element.dataset.start)).getMonth()));
    expect(tick).toBeDefined();
    const monthIndex = new Date(Number(tick!.dataset.start)).getMonth();
    expect(parseFloat(tick!.style.left)).toBeCloseTo((monthIndex + 0.5) / 9 * 100);
    expect(document.querySelector<HTMLElement>(".t3-daily-x-axis span")?.style.transform).toBe("translateX(-50%)");
  });

  it("shows the best day and separates gain from loss in the daily chart", () => {
    render(<DailyChangeCard currency={usd} daily={[
      { timestamp: Date.parse("2026-10-29"), value: 120 },
      { timestamp: Date.parse("2026-10-30"), value: -30 },
    ]} bestDay={{ timestamp: Date.parse("2026-10-29"), value: 120 }} />);
    expect(screen.getByText("Daily change")).toBeInTheDocument();
    expect(screen.getByText(/best day/)).toHaveTextContent("+$120");
    expect(screen.getByLabelText(/daily change chart/i)).toHaveTextContent("−$30");
  });

  it("labels the daily chart's vertical direction outside its date axis", () => {
    const daily = Array.from({ length: 30 }, (_, index) => ({
      timestamp: Date.parse("2026-10-01") + index * 86400000,
      value: index % 2 ? -100 : 100,
    }));
    render(<DailyChangeCard currency={usd} daily={daily} desktopFidelity />);
    expect(screen.getByText("▲ Up")).toBeInTheDocument();
    expect(screen.getByText("▼ Down")).toBeInTheDocument();
    expect(document.querySelector(".t3-daily-x-axis")).not.toHaveTextContent("Up");
    expect((document.querySelector(".t3-daily-up") as HTMLElement).style.height).toBe("48%");
    expect(document.querySelectorAll(".t3-daily-column")).toHaveLength(30);
    expect(screen.getByText("USD, last 30 days")).toBeInTheDocument();
  });

  it("renders weekly and monthly totals with bounded bars and truthful headings", () => {
    const { rerender } = render(<DailyChangeCard currency={usd} daily={days(90)} desktopFidelity />);
    expect(screen.getByText("Weekly change")).toBeInTheDocument();
    expect(screen.getByText("90 changes, grouped by week")).toBeInTheDocument();
    expect(document.querySelectorAll(".t3-daily-column").length).toBeLessThanOrEqual(60);
    expect(document.querySelector(".t3-daily-column")).toHaveAttribute("title", expect.stringContaining("changes"));
    expect(document.querySelector(".t3-daily-column > span")).toHaveAttribute("data-direction", "gain");
    rerender(<DailyChangeCard currency={usd} daily={days(264)} desktopFidelity />);
    expect(screen.getByText("Monthly change")).toBeInTheDocument();
    expect(screen.getByText("264 changes, grouped by month")).toBeInTheDocument();
    expect(document.querySelectorAll(".t3-daily-column").length).toBeLessThanOrEqual(60);
    const summary = document.querySelector(".t3-daily-chart .sr-only")?.textContent ?? "";
    expect(summary).toContain("264 changes, total");
    expect(summary.length).toBeLessThan(2000);
    expect(document.querySelector(".t3-daily-column")).toHaveAttribute("title", expect.stringContaining("best"));
    const ticks = [...document.querySelectorAll<HTMLElement>(".t3-daily-x-axis span")].map((tick) => Number(tick.dataset.start));
    expect(ticks[0]).toBe(new Date(2026, 0, 1).getTime());
    expect(ticks.at(-1)).toBe(new Date(2026, 8, 1).getTime());
  });

  it("scales grouped bars by their sum while retaining the best single day", () => {
    const daily = days(90).map((item) => ({ ...item, value: 100 }));
    render(<DailyChangeCard currency={usd} daily={daily} bestDay={daily[0]} desktopFidelity />);
    expect(document.querySelector(".t3-daily-y-axis")).toHaveTextContent("+1K");
    expect(screen.getByText(/best day/)).toHaveTextContent("+$100.00");
  });

  it("uses the phone bar limit for the shared card", () => {
    render(<DailyChangeCard currency={usd} daily={days(90)} />);
    expect(screen.getByText("Weekly change")).toBeInTheDocument();
    expect(document.querySelectorAll(".t3-daily-column").length).toBeLessThanOrEqual(40);
  });

  it("uses directional colours for daily bars and labels while keeping zero neutral", () => {
    render(<DailyChangeCard currency={usd} daily={[
      { timestamp: Date.parse("2026-10-29"), value: 120 },
      { timestamp: Date.parse("2026-10-30"), value: -30 },
      { timestamp: Date.parse("2026-10-31"), value: 0 },
    ]} desktopFidelity />);
    expect(document.querySelector(".t3-daily-up")).toHaveAttribute("data-direction", "gain");
    expect(document.querySelector(".t3-daily-down")).toHaveAttribute("data-direction", "loss");
    expect(document.querySelector(".t3-daily-neutral")).toHaveAttribute("data-direction", "neutral");
    expect(screen.getByText("▲ Up")).toHaveClass("text-gain");
    expect(screen.getByText("▼ Down")).toHaveClass("text-loss");
  });

  it("lists signed asset contributions", () => {
    render(<MemoryRouter><WhatMovedCard currency={usd} count={3} rows={[
      { symbol: "ETH", assetType: "crypto", value: 40 },
      { symbol: "SOL", assetType: "crypto", value: -25 },
    ]} /></MemoryRouter>);
    expect(screen.getByText("What moved")).toBeInTheDocument();
    expect(screen.getByText("Last 3 snapshots")).toBeInTheDocument();
    expect(screen.getByText("+$40.00")).toBeInTheDocument();
    expect(screen.getByText("−$25.00")).toBeInTheDocument();
  });
  it("renders a long CNY contribution as one signed text unit", () => {
    render(<MemoryRouter><WhatMovedCard currency={cny} count={7} rows={[
      { symbol: "BTC", assetType: "crypto", value: -600_061.17 },
    ]} /></MemoryRouter>);
    const amount = screen.getByText("−¥600,061.17");
    expect(amount).toHaveClass("t3-signed-unit");
    expect(amount.childNodes).toHaveLength(1);
    expect(amount.firstChild?.nodeType).toBe(Node.TEXT_NODE);
  });
  it("uses shared direction tokens for What moved bars and coin changes", () => {
    render(<MemoryRouter>
      <WhatMovedCard currency={usd} count={2} quoteColor="red-up-green-down" rows={[
        { symbol: "ETH", assetType: "crypto", value: 40 },
        { symbol: "SOL", assetType: "crypto", value: -25 },
      ]} />
      <TopCoinsCard currency={usd} quoteColor="red-up-green-down" rows={[
        { symbol: "BTC", assetType: "crypto", value: 100, amount: 1, priceChange: -2 },
      ]} />
    </MemoryRouter>);
    const bars = document.querySelectorAll<HTMLElement>(".t3-moved-track > span");
    expect(bars[0].style.backgroundColor).toBe("hsl(var(--gain))");
    expect(bars[1].style.backgroundColor).toBe("hsl(var(--loss))");
    expect(screen.getByText("+$40.00")).toHaveClass("text-gain");
    expect(screen.getByText("−$25.00")).toHaveClass("text-loss");
    expect(screen.getByText("−2.0%")).toHaveClass("text-loss");
  });
  it("keeps nonzero contribution bars visible at their original scale outside desktop fidelity", () => {
    const { rerender } = render(<MemoryRouter><WhatMovedCard currency={usd} count={2} rows={[
      { symbol: "ETH", assetType: "crypto", value: -40 },
      { symbol: "SOL", assetType: "crypto", value: -25 },
    ]} /></MemoryRouter>);
    expect([...document.querySelectorAll<HTMLElement>(".t3-moved-track > span")].map((bar) => bar.style.width))
      .toEqual(["100%", "62.5%"]);
    rerender(<MemoryRouter><WhatMovedCard currency={usd} count={2} rows={[
      { symbol: "ETH", assetType: "crypto", value: 1000 },
      { symbol: "SOL", assetType: "crypto", value: -500 },
      { symbol: "BTC", assetType: "crypto", value: 1 },
    ]} /></MemoryRouter>);
    expect([...document.querySelectorAll<HTMLElement>(".t3-moved-track > span")].map((bar) => bar.style.width))
      .toEqual(["100%", "50%", "2%"]);
    expect(document.querySelector(".t3-moved-diverging")).toBeNull();
  });
  it("keeps desktop gains and losses visible on opposite sides of the zero line", () => {
    const { rerender } = render(<MemoryRouter><WhatMovedCard currency={usd} count={2} desktopFidelity rows={[
      { symbol: "ETH", assetType: "crypto", value: -40 },
      { symbol: "SOL", assetType: "crypto", value: -25 },
    ]} /></MemoryRouter>);
    expect(document.querySelector(".t3-moved-diverging")).toBeInTheDocument();
    expect([...document.querySelectorAll<HTMLElement>(".t3-moved-track > span")].map((bar) => Number.parseFloat(bar.style.width)))
      .toEqual([92, 57.5]);
    rerender(<MemoryRouter><WhatMovedCard currency={usd} count={2} desktopFidelity rows={[
      { symbol: "ETH", assetType: "crypto", value: 1000 },
      { symbol: "SOL", assetType: "crypto", value: -500 },
    ]} /></MemoryRouter>);
    const bars = [...document.querySelectorAll<HTMLElement>(".t3-moved-track > span")];
    expect(Number.parseFloat(bars[0].style.width)).toBeGreaterThan(60);
    expect(Number.parseFloat(bars[1].style.width)).toBeGreaterThan(30);
    expect(bars[0].style.left).not.toBe("");
    expect(bars[1].style.right).not.toBe("");
  });
  it("uses the selected currency for daily chart ticks", () => {
    render(<DailyChangeCard currency={eur} daily={[
      { timestamp: Date.parse("2026-10-30"), value: 300 },
    ]} desktopFidelity />);
    expect(document.querySelector(".t3-daily-y-axis")).toHaveTextContent("+1K");
  });
  it("keeps the phone daily bar scale unchanged for small converted values", () => {
    render(<DailyChangeCard currency={eur} daily={[
      { timestamp: Date.parse("2026-10-30"), value: 0.8 },
    ]} />);
    expect((document.querySelector(".t3-daily-up") as HTMLElement).style.height).toBe("38.400000000000006%");
  });
  it("labels the coin percentage as a change rather than a price", () => {
    render(<MemoryRouter><TopCoinsCard currency={usd} rows={[
      { symbol: "BTC", assetType: "crypto", value: 100, amount: 1, priceChange: 5 },
    ]} /></MemoryRouter>);
    expect(screen.getByText("Change")).toBeInTheDocument();
    expect(screen.getByTestId("overview-coin-row")).toHaveTextContent("+5.0%");
  });

  it("does not show a numeric price change without a meaningful opening quote", () => {
    render(<MemoryRouter><TopCoinsCard currency={usd} rows={[
      { symbol: "BTC", assetType: "crypto", value: 100, amount: 1, priceChange: null },
    ]} /></MemoryRouter>);
    expect(screen.getByTestId("overview-coin-row")).toHaveTextContent("—");
    expect(screen.getByTestId("overview-coin-row")).not.toHaveTextContent("0.0%");
  });

  it("converts daily changes, contributions, and coin values to the selected currency", () => {
    render(<MemoryRouter>
      <DailyChangeCard currency={eur} daily={[{ timestamp: Date.parse("2026-10-30"), value: 10 }]} />
      <WhatMovedCard currency={eur} count={2} rows={[{ symbol: "BTC", assetType: "crypto", value: 20 }]} />
      <TopCoinsCard currency={eur} rows={[{ symbol: "ETH", assetType: "crypto", value: 50, amount: 2 }]} />
    </MemoryRouter>);
    expect(screen.getByLabelText(/daily change chart/i)).toHaveTextContent("+€20.00");
    expect(screen.getByText("+€40.00")).toBeInTheDocument();
    expect(screen.getByTestId("overview-coin-row")).toHaveTextContent("€50.00");
    expect(screen.getByTestId("overview-coin-row")).toHaveTextContent("€100.00");
  });

  it("names a failed source and last good time without claiming an excluded amount", () => {
    render(<SourceStatusCard statuses={[
      { sourceId: "cex:1", label: "OKX", status: "failed", lastSuccessAt: "2026-10-30T21:14:00Z" },
    ]} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/OKX/);
    expect(screen.getByRole("alert")).toHaveTextContent(/last good/i);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/excluding/i);
  });

  it("lists the latest status for each source in the sources card", () => {
    render(<SourceStatusCard variant="card" statuses={[
      { sourceId: "cex:0", label: "Binance", status: "ok" },
      { sourceId: "cex:1", label: "OKX", status: "failed", lastSuccessAt: "2026-10-30T21:14:00Z" },
    ]} />);
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("Binance")).toBeInTheDocument();
    expect(screen.getByText("OKX")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("shows three rankings first on phone and expands them without changing sorting", () => {
    render(<MemoryRouter><TopCoinsCard currency={usd} compact rows={[
      { symbol: "BTC", assetType: "crypto", value: 100, amount: 1, rank: 1, priceChange: 1 },
      { symbol: "ETH", assetType: "crypto", value: 90, amount: 1, rank: 2, priceChange: 2 },
      { symbol: "SOL", assetType: "crypto", value: 80, amount: 1, rank: 3, priceChange: 3 },
      { symbol: "BNB", assetType: "crypto", value: 70, amount: 1, rank: 4, priceChange: 4 },
    ]} /></MemoryRouter>);
    expect(screen.getAllByTestId("overview-coin-row")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    expect(screen.getAllByTestId("overview-coin-row")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: /by price change/i }));
    expect(screen.getAllByTestId("overview-coin-row")[0]).toHaveTextContent("BNB");
  });
});
