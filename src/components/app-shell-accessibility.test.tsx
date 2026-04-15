import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "@/App";
import Overview from "@/components/overview";

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };

vi.mock("@/components/index", () => ({
  default: () => <div>index app</div>,
}));

vi.mock("@/components/auto-updater", () => ({
  default: () => null,
}));

vi.mock("@/components/ui/toaster", () => ({
  Toaster: () => null,
}));

vi.mock("@/components/common/theme", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/utils/hook", () => ({
  renderRightClickMenu: vi.fn(),
}));

vi.mock("@/components/total-value-and-change", () => ({
  default: () => <div>total value</div>,
}));

vi.mock("@/components/pnl", () => ({
  default: () => <div>pnl</div>,
}));

vi.mock("@/components/latest-assets-percentage", () => ({
  default: () => <div>latest assets</div>,
}));

vi.mock("@/components/profit", () => ({
  default: () => <div>profit</div>,
}));

vi.mock("@/components/assets-percentage-change", () => ({
  default: () => <div>assets percentage change</div>,
}));

vi.mock("@/components/top-coins-rank", () => ({
  default: () => <div>top coins rank</div>,
}));

vi.mock("@/components/top-coins-percentage-change", () => ({
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
  it("provides a skip link that focuses the main content wrapper", async () => {
    const user = userEvent.setup();
    render(<App />);

    const skipLink = screen.getByRole("link", { name: /skip to main content/i });
    const mainContent = screen.getByText("index app").closest("#app-main-content");

    expect(mainContent).not.toBeNull();

    await user.click(skipLink);

    expect(mainContent).toHaveFocus();
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
