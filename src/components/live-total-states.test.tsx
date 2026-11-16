import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RealtimeTotalValue from "./realtime-total-value";
import { MobileHeaderTotal } from "@/mobile/components/mobile/header-total";
import { useLiveTotal, type LiveTotalState } from "./use-live-total";
import { queryLatestAssets } from "@/middlelayers/charts";

vi.mock("./use-live-total", () => ({ useLiveTotal: vi.fn() }));
vi.mock("@/middlelayers/charts", () => ({
  queryLatestAssets: vi.fn().mockResolvedValue([]),
  queryRealTimeAssetsValue: vi.fn(),
}));
vi.mock("./ui/carousel", async () => {
  const React = await import("react");
  const Wrapper = ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children);
  return { Carousel: Wrapper, CarouselContent: Wrapper, CarouselItem: Wrapper };
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const currency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };
const labels: Record<LiveTotalState, string> = {
  idle: "Not connected",
  connecting: "Connecting",
  live: "Live",
  partial: "Partial data",
  stale: "Waiting for an update",
  error: "Unavailable",
  off: "Off",
};
const priceLabels: Record<LiveTotalState, string> = {
  idle: "Live prices: not connected",
  connecting: "Live prices: connecting",
  live: "Live prices: connected",
  partial: "Live prices: partial data",
  stale: "Live prices: waiting for an update",
  error: "Live prices: unavailable",
  off: "Live prices: off",
};

for (const state of Object.keys(labels) as LiveTotalState[]) {
  it(`shows ${state} consistently on desktop and phone`, () => {
    const value = state === "live" || state === "stale" ? 123 : undefined;
    vi.mocked(useLiveTotal).mockReturnValue({
      state, value, animatedValue: value, announcedValue: value, firstReveal: false, animate: false,
      retryNow: vi.fn(),
    });
    const desktop = render(<RealtimeTotalValue currency={currency} quoteColor="green-up-red-down" />);
    expect(desktop.container.querySelectorAll(".t3-live-dot")).toHaveLength(1);
    expect(desktop.container.querySelector(".t3-live-dot")).toHaveAttribute("data-state", state);
    expect(desktop.container.querySelector(".t3-live-dot")).toHaveAttribute("aria-label", priceLabels[state]);
    expect(desktop.container.querySelector(".t3-live-dot")).toHaveAttribute("title", priceLabels[state]);
    expect(screen.getByRole("img", { name: priceLabels[state] })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Live total" })).toHaveAttribute("title", priceLabels[state]);
    expect(screen.getByRole("status", { name: `Live total, ${labels[state]}` })).toBeInTheDocument();
    if (value !== undefined) expect(desktop.container.querySelector(".t3-live-amount")).toHaveTextContent("$123");
    if (state === "connecting") expect(desktop.container.querySelector(".t3-live-skeleton")).toBeInTheDocument();
    desktop.unmount();

    const phone = render(<MobileHeaderTotal live fidelity currency={currency} />);
    expect(phone.container.querySelector(".mobile-header-live-dot")).toHaveAttribute("data-state", state);
    expect(phone.container.querySelector(".mobile-header-live-dot")).toHaveAttribute("aria-label", priceLabels[state]);
    expect(phone.container.querySelector(".mobile-header-live-dot")).toHaveAttribute("title", priceLabels[state]);
    expect(screen.getByRole("img", { name: priceLabels[state] })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: `Live total, ${labels[state]}` })).toBeInTheDocument();
    if (value !== undefined) expect(phone.container.querySelector(".mobile-header-total-value")).toHaveTextContent("$123");
    if (state === "connecting") expect(phone.container.querySelector(".t3-live-skeleton")).toBeInTheDocument();
  });
}

it("shows the live price explanation when the phone reading is tapped", () => {
  vi.mocked(useLiveTotal).mockReturnValue({
    state: "live", value: 123, animatedValue: 123, announcedValue: 123, firstReveal: false, animate: false,
    retryNow: vi.fn(),
  });
  render(<MobileHeaderTotal live fidelity currency={currency} />);
  fireEvent.click(screen.getByRole("button", { name: /Live total.*Live prices: connected/ }));
  expect(screen.getByText("Live prices: connected")).toBeVisible();
});

it("marks a long phone total so it can fit before the live dot", () => {
  vi.mocked(useLiveTotal).mockReturnValue({
    state: "live", value: 1234567890.12, animatedValue: 1234567890.12,
    announcedValue: 1234567890.12, firstReveal: false, animate: false,
    retryNow: vi.fn(),
  });
  const { container } = render(<MobileHeaderTotal live fidelity currency={currency} />);
  expect(container.querySelector(".mobile-header-total-value")).toHaveAttribute("data-long");
  expect(container.querySelector(".mobile-header-total-value")).toHaveTextContent("$1,234,567,890.12");
});

it("shows the partial marker with the known value on desktop and phone", () => {
  vi.mocked(useLiveTotal).mockReturnValue({
    state: "partial", value: 123, animatedValue: 123, announcedValue: 123,
    firstReveal: false, animate: false, partial: true, error: "pricesMissing:2", retryNow: vi.fn(),
  });
  const desktop = render(<RealtimeTotalValue currency={currency} quoteColor="green-up-red-down" />);
  expect(desktop.container.querySelector(".t3-live-trigger")).toHaveTextContent("$123");
  expect(desktop.container.querySelector(".t3-live-trigger")).toHaveTextContent("Partial data");
  desktop.unmount();
  const phone = render(<MobileHeaderTotal live fidelity currency={currency} />);
  expect(phone.container.querySelector(".mobile-header-total")).toHaveTextContent("$123");
  expect(phone.container.querySelector(".mobile-header-total")).toHaveTextContent("Partial data");
});

it("shows five missing symbols, expands the rest and separates small balances", () => {
  vi.mocked(queryLatestAssets).mockResolvedValue([]);
  vi.mocked(useLiveTotal).mockReturnValue({
    state: "partial", value: 123, animatedValue: 123, announcedValue: 123,
    firstReveal: false, animate: false, partial: true, error: "pricesMissing:6",
    missingSymbols: ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX"].map((symbol, index) => ({
      symbol, assetType: "crypto" as const, lastValue: 60 - index * 10,
    })),
    dustSymbols: [{ symbol: "DUST", assetType: "crypto", lastValue: 0.01 }],
    missingShare: 0.125,
    retryNow: vi.fn(),
  });
  render(<RealtimeTotalValue currency={currency} quoteColor="green-up-red-down" />);
  fireEvent.click(screen.getByRole("button", { name: "Live total" }));
  expect(screen.getByText("Prices for 6 coins missing")).toBeVisible();
  expect(screen.getByText("about 12.5% of the last snapshot value is not live-priced")).toBeVisible();
  const list = screen.getByTestId("live-missing-list");
  expect(list).toHaveAttribute("data-state", "collapsed");
  for (const symbol of ["ONE", "TWO", "THREE", "FOUR", "FIVE"]) {
    expect(list).toHaveTextContent(symbol);
  }
  expect(list).not.toHaveTextContent("SIX");
  expect(screen.queryByText("Small balances without a price")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "+1 more" }));
  expect(list).toHaveAttribute("data-state", "expanded");
  expect(list).toHaveTextContent("SIX");
  expect(screen.getByText("Small balances without a price")).toBeVisible();
  expect(list).toHaveTextContent("DUST");
  fireEvent.click(screen.getByRole("button", { name: "Show less" }));
  expect(list).toHaveAttribute("data-state", "collapsed");
});

it("shows a safe error reason, last success time and retry on both popovers", () => {
  const retryNow = vi.fn();
  vi.mocked(useLiveTotal).mockReturnValue({
    state: "stale", value: 123, animatedValue: 123, announcedValue: 123,
    firstReveal: false, animate: false, error: "ibkrToken", lastAt: Date.parse("2026-11-15T12:00:00Z"),
    retryNow,
  });
  const desktop = render(<RealtimeTotalValue currency={currency} quoteColor="green-up-red-down" />);
  fireEvent.click(screen.getByRole("button", { name: "Live total" }));
  expect(screen.getByText("IBKR token expired")).toBeVisible();
  expect(screen.getByText(/Last success/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Retry now" }));
  expect(retryNow).toHaveBeenCalledTimes(1);
  desktop.unmount();
  render(<MobileHeaderTotal live fidelity currency={currency} />);
  fireEvent.click(screen.getByRole("button", { name: /Live total.*Live prices/ }));
  expect(screen.getByText("IBKR token expired")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Retry now" }));
  expect(retryNow).toHaveBeenCalledTimes(2);
});
