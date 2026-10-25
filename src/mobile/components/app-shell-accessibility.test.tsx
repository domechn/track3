import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "@/mobile/App";
import Overview from "@/mobile/components/overview";

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };

vi.mock("@/mobile/components/index", () => ({
  default: () => <main id="app-main-content" tabIndex={-1}>index app</main>,
}));

vi.mock("@/mobile/components/ui/toaster", () => ({
  Toaster: () => null,
}));

vi.mock("@/mobile/components/common/theme", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/mobile/components/total-value-and-change", () => ({
  default: () => <div>total value</div>,
}));

vi.mock("@/mobile/components/pnl", () => ({
  default: () => <div>pnl</div>,
}));

vi.mock("@/mobile/components/latest-assets-percentage", () => ({
  default: () => <div>latest assets</div>,
}));

vi.mock("@/mobile/components/profit", () => ({
  default: () => <div>profit</div>,
}));

vi.mock("@/mobile/components/assets-percentage-change", () => ({
  default: () => <div>assets percentage change</div>,
}));

vi.mock("@/mobile/components/top-coins-rank", () => ({
  default: () => <div>top coins rank</div>,
}));

vi.mock("@/mobile/components/top-coins-percentage-change", () => ({
  default: () => <div>top coins percentage change</div>,
}));

vi.mock("@/components/motion", () => ({
  StaggerContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  FadeUp: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

describe("App shell accessibility", () => {
  it("provides a skip link that focuses the main landmark", async () => {
    const user = userEvent.setup();
    render(<App />);

    const skipLink = screen.getByRole("link", { name: /skip to main content/i });
    const mainContent = screen.getByRole("main");

    expect(mainContent).not.toBeNull();

    await user.click(skipLink);

    expect(mainContent).toHaveFocus();
  });

  it("leaves shell safe-area spacing to its header and content", () => {
    render(<App />);
    const shell = screen.getByRole("main").parentElement?.parentElement;
    expect(shell).toHaveClass("min-h-dvh");
    expect(shell).not.toHaveClass("ios-safe-area");
  });

  it("renders an overview page heading", () => {
    render(
      <Overview
        currency={usdCurrency}
        dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
        quoteColor="green-up-red-down"
      />
    );

    expect(
      screen.getByRole("heading", { level: 1, name: /overview/i })
    ).toBeInTheDocument();
  });
});
