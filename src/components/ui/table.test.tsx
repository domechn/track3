import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Table, TableBody, TableCell, TableRow } from "./table";

it("only puts a horizontally overflowing table wrapper in keyboard order", () => {
  const { container } = render(
    <Table><TableBody><TableRow><TableCell>Asset</TableCell></TableRow></TableBody></Table>,
  );
  const wrapper = screen.getByRole("table").parentElement!;
  Object.defineProperty(wrapper, "clientWidth", { configurable: true, value: 300 });
  Object.defineProperty(wrapper, "scrollWidth", { configurable: true, value: 300 });
  fireEvent(window, new Event("resize"));
  expect(container.querySelector(".table-scroll[tabindex]")).toBeNull();

  Object.defineProperty(wrapper, "scrollWidth", { configurable: true, value: 600 });
  fireEvent(window, new Event("resize"));
  expect(wrapper).toHaveAttribute("tabindex", "0");
});

it("updates keyboard access in the same render that makes a table overflow", () => {
  const table = (value: string) => (
    <Table><TableBody><TableRow><TableCell>{value}</TableCell></TableRow></TableBody></Table>
  );
  const view = render(table("Short"));
  const wrapper = screen.getByRole("table").parentElement!;
  Object.defineProperty(wrapper, "clientWidth", { configurable: true, value: 300 });
  Object.defineProperty(wrapper, "scrollWidth", { configurable: true, value: 300 });
  fireEvent(window, new Event("resize"));
  expect(wrapper).not.toHaveAttribute("tabindex");

  Object.defineProperty(wrapper, "scrollWidth", { configurable: true, value: 600 });
  view.rerender(table("Longer data"));
  expect(wrapper).toHaveAttribute("tabindex", "0");
});
