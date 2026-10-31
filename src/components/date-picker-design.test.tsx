import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DatePicker from "./date-picker";

describe("Overview date picker", () => {
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
});
