import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RealtimeTotalValue from "./realtime-total-value";
import { MobileHeaderTotal } from "@/mobile/components/mobile/header-total";
import { useLiveTotal, type LiveTotalState } from "./use-live-total";

vi.mock("./use-live-total", () => ({ useLiveTotal: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const currency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };
const labels: Record<LiveTotalState, string> = {
  idle: "Not connected",
  connecting: "Connecting",
  live: "Live",
  stale: "Waiting for an update",
  error: "Unavailable",
  off: "Off",
};
const priceLabels: Record<LiveTotalState, string> = {
  idle: "Live prices: not connected",
  connecting: "Live prices: connecting",
  live: "Live prices: connected",
  stale: "Live prices: waiting for an update",
  error: "Live prices: unavailable",
  off: "Live prices: off",
};

for (const state of Object.keys(labels) as LiveTotalState[]) {
  it(`shows ${state} consistently on desktop and phone`, () => {
    const value = state === "live" || state === "stale" ? 123 : undefined;
    vi.mocked(useLiveTotal).mockReturnValue({
      state, value, animatedValue: value, announcedValue: value, firstReveal: false, animate: false,
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
  });
  render(<MobileHeaderTotal live fidelity currency={currency} />);
  fireEvent.click(screen.getByRole("button", { name: /Live total.*Live prices: connected/ }));
  expect(screen.getByText("Live prices: connected")).toBeVisible();
});

it("marks a long phone total so it can fit before the live dot", () => {
  vi.mocked(useLiveTotal).mockReturnValue({
    state: "live", value: 1234567890.12, animatedValue: 1234567890.12,
    announcedValue: 1234567890.12, firstReveal: false, animate: false,
  });
  const { container } = render(<MobileHeaderTotal live fidelity currency={currency} />);
  expect(container.querySelector(".mobile-header-total-value")).toHaveAttribute("data-long");
  expect(container.querySelector(".mobile-header-total-value")).toHaveTextContent("$1,234,567,890.12");
});
