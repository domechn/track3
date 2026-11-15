import { act, fireEvent, render, screen } from "@testing-library/react";
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

it("lets the price query reuse its cache on each phone poll", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.mocked(queryRealTimeAssetsValue).mockResolvedValue([{ value: 100 }] as never);
  const callCount = vi.mocked(queryRealTimeAssetsValue).mock.calls.length;
  render(<MobileHeaderTotal live currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }} />);
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  const calls = vi.mocked(queryRealTimeAssetsValue).mock.calls.slice(callCount);
  expect(calls.length).toBeGreaterThanOrEqual(2);
  expect(calls.every((args) => args.length === 0)).toBe(true);
});

it("shows the bolt and label while the first Pro value connects", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.mocked(queryRealTimeAssetsValue).mockImplementation(() => new Promise(() => {}));
  render(<MobileHeaderTotal live fidelity currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }} />);
  expect(screen.getByLabelText("Live total")).toHaveTextContent("Live total");
  expect(screen.getByTestId("mobile-live-bolt")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Live total, Connecting");
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
  await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
  expect(screen.getByLabelText("Total")).toHaveTextContent("$42");
});

it("shows the live reason on phone and retries the quote query now", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(queryLatestAssets).mockResolvedValue([{ value: 90 }] as never);
  vi.mocked(queryRealTimeAssetsValue).mockRejectedValueOnce(new Error("CoinGecko 429 private123"))
    .mockResolvedValueOnce([{ symbol: "ETH", assetType: "crypto", amount: 1, price: 120, value: 120 }]);
  render(<MobileHeaderTotal live fidelity
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }} />);
  await act(async () => { await Promise.resolve(); });
  expect(JSON.stringify(log.mock.calls)).toContain("Price service rate limited (HTTP 429)");
  expect(JSON.stringify(log.mock.calls)).not.toContain("private123");
  fireEvent.click(screen.getByRole("button", { name: /Live total.*Live prices/ }));
  expect(screen.getByText("Price service rate limited")).toBeVisible();
  const beforeRetry = vi.mocked(queryRealTimeAssetsValue).mock.calls.length;
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Retry now" }));
    await Promise.resolve();
  });
  expect(screen.getByLabelText("Live total")).toHaveTextContent("$120");
  expect(queryRealTimeAssetsValue).toHaveBeenCalledTimes(beforeRetry + 1);
});

it("marks a phone total partial while preserving its known amount", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.mocked(queryRealTimeAssetsValue).mockResolvedValue(Object.assign(
    [{ symbol: "ETH", assetType: "crypto" as const, amount: 1, price: 120, value: 120 }],
    { partial: true, reason: "pricesMissing" as const, missingCount: 2 },
  ));
  render(<MobileHeaderTotal live fidelity
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }} />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByLabelText("Live total")).toHaveTextContent("$120");
  expect(screen.getByLabelText("Live total")).toHaveTextContent("Partial data");
});

it("does not turn a failed live quote into zero when no snapshot exists", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(queryRealTimeAssetsValue).mockRejectedValue(new Error("CoinGecko 429"));
  vi.mocked(queryLatestAssets).mockResolvedValue([]);
  render(<MobileHeaderTotal live fidelity
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }} />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByLabelText("Live total")).not.toHaveTextContent("$0");
  fireEvent.click(screen.getByRole("button", { name: /Live total.*Live prices/ }));
  expect(screen.getByText("Price service rate limited")).toBeVisible();
});
