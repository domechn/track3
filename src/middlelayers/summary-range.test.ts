import { describe, expect, it } from "vitest";
import { selectSummaryRange, summaryPresetRange } from "./summary-range";

const at = (day: number) => new Date(`2026-04-${String(day).padStart(2, "0")}T12:00:00.000Z`);
const dates = [at(1), at(5), at(9)];

describe("summary range baseline", () => {
  it("uses the previous snapshot for 1D with three snapshots", () => {
    expect(selectSummaryRange(dates, { start: at(9), end: at(9) })).toMatchObject({
      baseline: at(5), snapshots: [at(9)], databaseCount: 3,
    });
  });
  it("uses the previous snapshot even when it is days earlier", () => {
    expect(selectSummaryRange([at(1), at(9)], { start: at(9), end: at(9) }).baseline).toEqual(at(1));
  });
  it("accepts a custom single-day range", () => {
    expect(selectSummaryRange(dates, {
      start: new Date("2026-04-05T00:00:00.000Z"),
      end: new Date("2026-04-05T23:59:59.999Z"),
    })).toMatchObject({ baseline: at(1), snapshots: [at(5)] });
  });
  it("uses the first snapshot as the All baseline", () => {
    expect(selectSummaryRange(dates, { start: at(1), end: at(9) })).toMatchObject({
      baseline: at(1), snapshots: dates,
    });
  });
  it("requires a second database snapshot", () => {
    expect(selectSummaryRange([at(1)], { start: at(1), end: at(1) })).toMatchObject({
      baseline: undefined, snapshots: [at(1)], databaseCount: 1,
    });
    expect(selectSummaryRange([], { start: at(1), end: at(9) })).toMatchObject({
      baseline: undefined, snapshots: [], databaseCount: 0,
    });
  });
  it("uses the latest prior date after gaps and edits", () => {
    expect(selectSummaryRange([at(9), at(1), at(5), at(5)], { start: at(9), end: at(9) })).toMatchObject({
      baseline: at(5), snapshots: [at(9)], databaseCount: 3,
    });
  });
  it("makes 1D exactly the latest snapshot even when multiple snapshots share a day", () => {
    const morning = new Date("2026-04-09T09:00:00.000Z");
    expect(summaryPresetRange([at(1), morning, at(9)], "1D")).toEqual({
      start: at(9), end: at(9),
    });
  });
});
