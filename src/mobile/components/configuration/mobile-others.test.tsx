import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MobileOthers } from "@/mobile/components/configuration/mobile-others";

it("renames a custom asset in place without editing its holding", () => {
  const rename = vi.fn();
  const save = vi.fn();
  render(<MobileOthers fidelityLayout others={[{ symbol: "GOLD", alias: "Metal", amount: 2 }]}
    onSave={save} onRename={rename} onRemove={vi.fn()} onAttach={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Rename Metal" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Alias" }), { target: { value: " Bullion " } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(rename).toHaveBeenCalledWith(0, "Bullion");
  expect(save).not.toHaveBeenCalled();
});

it("opens the full custom asset editor from the symbol beside Rename", () => {
  render(<MobileOthers fidelityLayout others={[{ symbol: "GOLD", alias: "Gold", amount: 4 }]}
    onSave={vi.fn()} onRename={vi.fn()} onRemove={vi.fn()} onAttach={vi.fn()} />);
  expect(screen.getAllByRole("button", { name: "Edit GOLD" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Edit GOLD" }));
  expect(screen.getByRole("dialog", { name: "Edit custom asset" })).toBeVisible();
});

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

it("opens the custom editor from its visible symbol in the fidelity layout", () => {
  render(<MobileOthers fidelityLayout others={[{ symbol: "GOLD", amount: 2 }]}
    onSave={vi.fn()} onRemove={vi.fn()} onAttach={vi.fn()} />);
  const edit = screen.getAllByRole("button", { name: "Edit GOLD" })[0];
  expect(edit).toContainElement(screen.getByText("GOLD"));
  fireEvent.click(edit);
  expect(screen.getByRole("dialog", { name: "Edit custom asset" })).toBeVisible();
});

it("opens the legacy add-symbol editor", () => {
  render(<MobileOthers others={[]} onSave={vi.fn()} onRemove={vi.fn()} onAttach={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Add symbol" }));
  expect(screen.getByRole("dialog", { name: "Add custom asset" })).toBeVisible();
});

it("quotes custom holding values in the selected base currency", () => {
  render(<MobileOthers fidelityLayout others={[{
    symbol: "GOLD", amount: 2, price: { kind: "manual", usd: 100, setAt: "2026-10-31T00:00:00.000Z" },
  }]} baseCurrency={{ currency: "EUR", rate: 0.9 }}
  onSave={vi.fn()} onRemove={vi.fn()} onAttach={vi.fn()} />);
  expect(screen.getAllByText("€180.00").length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByRole("button", { name: "Edit GOLD" })[0]);
  fireEvent.click(screen.getByRole("radio", { name: "Your price" }));
  expect(screen.getAllByText(/€180\.00/).length).toBeGreaterThan(0);
});

it("labels a new custom holding as an addition", () => {
  render(<MobileOthers others={[]} fidelityLayout addRequest={1} onSave={vi.fn()} onRemove={vi.fn()} onAttach={vi.fn()} />);
  expect(screen.getByRole("dialog", { name: "Add custom asset" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Add custom asset" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add asset" })).toBeVisible();
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

it("saves a stock follow rule from the fidelity editor", () => {
  const save = vi.fn();
  render(<MobileOthers fidelityLayout others={[]} addRequest={1} onSave={save} onRemove={vi.fn()} onAttach={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Symbol" }), { target: { value: "NVDA-RSU" } });
  fireEvent.click(screen.getByRole("radio", { name: "Follow a listed asset" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Listed asset type" }), { target: { value: "stock" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Listed asset symbol" }), { target: { value: "nvda" } });
  fireEvent.click(screen.getByRole("button", { name: "Add asset" }));
  expect(save).toHaveBeenCalledWith(null, expect.objectContaining({
    price: { kind: "follow", assetType: "stock", symbol: "NVDA", ratio: 1 },
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
