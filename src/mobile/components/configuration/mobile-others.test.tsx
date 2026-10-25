import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MobileOthers } from "@/mobile/components/configuration/mobile-others";

it("edits custom holdings on a phone and offers their source attachment", () => {
  const save = vi.fn();
  const attach = vi.fn();
  render(<MobileOthers others={[{ symbol: "GOLD", amount: 2 }]} onSave={save} onRemove={vi.fn()} onAttach={attach} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit GOLD" }));
  expect(screen.getByRole("dialog", { name: "Edit custom asset" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Amount" }), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledWith(0, { symbol: "GOLD", amount: 3, alias: "" });
  fireEvent.click(screen.getByRole("button", { name: "More actions for GOLD" }));
  fireEvent.click(screen.getByRole("button", { name: "Attach to" }));
  expect(attach).toHaveBeenCalledWith(0);
});

it("labels a new custom holding as an addition", () => {
  render(<MobileOthers others={[]} onSave={vi.fn()} onRemove={vi.fn()} onAttach={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Add symbol" }));
  expect(screen.getByRole("dialog", { name: "Add custom asset" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Add custom asset" })).toBeInTheDocument();
});

it("hides the add-symbol action while the first-source guide is shown", () => {
  render(<MobileOthers others={[]} hideEmpty onSave={vi.fn()} onRemove={vi.fn()} onAttach={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Add symbol" })).toBeNull();
});

it("opens the custom holding editor from the first-source picker", () => {
  const actions = { others: [], hideEmpty: true, onSave: vi.fn(), onRemove: vi.fn(), onAttach: vi.fn() };
  const view = render(<MobileOthers {...actions} addRequest={0} />);
  view.rerender(<MobileOthers {...actions} addRequest={1} />);
  expect(screen.getByRole("dialog", { name: "Add custom asset" })).toBeInTheDocument();
});
