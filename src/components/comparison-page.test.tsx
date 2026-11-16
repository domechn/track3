import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
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
import { DataChangedContext } from "@/contexts/data-changed";
import { COMPARISON_DATES_KEY } from "@/middlelayers/ai/actions";

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("Comparison page", () => {
  it("starts from the same 30-day comparison at narrow desktop widths", async () => {
    const width = window.innerWidth;
    window.innerWidth = 1024;
    try {
      vi.mocked(queryAllDataDates).mockResolvedValue(Array.from({ length: 31 }, (_, index) => ({
        id: String(31 - index),
        date: `2026-10-${String(31 - index).padStart(2, "0")}`,
      })) as never);
      vi.mocked(queryCoinDataByUUID).mockResolvedValue([]);
      render(<Comparison currency={usdCurrency} quoteColor="green-up-red-down" />);
      await waitFor(() => expect(screen.getByRole("button", { name: /base date/i })).toHaveTextContent("2026-10-01"));
    } finally {
      window.innerWidth = width;
    }
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
    expect(screen.getByRole("table", { name: "Per asset" })).toHaveTextContent("BTC");

    const toggle = screen.getByRole("button", { name: /hide values/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAccessibleName(/show values/i);
    expect(screen.getByRole("table", { name: "Per asset" })).toHaveTextContent("***");
    const cells = screen.getByRole("table", { name: "Per asset" }).querySelectorAll("tbody td");
    for (const index of [1, 2, 5, 6, 7]) expect(cells[index]).toHaveTextContent("***");
    expect(cells[3]).toHaveTextContent("1,125.00");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(cells[1]).toHaveTextContent("0.8");
    expect(cells[1]).not.toHaveTextContent("***");
    expect(screen.getByRole("table", { name: "Per asset" })).not.toHaveTextContent("***");
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

  describe("data changes while the page is open", () => {
    const twoDays = [
      { id: "latest", date: "2024-04-16", createdAt: "2024-04-16T10:30:00" },
      { id: "previous", date: "2024-04-15", createdAt: "2024-04-15T09:00:00" },
    ];
    const page = (version: number) => <DataChangedContext.Provider value={version}>
      <Comparison currency={usdCurrency} quoteColor="green-up-red-down" />
    </DataChangedContext.Provider>;
    const firstLoad = async () => {
      vi.mocked(queryAllDataDates).mockResolvedValue(twoDays as never);
      vi.mocked(queryCoinDataByUUID).mockResolvedValue([]);
      const view = render(page(0));
      await waitFor(() => expect(screen.getByRole("button", { name: /head date/i })).toHaveTextContent("2024-04-16"));
      expect(screen.getByRole("button", { name: /base date/i })).toHaveTextContent("2024-04-15");
      return view;
    };

    it("keeps the selected pair and reads it again", async () => {
      const view = await firstLoad();
      vi.mocked(queryCoinDataByUUID).mockClear();
      view.rerender(page(1));
      await waitFor(() => expect(queryCoinDataByUUID).toHaveBeenCalledWith("latest"));
      expect(queryCoinDataByUUID).toHaveBeenCalledWith("previous");
      expect(screen.getByRole("button", { name: /head date/i })).toHaveTextContent("2024-04-16");
      expect(screen.getByRole("button", { name: /base date/i })).toHaveTextContent("2024-04-15");
    });

    it("lists a snapshot that arrived with the change", async () => {
      const user = userEvent.setup();
      const view = await firstLoad();
      vi.mocked(queryAllDataDates).mockResolvedValue([
        { id: "newest", date: "2024-04-16", createdAt: "2024-04-16T16:30:00" }, ...twoDays,
      ] as never);
      view.rerender(page(1));
      await waitFor(() => expect(screen.getByRole("button", { name: /head date/i })).toHaveTextContent("2024-04-16 10:30:00"));
      expect(screen.getByRole("button", { name: /base date/i })).toHaveTextContent("2024-04-15");
      await user.click(screen.getByRole("button", { name: /head date/i }));
      expect(screen.getByRole("button", { name: /select 2024-04-16 16:30:00 snapshot/i })).toBeInTheDocument();
    });
  });

  const twoSnapshots = [
    { id: "2", date: "2024-04-16", createdAt: "2024-04-16T00:00:00Z" },
    { id: "1", date: "2024-04-15", createdAt: "2024-04-15T00:00:00Z" },
  ];
  const threeSnapshots = [{ id: "3", date: "2024-04-17", createdAt: "2024-04-17T00:00:00Z" }, ...twoSnapshots];
  const atVersion = (version: number) => <DataChangedContext.Provider value={version}>
    <Comparison currency={usdCurrency} quoteColor="green-up-red-down" />
  </DataChangedContext.Provider>;
  const dayCell = (day: string) => [...document.querySelectorAll("button")]
    .filter((button) => button.textContent?.trim() === day);

  it("keeps the selected pair when the data version changes", async () => {
    vi.mocked(queryCoinDataByUUID).mockResolvedValue([]);
    vi.mocked(queryAllDataDates).mockResolvedValue(twoSnapshots as never);
    const view = render(atVersion(0));
    await waitFor(() => expect(screen.getByRole("button", { name: /head date/i })).toHaveTextContent("2024-04-16"));

    vi.mocked(queryAllDataDates).mockResolvedValue(threeSnapshots as never);
    vi.mocked(queryCoinDataByUUID).mockClear();
    view.rerender(atVersion(1));

    await waitFor(() => expect(queryAllDataDates).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(screen.getByRole("button", { name: /base date/i })).toHaveTextContent("2024-04-15");
    expect(screen.getByRole("button", { name: /head date/i })).toHaveTextContent("2024-04-16");
  });

  it("reloads the pair and reports loaded after the data version changes", async () => {
    vi.mocked(queryCoinDataByUUID).mockResolvedValue([]);
    vi.mocked(queryAllDataDates).mockResolvedValue(twoSnapshots as never);
    const view = render(atVersion(0));
    await waitFor(() => expect(screen.getByRole("button", { name: /head date/i })).toHaveTextContent("2024-04-16"));

    vi.mocked(queryAllDataDates).mockResolvedValue(threeSnapshots as never);
    vi.mocked(queryCoinDataByUUID).mockClear();
    view.rerender(atVersion(1));

    await waitFor(() => expect(queryCoinDataByUUID).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(document.querySelector(".analyze-comparison")).toHaveAttribute("data-state", "loaded");
  });

  it("offers a snapshot added by a data change in the head date picker", async () => {
    const user = userEvent.setup();
    vi.mocked(queryCoinDataByUUID).mockResolvedValue([]);
    vi.mocked(queryAllDataDates).mockResolvedValue(twoSnapshots as never);
    const view = render(atVersion(0));
    await waitFor(() => expect(screen.getByRole("button", { name: /head date/i })).toHaveTextContent("2024-04-16"));
    await user.click(screen.getByRole("button", { name: /head date/i }));
    expect(dayCell("16").some((cell) => !cell.disabled)).toBe(true);
    expect(dayCell("17").every((cell) => cell.disabled)).toBe(true);

    vi.mocked(queryAllDataDates).mockResolvedValue(threeSnapshots as never);
    view.rerender(atVersion(1));

    await waitFor(() => expect(dayCell("17").some((cell) => !cell.disabled)).toBe(true));
  });
});
