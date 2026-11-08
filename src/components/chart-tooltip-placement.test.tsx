import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ChartTooltip, useChartHitArea } from "./chart-tooltip";

const box = (left: number, top: number, width: number, height: number) => ({
  x: left, y: top, left, top, width, height, right: left + width, bottom: top + height,
  toJSON: () => ({}),
});

afterEach(() => vi.restoreAllMocks());

it("places an Overview tooltip 12px from its point and inside the plot", () => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.matches("[data-chart-tooltip]")) return box(0, 0, 100, 40);
    if (this.matches(".t3-chart-active-point")) return box(135, 60, 2, 2);
    if (this.matches(".t3-chart-plot")) return box(100, 50, 260, 150);
    return box(0, 0, 500, 300);
  });
  function Subject() {
    const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
    return <div data-ui-card=""><div className="t3-chart-plot">
      <span className="t3-chart-active-point" ref={setAnchor} />
      <ChartTooltip anchor={anchor}>Value: $1.00</ChartTooltip>
    </div></div>;
  }
  render(<Subject />);
  const tooltip = screen.getByRole("tooltip");
  expect(tooltip.style.left).toBe("149px");
  expect(tooltip.style.top).toBe("58px");
});

it("refreshes a selected mark when its async tooltip content arrives", () => {
  function Subject({ content }: { content: string }) {
    const chart = useChartHitArea();
    return <div data-chart-group="">
      <button {...chart.markProps(0, "point", content)}
        onClick={(event) => chart.select(0, event.currentTarget)}>point</button>
      {chart.tooltip}
    </div>;
  }
  const { rerender } = render(<Subject content="Value" />);
  fireEvent.click(screen.getByRole("button", { name: "point" }));
  expect(screen.getByRole("tooltip")).toHaveTextContent("Value");
  rerender(<Subject content="Value and mover" />);
  fireEvent.click(screen.getByRole("button", { name: "point" }));
  expect(screen.getByRole("tooltip")).toHaveTextContent("Value and mover");
});
