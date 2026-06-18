import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Comparison from "@/components/comparison";

vi.mock("@/components/motion", () => ({
  StaggerContainer: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  FadeUp: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock("@tauri-apps/api/path", () => ({
  appCacheDir: vi.fn().mockResolvedValue("/tmp/track3-cache"),
}));

vi.mock("@/utils/app", () => ({
  getImageApiPath: vi
    .fn()
    .mockImplementation((_dir: string, symbol: string) =>
      Promise.resolve(`/logos/${symbol}.png`),
    ),
}));

vi.mock("@/middlelayers/data", () => ({
  downloadCoinLogos: vi.fn(),
}));

vi.mock("@/middlelayers/charts", () => ({
  queryAllDataDates: vi.fn(),
  queryCoinDataByUUID: vi.fn(),
}));

import { queryAllDataDates, queryCoinDataByUUID } from "@/middlelayers/charts";

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };

beforeEach(() => {
  vi.clearAllMocks();
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

    render(
      <Comparison currency={usdCurrency} quoteColor="green-up-red-down" />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: /comparison/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /loading comparison data/i,
    );

    vi.advanceTimersByTime(9000);

    expect(screen.getByRole("status")).toHaveTextContent(
      /loading comparison data/i,
    );
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
        return [
          {
            symbol: "BTC",
            assetType: "crypto",
            amount: 1,
            value: 1200,
            price: 1200,
          },
        ];
      }
      return [
        {
          symbol: "BTC",
          assetType: "crypto",
          amount: 0.8,
          value: 900,
          price: 1125,
        },
      ];
    });

    render(
      <Comparison currency={usdCurrency} quoteColor="green-up-red-down" />,
    );

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    const toggle = screen.getByRole("button", { name: /hide values/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAccessibleName(/show values/i);
  });

  it("renders the value visibility icon with theme-aware current color", async () => {
    vi.mocked(queryAllDataDates).mockResolvedValue([
      { id: 1, date: "2024-04-16" },
      { id: 2, date: "2024-04-15" },
    ] as never);
    vi.mocked(queryCoinDataByUUID).mockResolvedValue([]);

    render(
      <Comparison currency={usdCurrency} quoteColor="green-up-red-down" />,
    );

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    const toggle = screen.getByRole("button", { name: /hide values/i });
    const icon = toggle.querySelector("svg");

    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass("text-current");
  });

  it("uses date picker buttons for the base and head dates instead of select comboboxes", async () => {
    vi.mocked(queryAllDataDates).mockResolvedValue([
      { id: 1, date: "2024-04-16" },
      { id: 2, date: "2024-04-15" },
    ] as never);
    vi.mocked(queryCoinDataByUUID).mockResolvedValue([]);

    render(
      <Comparison currency={usdCurrency} quoteColor="green-up-red-down" />,
    );

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /choose base date/i }),
    ).toHaveTextContent("2024-04-15");
    expect(
      screen.getByRole("button", { name: /choose head date/i }),
    ).toHaveTextContent("2024-04-16");
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("shows and selects individual snapshots when a date has multiple snapshots", async () => {
    const user = userEvent.setup();
    vi.mocked(queryAllDataDates).mockResolvedValue([
      {
        id: "latest-snapshot",
        date: "2024-04-16",
        createdAt: "2024-04-16T16:30:00",
      },
      {
        id: "older-same-day-snapshot",
        date: "2024-04-16",
        createdAt: "2024-04-16T10:30:00",
      },
      {
        id: "previous-day-snapshot",
        date: "2024-04-15",
        createdAt: "2024-04-15T09:00:00",
      },
    ] as never);
    vi.mocked(queryCoinDataByUUID).mockResolvedValue([]);

    render(
      <Comparison currency={usdCurrency} quoteColor="green-up-red-down" />,
    );

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    expect(queryCoinDataByUUID).toHaveBeenCalledWith("latest-snapshot");
    expect(queryCoinDataByUUID).toHaveBeenCalledWith(
      "older-same-day-snapshot",
    );
    expect(screen.getByRole("button", { name: /choose base date/i }))
      .toHaveTextContent("2024-04-16 10:30:00");

    vi.mocked(queryCoinDataByUUID).mockClear();

    await user.click(screen.getByRole("button", { name: /choose head date/i }));

    expect(screen.getByText("2 snapshots on 2024-04-16")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /select 2024-04-16 10:30:00 snapshot/i,
      }),
    );

    expect(queryCoinDataByUUID).toHaveBeenCalledWith(
      "older-same-day-snapshot",
    );
  });
});
