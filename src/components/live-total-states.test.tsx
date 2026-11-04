import { render, screen, cleanup } from "@testing-library/react";
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

for (const state of Object.keys(labels) as LiveTotalState[]) {
  it(`shows ${state} consistently on desktop and phone`, () => {
    const value = state === "live" || state === "stale" ? 123 : undefined;
    vi.mocked(useLiveTotal).mockReturnValue({
      state, value, animatedValue: value, announcedValue: value, firstReveal: false, animate: false,
    });
    const desktop = render(<RealtimeTotalValue currency={currency} quoteColor="green-up-red-down" />);
    expect(desktop.container.querySelector(".t3-live-dot")).toHaveAttribute("data-state", state);
    expect(screen.getByRole("status", { name: `Live total, ${labels[state]}` })).toBeInTheDocument();
    if (value !== undefined) expect(desktop.container.querySelector(".t3-live-amount")).toHaveTextContent("$123");
    if (state === "connecting") expect(desktop.container.querySelector(".t3-live-skeleton")).toBeInTheDocument();
    desktop.unmount();

    const phone = render(<MobileHeaderTotal live fidelity currency={currency} />);
    expect(phone.container.querySelector(".mobile-header-live-dot")).toHaveAttribute("data-state", state);
    expect(screen.getByRole("status", { name: `Live total, ${labels[state]}` })).toBeInTheDocument();
    if (value !== undefined) expect(phone.container.querySelector(".mobile-header-total-value")).toHaveTextContent("$123");
    if (state === "connecting") expect(phone.container.querySelector(".t3-live-skeleton")).toBeInTheDocument();
  });
}
