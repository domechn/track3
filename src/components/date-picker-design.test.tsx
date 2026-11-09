import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DatePicker from "./date-picker";

describe("Overview date picker", () => {
  it("marks the committed preset while previewing a custom range", () => {
    const dates = Array.from({ length: 31 }, (_, index) => new Date(2026, 9, index + 1, 12));
    render(<DatePicker overviewFidelity availableDates={dates}
      value={{ from: dates[0], to: dates[30] }} onDateChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose date range" }));
    expect(screen.getByRole("button", { name: /30 days/ })).toHaveTextContent("current");
    fireEvent.click(screen.getByRole("button", { name: /Custom range/ }));
    expect(screen.getByRole("button", { name: /30 days/ })).toHaveTextContent("current");
    expect(document.querySelectorAll(".t3-date-main .day-outside")).toHaveLength(0);
  });
  it("opens with a snapshot range that arrived after the initial render", () => {
    const dates = Array.from({ length: 15 }, (_, index) => new Date(2026, 0, index + 1, 12));
    const onDateChange = vi.fn();
    const { rerender } = render(<DatePicker availableDates={[]} value={undefined} onDateChange={onDateChange} />);
    rerender(<DatePicker availableDates={dates} value={{ from: dates[0], to: dates[14] }} onDateChange={onDateChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose date range" }));
    expect(screen.getByText("15 times")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });

  it("shows the selected snapshot range and submits the last ten snapshots in the existing shape", () => {
    const dates = Array.from({ length: 15 }, (_, index) => new Date(2026, 0, index + 1, 12));
    const onDateChange = vi.fn();
    render(<DatePicker availableDates={dates} value={{ from: dates[0], to: dates[14] }} onDateChange={onDateChange} />);
    expect(screen.getByRole("button", { name: "Choose date range" }).querySelector(".t3-date-range-display"))
      .toHaveAttribute("data-range", expect.stringContaining("Jan 1"));
    fireEvent.click(screen.getByRole("button", { name: "Choose date range" }));
    fireEvent.click(screen.getByRole("button", { name: "Last 10 Times" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onDateChange).toHaveBeenCalledWith(10, { from: dates[5], to: dates[14] });
  });
  it("allows a custom range containing one day with a snapshot", () => {
    const dates = [1, 5, 9].map((day) => new Date(2026, 0, day, 12));
    const onDateChange = vi.fn();
    render(<DatePicker availableDates={dates} value={{ from: dates[0], to: dates[2] }}
      onDateChange={onDateChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose date range" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "9" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "9" }));
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onDateChange).toHaveBeenCalledWith(1, {
      from: new Date(2026, 0, 9, 0),
      to: new Date(2026, 0, 9, 23, 59, 59, 999),
    });
  });
});
