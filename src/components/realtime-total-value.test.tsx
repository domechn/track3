import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
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

  return {
    Popover: Wrapper,
    PopoverContent: Wrapper,
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

const currency: CurrencyRateDetail = {
  alias: "USD",
  currency: "USD",
  rate: 1,
  symbol: "$",
};

describe("RealtimeTotalValue", () => {
  it("labels the on-demand live total control without implying a value has already loaded", () => {
    render(<RealtimeTotalValue currency={currency} quoteColor="green-up-red-down" />);
    expect(screen.getByRole("button", { name: "Show real-time portfolio value" })).toHaveTextContent("Live total");
    expect(screen.getByRole("button", { name: "Show real-time portfolio value" })).not.toHaveTextContent("$");
  });
  it("initializes the vertical carousel with a compatible autoplay plugin", () => {
    render(
      <RealtimeTotalValue
        currency={currency}
        quoteColor="green-up-red-down"
      />,
    );

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
