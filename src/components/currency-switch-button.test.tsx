import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import CurrencySwitchButton from "./currency-switch-button";

const usd = { currency: "USD", alias: "US dollar", symbol: "$", rate: 1 };
const cny = { currency: "CNY", alias: "Chinese yuan", symbol: "¥", rate: 7.1 };

it("hides when USD is preferred", () => {
  render(<CurrencySwitchButton preferredCurrency={usd} displayCurrency={usd} onToggle={() => {}} />);
  expect(screen.queryByRole("button", { name: /Show in/ })).toBeNull();
});

it("announces the next currency and highlights USD while overridden", () => {
  const onToggle = vi.fn();
  const rendered = render(<CurrencySwitchButton preferredCurrency={cny} displayCurrency={cny} onToggle={onToggle} />);
  const button = screen.getByRole("button", { name: "Show in USD" });
  expect(button).toHaveAttribute("aria-pressed", "false");
  expect(button).toHaveTextContent("CNY");
  fireEvent.click(button);
  expect(onToggle).toHaveBeenCalledOnce();
  rendered.rerender(<CurrencySwitchButton preferredCurrency={cny} displayCurrency={usd} onToggle={onToggle} />);
  expect(screen.getByRole("button", { name: "Show in CNY" })).toHaveAttribute("aria-pressed", "true");
  expect(button).toHaveTextContent("USD");
});
