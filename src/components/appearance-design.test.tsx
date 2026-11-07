import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { queryHistoricalData } from "@/middlelayers/charts-history";
import { AppearanceDesign } from "./appearance-design";

vi.mock("@/middlelayers/charts-history", () => ({ queryHistoricalData: vi.fn(async () => [
  { id: "new", total: 1200 }, { id: "old", total: 1000 },
]) }));

it("previews portfolio history and applies the selected theme", async () => {
  const onThemeChange = vi.fn();
  render(<AppearanceDesign selectedTheme="dark" quoteColor="green-up-red-down" onThemeChange={onThemeChange} onQuoteColorChange={vi.fn()} />);
  expect(await screen.findAllByText("$1,200.00")).toHaveLength(2);
  expect(queryHistoricalData).toHaveBeenCalledWith(31, true, { includeTransactions: false });
  fireEvent.click(screen.getByRole("radio", { name: /Light/ }));
  expect(onThemeChange).toHaveBeenCalledWith("light");
});

it("previews both quote choices with the theme's contrast-safe direction tokens", () => {
  render(<AppearanceDesign selectedTheme="light" quoteColor="green-up-red-down" onThemeChange={vi.fn()} onQuoteColorChange={vi.fn()} />);
  const choices = screen.getAllByRole("radio", { name: /(?:Green Up|Red Up)/i });
  expect((choices[0].querySelector(".samples b") as HTMLElement).style.color).toBe("hsl(var(--positive))");
  expect((choices[1].querySelector(".samples b") as HTMLElement).style.color).toBe("hsl(var(--negative))");
});
