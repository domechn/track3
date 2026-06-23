import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttachModal } from "./attach-modal";

describe("AttachModal", () => {
  it("renders None option and exchange/wallet groups", () => {
    render(
      <AttachModal
        open={true}
        onOpenChange={vi.fn()}
        currentAttachTo={undefined}
        cexOptions={[{ value: "cex:binance:key123", label: "Binance key***" }]}
        walletOptions={[{ value: "wallet:btc:addr1", label: "BTC 1abc...def" }]}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.getByText("Exchanges")).toBeInTheDocument();
    expect(screen.getByText("Wallets")).toBeInTheDocument();
  });

  it("highlights the currently selected option", () => {
    render(
      <AttachModal
        open={true}
        onOpenChange={vi.fn()}
        currentAttachTo={{ kind: "cex", type: "binance", identity: "key123" }}
        cexOptions={[{ value: "cex:binance:key123", label: "Binance key***" }]}
        walletOptions={[]}
        onSelect={vi.fn()}
      />,
    );

    // None should NOT be highlighted
    const noneItem = screen.getByText("None").closest('[role="button"]');
    expect(noneItem?.className).not.toContain("bg-accent");

    // The selected exchange should be highlighted
    const selectedItem = screen
      .getByText("Binance key***")
      .closest('[role="button"]');
    expect(selectedItem?.className).toContain("bg-accent");
  });

  it("shows empty state when no targets configured", () => {
    render(
      <AttachModal
        open={true}
        onOpenChange={vi.fn()}
        currentAttachTo={undefined}
        cexOptions={[]}
        walletOptions={[]}
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No exchanges or wallets configured yet."),
    ).toBeInTheDocument();
  });
});
