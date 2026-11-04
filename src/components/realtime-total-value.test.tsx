import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CurrencyRateDetail } from "@/middlelayers/types";

const carouselRender = vi.hoisted(() => vi.fn());

vi.mock("@/middlelayers/charts", () => ({
  queryLatestAssets: vi.fn(),
  queryRealTimeAssetsValue: vi.fn(),
}));

vi.mock("./ui/popover", async () => {
  const React = await import("react");
  const Wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const MockPopover = ({ children, onOpenChange }: { children: ReactNode; onOpenChange?: (open: boolean) => void }) =>
    React.createElement("div", { onClick: () => onOpenChange?.(true) }, children);

  return {
    Popover: MockPopover,
    PopoverContent: ({ children, className }: { children: ReactNode; className: string }) =>
      React.createElement("div", { className }, children),
    PopoverTrigger: Wrapper,
  };
});

vi.mock("./ui/carousel", async () => {
  const React = await import("react");
  const Carousel = ({
    children,
    plugins,
  }: {
    children: ReactNode;
    plugins?: unknown[];
  }) => {
    carouselRender(plugins);
    return React.createElement("div", null, children);
  };
  const Wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement("div", null, children);

  return {
    Carousel,
    CarouselContent: Wrapper,
    CarouselItem: Wrapper,
  };
});

import RealtimeTotalValue from "./realtime-total-value";
import { queryLatestAssets, queryRealTimeAssetsValue } from "@/middlelayers/charts";

const currency: CurrencyRateDetail = {
  alias: "USD",
  currency: "USD",
  rate: 1,
  symbol: "$",
};

describe("RealtimeTotalValue", () => {
  it("labels the on-demand live total control without implying a value has already loaded", () => {
    const { container } = render(<RealtimeTotalValue currency={currency} quoteColor="green-up-red-down" />);
    expect(screen.getByRole("button", { name: "Live total" })).toHaveAttribute(
      "aria-description", "Show real-time portfolio value");
    expect(screen.getByRole("button", { name: "Live total" })).not.toHaveTextContent("$");
    expect(container.querySelector(".t3-live-placeholder")).toBeNull();
  });
  it("reserves the amount while connecting and reveals the first real value", async () => {
    let finish!: (value: never) => void;
    vi.mocked(queryRealTimeAssetsValue).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    vi.mocked(queryLatestAssets).mockResolvedValue([]);
    const { container } = render(<RealtimeTotalValue currency={currency} quoteColor="green-up-red-down" />);
    fireEvent.click(screen.getByRole("button", { name: "Live total" }));
    expect(container.querySelector(".t3-live-amount")).toHaveAttribute("data-state", "connecting");
    expect(container.querySelector(".t3-live-skeleton")).toBeInTheDocument();
    expect(container.querySelector(".t3-live-popover")).not.toHaveTextContent("0.00%");
    await act(async () => { finish([{ symbol: "BTC", value: 100 }] as never); await Promise.resolve(); });
    expect(container.querySelector(".t3-live-amount")).toHaveTextContent("$100");
    expect(container.querySelector(".t3-live-amount")).toHaveAttribute("data-first", "true");
    expect(screen.getByRole("status", { name: "Live total, Live" })).toBeInTheDocument();
  });
  it("waits for the saved snapshot before showing a percentage change", async () => {
    let finishBaseline!: (value: never) => void;
    vi.mocked(queryRealTimeAssetsValue).mockResolvedValue([{ symbol: "BTC", value: 100, price: 100 }] as never);
    vi.mocked(queryLatestAssets).mockImplementationOnce(() => new Promise((resolve) => { finishBaseline = resolve; }));
    const { container } = render(<RealtimeTotalValue currency={currency} quoteColor="green-up-red-down" />);
    fireEvent.click(screen.getByRole("button", { name: "Live total" }));
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector(".t3-live-popover")).not.toHaveTextContent("1000000");
    await act(async () => { finishBaseline([{ symbol: "BTC", value: 80, price: 80 }] as never); await Promise.resolve(); });
    expect(container.querySelector(".t3-live-popover")).toHaveTextContent("+25.00%");
  });
  it("initializes the vertical carousel with a compatible autoplay plugin", async () => {
    vi.mocked(queryRealTimeAssetsValue).mockResolvedValue([{ symbol: "BTC", value: 100, price: 100 }] as never);
    vi.mocked(queryLatestAssets).mockResolvedValue([]);
    render(<RealtimeTotalValue currency={currency} quoteColor="green-up-red-down" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Live total" }));
      await Promise.resolve();
    });
    const [plugins] = carouselRender.mock.calls.at(-1) ?? [];
    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toEqual(
      expect.objectContaining({
        name: "autoplay",
        options: expect.objectContaining({ delay: 3000 }),
        init: expect.any(Function),
      }),
    );
  });
});
