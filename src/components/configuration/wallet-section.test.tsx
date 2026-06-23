import { render, screen } from "@testing-library/react";
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

    expect(screen.getByText(/No wallet found/)).toBeInTheDocument();
  });

  it("has an add button", () => {
    render(<WalletSection {...baseProps} />);

    expect(screen.getByText("Add Wallet Configuration")).toBeInTheDocument();
  });
});
