import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Comparison from "@/components/comparison";

vi.mock("@/components/motion", () => ({
  StaggerContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  FadeUp: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appCacheDir: vi.fn().mockResolvedValue("/tmp/track3-cache"),
}));

vi.mock("@/utils/app", () => ({
  getImageApiPath: vi.fn().mockImplementation((_dir: string, symbol: string) =>
    Promise.resolve(`/logos/${symbol}.png`)
  ),
}));

vi.mock("@/middlelayers/data", () => ({
  downloadCoinLogos: vi.fn(),
}));

vi.mock("@/middlelayers/charts", () => ({
  queryAllDataDates: vi.fn(),
  queryCoinDataByUUID: vi.fn(),
}));

import {
  queryAllDataDates,
  queryCoinDataByUUID,
} from "@/middlelayers/charts";

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };

beforeEach(() => {
  vi.useRealTimers();
});

describe("Comparison page", () => {
  it("shows a heading and keeps the loading status visible while comparison data is unresolved", async () => {
    vi.useFakeTimers();
    const pending = new Promise<never>(() => {});
    vi.mocked(queryAllDataDates).mockResolvedValue([
      { id: 1, date: "2024-04-16" },
      { id: 2, date: "2024-04-15" },
    ] as never);
    vi.mocked(queryCoinDataByUUID).mockReturnValue(pending);

    render(<Comparison currency={usdCurrency} quoteColor="green-up-red-down" />);

    expect(screen.getByRole("heading", { level: 1, name: /comparison/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/loading comparison data/i);

    vi.advanceTimersByTime(9000);

    expect(screen.getByRole("status")).toHaveTextContent(/loading comparison data/i);
    vi.useRealTimers();
  });

  it("clears loading after data resolves and exposes the value visibility toggle state", async () => {
    const user = userEvent.setup();
    vi.mocked(queryAllDataDates).mockResolvedValue([
      { id: 1, date: "2024-04-16" },
      { id: 2, date: "2024-04-15" },
    ] as never);
    vi.mocked(queryCoinDataByUUID).mockImplementation(async (uuid: string) => {
      if (uuid === "1") {
        return [{ symbol: "BTC", amount: 1, value: 1200, price: 1200 }];
      }
      return [{ symbol: "BTC", amount: 0.8, value: 900, price: 1125 }];
    });

    render(<Comparison currency={usdCurrency} quoteColor="green-up-red-down" />);

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    const toggle = screen.getByRole("button", { name: /hide values/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAccessibleName(/show values/i);
  });
});
