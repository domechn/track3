import { expect, it, vi } from "vitest";
import { queryTotalValue } from "./charts-assets";
import { ASSET_HANDLER } from "./entities/assets";
import { isSnapshotPartial, snapshotExclusionOptions } from "./snapshot-partial";

vi.mock("./entities/assets", () => ({
  ASSET_HANDLER: { listTotalValueRecords: vi.fn(), listSymbolGroupedAssets: vi.fn() },
}));
vi.mock("./snapshot-partial", () => ({ isSnapshotPartial: vi.fn(), snapshotExclusionOptions: vi.fn() }));

it("keeps the stored total but marks it partial for Overview", async () => {
  vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([
    { uuid: "partial-1", createdAt: new Date("2026-01-01"), totalValue: 1000 },
  ]);
  vi.mocked(isSnapshotPartial).mockResolvedValue(true);
  vi.mocked(snapshotExclusionOptions).mockResolvedValue([{ provider: "OKX", value: 300 }]);
  const range = { start: new Date("2026-01-01"), end: new Date("2026-01-02") };
  expect(await queryTotalValue(range)).toEqual({
    totalValue: 1000, partial: true, excludedSources: [{ provider: "OKX", value: 300 }],
  });
});
