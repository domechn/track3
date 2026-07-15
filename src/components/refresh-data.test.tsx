import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RefreshData from "@/components/refresh-data";
import { refreshAllData } from "@/middlelayers/charts";
import { updateAllCurrencyRates } from "@/middlelayers/configuration";
import { getMemoryCacheInstance } from "@/middlelayers/datafetch/utils/cache";

// Hoist mock fn references so they're available inside vi.mock factories
const mockSetButtonLoading = vi.hoisted(() => vi.fn());
const mockSetProgress = vi.hoisted(() => vi.fn());

vi.mock("@/components/index/index", async () => {
  const { createContext } = await import("react");
  return {
    RefreshButtonLoadingContext: createContext({
      buttonLoading: false,
      setButtonLoading: mockSetButtonLoading,
      progress: 0,
      setProgress: mockSetProgress,
    }),
  };
});

vi.mock("@/middlelayers/charts", () => ({
  refreshAllData: vi.fn(),
}));

vi.mock("@/middlelayers/configuration", () => ({
  updateAllCurrencyRates: vi.fn(),
}));

vi.mock("@/middlelayers/datafetch/utils/cache", () => ({
  getMemoryCacheInstance: vi.fn(),
}));

vi.mock("@/utils/app", () => ({
  trackEventWithClientID: vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(updateAllCurrencyRates).mockResolvedValue(undefined as never);
  vi.mocked(refreshAllData).mockResolvedValue({
    failedSources: [],
    requiresDataSourceAction: false,
    usedLastKnownData: false,
  } as never);
  vi.mocked(getMemoryCacheInstance).mockReturnValue({
    clearCache: vi.fn(),
  } as never);
});

describe("RefreshData — currency rates refresh ordering", () => {
  it("calls updateAllCurrencyRates before refreshAllData on button click", async () => {
    const callOrder: string[] = [];
    vi.mocked(updateAllCurrencyRates).mockImplementation(async () => {
      callOrder.push("updateAllCurrencyRates");
      return undefined as never;
    });
    vi.mocked(refreshAllData).mockImplementation(async () => {
      callOrder.push("refreshAllData");
      return {
        failedSources: [],
        requiresDataSourceAction: false,
        usedLastKnownData: false,
      } as never;
    });

    const user = userEvent.setup();
    render(<RefreshData loading={false} />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(callOrder).toEqual(["updateAllCurrencyRates", "refreshAllData"]);
    });
  });

  it("still calls refreshAllData when updateAllCurrencyRates rejects", async () => {
    vi.mocked(updateAllCurrencyRates).mockRejectedValue(
      new Error("network error"),
    );

    const user = userEvent.setup();
    render(<RefreshData loading={false} />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(refreshAllData).toHaveBeenCalledTimes(1);
    });
  });

  it("invokes afterRefresh(true) when the full refresh sequence succeeds", async () => {
    const afterRefresh = vi.fn();
    const user = userEvent.setup();
    render(<RefreshData loading={false} afterRefresh={afterRefresh} />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(afterRefresh).toHaveBeenCalledWith(true);
    });
  });

  it("asks the user whether to retry or use last data when a data source fails", async () => {
    const user = userEvent.setup();
    vi.mocked(refreshAllData).mockResolvedValueOnce({
      failedSources: [
        {
          analyzerName: "Stock Analyzer",
          walletIdentities: ["ibkr:query-1"],
          error: "IBKR maintenance",
        },
      ],
      requiresDataSourceAction: true,
      usedLastKnownData: false,
    } as never);

    render(<RefreshData loading={false} />);

    await user.click(screen.getByRole("button"));

    expect(
      await screen.findByText("Some data sources failed to load"),
    ).toBeTruthy();
    expect(screen.getByText(/Stock Analyzer/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry All" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use Last Data" })).toBeTruthy();
  });

  it("retries the whole refresh from the data source failure dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(refreshAllData)
      .mockResolvedValueOnce({
        failedSources: [
          {
            analyzerName: "Stock Analyzer",
            walletIdentities: ["ibkr:query-1"],
            error: "IBKR maintenance",
          },
        ],
        requiresDataSourceAction: true,
        usedLastKnownData: false,
      } as never)
      .mockResolvedValueOnce({
        failedSources: [],
        requiresDataSourceAction: false,
        usedLastKnownData: false,
      } as never);

    render(<RefreshData loading={false} />);

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByRole("button", { name: "Retry All" }));

    await waitFor(() => {
      expect(refreshAllData).toHaveBeenCalledTimes(2);
    });
    expect(refreshAllData).toHaveBeenLastCalledWith(
      expect.any(Function),
      {
        useLastKnownDataForFailedSources: false,
      },
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("reruns refresh with last-known data enabled from the data source failure dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(refreshAllData)
      .mockResolvedValueOnce({
        failedSources: [
          {
            analyzerName: "Stock Analyzer",
            walletIdentities: ["ibkr:query-1"],
            error: "IBKR maintenance",
          },
        ],
        requiresDataSourceAction: true,
        usedLastKnownData: false,
      } as never)
      .mockResolvedValueOnce({
        failedSources: [
          {
            analyzerName: "Stock Analyzer",
            walletIdentities: ["ibkr:query-1"],
            error: "IBKR maintenance",
          },
        ],
        requiresDataSourceAction: false,
        usedLastKnownData: true,
      } as never);

    render(<RefreshData loading={false} />);

    await user.click(screen.getByRole("button"));
    await user.click(
      await screen.findByRole("button", { name: "Use Last Data" }),
    );

    await waitFor(() => {
      expect(refreshAllData).toHaveBeenCalledTimes(2);
    });
    expect(refreshAllData).toHaveBeenLastCalledWith(
      expect.any(Function),
      {
        useLastKnownDataForFailedSources: true,
      },
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("passes automatic retries into one refresh operation call", async () => {
    vi.useFakeTimers();
    try {
      let persistenceAttempts = 0;
      vi.mocked(refreshAllData).mockImplementation(
        async (_addProgress, _options, _operation, retry) => {
          await retry!(async () => {
            persistenceAttempts += 1;
            if (persistenceAttempts === 1) {
              throw new Error("temporary failure");
            }
          });
          return {
            failedSources: [],
            requiresDataSourceAction: false,
            usedLastKnownData: false,
          } as never;
        },
      );

      render(<RefreshData loading={false} />);

      act(() => {
        screen.getByRole("button").click();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(refreshAllData).toHaveBeenCalledTimes(1);
      expect(persistenceAttempts).toBe(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(refreshAllData).toHaveBeenCalledTimes(1);
      expect(persistenceAttempts).toBe(2);
      expect(refreshAllData).toHaveBeenCalledWith(
        expect.any(Function),
        {
          useLastKnownDataForFailedSources: false,
        },
        {
          operationUuid: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
          ),
        },
        expect.any(Function),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("forwards refresh progress as absolute values across query retries", async () => {
    vi.mocked(refreshAllData).mockImplementation(async (setProgress) => {
      setProgress(75);
      setProgress(0);
      setProgress(90);
      setProgress(100);
      return {
        failedSources: [],
        requiresDataSourceAction: false,
        usedLastKnownData: false,
      } as never;
    });

    const user = userEvent.setup();
    render(<RefreshData loading={false} />);
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(refreshAllData).toHaveBeenCalledOnce();
      expect(mockSetProgress).toHaveBeenCalledTimes(6);
    });
    expect(mockSetProgress.mock.calls.map(([value]) => value)).toEqual([
      0,
      75,
      0,
      90,
      100,
      0,
    ]);
  });
});
