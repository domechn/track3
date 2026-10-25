import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfitAttribution from "@/mobile/components/profit-attribution";
import { queryAttribution } from "@/middlelayers/charts-attribution-data";
import { DataChangedContext } from "@/contexts/data-changed";
import { I18nProvider, localeLocalStorageKey } from "@/mobile/i18n";

vi.mock("@/middlelayers/charts-attribution-data", () => ({ queryAttribution: vi.fn() }));
const currency = { currency: "EUR", symbol: "€", rate: 2, alias: "eur" };
const range = { start: new Date("2024-04-01T00:00:00.000Z"), end: new Date("2024-04-02T00:00:00.000Z") };
const empty = { attribution: { entries: [], totals: { priceEffect: 0, flowEffect: 0, residual: 0, totalChange: 0 }, startValue: 0, endValue: 0 }, aliases: {} };
const filled = {
  attribution: {
    entries: [
      { symbol: "BTC", assetType: "crypto" as const, wallet: "w", priceEffect: 20, flowEffect: 100, residual: 0, totalChange: 120 },
      { symbol: "ETH", assetType: "crypto" as const, wallet: "c", priceEffect: -30, flowEffect: 0, residual: -10, totalChange: -40 },
    ],
    totals: { priceEffect: -10, flowEffect: 100, residual: -10, totalChange: 80 }, startValue: 100, endValue: 180,
  },
  aliases: { w: { alias: "Main", type: "Binance" }, c: { alias: "Vault", type: "ERC20" } },
};

beforeEach(() => vi.clearAllMocks());
function view() { return <ProfitAttribution currency={currency} dateRange={range} quoteColor="red-up-green-down" />; }

describe("profit attribution", () => {
  it("keeps desktop contributor and detractor previews to five groups", async () => {
    vi.mocked(queryAttribution).mockResolvedValue({
      attribution: {
        entries: Array.from({ length: 12 }, (_, index) => ({
          symbol: `COIN${index}`, assetType: "crypto" as const, wallet: "w",
          priceEffect: index < 6 ? index + 1 : -(index - 5),
          flowEffect: 0, residual: 0, totalChange: index < 6 ? index + 1 : -(index - 5),
        })),
        totals: { priceEffect: 0, flowEffect: 0, residual: 0, totalChange: 0 },
        startValue: 100, endValue: 100,
      },
      aliases: {},
    });
    render(view());
    const figure = await screen.findByRole("figure", { name: "Top attribution contributors and detractors" });
    const [contributors, detractors] = within(figure).getAllByRole("list");
    expect(within(contributors).getAllByRole("listitem")).toHaveLength(5);
    expect(within(detractors).getAllByRole("listitem")).toHaveLength(5);
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(13);
  });
  it("expands grouped attribution fields beneath the phone rank", async () => {
    const previousMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) => ({
      matches: query.includes("pointer: coarse"), media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
    try {
      vi.mocked(queryAttribution).mockResolvedValue(filled);
      render(view());
      expect(await screen.findByText("Top contributors")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /BTC/ }));
      const row = screen.getByRole("button", { name: /BTC/ }).closest("li")!;
      expect(row.querySelector("img")).toBeInTheDocument();
      expect(within(row).getByText("Quantity change")).toBeInTheDocument();
      expect(within(row).getByText("+€200.00")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      window.matchMedia = previousMatchMedia;
    }
  });

  it("shows loading, then an honest empty state when the range has no comparison", async () => {
    let resolve!: (value: typeof empty) => void;
    vi.mocked(queryAttribution).mockReturnValue(new Promise((done) => { resolve = done; }));
    render(view());
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    resolve(empty);
    expect(await screen.findByText("No attribution available for this range." )).toBeInTheDocument();
  });

  it("shows converted totals, top contributors and detractors, and grouped rows", async () => {
    vi.mocked(queryAttribution).mockResolvedValue(filled);
    render(view());
    expect(await screen.findByText("Top contributors")).toBeInTheDocument();
    expect(screen.getByText("Top detractors")).toBeInTheDocument();
    expect(screen.getAllByText("+€240.00")[0]).toHaveClass("text-rose-500");
    expect(screen.getByRole("figure", { name: "Top attribution contributors and detractors" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByText("BTC").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("radio", { name: "Source" }));
    expect(screen.getAllByText("Binance").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ERC20").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("radio", { name: "Wallet" }));
    expect(screen.getAllByText("Main (Binance)").length).toBeGreaterThan(0);
  });

  it("ranks market gains and losses without treating an internal trade as profit", async () => {
    vi.mocked(queryAttribution).mockResolvedValue({
      attribution: {
        entries: [
          { symbol: "BTC", assetType: "crypto", wallet: "w", priceEffect: 0, flowEffect: 50000, residual: 0, totalChange: 50000 },
          { symbol: "USDT", assetType: "crypto", wallet: "w", priceEffect: 0, flowEffect: -50000, residual: 0, totalChange: -50000 },
          { symbol: "ETH", assetType: "crypto", wallet: "w", priceEffect: 100, flowEffect: 0, residual: 0, totalChange: 100 },
          { symbol: "SOL", assetType: "crypto", wallet: "w", priceEffect: -40, flowEffect: 0, residual: 0, totalChange: -40 },
        ],
        totals: { priceEffect: 60, flowEffect: 0, residual: 0, totalChange: 60 },
        startValue: 100000, endValue: 100060,
      },
      aliases: { w: { alias: "Main", type: "Binance" } },
    });
    render(view());
    const figure = await screen.findByRole("figure", { name: "Top attribution contributors and detractors" });
    const [contributors, detractors] = within(figure).getAllByRole("list");
    expect(within(contributors).getAllByRole("listitem")).toHaveLength(1);
    expect(within(contributors).getByText("ETH")).toBeInTheDocument();
    expect(within(contributors).getByText("+€200.00")).toBeInTheDocument();
    expect(within(contributors).getByText("ETH").closest("li")?.querySelector("[style]")).toHaveStyle({ width: "100%" });
    expect(within(detractors).getAllByRole("listitem")).toHaveLength(1);
    expect(within(detractors).getByText("SOL")).toBeInTheDocument();
    expect(within(detractors).getByText("-€80.00")).toBeInTheDocument();
  });

  it("shows an alert when attribution cannot be loaded", async () => {
    vi.mocked(queryAttribution).mockRejectedValue(new Error("database unavailable"));
    render(view());
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load attribution.");
  });

  it("discards a stale response after the selected range changes", async () => {
    let resolveOld!: (value: typeof filled) => void;
    vi.mocked(queryAttribution).mockReturnValueOnce(new Promise((done) => { resolveOld = done; })).mockResolvedValueOnce(empty);
    const rendered = render(view());
    rendered.rerender(<ProfitAttribution currency={currency} dateRange={{ start: range.start, end: new Date("2024-04-03T00:00:00.000Z") }} quoteColor="red-up-green-down" />);
    expect(await screen.findByText("No attribution available for this range.")).toBeInTheDocument();
    await act(async () => { resolveOld(filled); });
    expect(screen.queryByText("Top contributors")).not.toBeInTheDocument();
  });

  it("keeps the previous attribution visible while refreshing stored data", async () => {
    let resolve!: (value: typeof filled) => void;
    vi.mocked(queryAttribution).mockResolvedValueOnce(filled)
      .mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const rendered = render(<DataChangedContext.Provider value={0}>{view()}</DataChangedContext.Provider>);
    expect(await screen.findByText("Top contributors")).toBeInTheDocument();
    rendered.rerender(<DataChangedContext.Provider value={1}>{view()}</DataChangedContext.Provider>);
    expect(screen.getByText("Top contributors")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await act(async () => { resolve(filled); });
  });

  it("keeps the previous attribution visible when a refresh fails", async () => {
    let reject!: (reason: Error) => void;
    vi.mocked(queryAttribution).mockResolvedValueOnce(filled)
      .mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    const rendered = render(<DataChangedContext.Provider value={0}>{view()}</DataChangedContext.Provider>);
    expect(await screen.findByText("Top contributors")).toBeInTheDocument();
    rendered.rerender(<DataChangedContext.Provider value={1}>{view()}</DataChangedContext.Provider>);
    await act(async () => { reject(new Error("database unavailable")); });
    expect(screen.getByText("Top contributors")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load attribution.");
  });

  it("explains both empty market leader sections when all changes are quantity changes", async () => {
    const previousMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) => ({
      matches: query.includes("pointer: coarse"), media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
    try {
    vi.mocked(queryAttribution).mockResolvedValue({
      attribution: { entries: [{ symbol: "BTC", assetType: "crypto", wallet: "w", priceEffect: 0, flowEffect: 100, residual: 0, totalChange: 100 }],
        totals: { priceEffect: 0, flowEffect: 100, residual: 0, totalChange: 100 }, startValue: 0, endValue: 100 },
      aliases: {},
    });
    render(view());
    const figure = await screen.findByRole("figure");
    expect(within(figure).getByText("No market change")).toBeInTheDocument();
    expect(within(figure).getByText("No losses in this period")).toBeInTheDocument();
    expect(within(figure).getByRole("button", { name: /BTC/ })).toBeInTheDocument();
    } finally {
      window.matchMedia = previousMatchMedia;
    }
  });

  it("keeps contributors beyond fifth place reachable on a phone", async () => {
    const previousMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) => ({
      matches: query.includes("pointer: coarse"), media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
    try {
      vi.mocked(queryAttribution).mockResolvedValue({
        ...filled,
        attribution: { ...filled.attribution, entries: Array.from({ length: 6 }, (_, index) => ({
          symbol: `COIN${index}`, assetType: "crypto" as const, wallet: "w",
          priceEffect: 60 - index, flowEffect: 0, residual: 0, totalChange: 60 - index,
        })) },
      });
      render(view());
      expect(await screen.findByRole("button", { name: /COIN5/ })).toBeInTheDocument();
    } finally {
      window.matchMedia = previousMatchMedia;
    }
  });

  it("renders stock attribution with the selected Chinese label", async () => {
    localStorage.setItem(localeLocalStorageKey, "zh");
    vi.mocked(queryAttribution).mockResolvedValue({
      attribution: { entries: [{ symbol: "ABC", assetType: "stock", wallet: "w", priceEffect: 10, flowEffect: 0, residual: 0, totalChange: 10 }],
        totals: { priceEffect: 10, flowEffect: 0, residual: 0, totalChange: 10 }, startValue: 100, endValue: 110 },
      aliases: {},
    });
    try {
      render(<I18nProvider>{view()}</I18nProvider>);
      expect((await screen.findAllByText("ABC · 股票")).length).toBeGreaterThan(0);
    } finally {
      localStorage.removeItem(localeLocalStorageKey);
    }
  });
});
