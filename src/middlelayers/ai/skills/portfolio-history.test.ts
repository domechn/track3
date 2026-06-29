import { beforeEach, describe, expect, it, vi } from "vitest";
import skill from "./portfolio-history";
import { ASSET_HANDLER } from "../../entities/assets";

vi.mock("../../entities/assets", () => ({
  ASSET_HANDLER: {
    listTotalValueRecords: vi.fn(),
  },
}));

const baseCurrency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("portfolio_history skill", () => {
  it("returns empty when no records match", async () => {
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([]);
    const result = await skill.run({}, { baseCurrency });
    expect((result.data as any).empty).toBe(true);
    expect(result.chart).toBeUndefined();
  });

  it("returns downsampled timeline and chart", async () => {
    const records = Array.from({ length: 200 }, (_, i) => ({
      uuid: `u${i}`,
      createdAt: new Date(`2026-01-01T00:00:00Z`).getTime() + i * 24 * 60 * 60 * 1000,
      totalValue: 1000 + i * 10,
    }));
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue(records as any);

    const result = await skill.run({ maxPoints: 50 }, { baseCurrency });
    const data = result.data as any;
    expect(data.points.length).toBeLessThanOrEqual(50);
    expect(data.summary.endValue - data.summary.startValue).toBeGreaterThan(0);
    expect(result.chart?.type).toBe("line");
  });

  it("clamps maxPoints to a sane range", async () => {
    const records = Array.from({ length: 5 }, (_, i) => ({
      uuid: `u${i}`,
      createdAt: new Date(`2026-01-0${i + 1}T00:00:00Z`),
      totalValue: 100 + i,
    }));
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue(records as any);
    const result = await skill.run({ maxPoints: 9999 }, { baseCurrency });
    const data = result.data as any;
    expect(data.points).toHaveLength(5);
  });
});
  it("filters by date range", async () => {
    const records = [
      { uuid: "u1", createdAt: new Date("2025-01-01T00:00:00Z"), totalValue: 1000 },
      { uuid: "u2", createdAt: new Date("2025-06-01T00:00:00Z"), totalValue: 1100 },
      { uuid: "u3", createdAt: new Date("2026-01-01T00:00:00Z"), totalValue: 1200 },
      { uuid: "u4", createdAt: new Date("2026-06-01T00:00:00Z"), totalValue: 1300 },
    ];
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockImplementation(
      async (start?: Date, end?: Date) => {
        let filtered = records;
        if (start) filtered = filtered.filter((r) => r.createdAt >= start);
        if (end) filtered = filtered.filter((r) => r.createdAt <= end);
        return filtered.filter((r) => {
          if (start && r.createdAt < start) return false;
          if (end && r.createdAt > end) return false;
          return true;
        });
      },
    );

    const result = await skill.run(
      { from: "2025-06-01T00:00:00Z", to: "2026-01-01T00:00:00Z" },
      { baseCurrency },
    );
    const data = result.data as any;
    expect(data.points.length).toBeGreaterThanOrEqual(2);
    expect(result.chart?.type).toBe("line");
  });

  it("handles invalid date arguments gracefully", async () => {
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([]);
    const result = await skill.run(
      { from: "not-a-date", to: "also-not-a-date" },
      { baseCurrency },
    );
    expect((result.data as any).empty).toBe(true);
  });

  it("returns a chart only when there are data points", async () => {
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([]);
    const result = await skill.run({}, { baseCurrency });
    expect(result.chart).toBeUndefined();
  });

  it("converts values into the base currency rate", async () => {
    const records = [
      { uuid: "u1", createdAt: new Date("2026-01-01T00:00:00Z"), totalValue: 1000 },
    ];
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue(records as any);

    const result = await skill.run(
      {},
      { baseCurrency: { ...baseCurrency, currency: "EUR", rate: 0.85 } },
    );
    const data = result.data as any;
    expect(data.points[0].value).toBe(850);
    expect(data.summary.startValue).toBe(850);
  });

