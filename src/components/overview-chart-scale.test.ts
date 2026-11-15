import { expect, it } from "vitest";
import {
  bestDayLabelPosition, formatOverviewAxisTicks, formatOverviewDateTick, overlapsEndValue, pickDateTicks,
} from "./overview-chart-scale";

const day = 86_400_000;
const start = Date.UTC(2024, 0, 1, 12);

it.each([3, 31, 90, 365, 1000, 5000])("keeps %i daily dates readable at four plot widths", (count) => {
  const timestamps = Array.from({ length: count }, (_, index) => start + index * day);
  for (const plotWidthPx of [390, 820, 1100, 1440]) {
    for (const locale of ["en-GB", "zh-CN", "ja-JP"]) {
      const labels = timestamps.map((_, index) => formatOverviewDateTick(timestamps, index, locale));
      const labelWidthPx = Math.max(...labels.map((label) => label.length * 7 + 12));
      const picked = pickDateTicks({ timestamps, plotWidthPx, labelWidthPx, minGapPx: 16, locale });
      expect(picked[0]).toBe(0);
      expect(picked.at(-1)).toBe(count - 1);
      expect(new Set(picked.map((index) => labels[index])).size).toBe(picked.length);
      for (let position = 1; position < picked.length; position++) {
        expect((picked[position] - picked[position - 1]) / (count - 1) * plotWidthPx)
          .toBeGreaterThanOrEqual(labelWidthPx + 16);
      }
    }
  }
});

it("keeps the last date when first and last cannot both fit", () => {
  const timestamps = [start, start + day, start + 2 * day];
  expect(pickDateTicks({ timestamps, plotWidthPx: 30, labelWidthPx: 45, minGapPx: 16, locale: "en-GB" }))
    .toEqual([2]);
});

it("labels intraday points by time and avoids duplicate minutes", () => {
  const timestamps = [start, start + 10_000, start + 60_000, start + 3_600_000];
  const picked = pickDateTicks({ timestamps, plotWidthPx: 390, labelWidthPx: 47, minGapPx: 16, locale: "en-GB" });
  expect(picked).toContain(0);
  expect(picked).toContain(3);
  expect(new Set(picked.map((index) => formatOverviewDateTick(timestamps, index, "en-GB"))).size).toBe(picked.length);
  expect(formatOverviewDateTick(timestamps, 0, "en-GB")).toBe("12:00");
});

it("uses the requested date formats in English, Chinese, and Japanese", () => {
  const threeMonths = Array.from({ length: 91 }, (_, index) => start + index * day);
  expect(formatOverviewDateTick([start, start + 10 * day], 0, "en-GB")).toBe("Jan 1");
  expect(formatOverviewDateTick([start, start + 10 * day], 0, "zh-CN")).toBe("1月1日");
  expect(formatOverviewDateTick([start, start + 10 * day], 0, "ja-JP")).toBe("1月1日");
  expect(formatOverviewDateTick(threeMonths, 0, "en-GB")).toBe("Jan 2024");
  expect(formatOverviewDateTick(threeMonths, 31, "en-GB")).toBe("Feb");
  expect(formatOverviewDateTick(threeMonths, 31, "zh-CN")).toBe("2月");
});

it("prefers observed calendar boundaries with irregular timestamps", () => {
  const timestamps = [0, 1, 3, 7, 10, 14, 17, 21, 29].map((offset) => start + offset * day);
  const picked = pickDateTicks({ timestamps, plotWidthPx: 390, labelWidthPx: 46, minGapPx: 16, locale: "en-GB" });
  expect(picked).toContain(3);
  expect(picked).toContain(5);
  expect(picked).not.toContain(7); // the last label takes its space
});

it("spaces dates using wide label boxes as used beside JPY values", () => {
  const timestamps = Array.from({ length: 90 }, (_, index) => start + index * day);
  const picked = pickDateTicks({ timestamps, plotWidthPx: 390, labelWidthPx: 90, minGapPx: 16, locale: "ja-JP" });
  expect(picked.length).toBeLessThanOrEqual(4);
  expect(picked[0]).toBe(0);
  expect(picked.at(-1)).toBe(89);
});

it("places internal month labels on the first day during an 80-day span", () => {
  const first = Date.UTC(2026, 7, 28, 12);
  const timestamps = Array.from({ length: 80 }, (_, index) => first + index * day);
  const picked = pickDateTicks({ timestamps, plotWidthPx: 1050, labelWidthPx: 70, minGapPx: 16, locale: "en-GB" });
  expect(picked.slice(1, -1).map((index) => new Date(timestamps[index]).toISOString().slice(0, 10)))
    .toEqual(["2026-10-01"]);
});

it("skips a mid-month first observation when a month has no first-day point", () => {
  const timestamps = ["2026-08-20", "2026-09-03", "2026-10-01", "2026-11-07"]
    .map((date) => Date.parse(`${date}T12:00:00Z`));
  const picked = pickDateTicks({ timestamps, plotWidthPx: 1050, labelWidthPx: 70, minGapPx: 16, locale: "en-GB" });
  expect(picked).toEqual([0, 2, 3]);
});

it("hides a y tick inside the end tag's vertical clearance", () => {
  expect(overlapsEndValue(105, 100, 16)).toBe(true);
  expect(overlapsEndValue(119, 100, 16)).toBe(true);
  expect(overlapsEndValue(121, 100, 16)).toBe(false);
});

it("puts the best-day note left of its marker and above both lines", () => {
  expect(bestDayLabelPosition({
    left: 40, right: 360, top: 20, bottom: 180,
    markerX: 300, peakY: 100, dashedY: 80, labelWidth: 140, labelHeight: 16,
  })).toEqual({ x: 154, y: 58, width: 140 });
});

it("keeps the best-day note above an earlier high point under its full width", () => {
  const position = {
    left: 40, right: 360, top: 20, bottom: 180,
    markerX: 300, peakY: 100, dashedY: 80, labelWidth: 140, labelHeight: 16,
    linePoints: [{ x: 200, y: 60 }, { x: 300, y: 100 }],
  };
  expect(bestDayLabelPosition(position)).toEqual({ x: 154, y: 38, width: 140 });
});

it("flips the best-day note below the lines when the top has no room", () => {
  expect(bestDayLabelPosition({
    left: 40, right: 360, top: 20, bottom: 180,
    markerX: 60, peakY: 35, dashedY: 50, labelWidth: 140, labelHeight: 16,
  })).toEqual({ x: 66, y: 56, width: 140 });
});

it("uses the gap between the dashed line and the peak when the bottom is tight", () => {
  expect(bestDayLabelPosition({
    left: 40, right: 360, top: 20, bottom: 180,
    markerX: 300, peakY: 160, dashedY: 35, labelWidth: 140, labelHeight: 16,
  })).toEqual({ x: 154, y: 41, width: 140 });
});

it.each([
  [[1_690_000, 1_720_000, 1_750_000, 1_780_000, 1_810_000], ["1.69m", "1.72m", "1.75m", "1.78m", "1.81m"]],
  [[1_745_000, 1_747_500, 1_750_000, 1_752_500, 1_755_000], ["1.745m", "1.7475m", "1.75m", "1.7525m", "1.755m"]],
  [[900_000, 950_000, 1_000_000, 1_050_000, 1_100_000], ["0.9m", "0.95m", "1m", "1.05m", "1.1m"]],
  [[12_000, 12_250, 12_500, 12_750, 13_000], ["12k", "12.25k", "12.5k", "12.75k", "13k"]],
  [[950_000, 975_000, 1_000_000, 1_025_000], ["0.95m", "0.975m", "1m", "1.025m"]],
])("gives nearby Overview y-axis ticks distinct, accurate labels", (ticks, expected) => {
  expect(formatOverviewAxisTicks(ticks)).toEqual(expected);
});

it("keeps very small adjacent tick labels distinct", () => {
  expect(formatOverviewAxisTicks([1e-9, 2e-9])).toEqual(["1e-9", "2e-9"]);
});

it("keeps tiny ticks on either side of zero distinct", () => {
  expect(formatOverviewAxisTicks([-1e-9, 1e-9])).toEqual(["-1e-9", "1e-9"]);
});

it("uses scientific labels when decimal precision cannot distinguish the ticks", () => {
  expect(formatOverviewAxisTicks([1e-16, 2e-16])).toEqual(["1e-16", "2e-16"]);
});
