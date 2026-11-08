import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { queryAllDataDates, queryAssetsByUUIDs } from "@/middlelayers/charts";
import { useOverviewTopMover } from "./overview-top-mover";

vi.mock("@/middlelayers/charts", () => ({
  queryAllDataDates: vi.fn(),
  queryAssetsByUUIDs: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

it("uses the previous daily close to find the selected day's largest asset mover", async () => {
  const date = (id: string, createdAt: string) => ({ id, date: createdAt.slice(0, 10), createdAt });
  const asset = (uuid: string, symbol: string, value: number) => ({
    id: 1, uuid, createdAt: "2026-11-08T18:00:00Z", assetType: "crypto" as const,
    symbol, amount: 1, value, price: value,
  });
  vi.mocked(queryAllDataDates).mockResolvedValue([
    date("first", "2026-11-06T22:00:00Z"),
    date("previous", "2026-11-07T22:00:00Z"),
    date("morning", "2026-11-08T08:00:00Z"),
    date("selected", "2026-11-08T18:00:00Z"),
  ]);
  vi.mocked(queryAssetsByUUIDs).mockResolvedValue([
    asset("previous", "USDT", 100), asset("selected", "USDT", 125),
    asset("previous", "BTC", 20), asset("selected", "BTC", 5),
  ]);

  const { result } = renderHook(() => useOverviewTopMover(
    Date.parse("2026-11-08T10:00:00Z"), Date.parse("2026-11-06T00:00:00Z")));
  await waitFor(() => expect(result.current).toEqual({ symbol: "USDT", value: 25 }));
  expect(queryAssetsByUUIDs).toHaveBeenCalledWith(["previous", "selected"]);
});

it("does not invent a mover when there is no prior day", async () => {
  vi.mocked(queryAllDataDates).mockResolvedValue([
    { id: "first", date: "2026-11-08", createdAt: "2026-11-08T18:00:00Z" },
  ]);
  const { result } = renderHook(() => useOverviewTopMover(
    Date.parse("2026-11-08T10:00:00Z"), Date.parse("2026-11-08T00:00:00Z")));
  await waitFor(() => expect(queryAllDataDates).toHaveBeenCalled());
  expect(result.current).toBeUndefined();
  expect(queryAssetsByUUIDs).not.toHaveBeenCalled();
});
