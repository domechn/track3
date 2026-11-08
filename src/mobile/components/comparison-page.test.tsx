import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Comparison from "@/mobile/components/comparison";

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
import * as configuration from "@/middlelayers/configuration";
import { StableCoinsQuery } from "@/middlelayers/datafetch/coins/stable";
import * as platform from "@/utils/platform";
import { COMPARISON_DATES_KEY } from "@/middlelayers/ai/actions";
import { readAssistantComparisonDates, setAssistantComparisonDates } from "@/middlelayers/ui-state/page-prefs";

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  window.location.hash = "";
});

describe("Comparison page", () => {
  it("uses the shared stablecoin list for the phone mover note", async () => {
    const stableQuery = vi.spyOn(StableCoinsQuery.prototype, "listAllStableCoins").mockResolvedValue(["XUSD"]);
    const savedStable = vi.spyOn(configuration, "getStableCoins").mockResolvedValue([]);
    const ios = vi.spyOn(platform, "isIOS").mockReturnValue(true);
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    try {
      vi.mocked(queryAllDataDates).mockResolvedValue([
        { id: "head", date: "2024-04-16", createdAt: "2024-04-16T00:00:00Z" },
        { id: "base", date: "2024-04-15", createdAt: "2024-04-15T00:00:00Z" },
      ]);
      vi.mocked(queryCoinDataByUUID).mockImplementation(async (uuid: string) => [
        { symbol: "BTC", assetType: "crypto", amount: 1, value: uuid === "head" ? 120 : 100, price: uuid === "head" ? 120 : 100 },
        { symbol: "XUSD", assetType: "crypto", amount: 1, value: uuid === "head" ? 98 : 100, price: uuid === "head" ? 98 : 100 },
      ]);
      render(<Comparison currency={usdCurrency} quoteColor="green-up-red-down" />);
      await waitFor(() => expect(document.querySelector(".fd-comparison-movers.percent p"))
        .toHaveTextContent("XUSD moved"));
      fireEvent.pointerEnter(document.querySelector(".fd-comparison-movers:not(.percent) .fd-comparison-mover [data-chart-mark]")!);
      expect(screen.getByRole("tooltip")).toHaveTextContent("+$20.00");
    } finally {
      stableQuery.mockRestore();
      savedStable.mockRestore();
      ios.mockRestore();
      Object.defineProperty(window, "innerWidth", { configurable: true, value: previousWidth });
    }
  });

  it("opens a snapshot selected from History as the comparison head", async () => {
    window.location.hash = "#/comparison?head=older";
    vi.mocked(queryAllDataDates).mockResolvedValue([
      { id: "latest", date: "2024-04-16", createdAt: "2024-04-16T00:00:00Z" },
      { id: "older", date: "2024-04-15", createdAt: "2024-04-15T00:00:00Z" },
      { id: "oldest", date: "2024-04-14", createdAt: "2024-04-14T00:00:00Z" },
    ]);
    vi.mocked(queryCoinDataByUUID).mockResolvedValue([]);
    render(<Comparison currency={usdCurrency} quoteColor="green-up-red-down" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /head date/i })).toHaveTextContent("2024-04-15"));
    expect(screen.getByRole("button", { name: /base date/i })).toHaveTextContent("2024-04-14");
  });
  it("leaves quick ranges unselected when the latest two snapshots are shown on a phone", async () => {
    const previousMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) => ({
      matches: query.includes("pointer: coarse"), media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
    localStorage.removeItem(COMPARISON_DATES_KEY);
    try {
      vi.mocked(queryAllDataDates).mockResolvedValue([
        { id: "head", date: "2024-04-16", createdAt: "2024-04-16T00:00:00Z" },
        { id: "base", date: "2024-04-15", createdAt: "2024-04-15T00:00:00Z" },
      ]);
      vi.mocked(queryCoinDataByUUID).mockResolvedValue([]);
      render(<Comparison currency={usdCurrency} quoteColor="green-up-red-down" />);
      await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument(), { timeout: 5000 });
      expect(screen.getAllByRole("radio").every((radio) => radio.getAttribute("aria-checked") === "false")).toBe(true);
    } finally {
      window.matchMedia = previousMatchMedia;
    }
  });
  it("keeps the desktop currency spacing in comparison totals", async () => {
    vi.mocked(queryAllDataDates).mockResolvedValue([
      { id: "head", date: "2024-04-16", createdAt: "2024-04-16T00:00:00Z" },
      { id: "base", date: "2024-04-15", createdAt: "2024-04-15T00:00:00Z" },
    ]);
    vi.mocked(queryCoinDataByUUID).mockResolvedValue([
      { symbol: "BTC", assetType: "crypto", amount: 1, value: 1000, price: 1000 },
    ]);
    render(<Comparison currency={usdCurrency} quoteColor="green-up-red-down" />);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(document.querySelector(".comparison-total-grid")).toHaveTextContent("$ 1,000.00");
  });
  it("consumes an assistant comparison date selection after applying it", async () => {
    localStorage.setItem(COMPARISON_DATES_KEY, JSON.stringify({ base: "2024-04-15", head: "2024-04-16" }));
    vi.mocked(queryAllDataDates).mockResolvedValue([
      { id: "1", date: "2024-04-16", createdAt: "2024-04-16T00:00:00Z" },
      { id: "2", date: "2024-04-15", createdAt: "2024-04-15T00:00:00Z" },
    ]);
    vi.mocked(queryCoinDataByUUID).mockResolvedValue([]);
    render(<Comparison currency={usdCurrency} quoteColor="green-up-red-down" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /base date/i })).toHaveTextContent("2024-04-15"));
    expect(localStorage.getItem(COMPARISON_DATES_KEY)).toBeNull();
  });
  it("applies a padded assistant date to an unpadded snapshot label", async () => {
    setAssistantComparisonDates({ base: "2026-10-01", head: "2026-10-31" });
    vi.mocked(queryAllDataDates).mockResolvedValue([
      { id: "head", date: "2026-10-31", createdAt: "2026-10-31T09:41:00Z" },
      { id: "previous", date: "2026-10-30", createdAt: "2026-10-30T09:41:00Z" },
      { id: "base", date: "2026-10-1", createdAt: "2026-10-01T09:41:00Z" },
    ]);
    vi.mocked(queryCoinDataByUUID).mockResolvedValue([]);
    render(<Comparison currency={usdCurrency} quoteColor="green-up-red-down" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /base date/i })).toHaveTextContent(/2026-10-1\b/);
      expect(readAssistantComparisonDates()).toBeUndefined();
    }, { timeout: 10_000 });
  });
  it("replaces an assistant date selection when the user chooses a quick comparison", async () => {
    localStorage.setItem(COMPARISON_DATES_KEY, JSON.stringify({ base: "2024-04-15", head: "2024-04-16" }));
    vi.mocked(queryAllDataDates).mockResolvedValue([
      { id: "1", date: "2024-04-16", createdAt: "2024-04-16T00:00:00Z" },
      { id: "2", date: "2024-04-15", createdAt: "2024-04-15T00:00:00Z" },
    ]);
    vi.mocked(queryCoinDataByUUID).mockResolvedValue([]);
    render(<Comparison currency={usdCurrency} quoteColor="green-up-red-down" />);
    await userEvent.click(await screen.findByRole("radio", { name: "7D" }));
    expect(localStorage.getItem(COMPARISON_DATES_KEY)).toBeNull();
  });
  function toLocalDateTimeParts(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    };
  }

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
    expect(document.querySelector(".comparison-total-base")).not.toHaveTextContent("***");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAccessibleName(/show values/i);
    expect(screen.getAllByText("***").length).toBeGreaterThan(0);
    await user.click(toggle);
    expect(screen.queryByText("***")).not.toBeInTheDocument();
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

  it("shows one neutral marker for an unchanged asset metric", async () => {
    vi.mocked(queryAllDataDates).mockResolvedValue([
      { id: 1, date: "2024-04-16" },
      { id: 2, date: "2024-04-15" },
    ] as never);
    vi.mocked(queryCoinDataByUUID).mockResolvedValue([
      { symbol: "USDC", assetType: "crypto", amount: 100, value: 100, price: 1 },
    ]);
    render(<Comparison currency={usdCurrency} quoteColor="green-up-red-down" />);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    const change = document.querySelector(".comparison-metric-row > :nth-child(3)");
    expect(change).toHaveTextContent(/^—$/);
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
      screen.getByRole("button", { name: /base date/i }),
    ).toHaveTextContent("2024-04-15");
    expect(
      screen.getByRole("button", { name: /head date/i }),
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
    expect(queryCoinDataByUUID).toHaveBeenCalledWith("older-same-day-snapshot");
    expect(
      screen.getByRole("button", { name: /base date/i }),
    ).toHaveTextContent("2024-04-16 10:30:00");

    vi.mocked(queryCoinDataByUUID).mockClear();

    await user.click(screen.getByRole("button", { name: /head date/i }));

    expect(screen.getByText("2 snapshots on 2024-04-16")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /select 2024-04-16 10:30:00 snapshot/i,
      }),
    );

    expect(queryCoinDataByUUID).toHaveBeenCalledWith("older-same-day-snapshot");
  });

  it("formats UTC snapshot timestamps in local timezone for picker labels", async () => {
    const latestCreatedAt = "2024-04-16T16:30:00.000Z";
    const olderCreatedAt = "2024-04-16T10:30:00.000Z";
    const latest = toLocalDateTimeParts(latestCreatedAt);
    const older = toLocalDateTimeParts(olderCreatedAt);

    vi.mocked(queryAllDataDates).mockResolvedValue([
      {
        id: "latest-snapshot",
        date: "2024-04-16",
        createdAt: latestCreatedAt,
      },
      {
        id: "older-same-day-snapshot",
        date: "2024-04-16",
        createdAt: olderCreatedAt,
      },
    ] as never);
    vi.mocked(queryCoinDataByUUID).mockResolvedValue([]);

    render(
      <Comparison currency={usdCurrency} quoteColor="green-up-red-down" />,
    );

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /head date/i }),
    ).toHaveTextContent(`2024-04-16 ${latest.time}`);
    expect(
      screen.getByRole("button", { name: /base date/i }),
    ).toHaveTextContent(`2024-04-16 ${older.time}`);
  });
});
