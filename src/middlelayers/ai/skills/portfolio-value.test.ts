import { beforeEach, expect, it, vi } from "vitest";
import skill from "./portfolio-value";
import { ASSET_HANDLER } from "../../entities/assets";
import { isSnapshotPartial, partialSnapshotIds } from "../../snapshot-partial";

vi.mock("../../entities/assets", () => ({
  ASSET_HANDLER: { listTotalValueRecords: vi.fn(), listAssetsByUUIDs: vi.fn() },
}));
vi.mock("../../snapshot-partial", () => ({ isSnapshotPartial: vi.fn(), partialSnapshotIds: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([
    { uuid: "s1", createdAt: "2026-07-20T00:00:00.000Z", totalValue: 1000 },
  ] as never);
  vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([
    { uuid: "s1", assetType: "crypto", symbol: "BTC", amount: 1, value: 1000, price: 1000 },
  ] as never);
});

it("tells the assistant that a stored latest total includes carried values", async () => {
  vi.mocked(isSnapshotPartial).mockResolvedValue(true);
  const result = await skill.run({}, { baseCurrency: { currency: "USD", rate: 1, alias: "USD", symbol: "$" } });
  expect(result.data).toMatchObject({ valueUsd: 1000, partial: true });
  expect(result.text).toContain("partial");
});

it("labels partial totals in a requested timeline", async () => {
  vi.mocked(partialSnapshotIds).mockResolvedValue(new Set(["s1"]));
  const result = await skill.run({ from: "2026-07-19", to: "2026-07-21" },
    { baseCurrency: { currency: "USD", rate: 1, alias: "USD", symbol: "$" } });
  expect(result.data).toMatchObject({ points: [{ valueUsd: 1000, partial: true }], summary: { partial: true } });
  expect(result.text).toContain("partial");
});
