import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RealtimeTotalValue from "./realtime-total-value";
import { MobileHeaderTotal } from "@/mobile/components/mobile/header-total";
import { useLiveTotal, type LiveTotalState } from "./use-live-total";

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
