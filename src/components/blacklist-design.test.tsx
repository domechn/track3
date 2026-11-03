import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BlacklistDesign } from "./blacklist-design";

it("normalizes a new blacklist symbol and prevents duplicates", async () => {
  const onAdd = vi.fn(async () => {});
  render(<BlacklistDesign symbols={["BTC"]} onAdd={onAdd} onRemove={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: " btc " } });
  fireEvent.click(screen.getByRole("button", { name: "Hide token" }));
  expect(onAdd).not.toHaveBeenCalled();
  expect(screen.getByText(/BTC is already on the blacklist/)).toBeInTheDocument();

  fireEvent.change(screen.getByRole("textbox"), { target: { value: " eth " } });
  fireEvent.click(screen.getByRole("button", { name: "Hide token" }));
  expect(onAdd).toHaveBeenCalledWith("ETH");
});
