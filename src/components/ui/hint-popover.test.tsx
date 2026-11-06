import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { HintPopover, HintCoinList } from "./hint-popover";

afterEach(() => vi.useRealTimers());

it("opens on focus, closes on Escape, and keeps only the latest hint open", () => {
  render(<>
    <HintPopover label="First hint">First explanation</HintPopover>
    <HintPopover label="Second hint">Second explanation</HintPopover>
  </>);
  const first = screen.getByRole("button", { name: "First hint" });
  const second = screen.getByRole("button", { name: "Second hint" });
  fireEvent.focus(first);
  expect(screen.getByRole("tooltip")).toHaveTextContent("First explanation");
  expect(first).toHaveAttribute("aria-expanded", "true");
  expect(first).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);
  fireEvent.focus(second);
  expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Second explanation");
  expect(first).toHaveAttribute("aria-expanded", "false");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("waits for hover intent and closes after pointer leaves", () => {
  vi.useFakeTimers();
  render(<HintPopover label="Details">Explanation</HintPopover>);
  const trigger = screen.getByRole("button", { name: "Details" });
  fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
  act(() => vi.advanceTimersByTime(149));
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("tooltip")).toBeInTheDocument();
  fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
  act(() => vi.advanceTimersByTime(99));
  expect(screen.getByRole("tooltip")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("toggles on tap and closes outside", () => {
  render(<><HintPopover label="Details">Explanation</HintPopover><button>Outside</button></>);
  const trigger = screen.getByRole("button", { name: "Details" });
  fireEvent.click(trigger);
  expect(screen.getByRole("tooltip")).toBeInTheDocument();
  fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  fireEvent.click(trigger);
  fireEvent.click(trigger);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("keeps a tapped hint open when the pointer leaves", () => {
  vi.useFakeTimers();
  render(<HintPopover label="Details">Explanation</HintPopover>);
  const trigger = screen.getByRole("button", { name: "Details" });
  fireEvent.click(trigger);
  fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
  act(() => vi.advanceTimersByTime(100));
  expect(screen.getByRole("tooltip")).toBeInTheDocument();
});

it("pins a card hint when clicked after hover opens it", () => {
  vi.useFakeTimers();
  render(<div><HintPopover label="Card details" hoverParent>Card explanation</HintPopover></div>);
  const trigger = screen.getByRole("button", { name: "Card details" });
  fireEvent.pointerEnter(trigger.parentElement!, { pointerType: "mouse" });
  act(() => vi.advanceTimersByTime(150));
  expect(screen.getByRole("tooltip")).toHaveTextContent("Card explanation");
  fireEvent.pointerDown(trigger, { pointerType: "mouse" });
  fireEvent.click(trigger);
  fireEvent.pointerLeave(trigger.parentElement!, { pointerType: "mouse" });
  act(() => vi.advanceTimersByTime(100));
  expect(screen.getByRole("tooltip")).toHaveTextContent("Card explanation");
  fireEvent.click(trigger);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("opens on keyboard focus after a touch drag cancels a badge press", () => {
  render(<HintPopover label="Details">Explanation</HintPopover>);
  const trigger = screen.getByRole("button", { name: "Details" });
  fireEvent.pointerDown(trigger, { pointerType: "touch" });
  fireEvent.pointerCancel(trigger, { pointerType: "touch" });
  fireEvent.focus(trigger);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Explanation");
});

it("moves from a focused trigger to the expansion control with Tab", async () => {
  render(<HintPopover label="Coins"><HintCoinList
    names={Array.from({ length: 9 }, (_, index) => `COIN${index}`)}
    more={(count) => `and ${count} more`} showAll="Show all" showLess="Show less" /></HintPopover>);
  const trigger = screen.getByRole("button", { name: "Coins" });
  trigger.focus();
  await userEvent.tab();
  expect(screen.getByRole("button", { name: "Show all" })).toHaveFocus();
});

it("closes a keyboard-opened hint when focus leaves it", () => {
  render(<><HintPopover label="Details">Explanation</HintPopover><button>Outside</button></>);
  const trigger = screen.getByRole("button", { name: "Details" });
  fireEvent.focus(trigger);
  expect(screen.getByRole("tooltip")).toBeInTheDocument();
  fireEvent.blur(trigger, { relatedTarget: screen.getByRole("button", { name: "Outside" }) });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("keeps a card hint open when its badge receives focus", () => {
  vi.useFakeTimers();
  render(<div><HintPopover label="Card details" hoverParent>Card explanation</HintPopover></div>);
  const trigger = screen.getByRole("button", { name: "Card details" });
  fireEvent.pointerEnter(trigger.parentElement!, { pointerType: "mouse" });
  act(() => vi.advanceTimersByTime(150));
  expect(screen.getByRole("tooltip")).toHaveTextContent("Card explanation");
  fireEvent.focus(trigger);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Card explanation");
});

it.each([
  [3, "A, B, C", false],
  [8, "A, B, C, D, E, F, G, H", false],
  [9, "A, B, C, D, E, F, G, H", true],
  [60, "A, B, C, D, E, F, G, H", true],
] as const)("shows eight of %i coins until expanded", (count, preview, expandable) => {
  const names = Array.from({ length: count }, (_, index) => String.fromCharCode(65 + index));
  render(<HintCoinList names={names} more={(n) => `and ${n} more`} showAll="Show all" showLess="Show less" />);
  expect(screen.getByText(preview)).toBeInTheDocument();
  if (expandable) {
    expect(screen.getByText(`and ${count - 8} more`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(screen.getByText(names.join(", "))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.getByText(preview)).toBeInTheDocument();
  } else {
    expect(screen.queryByRole("button", { name: "Show all" })).not.toBeInTheDocument();
  }
});
