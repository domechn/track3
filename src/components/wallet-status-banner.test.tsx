import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WalletStatusBanner } from "./wallet-status-banner";

describe("WalletStatusBanner", () => {
  it("shows the failed category and last good time without upstream details", () => {
    render(<WalletStatusBanner statuses={[{
      sourceId: "okx", label: "OKX", status: "failed", category: "rateLimit",
      detail: "Rate limit exceeded (HTTP 429)", lastSuccessAt: "2026-10-31T09:12:00Z",
    }]} locale="en" t={(key) => ({
      "wallets.refreshFailed": "{source} refresh failed",
      "wallets.failure.rateLimit": "Rate limited",
      "wallets.lastGood": "Last good {time}",
    }[key] ?? key)} />);
    expect(screen.getByRole("alert")).toHaveTextContent("OKX refresh failed");
    expect(screen.getByRole("alert")).toHaveTextContent("Rate limited");
    expect(screen.getByRole("alert")).toHaveTextContent("Last good");
    expect(screen.getByRole("alert")).not.toHaveTextContent(/HTTP|429|Rate limit exceeded|automatic try/);
  });

  it("formats the last good time in the selected app language", () => {
    render(<WalletStatusBanner statuses={[{
      sourceId: "okx", label: "OKX", status: "failed", category: "other",
      lastSuccessAt: "2026-10-31T09:12:00Z",
    }]} locale="zh" t={(key) => key === "wallets.lastGood" ? "上次成功 {time}" : key} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/上次成功 .*09:12/);
    expect(screen.getByRole("alert")).not.toHaveTextContent("AM");
  });

  it("includes the date for an older last good result", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 1, 12));
    try {
      const statuses = [
        { sourceId: "old", label: "Old", status: "failed" as const, lastSuccessAt: new Date(2026, 9, 31, 9, 12).toISOString() },
        { sourceId: "today", label: "Today", status: "failed" as const, lastSuccessAt: new Date(2026, 10, 1, 9, 12).toISOString() },
      ];
      const { container } = render(<WalletStatusBanner statuses={statuses} locale="en"
        t={(key) => key === "wallets.lastGood" ? "Last good {time}" : key} />);
      const entries = container.querySelectorAll(".analyze-wallet-failure");
      expect(entries[0]).toHaveTextContent("Oct 31");
      expect(entries[1]).not.toHaveTextContent("Nov 1");
    } finally {
      vi.useRealTimers();
    }
  });
});
