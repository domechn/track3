import { describe, expect, it } from "vitest";
import { hourlyHistory } from "@/test/history-fixtures";
import { downsampleIndices } from "./chart-downsample";

describe("chart downsampling", () => {
  it("bounds plotted points and keeps endpoints and extremes", () => {
    const values = Array.from({ length: 2000 }, (_, index) => index % 10);
    values[947] = -1000;
    values[1202] = 5000;
    const indices = downsampleIndices([values], 120);
    expect(indices.length).toBeLessThanOrEqual(120);
    expect(indices[0]).toBe(0);
    expect(indices.at(-1)).toBe(1999);
    expect(indices).toContain(947);
    expect(indices).toContain(1202);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it("keeps extremes from aligned series and leaves short inputs intact", () => {
    const a = Array.from({ length: 1000 }, (_, i) => i);
    const b = a.map(() => 10);
    b[416] = 10000;
    const indices = downsampleIndices([a, b], 80);
    expect(indices).toContain(416);
    expect(indices).toContain(0);
    expect(indices).toContain(999);
    expect(downsampleIndices([a.slice(0, 3)], 80)).toEqual([0, 1, 2]);
  });

  it("bounds an hourly three-year chart without changing the source", () => {
    const totals = Array.from(hourlyHistory(), (snapshot) =>
      snapshot.assets.reduce((sum, asset) => sum + asset.value, 0),
    );
    const last = totals.at(-1);
    expect(downsampleIndices([totals], 600)).toHaveLength(600);
    expect(totals.at(-1)).toBe(last);
  });
});
