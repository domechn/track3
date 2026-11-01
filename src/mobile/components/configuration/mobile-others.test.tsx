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

it("saves a listed asset follow rule with the custom holding", () => {
  const save = vi.fn();
  render(<MobileOthers others={[{ symbol: "NOVA", amount: 10 }]} onSave={save} onRemove={vi.fn()} onAttach={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit NOVA" }));
  fireEvent.click(screen.getByRole("radio", { name: "Follow a listed asset" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Listed symbol" }), { target: { value: "btc" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledWith(0, expect.objectContaining({
    price: { kind: "follow", assetType: "crypto", symbol: "BTC", ratio: 1 },
  }));
});

it("accepts a manual price in the selected base currency", () => {
  const save = vi.fn();
  render(<MobileOthers others={[{ symbol: "NOVA", amount: 10 }]}
    baseCurrency={{ currency: "EUR", rate: 0.9 }} onSave={save} onRemove={vi.fn()} onAttach={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit NOVA" }));
  fireEvent.click(screen.getByRole("radio", { name: "Your price" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "EUR per unit" }), { target: { value: "9" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledWith(0, expect.objectContaining({
    price: expect.objectContaining({ kind: "manual", usd: 10 }),
  }));
});

it("labels a follow rule invalid after its target becomes a custom row", () => {
  render(<MobileOthers others={[
    { symbol: "NOVA", amount: 1, price: { kind: "follow", assetType: "crypto", symbol: "BTC", ratio: 1 } },
    { symbol: "BTC", amount: 1 },
  ]} onSave={vi.fn()} onRemove={vi.fn()} onAttach={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Edit NOVA" })).toHaveTextContent("Invalid price rule");
});
