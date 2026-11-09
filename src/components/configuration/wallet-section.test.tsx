import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WalletSection } from "./wallet-section";
import type { WalletRow } from "./types";

const mockWallets: WalletRow[] = [
  { type: "btc", alias: "Cold Storage", address: "1abc", active: true },
  { type: "erc20", alias: undefined, address: "0xdef", active: false },
];

const baseProps = {
  wallets: mockWallets,
  visibleWallets: mockWallets,
  walletPage: 0,
  walletPageCount: 1,
  isPro: false,
  walletOptions: [
    { value: "btc", label: "BTC" },
    { value: "erc20", label: "ERC20" },
  ],
  addWalletDialogOpen: false,
  addWalletConfig: undefined,
  saveWalletConfigLoading: false,
  onWalletPageChange: vi.fn(),
  onAddWalletDialogOpenChange: vi.fn(),
  onAddWalletConfigChange: vi.fn(),
  onAddWalletFormSubmit: vi.fn(),
  onToggleActive: vi.fn(),
  onRemove: vi.fn(),
  onQuickLook: vi.fn(),
};

describe("WalletSection", () => {
  it("allows an empty alias to restore the wallet's default name", () => {
    const onRename = vi.fn();
    render(<WalletSection {...baseProps} onRename={onRename} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename Cold Storage" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Alias" }), { target: { value: " " } });
    expect(screen.getByRole("dialog")).toHaveTextContent("Shown elsewhere as 1abc");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Alias" }), { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("btc", "1abc", "");
  });
  it("pages a real-scale wallet list at eight visible rows", () => {
    const wallets = Array.from({ length: 13 }, (_, index): WalletRow => ({
      type: "btc", alias: `Wallet ${index + 1}`, address: `bc1q${index + 1}`, active: true,
    }));
    const onWalletPageChange = vi.fn();
    const { container } = render(<WalletSection {...baseProps} wallets={wallets} visibleWallets={wallets}
      walletPageCount={2} onWalletPageChange={onWalletPageChange} />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(8);
    expect(screen.getByText("8 shown / 13 total")).toBeInTheDocument();
    const pager = container.querySelector("[data-layout-pager]")!;
    fireEvent.click(within(pager as HTMLElement).getByRole("button", { name: "Next" }));
    expect(onWalletPageChange).toHaveBeenCalledWith(1);
  });
  it("distinguishes long wallet aliases by their suffix without losing the full name", () => {
    const aliases = ["Cold storage account for wallet 01", "Cold storage account for wallet 02"];
    render(<WalletSection {...baseProps} wallets={aliases.map((alias, index) => ({
      type: "btc", alias, address: `bc1q${index}`, active: true,
    }))} visibleWallets={aliases.map((alias, index) => ({
      type: "btc", alias, address: `bc1q${index}`, active: true,
    }))} />);
    expect(screen.getByText("Cold stora…let 01")).toBeInTheDocument();
    expect(screen.getByText("Cold stora…let 02")).toBeInTheDocument();
    for (const alias of aliases) expect(screen.getByText(alias)).toHaveClass("sr-only");
  });
  it("renders wallet table with data", () => {
    render(<WalletSection {...baseProps} />);

    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.getByText("ERC20")).toBeInTheDocument();
    expect(screen.getByText("Cold Storage")).toBeInTheDocument();
  });

  it("shows wallet addresses", () => {
    render(<WalletSection {...baseProps} />);

    expect(screen.getByText("1abc")).toBeInTheDocument();
    expect(screen.getByText("0xdef")).toBeInTheDocument();
  });

  it("shows empty state when no wallets", () => {
    render(<WalletSection {...baseProps} wallets={[]} visibleWallets={[]} />);

    const state = screen.getByRole("heading", { name: "No wallets yet" }).closest("[data-empty-state]")!;
    expect(state).toHaveTextContent("Add one to start reading balances");
    expect(state).not.toHaveTextContent("Add your first wallet address");
  });

  it("has an add button", () => {
    render(<WalletSection {...baseProps} />);

    expect(screen.getByText("Add Wallet Configuration")).toBeInTheDocument();
  });

  it("requires confirmation before removing a wallet draft", () => {
    const onRemove = vi.fn();
    render(<WalletSection {...baseProps} onRemove={onRemove} />);
    const row = screen.getByText("1abc").closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription("This removes it from your configuration.");
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(onRemove).toHaveBeenCalledWith("btc", "1abc");
  });
});
