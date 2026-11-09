import { expect, it } from "vitest";
import { formatOverviewAxisTicks, shouldShowOverviewDateTick } from "./overview-chart-scale";

it("keeps the final date without crowding it with a nearby regular tick", () => {
  expect(shouldShowOverviewDateTick(30, 31)).toBe(true);
  expect(shouldShowOverviewDateTick(30, 33)).toBe(false);
  expect(shouldShowOverviewDateTick(32, 33)).toBe(true);
  expect(shouldShowOverviewDateTick(25, 33)).toBe(true);
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
