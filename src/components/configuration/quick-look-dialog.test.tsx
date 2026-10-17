import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { QuickLookDialog } from "./quick-look-dialog";

describe("QuickLookDialog", () => {
  it("renders loading spinner when loading is true", async () => {
    render(
      <QuickLookDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Test Wallet"
        loading={true}
        data={[]}
        logoMap={{}}
      />,
    );

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    const results = await axe.run(screen.getByRole("dialog"), { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  it("renders empty state when data is empty and not loading", () => {
    render(
      <QuickLookDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Test Wallet"
        loading={false}
        data={[]}
        logoMap={{}}
      />,
    );

    expect(screen.getByText("No assets found")).toBeInTheDocument();
  });

  it("renders asset list with symbols and amounts", () => {
    render(
      <QuickLookDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Binance"
        loading={false}
        data={[
          { symbol: "BTC", amount: 1.5 },
          { symbol: "ETH", amount: 10 },
        ]}
        logoMap={{}}
      />,
    );

    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.getByText("1.50")).toBeInTheDocument();
    expect(screen.getByText("10.00")).toBeInTheDocument();
  });

  it("renders the title", () => {
    render(
      <QuickLookDialog
        open={true}
        onOpenChange={vi.fn()}
        title="My Exchange"
        loading={false}
        data={[]}
        logoMap={{}}
      />,
    );

    expect(screen.getByText(/Quick Look/)).toBeInTheDocument();
    expect(screen.getByText(/My Exchange/)).toBeInTheDocument();
  });
});
