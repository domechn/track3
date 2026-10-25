import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { queryLatestAssets, queryRealTimeAssetsValue, queryTotalValue } from "@/middlelayers/charts";
import { MobileHeaderTotal } from "@/mobile/components/mobile/header-total";

vi.mock("@/middlelayers/charts", () => ({
  queryLatestAssets: vi.fn(),
  queryRealTimeAssetsValue: vi.fn(),
  queryTotalValue: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("uses the selected period for the compact Overview total", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.mocked(queryTotalValue).mockResolvedValue({ totalValue: 68056.33 });
  vi.mocked(queryLatestAssets).mockResolvedValue([]);
  render(<MobileHeaderTotal live={false} range={{ start: new Date("2026-08-24"), end: new Date("2026-10-22") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }} />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByLabelText("Total")).toHaveTextContent("$68,056.33");
  expect(queryLatestAssets).not.toHaveBeenCalled();
});

it("updates the Pro header total when live portfolio prices change", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.mocked(queryLatestAssets).mockResolvedValue([]);
  vi.mocked(queryRealTimeAssetsValue)
    .mockResolvedValueOnce([{ value: 100 }] as never)
    .mockResolvedValueOnce([{ value: 120 }] as never);
  render(<MobileHeaderTotal live currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }} />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByLabelText("Total")).toHaveTextContent("$100");
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(screen.getByLabelText("Total")).toHaveTextContent("$120");
});

it("pauses live price queries while the app is hidden and resumes on return", async () => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.mocked(queryRealTimeAssetsValue).mockResolvedValue([{ value: 100 }] as never);
  render(<MobileHeaderTotal live currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }} />);
  await act(async () => { await Promise.resolve(); });
  expect(queryRealTimeAssetsValue).toHaveBeenCalledTimes(1);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
  expect(queryRealTimeAssetsValue).toHaveBeenCalledTimes(1);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); await Promise.resolve(); });
  expect(queryRealTimeAssetsValue).toHaveBeenCalledTimes(2);
});

it("keeps the last header total when a later live query fails", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.mocked(queryLatestAssets).mockRejectedValue(new Error("offline"));
  vi.mocked(queryRealTimeAssetsValue)
    .mockResolvedValueOnce([{ value: 100 }] as never)
    .mockRejectedValueOnce(new Error("offline"));
  render(<MobileHeaderTotal live currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }} />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByLabelText("Total")).toHaveTextContent("$100");
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(screen.getByLabelText("Total")).toHaveTextContent("$100");
});

it("retries an initial header total query failure", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.mocked(queryTotalValue)
    .mockRejectedValueOnce(new Error("temporarily unavailable"))
    .mockResolvedValueOnce({ totalValue: 42 });
  render(<MobileHeaderTotal live={false} range={{ start: new Date("2026-08-24"), end: new Date("2026-10-22") }}
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }} />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByLabelText("Total")).toHaveTextContent("—");
  await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
  expect(screen.getByLabelText("Total")).toHaveTextContent("$42");
});
