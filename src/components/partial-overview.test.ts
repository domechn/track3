import { expect, it, vi } from "vitest";
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import PartialOverview, { chartBounds, resolvePartialSourceLabel } from "./partial-overview";

vi.mock("@/middlelayers/license", () => ({
  LicenseCenter: { getInstance: () => ({ getUsage: () => Promise.resolve({
    enforced: true,
    usage: {
      erc20: { limit: 50, used: 50, remaining: 0, periodStart: "2026-10-01", periodEnd: "2026-11-01" },
      tron: { limit: 300, used: 8, remaining: 292, periodStart: "2026-10-01", periodEnd: "2026-11-01" },
    },
  }) }) },
}));

it("shows quota usage and plan navigation without offering a retry", async () => {
  render(createElement(PartialOverview, {
    view: { at: "2026-10-31T09:41:00Z", sourcesTotal: 5, lastGoodAt: "2026-10-30T21:14:00Z",
      source: { wallet: "0x4f…a91c", kind: "wallet", provider: "ETH" },
      included: [], lastGood: [], points: [] },
    statuses: [{ sourceId: "erc20:0", label: "0x4f…a91c", kind: "wallet", provider: "ETH",
      status: "failed", category: "quota", lastSuccessAt: "2026-10-30T21:14:00Z" }],
    currency: { currency: "USD", symbol: "$", rate: 1, alias: "USD" },
    bannerOnly: true,
  }));
  expect(await screen.findByText("50 of 50 ERC20 refreshes used this month; the count resets on 1 Nov.", { exact: false })).toBeVisible();
  expect(screen.getByText("0x4f…a91c not refreshed: Pro limit reached. Totals exclude 0x4f…a91c.")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Manage plan" }));
  expect(window.location.hash).toBe("#/settings/systemInfo");
  window.location.hash = "";
});

it("shows the named failed source instead of its persisted wallet hash", () => {
  const wallet = "ddf7fe606e048ac89f8a8c62bf23c4be";
  expect(resolvePartialSourceLabel({ wallet, kind: "exchange", provider: "OKX" }, [
    { sourceId: "okx:0", label: "OKX trading", kind: "exchange", provider: "OKX", status: "stale" },
  ])).toBe("OKX trading");
  expect(resolvePartialSourceLabel({ wallet, kind: "wallet", provider: "BTC" }, [
    { sourceId: "btc:0", label: "First BTC wallet", kind: "wallet", provider: "BTC", status: "stale" },
    { sourceId: "btc:1", label: "Second BTC wallet", kind: "wallet", provider: "BTC", status: "stale" },
  ])).toBe("BTC");
});

it("scales a long real history from its values without a fixed sample range", () => {
  const points = Array.from({ length: 100_000 }, (_, index) => ({
    timestamp: index, totalValue: index % 2 ? 731_000 : 763_000,
  }));
  expect(chartBounds(points)).toEqual({ low: 700_000, high: 780_000 });
  expect(chartBounds([{ timestamp: 0, totalValue: 42_000 }])).toEqual({ low: 20_000, high: 60_000 });
  const small = chartBounds([
    { timestamp: 0, totalValue: 5_000 },
    { timestamp: 1, totalValue: 5_200 },
  ]);
  expect(small.low).toBeGreaterThan(4_000);
  expect(small.high).toBeLessThan(6_000);
});

it("does not claim a last-known value when no complete snapshot exists", () => {
  render(createElement(PartialOverview, {
    view: { at: "2026-10-31T09:41:00Z", sourcesTotal: 5,
      source: { wallet: "OKX", kind: "exchange", provider: "OKX" },
      included: [], lastGood: [], points: [] },
    statuses: [{ sourceId: "okx", label: "OKX", kind: "exchange", provider: "OKX",
      status: "failed", lastSuccessAt: "2026-10-30T21:14:00Z" }],
    currency: { currency: "USD", symbol: "$", rate: 1, alias: "USD" },
  }));
  expect(screen.getByRole("button", { name: "Use last known values" })).toBeDisabled();
  expect(screen.getAllByText(/No complete snapshot is available for OKX/)).toHaveLength(2);
  expect(screen.getAllByText(/0 of 5 sources/).length).toBeGreaterThan(0);
});

it("shows evenly spaced dates along a complete partial-history line", () => {
  render(createElement(PartialOverview, {
    view: { at: "2026-10-31T09:41:00Z", sourcesTotal: 1,
      source: { wallet: "OKX", kind: "exchange", provider: "OKX" },
      included: [], lastGood: [],
      points: Array.from({ length: 30 }, (_, index) => ({
        timestamp: Date.parse("2026-10-01T09:41:00Z") + index * 86400000,
        totalValue: 700_000 + index * 1000,
      })) },
    statuses: [{ sourceId: "okx", label: "OKX", status: "failed" }],
    currency: { currency: "USD", symbol: "$", rate: 1, alias: "USD" },
  }));
  expect(document.querySelector(".t3-flow-chart-dates")?.children).toHaveLength(7);
  expect(document.querySelector(".t3-flow-chart-dates")).toHaveTextContent("1 Oct");
  expect(document.querySelector(".t3-flow-chart-dates")).toHaveTextContent("30 Oct");
});
