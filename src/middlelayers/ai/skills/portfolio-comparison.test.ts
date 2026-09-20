import { beforeEach, describe, expect, it, vi } from "vitest";
import skill from "./portfolio-comparison";
import { ASSET_HANDLER } from "../../entities/assets";

vi.mock("../../entities/assets", () => ({
  ASSET_HANDLER: {
    listTotalValueRecords: vi.fn(),
    listAssetsByUUIDs: vi.fn(),
  },
}));

const baseCurrency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

const snapshots = [
  { uuid: "s1", createdAt: "2026-06-20T00:00:00.000Z", totalValue: 1000 },
  { uuid: "s2", createdAt: "2026-07-05T00:00:00.000Z", totalValue: 1100 },
  { uuid: "s3", createdAt: "2026-07-20T00:00:00.000Z", totalValue: 1200 },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-20T12:00:00.000Z"));
  vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue(snapshots as any);
  vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockImplementation(async (uuids: string[]) =>
    uuids.map((uuid) => ({
      id: 1, uuid, createdAt: "", assetType: "crypto", symbol: "BTC", amount: 1,
      value: snapshots.find((s) => s.uuid === uuid)!.totalValue, price: 1,
    })) as any,
  );
});

describe("portfolio_comparison skill", () => {
  it("accepts plain ISO strings for both sides", async () => {
    const result = await skill.run(
      { left: "2026-06-20", right: "2026-07-20" },
      { baseCurrency },
    );
    const data = result.data as any;
    expect(data.left.uuid).toBe("s1");
    expect(data.right.uuid).toBe("s3");
    expect(data.totalDeltaPct).toBeCloseTo(20);
  });

  it("accepts relative day offsets and defaults right to latest", async () => {
    const result = await skill.run({ left: "30 days ago" }, { baseCurrency });
    const data = result.data as any;
    expect(data.left.uuid).toBe("s1");
    expect(data.right.uuid).toBe("s3");
  });

  it("accepts daysAgo objects and 'latest'", async () => {
    const result = await skill.run(
      { left: { daysAgo: 15 }, right: { date: "latest" } },
      { baseCurrency },
    );
    const data = result.data as any;
    expect(data.left.uuid).toBe("s2");
    expect(data.right.uuid).toBe("s3");
  });

  it("still fails clearly on garbage input", async () => {
    const result = await skill.run({ left: "sometime", right: "later" }, { baseCurrency });
    expect((result.data as any).error).toBeTruthy();
  });

  it("treats a bare number as days ago and an empty right as latest", async () => {
    const a = await skill.run({ left: 15, right: "" }, { baseCurrency });
    expect((a.data as any).left.uuid).toBe("s2");
    expect((a.data as any).right.uuid).toBe("s3");
  });
});
