import { beforeEach, describe, expect, it, vi } from "vitest";
import { setBaseCurrency } from "../pi-agent";
import skill from "./portfolio-history";
import { ASSET_HANDLER } from "../../entities/assets";

vi.mock("../../entities/assets", () => ({
  ASSET_HANDLER: { listTotalValueRecords: vi.fn() },
}));

const baseCurrency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

beforeEach(() => { vi.clearAllMocks(); setBaseCurrency(baseCurrency); });

describe("portfolio_history skill", () => {
  it("returns empty when no records match", async () => {
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([]);
    const result = await skill.execute("test", {}, undefined, undefined, {} as any);
    expect((result.details.data as any).empty).toBe(true);
    expect(result.details.chart).toBeUndefined();
  });

  it("returns downsampled timeline and chart", async () => {
    const records = Array.from({ length: 200 }, (_, i) => ({
      uuid: `u${i}`, createdAt: new Date("2026-01-01T00:00:00Z").getTime() + i * 86400000, totalValue: 1000 + i * 10,
    }));
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue(records as any);
    const result = await skill.execute("test", { maxPoints: 50 }, undefined, undefined, {} as any);
    const data = result.details.data as any;
    expect(data.points.length).toBeLessThanOrEqual(50);
    expect(data.summary.endValue - data.summary.startValue).toBeGreaterThan(0);
    expect(result.details.chart?.type).toBe("line");
  });

  it("clamps maxPoints to a sane range", async () => {
    const records = Array.from({ length: 5 }, (_, i) => ({
      uuid: `u${i}`, createdAt: new Date(`2026-01-0${i + 1}T00:00:00Z`), totalValue: 100 + i,
    }));
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue(records as any);
    const result = await skill.execute("test", { maxPoints: 9999 }, undefined, undefined, {} as any);
    const data = result.details.data as any;
    expect(data.points).toHaveLength(5);
  });
});
