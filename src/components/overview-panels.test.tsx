import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DailyChangeCard, WhatMovedCard, SourceStatusCard, TopCoinsCard } from "./overview-panels";

const usd = { currency: "USD", rate: 1, alias: "US Dollar", symbol: "$" };
const eur = { currency: "EUR", rate: 2, alias: "Euro", symbol: "€" };

describe("overview panels", () => {
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
  it("pages through desktop movers without stretching the chart row", () => {
    const rows = Array.from({ length: 11 }, (_, index) => ({
      symbol: `ASSET${index}`, assetType: "crypto" as const, value: 100 - index,
    }));
    render(<MemoryRouter><WhatMovedCard currency={usd} count={2} rows={rows} desktopFidelity /></MemoryRouter>);
    expect(document.querySelectorAll(".t3-moved-list li")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(document.querySelectorAll(".t3-moved-list li")).toHaveLength(3);
    expect(screen.getByText("9–11 of 11")).toBeInTheDocument();
    expect(screen.queryByText("ASSET7")).not.toBeInTheDocument();
    expect(screen.getByText("ASSET10")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.queryByText("ASSET10")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".t3-moved-list li")).toHaveLength(8);
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

  it("keeps a source action at the bottom when few sources fill the desktop card", () => {
    render(<SourceStatusCard variant="card" desktopFidelity sources={[{
      wallet: "Ledger", walletAlias: "Ledger", value: 100, percentage: 100, amount: 1, chartColor: "#000",
    }]} statuses={[
      { sourceId: "wallet:1", label: "Ledger", status: "ok" },
    ]} />);
    expect(screen.getByRole("link", { name: "Manage sources" })).toHaveAttribute("href", "#/settings/configuration");
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
