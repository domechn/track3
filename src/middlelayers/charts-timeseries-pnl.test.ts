import { expect, it, vi } from "vitest";
import { queryPNLTableValue } from "./charts-timeseries";
import { ASSET_HANDLER } from "./entities/assets";

vi.mock("./entities/assets", () => ({
  ASSET_HANDLER: { listSymbolGroupedAssets: vi.fn() },
}));

it("uses 1, 7, and 30 refresh intervals for PnL values", async () => {
  // 32 snapshots: 100, 110, ..., 410. Seven back is 340; thirty back is 110.
  vi.mocked(ASSET_HANDLER.listSymbolGroupedAssets).mockResolvedValue(
    Array.from({ length: 32 }, (_, index) => [{
      value: 410 - index * 10,
      createdAt: new Date(Date.UTC(2024, 0, 31 - index)).toISOString(),
    }]) as Awaited<ReturnType<typeof ASSET_HANDLER.listSymbolGroupedAssets>>,
  );
  const result = await queryPNLTableValue();
  expect(result.latestTotalValue).toBe(410);
  expect(result.todayPNL?.value).toBe(10);
  expect(result.sevenTPnl?.value).toBe(70);
  expect(result.thirtyPNL?.value).toBe(300);
});
