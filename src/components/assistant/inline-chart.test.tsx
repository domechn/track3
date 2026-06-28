import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InlineChart from "./inline-chart";

vi.mock("react-chartjs-2", () => ({
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  Doughnut: () => <div data-testid="doughnut" />,
  Radar: () => <div data-testid="radar" />,
}));

describe("InlineChart", () => {
  it("renders a doughnut chart", () => {
    const { getByTestId } = render(
      <InlineChart
        spec={{
          type: "doughnut",
          labels: ["A", "B"],
          datasets: [{ data: [10, 20] }],
          title: "Top",
        }}
      />,
    );
    expect(getByTestId("doughnut")).toBeTruthy();
  });

  it("renders a radar chart with title and caption", () => {
    const { getByTestId, getByText } = render(
      <InlineChart
        spec={{
          type: "radar",
          labels: ["x", "y", "z"],
          datasets: [{ data: [1, 2, 3] }],
          title: "Health",
          caption: "Caption text",
        }}
      />,
    );
    expect(getByTestId("radar")).toBeTruthy();
    expect(getByText("Health")).toBeTruthy();
    expect(getByText("Caption text")).toBeTruthy();
  });

  it("renders bar and line charts", () => {
    const bar = render(
      <InlineChart
        spec={{ type: "bar", labels: ["a"], datasets: [{ data: [1] }] }}
      />,
    );
    expect(bar.getByTestId("bar")).toBeTruthy();
    bar.unmount();

    const line = render(
      <InlineChart
        spec={{ type: "line", labels: ["a"], datasets: [{ data: [1] }] }}
      />,
    );
    expect(line.getByTestId("line")).toBeTruthy();
  });
});
