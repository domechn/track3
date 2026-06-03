import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
  vi.mocked(updateAllCurrencyRates).mockResolvedValue(undefined);
  vi.mocked(refreshAllData).mockResolvedValue(undefined);
  vi.mocked(getMemoryCacheInstance).mockReturnValue({
    clearCache: vi.fn(),
  } as never);
});

describe("RefreshData — currency rates refresh ordering", () => {
  it("calls updateAllCurrencyRates before refreshAllData on button click", async () => {
    const callOrder: string[] = [];
    vi.mocked(updateAllCurrencyRates).mockImplementation(async () => {
      callOrder.push("updateAllCurrencyRates");
    });
    vi.mocked(refreshAllData).mockImplementation(async () => {
      callOrder.push("refreshAllData");
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
});
