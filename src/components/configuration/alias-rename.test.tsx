import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { I18nProvider, localeLocalStorageKey } from "@/i18n";
import { AliasRename } from "./alias-rename";

it("previews duplicate names with stable ordinals and allows the duplicate", () => {
  const onRename = vi.fn();
  render(<AliasRename alias="First" name="First" fallback="Binance"
    names={["First", "Main"]} index={0} onRename={onRename} />);
  fireEvent.click(screen.getByRole("button", { name: "Rename First" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Alias" }), { target: { value: "Main" } });
  expect(screen.getByRole("dialog")).toHaveTextContent("Shown elsewhere as Main (1)");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onRename).toHaveBeenCalledWith("Main");
});

it("limits a typed alias to 40 characters", async () => {
  const onRename = vi.fn();
  render(<AliasRename name="Original" fallback="Binance" names={["Original"]} index={0} onRename={onRename} />);
  await userEvent.click(screen.getByRole("button", { name: "Rename Original" }));
  const input = screen.getByRole("textbox", { name: "Alias" });
  await userEvent.type(input, "x".repeat(42));
  expect(input).toHaveValue("x".repeat(40));
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onRename).toHaveBeenCalledWith("x".repeat(40));
});

it("trims on Enter, cancels with Escape, and returns focus to Rename", async () => {
  const onRename = vi.fn();
  render(<AliasRename alias="Main" name="Main" fallback="Binance" names={["Main"]} index={0} onRename={onRename} />);
  const trigger = screen.getByRole("button", { name: "Rename Main" });
  await userEvent.click(trigger);
  const input = screen.getByRole("textbox", { name: "Alias" });
  expect(input).toHaveValue("Main");
  expect(screen.getByText("Shown elsewhere as Main")).toHaveAttribute("aria-live", "polite");
  await userEvent.keyboard("{Escape}");
  expect(onRename).not.toHaveBeenCalled();
  expect(trigger).toHaveFocus();
  await userEvent.click(trigger);
  await userEvent.clear(screen.getByRole("textbox", { name: "Alias" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Alias" }), "  Vault  {Enter}");
  expect(onRename).toHaveBeenCalledWith("Vault");
  expect(trigger).toHaveFocus();
});

it("formats the source name within the Chinese rename sentence", () => {
  localStorage.setItem(localeLocalStorageKey, "zh");
  try {
    render(<I18nProvider><AliasRename alias="Main" name="Main" fallback="Binance"
      names={["Main"]} index={0} onRename={vi.fn()} /></I18nProvider>);
    fireEvent.click(screen.getByRole("button", { name: "重命名Main" }));
    expect(screen.getByRole("dialog", { name: "重命名Main" })).toBeInTheDocument();
  } finally {
    localStorage.removeItem(localeLocalStorageKey);
  }
});
